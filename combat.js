// ---------------------------------------------------------------------------
// Combat system: on-map encounter reveal, first-person battle, turn commands
// ---------------------------------------------------------------------------

const ENCOUNTER_CHANCE = 0.07; // per eligible dungeon-floor tile stepped on
const ENCOUNTER_COOLDOWN_STEPS = 4; // guaranteed safe steps after a fight ends
const ENCOUNTER_ENTRY_GRACE_STEPS = 6; // guaranteed safe steps after walking into the dungeon
const ENCOUNTER_FLASH_COUNT = 3;
const ENCOUNTER_FLASH_DURATION = 150; // ms, on and off each
const ENCOUNTER_DISAPPEAR_DURATION = 600; // ms
const VICTORY_PAUSE_DURATION = 500; // ms — lets a defeated enemy's HP bar visibly hit zero first
const TURN_PAUSE_DURATION = 700; // ms — gap between the player's action and the first enemy's retaliation
const ENEMY_STAGGER_DURATION = 450; // ms — gap between each subsequent attacking enemy within one enemy beat
const BASE_CRIT_CHANCE = 0.05;
const CRIT_CHANCE_PER_AGILITY = 0.01; // Agility now has a real combat effect
const ENEMY_CRIT_CHANCE = 0.05; // flat for now — tunable per-enemy later (e.g. bosses)
const CRIT_MULTIPLIER = 2;
const CRIT_BANNER_DURATION = 700; // ms
const MAX_ENEMY_SLOTS = 3;

let inCombat = false;
let currentEnemies = []; // up to MAX_ENEMY_SLOTS entries: { def, hp, mp, status } | null
let playerDefending = false;
let battleLog = [];
let awaitingVictoryPause = false; // an enemy is at 0 HP but hasn't been removed from its slot yet
let isResolvingTurn = false; // player has acted, waiting on the enemy beat to fully resolve
let stepsSinceEncounter = ENCOUNTER_COOLDOWN_STEPS; // ready to roll from the start
let activeSubmenu = null; // "magic" | "item" | null
let playerStatus = {}; // { poison: { turnsLeft }, ... } — reset whenever combat starts/ends
let selectingTarget = null; // { kind: "attack" } | { kind: "spell", spellId } | null
let currentBossId = null; // set for the duration of a boss fight, null during any random encounter

// Delays eligibility by `steps` new tiles from now (used so entering a fresh
// area — like walking into the dungeon — always gives a safe look-around first).
function armEncounterGracePeriod(steps) {
  stepsSinceEncounter = ENCOUNTER_COOLDOWN_STEPS - steps;
}

// encounterPhase: "idle" | "appearing" | "ready" | "fighting" | "disappearing"
let encounterPhase = "idle";
let encounterGroup = null; // array of enemy defs waiting to be confirmed into battle

function aliveEnemies() {
  const result = [];
  currentEnemies.forEach((enemy, index) => {
    if (enemy) result.push({ enemy, index });
  });
  return result;
}

function weaponAttackBonus() {
  const equipped = inventory.equipment.weapon;
  if (!equipped) return 0;
  const def = getItemDef(equipped.itemId);
  return (def && def.attack) || 0;
}

// Reads a `critBonus` field off the equipped weapon, if any — no items define
// one yet, but this is the hook for future gear/skills to raise crit chance.
function weaponCritBonus() {
  const equipped = inventory.equipment.weapon;
  if (!equipped) return 0;
  const def = getItemDef(equipped.itemId);
  return (def && def.critBonus) || 0;
}

function getCritChance() {
  return BASE_CRIT_CHANCE + character.stats.agility * CRIT_CHANCE_PER_AGILITY + weaponCritBonus();
}

function playerDefenseBonus() {
  const equipped = inventory.equipment.armor;
  if (!equipped) return 0;
  const def = getItemDef(equipped.itemId);
  return (def && def.defense) || 0;
}

