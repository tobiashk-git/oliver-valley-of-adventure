// ---------------------------------------------------------------------------
// Generic slot-array operations shared by inventory and storage containers
// ---------------------------------------------------------------------------

// Adds `amount` of itemId into `slots`, stacking where possible.
// Returns the amount that could not be added (0 = fully added).
function addToSlots(slots, itemId, amount) {
  const def = getItemDef(itemId);
  if (!def) return amount;

  let remaining = amount;

  if (def.stackable) {
    for (const slot of slots) {
      if (remaining <= 0) break;
      if (slot && slot.itemId === itemId && slot.amount < def.maxStack) {
        const space = def.maxStack - slot.amount;
        const add = Math.min(space, remaining);
        slot.amount += add;
        remaining -= add;
      }
    }
  }

  while (remaining > 0) {
    const emptyIndex = slots.findIndex((s) => s === null);
    if (emptyIndex === -1) break; // container full
    const add = def.stackable ? Math.min(def.maxStack, remaining) : 1;
    slots[emptyIndex] = { itemId, amount: add };
    remaining -= add;
  }

  return remaining;
}

// Removes up to `amount` of itemId from `slots`. Returns the amount actually removed.
function removeFromSlots(slots, itemId, amount) {
  let remaining = amount;
  for (let i = 0; i < slots.length && remaining > 0; i++) {
    const slot = slots[i];
    if (slot && slot.itemId === itemId) {
      const take = Math.min(slot.amount, remaining);
      slot.amount -= take;
      remaining -= take;
      if (slot.amount <= 0) slots[i] = null;
    }
  }
  return amount - remaining;
}

function countInSlots(slots, itemId) {
  return slots.reduce((sum, slot) => (slot && slot.itemId === itemId ? sum + slot.amount : sum), 0);
}

const RARITY_ORDER = Object.keys(RARITY);

function sortSlots(slots) {
  const items = slots.filter((s) => s !== null);
  items.sort((a, b) => {
    const defA = getItemDef(a.itemId);
    const defB = getItemDef(b.itemId);
    const rarityDiff = RARITY_ORDER.indexOf(defA.rarity) - RARITY_ORDER.indexOf(defB.rarity);
    if (rarityDiff !== 0) return rarityDiff;
    return defA.name.localeCompare(defB.name);
  });
  for (let i = 0; i < slots.length; i++) {
    slots[i] = items[i] || null;
  }
}

// Moves the whole stack at fromSlots[fromIndex] into toSlots, stacking/filling as space allows.
// Leftover (if toSlots doesn't have room) stays behind in fromSlots.
function transferSlot(fromSlots, toSlots, fromIndex) {
  const slot = fromSlots[fromIndex];
  if (!slot) return;

  const notAdded = addToSlots(toSlots, slot.itemId, slot.amount);
  const moved = slot.amount - notAdded;
  if (moved <= 0) return;

  fromSlots[fromIndex] = notAdded > 0 ? { itemId: slot.itemId, amount: notAdded } : null;
}
