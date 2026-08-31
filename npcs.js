// ---------------------------------------------------------------------------
// NPC definitions
// ---------------------------------------------------------------------------

const NPC_DEFS = {
  village_elder: {
    id: "village_elder",
    name: "Village Elder",
    icon: "🧑‍🌾",
    spriteKind: "elder",
    intro: "Ah, a new face! I'm the Village Elder — I look after this little settlement. Good to meet you, traveler.",
    questIds: ["gather_wood"], // buildWorld() (world.js) appends the main quest here too
  },
  village_trader: {
    id: "village_trader",
    name: "Village Trader",
    icon: "🧑‍💼",
    spriteKind: "trader",
    intro: "Welcome, welcome! I'm the Village Trader — come back anytime you want to buy or sell.",
    shop: true,
  },
};

// npcId -> true once their intro (below) has been shown. Doubles as the data
// source for the "meet_villagers" quest objective (see quests.js) — no
// separate tracking needed.
let npcsMet = {};

// Clones an NPC under a new id (a later world's own elder) with its own
// quest list, starting empty. Mutates NPC_DEFS directly, same as
// registerBoss() mutates BOSS_DEFS.
function registerNPC(id, def) {
  NPC_DEFS[id] = { id, questIds: [], spriteKind: "elder", ...def };
  return NPC_DEFS[id];
}

// Single E-key entry point for any NPC, regardless of kind. The first
// interaction with any given NPC always shows their one-time introduction
// instead of their normal function — every interaction after that behaves
// as it always has (opens the shop, or opens quest dialogue).
function interactWithNPC(npcId) {
  const def = NPC_DEFS[npcId];
  if (!npcsMet[npcId]) {
    npcsMet[npcId] = true;
    const gatesJustOpened = checkVillageGatesQuest();
    if (def.intro) {
      const text = gatesJustOpened
        ? `${def.intro} The village gates creak open — you're free to explore the valley!`
        : def.intro;
      showMessage(def.name, text);
      return;
    }
  }
  if (def.shop) {
    if (isShopOpen()) closeShop();
    else openShop();
  } else if (def.questIds && def.questIds.length) {
    if (isDialogueOpen()) closeDialogue();
    else openDialogue(npcId);
  }
}