function accessoryBonus(field) {
  const equipped = inventory.equipment.accessory;
  if (!equipped) return 0;
  const def = getItemDef(equipped.itemId);
  return (def && def.bonus && def.bonus[field]) || 0;
}

// Rolls a player damage hit, applying the crit multiplier if it lands.
// Returns { dmg, isCrit } so callers can log/animate the crit distinctly.
function resolvePlayerDamage(power, defense) {
  const isCrit = Math.random() < getCritChance();
  const base = physicalDamage(power, defense);
  const dmg = isCrit ? Math.round(base * CRIT_MULTIPLIER) : base;
  return { dmg, isCrit };
}

function logBattle(message) {
  battleLog.push(message);
  if (battleLog.length > 5) battleLog.shift();
}

// ---------------------------------------------------------------------------
// Status effects
// ---------------------------------------------------------------------------

function applyStatusToPlayer(statusId) {
  if (playerStatus[statusId]) return; // no stacking/refresh this pass
  const def = STATUS_DEFS[statusId];
  playerStatus[statusId] = { turnsLeft: def.duration };
  logBattle(`Oliver is afflicted with ${def.name}!`);
}

// Unreachable this pass (nothing inflicts status on enemies yet), but kept
// symmetric with applyStatusToPlayer so a future player spell/item just calls this.
function applyStatusToEnemy(index, statusId) {
  const enemy = currentEnemies[index];
  if (!enemy || enemy.status[statusId]) return;
  const def = STATUS_DEFS[statusId];
  enemy.status[statusId] = { turnsLeft: def.duration };
  logBattle(`${enemy.def.name} is afflicted with ${def.name}!`);
}

// Applies poison damage-over-time to `target` (character or an enemy instance), if any.
function tickStatusDamage(target, statusMap, label) {
  if (!statusMap.poison) return;
  const dmg = STATUS_DEFS.poison.dotDamage;
  target.hp = Math.max(0, target.hp - dmg);
  logBattle(`${label} takes ${dmg} poison damage!`);
}

// Decrements every active status's remaining turns by 1, removing any that expire.
function tickStatusDurations(statusMap, label) {
  for (const id of Object.keys(statusMap)) {
    statusMap[id].turnsLeft -= 1;
    if (statusMap[id].turnsLeft <= 0) {
      logBattle(`${label}'s ${STATUS_DEFS[id].name} wears off.`);
      delete statusMap[id];
    }
  }
}

function renderStatusBadges(containerId, statusMap) {
  const el = document.getElementById(containerId);
  const entries = Object.entries(statusMap);
  if (entries.length === 0) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = entries
    .map(([id, state]) => {
      const def = STATUS_DEFS[id];
      return `<span class="status-badge" title="${def.name} (${state.turnsLeft} left)">${def.icon}<span class="status-badge-count">${state.turnsLeft}</span></span>`;
    })
    .join("");
}

// Gate run at the start of every player-committing action (Attack/Defend/cast/use item).
// Ticks poison, then checks Sleep/Paralysis. Returns true if the action should proceed;
// if false, it has already resolved the turn as skipped (or handled defeat).
function beginPlayerTurn() {
  tickStatusDamage(character, playerStatus, "Oliver");
  if (character.hp <= 0) {
    handleDefeat();
    return false;
  }
  if (playerStatus.sleep) {
    logBattle("Oliver is fast asleep and can't act!");
    renderBattleScreen();
    proceedToEnemyTurns();
    return false;
  }
  if (playerStatus.paralysis && Math.random() >= STATUS_DEFS.paralysis.actChance) {
    logBattle("Oliver is paralyzed and can't move!");
    renderBattleScreen();
    proceedToEnemyTurns();
    return false;
  }
  return true;
}

function handleDefeat() {
  logBattle("Oliver was defeated...");
  character.hp = character.maxHp;
  character.mp = character.maxMp;
  playerStatus = {};
  activateLevel("overworld", overworldLevel.playerStart.x, overworldLevel.playerStart.y);
  endCombat();
  renderCharacterPanel();
}

