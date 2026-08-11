// ---------------------------------------------------------------------------
// Enemy definitions
// ---------------------------------------------------------------------------

const ENEMY_DEFS = {
  dungeon_rat: {
    id: "dungeon_rat",
    name: "Dungeon Rat",
    icon: "🐀",
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
    maxHp: 10,
    maxMp: 6,
    attack: 3,
    defense: 0,
    goldMin: 6,
    goldMax: 10,
    statusAttack: { status: "silence", chance: 0.3 },
  },
};

// Fixed, checkpoint-style bosses — never picked by pickRandomEnemyDef()/
// pickEncounterGroup(), only fought via the boss tiles in game.js.
const BOSS_DEFS = {
  dungeon_boss: {
    id: "dungeon_boss",
    name: "Bone Lord",
    icon: "🧟",
    maxHp: 60,
    maxMp: 0,
    attack: 8,
    defense: 3,
    goldMin: 40,
    goldMax: 60,
    statusAttack: { status: "paralysis", chance: 0.2 },
    dropItemId: "bone_greatsword",
  },
  castle_boss: {
    id: "castle_boss",
    name: "Royal Wraith",
    icon: "👑",
    maxHp: 80,
    maxMp: 10,
    attack: 9,
    defense: 4,
    goldMin: 60,
    goldMax: 90,
    statusAttack: { status: "silence", chance: 0.25 },
    dropItemId: "royal_plate",
  },
};

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
