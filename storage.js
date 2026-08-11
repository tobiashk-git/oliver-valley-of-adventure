// ---------------------------------------------------------------------------
// Storage system: chests/stashes with capacity upgrades, sorting, filtering
// ---------------------------------------------------------------------------

const BASE_STORAGE_SLOTS = 10;

const CAPACITY_TIERS = [
  { cost: { wood: 10, stone: 5 }, addSlots: 10 },
  { cost: { wood: 25, stone: 15 }, addSlots: 10 },
  { cost: { wood: 50, stone: 30 }, addSlots: 10 },
];

const storages = {
  house_chest: {
    name: "House Chest",
    slots: new Array(BASE_STORAGE_SLOTS).fill(null),
    tier: 0,
  },
};

// Registers a new storage container pre-loaded with an item (e.g. a dungeon/castle gold chest).
function createFilledStorage(id, name, slotCount, itemId, amount) {
  const slots = new Array(slotCount).fill(null);
  addToSlots(slots, itemId, amount);
  storages[id] = { name, slots, tier: 0 };
}

let currentStorageId = null;
let currentStorageFilter = "all";

// Crafting resources (material-type items) are pooled across the backpack and
// every storage container, so gathering feeds crafting no matter where it's stashed.
// Equipment and other non-material items stay scoped to the backpack only.
function getResourceCount(itemId) {
  const def = getItemDef(itemId);
  if (!def || def.type !== "material") return getItemCount(itemId);

  let total = countInSlots(inventory.slots, itemId);
  for (const id in storages) {
    total += countInSlots(storages[id].slots, itemId);
  }
  return total;
}

function removeResource(itemId, amount) {
  const def = getItemDef(itemId);
  if (!def || def.type !== "material") return removeItem(itemId, amount);

  let remaining = amount - removeFromSlots(inventory.slots, itemId, amount);
  for (const id in storages) {
    if (remaining <= 0) break;
    remaining -= removeFromSlots(storages[id].slots, itemId, remaining);
  }
  return amount - remaining;
}

function isStorageOpen() {
  return currentStorageId !== null;
}

function openStorage(id) {
  currentStorageId = id;
  currentStorageFilter = "all";
  renderStoragePanel();
  document.getElementById("storage-modal").classList.add("open");
}

function closeStorage() {
  document.getElementById("storage-modal").classList.remove("open");
  currentStorageId = null;
}

function canAffordUpgrade(storage) {
  const tierDef = CAPACITY_TIERS[storage.tier];
  if (!tierDef) return false;
  return getResourceCount("wood") >= tierDef.cost.wood && getResourceCount("stone") >= tierDef.cost.stone;
}

function upgradeStorage(id) {
  const storage = storages[id];
  const tierDef = CAPACITY_TIERS[storage.tier];
  if (!tierDef || !canAffordUpgrade(storage)) return;

  removeResource("wood", tierDef.cost.wood);
  removeResource("stone", tierDef.cost.stone);
  for (let i = 0; i < tierDef.addSlots; i++) storage.slots.push(null);
  storage.tier += 1;

  renderStoragePanel();
  refreshHud();
}

function buildSlotGrid(containerEl, slots, onClickSlot) {
  containerEl.innerHTML = "";
  slots.forEach((slot, index) => {
    const cell = document.createElement("div");
    cell.className = "inv-slot";
    if (slot) {
      const def = getItemDef(slot.itemId);
      const rarity = RARITY[def.rarity];
      cell.style.borderColor = rarity.color;
      cell.title = `${def.name} (${rarity.name})`;
      cell.innerHTML = `<span class="inv-icon">${def.icon}</span><span class="inv-amount">${slot.amount}</span>`;
      if (currentStorageFilter !== "all" && def.type !== currentStorageFilter) {
        cell.classList.add("dimmed");
      }
    }
    cell.addEventListener("click", () => onClickSlot(index));
    containerEl.appendChild(cell);
  });
}

function renderStoragePanel() {
  if (!currentStorageId) return;
  const storage = storages[currentStorageId];

  document.getElementById("storage-title").textContent = storage.name;

  buildSlotGrid(document.getElementById("chest-grid"), storage.slots, (index) => {
    transferSlot(storage.slots, inventory.slots, index);
    renderStoragePanel();
    refreshHud();
  });

  buildSlotGrid(document.getElementById("backpack-grid"), inventory.slots, (index) => {
    transferSlot(inventory.slots, storage.slots, index);
    renderStoragePanel();
    refreshHud();
  });

  const upgradeBtn = document.getElementById("storage-upgrade-btn");
  const tierDef = CAPACITY_TIERS[storage.tier];
  if (!tierDef) {
    upgradeBtn.textContent = "Max Capacity";
    upgradeBtn.disabled = true;
  } else {
    upgradeBtn.textContent = `Upgrade +${tierDef.addSlots} slots  (${tierDef.cost.wood} 🌲  ${tierDef.cost.stone} 🪨)`;
    upgradeBtn.disabled = !canAffordUpgrade(storage);
  }

  document.querySelectorAll("#storage-filters .filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === currentStorageFilter);
  });
}

function setStorageFilter(filter) {
  currentStorageFilter = filter;
  renderStoragePanel();
}

function sortStorageChest() {
  if (!currentStorageId) return;
  sortSlots(storages[currentStorageId].slots);
  renderStoragePanel();
}

function sortBackpack() {
  sortSlots(inventory.slots);
  renderStoragePanel();
  renderInventoryPanel();
}

document.getElementById("storage-upgrade-btn").addEventListener("click", () => upgradeStorage(currentStorageId));
document.getElementById("storage-close-btn").addEventListener("click", closeStorage);
document.getElementById("chest-sort-btn").addEventListener("click", sortStorageChest);
document.getElementById("backpack-sort-btn").addEventListener("click", sortBackpack);
document.querySelectorAll("#storage-filters .filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => setStorageFilter(btn.dataset.filter));
});