function checkRandomEncounter() {
  if (inCombat) return;
  stepsSinceEncounter++;
  if (stepsSinceEncounter < ENCOUNTER_COOLDOWN_STEPS) return;
  if (Math.random() < ENCOUNTER_CHANCE) {
    stepsSinceEncounter = 0;
    beginEncounterAppearance();
  }
}

function joinNames(names) {
  if (names.length === 1) return `A ${names[0]}`;
  if (names.length === 2) return `A ${names[0]} and a ${names[1]}`;
  return `A ${names.slice(0, -1).join(", a ")}, and a ${names[names.length - 1]}`;
}

// Step 1: the enemy group appears on the dungeon map itself, the screen flashes,
// then an "Enter Combat" button appears once the player has taken it in.
function beginEncounterAppearance() {
  encounterGroup = pickEncounterGroup();
  encounterPhase = "appearing";
  inCombat = true; // freeze exploration movement/keys immediately

  const marker = document.getElementById("encounter-marker");
  marker.textContent = encounterGroup.map((def) => def.icon).join(" ");
  positionEncounterMarker();
  marker.className = "encounter-marker visible";

  const caption = document.getElementById("encounter-caption");
  caption.textContent = `${joinNames(encounterGroup.map((def) => def.name))} appear${encounterGroup.length === 1 ? "s" : ""}!`;
  caption.classList.add("visible");

  runFlashSequence(ENCOUNTER_FLASH_COUNT);
}

function positionEncounterMarker() {
  const camX = Math.round(Math.max(0, Math.min(MAP_W * TILE - VIEW_W, player.x - VIEW_W / 2)));
  const camY = Math.round(Math.max(0, Math.min(MAP_H * TILE - VIEW_H, player.y - VIEW_H / 2)));
  const marker = document.getElementById("encounter-marker");
  marker.style.left = `${player.x - camX}px`;
  marker.style.top = `${player.y - camY - 16}px`;
}

function runFlashSequence(remaining) {
  if (remaining <= 0) {
    encounterPhase = "ready";
    document.getElementById("encounter-enter-btn").classList.add("visible");
    return;
  }
  const flashEl = document.getElementById("encounter-flash");
  flashEl.classList.add("flash-on");
  setTimeout(() => {
    flashEl.classList.remove("flash-on");
    setTimeout(() => runFlashSequence(remaining - 1), ENCOUNTER_FLASH_DURATION);
  }, ENCOUNTER_FLASH_DURATION);
}

// Step 2: player confirms and the first-person battle screen opens.
function enterCombatFromEncounter() {
  if (encounterPhase !== "ready") return;
  document.getElementById("encounter-enter-btn").classList.remove("visible");
  encounterPhase = "fighting";
  startCombat(encounterGroup);
}

// Fixed boss fight: the player already deliberately walked up and pressed E,
// so unlike a random encounter there's no flash/marker/Enter-Combat build-up —
// the battle screen opens immediately, same as opening a chest is instant.
function startBossFight(bossId) {
  if (inCombat) return;
  const def = BOSS_DEFS[bossId];
  if (!def) return;
  currentBossId = bossId;
  startCombat([def]);
}

// Victory-only: marks the boss as permanently defeated (the checkpoint) and
// closes out combat. No on-map marker to animate away, unlike finishEncounter().
function finishBossFight() {
  document.getElementById("battle-screen").classList.remove("open");
  currentEnemies = [];
  if (currentBossId) bossDefeated[currentBossId] = true;
  currentBossId = null;
  inCombat = false;
  playerStatus = {};
  selectingTarget = null;
}

// Continue-button handler shared by both fight types: bosses skip the
// disappearing-marker animation that random encounters play.
function handleVictoryContinue() {
  if (currentBossId) {
    finishBossFight();
  } else {
    finishEncounter("victory");
  }
}

