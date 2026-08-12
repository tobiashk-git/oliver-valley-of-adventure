// ---------------------------------------------------------------------------
// NPC definitions
// ---------------------------------------------------------------------------

const NPC_DEFS = {
  village_elder: {
    id: "village_elder",
    name: "Village Elder",
    icon: "🧑‍🌾",
    questIds: ["gather_wood"], // buildWorld() (world.js) appends the main quest here too
  },
  village_trader: {
    id: "village_trader",
    name: "Village Trader",
    icon: "🧑‍💼",
    shop: true,
  },
};

// Clones an NPC under a new id (a later world's own elder) with its own
// quest list, starting empty. Mutates NPC_DEFS directly, same as
// registerBoss() mutates BOSS_DEFS.
function registerNPC(id, def) {
  NPC_DEFS[id] = { id, questIds: [], ...def };
  return NPC_DEFS[id];
}

// Single E-key entry point for any NPC, regardless of kind.
function interactWithNPC(npcId) {
  const def = NPC_DEFS[npcId];
  if (def.shop) {
    if (isShopOpen()) closeShop();
    else openShop();
  } else if (def.questIds && def.questIds.length) {
    if (isDialogueOpen()) closeDialogue();
    else openDialogue(npcId);
  }
}
