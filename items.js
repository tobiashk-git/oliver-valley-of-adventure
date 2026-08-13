// ---------------------------------------------------------------------------
// Item definitions and rarity tiers
// ---------------------------------------------------------------------------

const RARITY = {
  COMMON: { name: "Common", color: "#b0b0b0" },
  UNCOMMON: { name: "Uncommon", color: "#4caf50" },
  RARE: { name: "Rare", color: "#3a7bd5" },
  EPIC: { name: "Epic", color: "#a05acb" },
};

// type: "material" | "weapon" | "armor" | "accessory" | "consumable" | "currency"
const ITEM_DEFS = {
  wood: {
    id: "wood",
    name: "Wood",
    icon: "🌲",
    type: "material",
    rarity: "COMMON",
    stackable: true,
    maxStack: 99,
    value: 1,
  },
  stone: {
    id: "stone",
    name: "Stone",
    icon: "🪨",
    type: "material",
    rarity: "COMMON",
    stackable: true,
    maxStack: 99,
    value: 1,
  },
  wooden_pickaxe: {
    id: "wooden_pickaxe",
    name: "Wooden Pickaxe",
    icon: "⛏️",
    type: "weapon",
    rarity: "COMMON",
    stackable: false,
    maxStack: 1,
    attack: 2,
    value: 6,
  },
  sturdy_planks: {
    id: "sturdy_planks",
    name: "Sturdy Planks",
    icon: "🪵",
    type: "material",
    rarity: "UNCOMMON",
    stackable: true,
    maxStack: 99,
    value: 4,
  },
  ice: {
    id: "ice",
    name: "Ice",
    icon: "🧊",
    type: "material",
    rarity: "COMMON",
    stackable: true,
    maxStack: 99,
    value: 2,
  },
  cactus: {
    id: "cactus",
    name: "Cactus",
    icon: "🌵",
    type: "material",
    rarity: "COMMON",
    stackable: true,
    maxStack: 99,
    value: 2,
  },
  flower: {
    id: "flower",
    name: "Flower",
    icon: "🌸",
    type: "material",
    rarity: "COMMON",
    stackable: true,
    maxStack: 99,
    value: 2,
  },
  jewel: {
    id: "jewel",
    name: "Jewel",
    icon: "💎",
    type: "material",
    rarity: "RARE",
    stackable: true,
    maxStack: 99,
    value: 10,
  },
  gold: {
    id: "gold",
    name: "Gold",
    icon: "🪙",
    type: "currency",
    rarity: "UNCOMMON",
    stackable: true,
    maxStack: 999,
  },
  healing_potion: {
    id: "healing_potion",
    name: "Healing Potion",
    icon: "🧪",
    type: "consumable",
    rarity: "COMMON",
    stackable: true,
    maxStack: 20,
    effect: { kind: "heal", amount: 12 },
    value: 12,
  },
  mana_potion: {
    id: "mana_potion",
    name: "Mana Potion",
    icon: "🔮",
    type: "consumable",
    rarity: "UNCOMMON",
    stackable: true,
    maxStack: 20,
    effect: { kind: "restoreMp", amount: 6 },
    value: 15,
  },
  antidote: {
    id: "antidote",
    name: "Antidote",
    icon: "🌿",
    type: "consumable",
    rarity: "COMMON",
    stackable: true,
    maxStack: 20,
    effect: { kind: "cure", status: "poison" },
    value: 10,
  },
  leather_armor: {
    id: "leather_armor",
    name: "Leather Armor",
    icon: "🦺",
    type: "armor",
    rarity: "COMMON",
    stackable: false,
    maxStack: 1,
    defense: 3,
    value: 20,
  },
  charm_of_warding: {
    id: "charm_of_warding",
    name: "Charm of Warding",
    icon: "🧿",
    type: "accessory",
    rarity: "UNCOMMON",
    stackable: false,
    maxStack: 1,
    bonus: { statusResistance: 0.5 },
    value: 30,
  },
  bone_greatsword: {
    id: "bone_greatsword",
    name: "Bone Greatsword",
    icon: "🗡️",
    type: "weapon",
    rarity: "RARE",
    stackable: false,
    maxStack: 1,
    attack: 6,
    value: 90,
  },
  royal_plate: {
    id: "royal_plate",
    name: "Royal Plate",
    icon: "🛡️",
    type: "armor",
    rarity: "RARE",
    stackable: false,
    maxStack: 1,
    defense: 8,
    value: 100,
  },
  magic_crystal: {
    id: "magic_crystal",
    name: "Magic Crystal",
    icon: "🔷",
    type: "material",
    rarity: "EPIC",
    stackable: true,
    maxStack: 10,
    // deliberately no `value` — a quest item, not sellable (mirrors how
    // bone_greatsword/royal_plate are kept out of the shop's own stock list)
  },
  dungeon_key: {
    id: "dungeon_key",
    name: "Ancient Key",
    icon: "🗝️",
    type: "material",
    rarity: "RARE",
    stackable: true,
    maxStack: 5,
    // deliberately no `value` — a quest item, not sellable (see magic_crystal)
    foundMessage: {
      title: "Critical Item",
      text: "You found the Ancient Key! It should open the locked door guarding the final boss's chamber.",
    },
  },
};

function getItemDef(itemId) {
  return ITEM_DEFS[itemId] || null;
}

// Short "Stat +N" suffix for gear tooltips; "" for items with no combat stat.
function describeItemStats(def) {
  if (!def) return "";
  if (def.attack) return `Attack +${def.attack}`;
  if (def.defense) return `Defense +${def.defense}`;
  if (def.bonus) {
    return Object.entries(def.bonus)
      .map(([field, amount]) => {
        const label = field.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
        return `${label} +${Math.round(amount * 100)}%`;
      })
      .join(", ");
  }
  return "";
}