function startCombat(group) {
  const defs = group || [pickRandomEnemyDef()];
  currentEnemies = defs.map((def) => ({ def, hp: def.maxHp, mp: def.maxMp, status: {} }));
  inCombat = true;
  playerDefending = false;
  activeSubmenu = null;
  selectingTarget = null;
  isResolvingTurn = false;
  playerStatus = {};
  battleLog = [`${joinNames(defs.map((def) => def.name))} appear${defs.length === 1 ? "s" : ""}!`];
  document.getElementById("battle-screen").classList.add("open");
  renderBattleScreen();
}

function flashEnemyHit(index, isCrit) {
  const el = document.getElementById(`battle-enemy-icon-${index}`);
  el.classList.remove("icon-hit-flash", "icon-crit-flash");
  void el.offsetWidth; // restart the CSS animation even if it's already mid-flash
  el.classList.add(isCrit ? "icon-crit-flash" : "icon-hit-flash");
  if (isCrit) showCritBanner();
}

function showCritBanner() {
  const el = document.getElementById("battle-crit-banner");
  el.classList.remove("visible");
  void el.offsetWidth;
  el.classList.add("visible");
  setTimeout(() => el.classList.remove("visible"), CRIT_BANNER_DURATION);
}

function flashPlayerHit(isCrit) {
  const el = document.getElementById("battle-status");
  el.classList.remove("panel-hit-flash", "panel-crit-flash");
  void el.offsetWidth;
  el.classList.add(isCrit ? "panel-crit-flash" : "panel-hit-flash");
  if (isCrit) showCritBanner();
}

// Runs after the player's beat has rendered: pauses, then resolves each living
// enemy's retaliation in its own staggered beat so every hit reads distinctly.
function proceedToEnemyTurns() {
  const order = currentEnemies.map((e, i) => (e ? i : null)).filter((i) => i !== null);
  runEnemyTurnsSequentially(order, 0);
}

function runEnemyTurnsSequentially(order, step) {
  setTimeout(
    () => {
      if (step >= order.length) {
        tickStatusDurations(playerStatus, "Oliver");
        currentEnemies.forEach((e) => e && tickStatusDurations(e.status, e.def.name));
        isResolvingTurn = false;
        renderBattleScreen();
        return;
      }
      const index = order[step];
      const enemy = currentEnemies[index];
      const stillAlive = !enemy || resolveSingleEnemyTurn(index);
      if (stillAlive === false) return; // player was defeated — handleDefeat() already exited combat
      runEnemyTurnsSequentially(order, step + 1);
    },
    step === 0 ? TURN_PAUSE_DURATION : ENEMY_STAGGER_DURATION
  );
}

// Defeat path: leaving the dungeon entirely, so no on-map animation — just reset.
function endCombat() {
  document.getElementById("battle-screen").classList.remove("open");
  inCombat = false;
  currentEnemies = [];
  activeSubmenu = null;
  selectingTarget = null;
  playerStatus = {};
  currentBossId = null;
  encounterPhase = "idle";
  encounterGroup = null;
  document.getElementById("encounter-marker").className = "encounter-marker";
  document.getElementById("encounter-enter-btn").classList.remove("visible");
  document.getElementById("encounter-caption").classList.remove("visible");
}

// Victory/Run path: close the battle screen, return to the dungeon map, and
// (on victory) play the enemy's disappearing animation before releasing control.
function finishEncounter(outcome) {
  document.getElementById("battle-screen").classList.remove("open");
  currentEnemies = [];

  if (outcome === "victory") {
    encounterPhase = "disappearing";
    const marker = document.getElementById("encounter-marker");
    marker.className = "encounter-marker disappearing";
    setTimeout(clearEncounter, ENCOUNTER_DISAPPEAR_DURATION);
  } else {
    clearEncounter();
  }
}

function clearEncounter() {
  encounterPhase = "idle";
  encounterGroup = null;
  inCombat = false;
  playerStatus = {};
  selectingTarget = null;
  currentBossId = null;
  document.getElementById("encounter-marker").className = "encounter-marker";
  document.getElementById("encounter-caption").classList.remove("visible");
}

function physicalDamage(power, defense) {
  const base = power - defense;
  const variance = base * (Math.random() * 0.3 - 0.15);
  return Math.max(1, Math.round(base + variance));
}

