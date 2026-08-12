// ---------------------------------------------------------------------------
// NPC definitions
// ---------------------------------------------------------------------------

const NPC_DEFS = {
  village_elder: {
    id: "village_elder",
    name: "Village Elder",
    icon: "🧑‍🌾",
    questId: "gather_wood",
  },
  village_trader: {
    id: "village_trader",
    name: "Village Trader",
    icon: "🧑‍💼",
    shop: true,
  },
};

// Single E-key entry point for any NPC, regardless of kind.
function interactWithNPC(npcId) {
  const def = NPC_DEFS[npcId];
  if (def.shop) {
    if (isShopOpen()) closeShop();
    else openShop();
  } else if (def.questId) {
    if (isDialogueOpen()) closeDialogue();
    else openDialogue(npcId);
  }
}
