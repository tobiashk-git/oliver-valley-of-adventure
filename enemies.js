// ---------------------------------------------------------------------------
// Enemy definitions
// ---------------------------------------------------------------------------

const ENEMY_DEFS = {
  dungeon_rat: {
    id: "dungeon_rat",
    name: "Dungeon Rat",
    icon: "🐀",
    sprite: "assets/lpc/enemies/rat.png",
    maxHp: 12,
    maxMp: 0,
    attack: 3,
    defense: 0,
    goldMin: 3,
    goldMax: 6,
    statusAttack: { status: "poison", chance: 0.25 },
  },
  cave_bat: {
    id: "cave_bat",
    name: "Cave Bat",
    icon: "🦇",
    sprite: "assets/lpc/enemies/bat.png",
    maxHp: 10,
    maxMp: 0,
    attack: 4,
    defense: 0,
    goldMin: 2,
    goldMax: 4,
    statusAttack: { status: "confusion", chance: 0.25 },
  },
  skeleton: {
    id: "skeleton",
    name: "Skeleton",
    icon: "💀",
    sprite: "assets/lpc/enemies/skeleton.png",
    maxHp: 18,
    maxMp: 4,
    attack: 4,
    defense: 2,
    goldMin: 8,
    goldMax: 12,
    statusAttack: { status: "paralysis", chance: 0.25 },
  },
  giant_spider: {
    id: "giant_spider",
    name: "Giant Spider",
    icon: "🕷️",
    sprite: "assets/lpc/enemies/spider.png",
    maxHp: 14,
    maxMp: 0,
    attack: 4,
    defense: 1,
    goldMin: 5,
    goldMax: 8,
    statusAttack: { status: "sleep", chance: 0.3 },
  },
  ghost: {
    id: "ghost",
    name: "Ghost",
    icon: "👻",
    sprite: "assets/lpc/enemies/ghost.png",
    maxHp: 10,
    maxMp: 6,
    attack: 3,
    defense: 0,
    goldMin: 6,
    goldMax: 10,
    statusAttack: { status: "silence", chance: 0.3 },
  },
};

// Reusable boss stat blocks — every world's guardians/final boss are cloned
// from these via registerBoss() (world.js) with a world-prefixed id, except
// World 1's own dungeon_boss/castle_boss below, which keep their original
// fixed ids (built straight from these same templates, so stats match).
const DUNGEON_GUARDIAN_TEMPLATE = {
  name: "Bone Lord",
  icon: "🧟",
  sprite: "assets/lpc/enemies/bone_lord.png",
  maxHp: 60,
  maxMp: 0,
  attack: 8,
  defense: 3,
  goldMin: 40,
  goldMax: 60,
  statusAttack: { status: "paralysis", chance: 0.2 },
  dropItemIds: ["bone_greatsword", "magic_crystal"],
};
const CASTLE_GUARDIAN_TEMPLATE = {
  name: "Royal Wraith",
  icon: "👑",
  sprite: "assets/lpc/enemies/royal_wraith.png",
  maxHp: 80,
  maxMp: 10,
  attack: 9,
  defense: 4,
  goldMin: 60,
  goldMax: 90,
  statusAttack: { status: "silence", chance: 0.25 },
  dropItemIds: ["royal_plate", "magic_crystal"],
};
const FINAL_BOSS_TEMPLATE = {
  name: "Shadow Sovereign",
  icon: "👹",
  sprite: "assets/lpc/enemies/shadow_sovereign.png",
  maxHp: 150,
  maxMp: 20,
  attack: 14,
  defense: 6,
  goldMin: 150,
  goldMax: 220,
  statusAttack: { status: "sleep", chance: 0.2 },
  dropItemIds: ["magic_crystal"],
};

// Fixed, checkpoint-style bosses — never picked by pickRandomEnemyDef()/
// pickEncounterGroup(), only fought via the boss tiles in game.js.
const BOSS_DEFS = {
  dungeon_boss: { id: "dungeon_boss", ...DUNGEON_GUARDIAN_TEMPLATE },
  castle_boss: { id: "castle_boss", ...CASTLE_GUARDIAN_TEMPLATE },
};

// Clones a boss template under a new id (e.g. a later world's own guardians),
// and makes sure it starts undefeated. Mutates BOSS_DEFS/bossDefeated
// directly since both are just plain objects other code already reads live.
function registerBoss(id, template) {
  BOSS_DEFS[id] = { id, ...template };
  if (!(id in bossDefeated)) bossDefeated[id] = false;
  return BOSS_DEFS[id];
}

function pickRandomEnemyDef() {
  const ids = Object.keys(ENEMY_DEFS);
  const id = ids[Math.floor(Math.random() * ids.length)];
  return ENEMY_DEFS[id];
}

// Weighted random group size (~60% solo, ~30% duo, ~10% trio), each slot an
// independent random pick — duplicates and mixed formations both happen naturally.
function pickEncounterGroup() {
  const roll = Math.random();
  const size = roll < 0.6 ? 1 : roll < 0.9 ? 2 : 3;
  const group = [];
  for (let i = 0; i < size; i++) group.push(pickRandomEnemyDef());
  return group;
}