// One enemy's retaliation. Returns false if the player was defeated.
function resolveSingleEnemyTurn(index) {
  const enemy = currentEnemies[index];
  if (!enemy) return true;

  tickStatusDamage(enemy, enemy.status, enemy.def.name);
  if (checkEnemyDefeat(index)) return true; // poison alone finished it off — no attack this round

  if (enemy.status.sleep) {
    logBattle(`${enemy.def.name} is fast asleep!`);
    return true;
  }
  if (enemy.status.paralysis && Math.random() >= STATUS_DEFS.paralysis.actChance) {
    logBattle(`${enemy.def.name} is paralyzed and can't move!`);
    return true;
  }

  const isCrit = Math.random() < ENEMY_CRIT_CHANCE;
  let dmg = physicalDamage(enemy.def.attack, playerDefenseBonus());
  if (isCrit) dmg = Math.round(dmg * CRIT_MULTIPLIER);
  if (playerDefending) dmg = Math.max(1, Math.floor(dmg / 2));
  const wasAsleep = !!playerStatus.sleep;
  character.hp = Math.max(0, character.hp - dmg);
  logBattle(
    isCrit
      ? `Critical hit! ${enemy.def.name} attacks Oliver for ${dmg} damage!`
      : `${enemy.def.name} attacks Oliver for ${dmg} damage!`
  );
  flashPlayerHit(isCrit);

  if (wasAsleep) {
    delete playerStatus.sleep;
    logBattle("Oliver wakes up!");
  }

  if (character.hp <= 0) {
    handleDefeat();
    return false;
  }

  if (enemy.def.statusAttack) {
    const chance = enemy.def.statusAttack.chance * (1 - accessoryBonus("statusResistance"));
    if (Math.random() < chance) applyStatusToPlayer(enemy.def.statusAttack.status);
  }

  return true;
}

// Handles one enemy dropping to 0 HP: drains its bar, pauses, grants its gold,
// and removes it from its slot. If that empties the whole group, shows Victory.
// `onResolved(groupCleared)` fires once the pause completes and the slot has
// actually been nulled — callers that need to know "is the fight over" must
// wait for this rather than checking synchronously, since the removal is delayed.
function checkEnemyDefeat(index, onResolved) {
  const enemy = currentEnemies[index];
  if (!enemy || enemy.hp > 0) return false;
  awaitingVictoryPause = true;
  renderBattleScreen(); // show this slot's HP bar fully drained before it's removed
  setTimeout(() => {
    const def = enemy.def;
    const gold = def.goldMin + Math.floor(Math.random() * (def.goldMax - def.goldMin + 1));
    addItem("gold", gold);
    let msg = `${def.name} defeated! Found ${gold} gold.`;
    if (def.dropItemId) {
      addItem(def.dropItemId, 1);
      msg += ` Obtained ${getItemDef(def.dropItemId).name}!`;
    }
    refreshHud();
    logBattle(msg);
    currentEnemies[index] = null;
    awaitingVictoryPause = false;
    const groupCleared = aliveEnemies().length === 0;
    if (groupCleared) isResolvingTurn = false;
    renderBattleScreen();
    if (onResolved) onResolved(groupCleared);
  }, VICTORY_PAUSE_DURATION);
  return true;
}

function playerAttack() {
  if (!inCombat || aliveEnemies().length === 0 || awaitingVictoryPause || isResolvingTurn) return;
  isResolvingTurn = true;
  activeSubmenu = null;
  if (!beginPlayerTurn()) return;
  playerDefending = false;

  if (playerStatus.confusion && Math.random() < STATUS_DEFS.confusion.selfHitChance) {
    const power = character.stats.strength * 2 + weaponAttackBonus();
    const { dmg } = resolvePlayerDamage(power, 0);
    character.hp = Math.max(0, character.hp - dmg);
    logBattle(`Oliver is confused and hits himself for ${dmg} damage!`);
    flashPlayerHit(false);
    renderBattleScreen();
    if (character.hp <= 0) {
      handleDefeat();
      isResolvingTurn = false;
      return;
    }
    proceedToEnemyTurns();
    return;
  }

  const alive = aliveEnemies();
  if (alive.length === 1) {
    resolveAttackOnTarget(alive[0].index);
  } else {
    selectingTarget = { kind: "attack" };
    renderBattleScreen();
  }
}

