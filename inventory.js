// ---------------------------------------------------------------------------
// Inventory system: item slots + equipment slots
// ---------------------------------------------------------------------------

const INVENTORY_SLOT_COUNT = 20;

const inventory = {
  slots: new Array(INVENTORY_SLOT_COUNT).fill(null), // {itemId, amount} | null
  equipment: {
    weapon: null, // {itemId} | null
    armor: null,
    accessory: null,
  },
};

// Adds `amount` of itemId to inventory, stacking where possible.
// Returns the amount that could not be added (0 = fully added).
function addItem(itemId, amount) {
  return addToSlots(inventory.slots, itemId, amount);
}

// Removes up to `amount` of itemId from inventory. Returns the amount actually removed.
function removeItem(itemId, amount) {
  return removeFromSlots(inventory.slots, itemId, amount);
}

function getItemCount(itemId) {
  return countInSlots(inventory.slots, itemId);
}

const EQUIPPABLE_TYPES = ["weapon", "armor", "accessory"];
const USABLE_OUTSIDE_COMBAT_KINDS = ["heal", "restoreMp"];

// Consumes a healing/mana item straight from the inventory while exploring
// (combat has its own turn-based Item flow via useItem() in combat.js).
function useItemOutOfCombat(slotIndex) {
  if (inCombat) return;
  const slot = inventory.slots[slotIndex];
  if (!slot) return;
  const def = getItemDef(slot.itemId);
  if (!def || !def.effect || !USABLE_OUTSIDE_COMBAT_KINDS.includes(def.effect.kind)) return;

  if (def.effect.kind === "heal") {
    character.hp = Math.min(character.maxHp, character.hp + def.effect.amount);
  } else if (def.effect.kind === "restoreMp") {
    character.mp = Math.min(character.maxMp, character.mp + def.effect.amount);
  }
  removeItem(slot.itemId, 1);

  renderCharacterPanel();
  refreshHud();
  renderInventoryPanel();
}

function equipFromSlot(slotIndex) {
  const slot = inventory.slots[slotIndex];
  if (!slot) return;
  const def = getItemDef(slot.itemId);
  if (!EQUIPPABLE_TYPES.includes(def.type)) return;

  const previous = inventory.equipment[def.type];
  removeItem(slot.itemId, 1);
  inventory.equipment[def.type] = { itemId: slot.itemId };
  if (previous) addItem(previous.itemId, 1);

  renderInventoryPanel();
}

function unequipSlot(slotName) {
  const equipped = inventory.equipment[slotName];
  if (!equipped) return;
  const notAdded = addItem(equipped.itemId, 1);
  if (notAdded > 0) return; // backpack full, leave it equipped

  inventory.equipment[slotName] = null;
  renderInventoryPanel();
}

function renderInventoryPanel() {
  const grid = document.getElementById("inv-grid");
  grid.innerHTML = "";

  inventory.slots.forEach((slot, index) => {
    const cell = document.createElement("div");
    cell.className = "inv-slot";
    if (slot) {
      const def = getItemDef(slot.itemId);
      const rarity = RARITY[def.rarity];
      cell.style.borderColor = rarity.color;
      const stats = describeItemStats(def);
      const usable = def.effect && USABLE_OUTSIDE_COMBAT_KINDS.includes(def.effect.kind);
      let title = stats ? `${def.name} (${rarity.name}) — ${stats}` : `${def.name} (${rarity.name})`;
      if (usable) title += " (Click to use)";
      cell.title = title;
      cell.innerHTML = `<span class="inv-icon">${def.icon}</span><span class="inv-amount">${slot.amount}</span>`;
      if (EQUIPPABLE_TYPES.includes(def.type)) {
        cell.addEventListener("click", () => equipFromSlot(index));
      } else if (usable) {
        cell.addEventListener("click", () => useItemOutOfCombat(index));
      }
    }
    grid.appendChild(cell);
  });

  for (const slotName of EQUIPPABLE_TYPES) {
    const el = document.getElementById(`equip-${slotName}`);
    const equipped = inventory.equipment[slotName];
    if (equipped) {
      const def = getItemDef(equipped.itemId);
      el.innerHTML = `<span class="inv-icon">${def.icon}</span>`;
      const stats = describeItemStats(def);
      el.title = stats ? `${def.name} — ${stats}` : def.name;
    } else {
      el.innerHTML = `<span class="equip-label">${slotName}</span>`;
      el.title = "Empty";
    }
  }
}

for (const slotName of EQUIPPABLE_TYPES) {
  document.getElementById(`equip-${slotName}`).addEventListener("click", () => unequipSlot(slotName));
}
