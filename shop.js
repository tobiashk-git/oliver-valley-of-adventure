// ---------------------------------------------------------------------------
// Shop: buy from a curated stock, sell anything with a value from the backpack
// ---------------------------------------------------------------------------

const SHOP_STOCK = ["healing_potion", "mana_potion", "antidote", "leather_armor", "charm_of_warding"];

let shopTab = "buy";

function sellPrice(value) {
  return Math.max(1, Math.floor(value * 0.5));
}

function isShopOpen() {
  return document.getElementById("shop-modal").classList.contains("open");
}

function openShop() {
  shopTab = "buy";
  renderShopPanel();
  document.getElementById("shop-modal").classList.add("open");
}

function closeShop() {
  document.getElementById("shop-modal").classList.remove("open");
}

function setShopTab(tab) {
  shopTab = tab;
  renderShopPanel();
}

function buyItem(itemId) {
  const def = getItemDef(itemId);
  if (getItemCount("gold") < def.value) return;
  removeItem("gold", def.value);
  addItem(itemId, 1);
  refreshHud();
  renderShopPanel();
}

function sellItem(itemId) {
  if (getItemCount(itemId) <= 0) return;
  const def = getItemDef(itemId);
  removeItem(itemId, 1);
  addItem("gold", sellPrice(def.value));
  refreshHud();
  renderShopPanel();
}

function buildShopRow(def, priceLabel, affordable, buttonLabel, onClick) {
  const row = document.createElement("div");
  row.className = "craft-row";
  row.innerHTML = `
    <div class="craft-icon">${def.icon}</div>
    <div class="craft-info">
      <div class="craft-name">${def.name}</div>
      <div class="craft-costs"><span class="craft-cost${affordable ? "" : " insufficient"}">🪙 ${priceLabel}</span></div>
    </div>
    <button class="craft-btn"${affordable ? "" : " disabled"}>${buttonLabel}</button>
  `;
  row.querySelector(".craft-btn").addEventListener("click", onClick);
  return row;
}

function renderShopPanel() {
  document.querySelectorAll("#shop-modal .filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.shopTab === shopTab);
  });
  document.getElementById("shop-gold").textContent = getItemCount("gold");

  const list = document.getElementById("shop-list");
  list.innerHTML = "";

  if (shopTab === "buy") {
    SHOP_STOCK.forEach((itemId) => {
      const def = getItemDef(itemId);
      const affordable = getItemCount("gold") >= def.value;
      list.appendChild(buildShopRow(def, def.value, affordable, "Buy", () => buyItem(itemId)));
    });
  } else {
    const ownedIds = [...new Set(inventory.slots.filter(Boolean).map((s) => s.itemId))].filter((id) => {
      const def = getItemDef(id);
      return def.value && def.type !== "currency";
    });

    if (ownedIds.length === 0) {
      list.innerHTML = `<p class="modal-hint">Nothing to sell.</p>`;
      return;
    }

    ownedIds.forEach((itemId) => {
      const def = getItemDef(itemId);
      const owned = getItemCount(itemId);
      const row = buildShopRow({ ...def, name: `${def.name} ×${owned}` }, sellPrice(def.value), true, "Sell", () => sellItem(itemId));
      list.appendChild(row);
    });
  }
}

document.getElementById("shop-close-btn").addEventListener("click", closeShop);
document.querySelectorAll("#shop-modal .filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => setShopTab(btn.dataset.shopTab));
});