function resolveAttackOnTarget(index) {
  const enemy = currentEnemies[index];
  const power = character.stats.strength * 2 + weaponAttackBonus();
  const { dmg, isCrit } = resolvePlayerDamage(power, enemy.def.defense);
  enemy.hp = Math.max(0, enemy.hp - dmg);
  logBattle(
    isCrit
      ? `Critical hit! Oliver attacks ${enemy.def.name} for ${dmg} damage!`
      : `Oliver attacks ${enemy.def.name} for ${dmg} damage!`
  );
  flashEnemyHit(index, isCrit);
  renderBattleScreen();

  const died = checkEnemyDefeat(index, (groupCleared) => {
    if (!groupCleared) proceedToEnemyTurns();
  });
  if (!died) proceedToEnemyTurns();
}

// Click handler for a `.battle-enemy-slot` — only does anything while a target
// is being chosen (2+ enemies were alive when Attack/a damage spell was picked).
function selectTarget(index) {
  if (!selectingTarget || !currentEnemies[index]) return;
  const action = selectingTarget;
  selectingTarget = null;
  if (action.kind === "attack") {
    resolveAttackOnTarget(index);
  } else if (action.kind === "spell") {
    resolveSpellOnTarget(action.spellId, index);
  }
}

function openMagicMenu() {
  if (!inCombat || aliveEnemies().length === 0 || awaitingVictoryPause || isResolvingTurn) return;
  if (playerStatus.silence) {
    logBattle("Oliver is silenced and cannot cast spells!");
    renderBattleScreen();
    return;
  }
  activeSubmenu = "magic";
  renderBattleScreen();
}

function openItemMenu() {
  if (!inCombat || aliveEnemies().length === 0 || awaitingVictoryPause || isResolvingTurn) return;
  activeSubmenu = "item";
  renderBattleScreen();
}

function closeSubmenu() {
  activeSubmenu = null;
  renderBattleScreen();
}

function castSpell(spellId) {
  if (!inCombat || aliveEnemies().length === 0 || awaitingVictoryPause || isResolvingTurn) return;
  const spell = SPELL_DEFS[spellId];
  if (!spell || character.mp < spell.mpCost) return;
  isResolvingTurn = true;
  activeSubmenu = null;
  if (!beginPlayerTurn()) return;
  playerDefending = false;
  character.mp -= spell.mpCost;

  if (spell.kind === "damage") {
    const alive = aliveEnemies();
    if (alive.length === 1) {
      resolveSpellOnTarget(spellId, alive[0].index);
    } else {
      selectingTarget = { kind: "spell", spellId };
      renderBattleScreen();
    }
  } else if (spell.kind === "heal") {
    const healed = Math.min(spell.power, character.maxHp - character.hp);
    character.hp += healed;
    logBattle(`Oliver casts ${spell.name} and recovers ${healed} HP!`);
    renderBattleScreen();
    proceedToEnemyTurns();
  }
}

function resolveSpellOnTarget(spellId, index) {
  const spell = SPELL_DEFS[spellId];
  const enemy = currentEnemies[index];
  const { dmg, isCrit } = resolvePlayerDamage(spell.power, 0);
  enemy.hp = Math.max(0, enemy.hp - dmg);
  logBattle(
    isCrit
      ? `Critical hit! Oliver casts ${spell.name} on ${enemy.def.name} for ${dmg} damage!`
      : `Oliver casts ${spell.name} on ${enemy.def.name} for ${dmg} damage!`
  );
  flashEnemyHit(index, isCrit);
  renderBattleScreen();

  const died = checkEnemyDefeat(index, (groupCleared) => {
    if (!groupCleared) proceedToEnemyTurns();
  });
  if (!died) proceedToEnemyTurns();
}

function useItem(itemId) {
  if (!inCombat || aliveEnemies().length === 0 || awaitingVictoryPause || isResolvingTurn) return;
  if (getItemCount(itemId) <= 0) return;
  const def = getItemDef(itemId);
  if (!def || !def.effect) return;
  isResolvingTurn = true;
  activeSubmenu = null;
  if (!beginPlayerTurn()) return;
  playerDefending = false;
  removeItem(itemId, 1);

  if (def.effect.kind === "heal") {
    const healed = Math.min(def.effect.amount, character.maxHp - character.hp);
    character.hp += healed;
    logBattle(`Oliver uses ${def.name} and recovers ${healed} HP!`);
  } else if (def.effect.kind === "restoreMp") {
    const restored = Math.min(def.effect.amount, character.maxMp - character.mp);
    character.mp += restored;
    logBattle(`Oliver uses ${def.name} and recovers ${restored} MP!`);
  } else if (def.effect.kind === "cure") {
    if (playerStatus[def.effect.status]) {
      const statusName = STATUS_DEFS[def.effect.status].name;
      delete playerStatus[def.effect.status];
      logBattle(`Oliver uses ${def.name} and cures ${statusName}!`);
    } else {
      logBattle(`Oliver uses ${def.name}, but wasn't affected.`);
    }
  }
  refreshHud();
  renderBattleScreen();
  proceedToEnemyTurns();
}

function playerDefend() {
  if (!inCombat || aliveEnemies().length === 0 || awaitingVictoryPause || isResolvingTurn) return;
  isResolvingTurn = true;
  activeSubmenu = null;
  if (!beginPlayerTurn()) return;
  playerDefending = true;
  logBattle("Oliver braces for the next attack.");
  renderBattleScreen();
  proceedToEnemyTurns();
}

function playerRun() {
  if (!inCombat || awaitingVictoryPause || isResolvingTurn) return;
  logBattle("Oliver flees the battle!");
  finishEncounter("run");
}

function renderBattleScreen() {
  const alive = aliveEnemies();
  const hasEnemies = alive.length > 0;

  for (let i = 0; i < MAX_ENEMY_SLOTS; i++) {
    const enemy = currentEnemies[i];
    const slotEl = document.getElementById(`battle-enemy-slot-${i}`);
    slotEl.style.display = enemy ? "flex" : "none";
    slotEl.classList.toggle("targetable", !!(selectingTarget && enemy));
    slotEl.classList.toggle("boss", !!(currentBossId && enemy));
    if (!enemy) continue;

    const hpPct = Math.max(0, (enemy.hp / enemy.def.maxHp) * 100);
    const maxMp = enemy.def.maxMp;
    const mpPct = maxMp > 0 ? Math.max(0, (enemy.mp / maxMp) * 100) : 0;
    document.getElementById(`battle-enemy-icon-${i}`).textContent = enemy.def.icon;
    document.getElementById(`battle-enemy-name-${i}`).textContent = enemy.def.name;
    document.getElementById(`battle-enemy-hp-bar-${i}`).style.width = `${hpPct}%`;
    document.getElementById(`battle-enemy-hp-text-${i}`).textContent = `${enemy.hp} / ${enemy.def.maxHp}`;
    document.getElementById(`battle-enemy-mp-bar-${i}`).style.width = `${mpPct}%`;
    document.getElementById(`battle-enemy-mp-text-${i}`).textContent = `${enemy.mp} / ${maxMp}`;
    renderStatusBadges(`battle-enemy-statuses-${i}`, enemy.status);
  }

  document.getElementById("battle-victory-label").style.display = hasEnemies ? "none" : "block";
  document.getElementById("battle-victory-label").textContent = "Victory!";

  document.getElementById("battle-hp-bar").style.width = `${(character.hp / character.maxHp) * 100}%`;
  document.getElementById("battle-hp-text").textContent = `${character.hp} / ${character.maxHp}`;
  document.getElementById("battle-mp-bar").style.width = `${(character.mp / character.maxMp) * 100}%`;
  document.getElementById("battle-mp-text").textContent = `${character.mp} / ${character.maxMp}`;
  renderStatusBadges("battle-player-statuses", playerStatus);

  document.getElementById("battle-log").innerHTML = battleLog.map((line) => `<div>${line}</div>`).join("");

  const inBattle = hasEnemies && !awaitingVictoryPause && !isResolvingTurn && !selectingTarget;
  document.getElementById("battle-attack-btn").disabled = !inBattle;
  document.getElementById("battle-magic-btn").disabled = !inBattle;
  document.getElementById("battle-item-btn").disabled = !inBattle;
  document.getElementById("battle-defend-btn").disabled = !inBattle;
  document.getElementById("battle-run-btn").disabled = !inBattle || !!selectingTarget;

  const continueBtn = document.getElementById("battle-continue-btn");
  continueBtn.style.display = !hasEnemies ? "block" : "none";

  renderSubmenu();
}

function renderSubmenu() {
  const commandsEl = document.getElementById("battle-commands");
  const submenuEl = document.getElementById("battle-submenu");

  if (!activeSubmenu || aliveEnemies().length === 0 || awaitingVictoryPause) {
    commandsEl.style.display = "grid";
    submenuEl.style.display = "none";
    submenuEl.innerHTML = "";
    return;
  }

  commandsEl.style.display = "none";
  submenuEl.style.display = "flex";

  let rowsHtml = "";
  if (activeSubmenu === "magic") {
    rowsHtml = Object.values(SPELL_DEFS)
      .map((spell) => {
        const disabled = character.mp < spell.mpCost;
        return `<button class="submenu-row" data-spell="${spell.id}"${disabled ? " disabled" : ""}>
          <span class="submenu-icon">${spell.icon}</span>
          <span class="submenu-name">${spell.name}</span>
          <span class="submenu-detail">${spell.mpCost} MP</span>
        </button>`;
      })
      .join("");
  } else if (activeSubmenu === "item") {
    const usable = Object.values(ITEM_DEFS).filter((def) => def.type === "consumable" && getItemCount(def.id) > 0);
    rowsHtml =
      usable.length === 0
        ? `<div class="submenu-empty">No usable items.</div>`
        : usable
            .map(
              (def) => `<button class="submenu-row" data-item="${def.id}">
          <span class="submenu-icon">${def.icon}</span>
          <span class="submenu-name">${def.name}</span>
          <span class="submenu-detail">&times;${getItemCount(def.id)}</span>
        </button>`
            )
            .join("");
  }

  submenuEl.innerHTML = rowsHtml + `<button id="battle-submenu-back" class="craft-btn submenu-back">Back</button>`;

  submenuEl.querySelectorAll("[data-spell]").forEach((btn) => {
    btn.addEventListener("click", () => castSpell(btn.dataset.spell));
  });
  submenuEl.querySelectorAll("[data-item]").forEach((btn) => {
    btn.addEventListener("click", () => useItem(btn.dataset.item));
  });
  document.getElementById("battle-submenu-back").addEventListener("click", closeSubmenu);
}

document.getElementById("encounter-enter-btn").addEventListener("click", enterCombatFromEncounter);
document.getElementById("battle-attack-btn").addEventListener("click", playerAttack);
document.getElementById("battle-magic-btn").addEventListener("click", openMagicMenu);
document.getElementById("battle-item-btn").addEventListener("click", openItemMenu);
document.getElementById("battle-defend-btn").addEventListener("click", playerDefend);
document.getElementById("battle-run-btn").addEventListener("click", playerRun);
document.getElementById("battle-continue-btn").addEventListener("click", handleVictoryContinue);
for (let i = 0; i < MAX_ENEMY_SLOTS; i++) {
  document.getElementById(`battle-enemy-slot-${i}`).addEventListener("click", () => selectTarget(i));
}
