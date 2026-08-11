// ---------------------------------------------------------------------------
// Crafting system: instant recipes, no station required
// ---------------------------------------------------------------------------

const RECIPES = {
  wooden_pickaxe: {
    id: "wooden_pickaxe",
    resultItemId: "wooden_pickaxe",
    resultAmount: 1,
    cost: { wood: 3, stone: 2 },
  },
  sturdy_planks: {
    id: "sturdy_planks",
    resultItemId: "sturdy_planks",
    resultAmount: 2,
    cost: { wood: 5 },
  },
  healing_potion: {
    id: "healing_potion",
    resultItemId: "healing_potion",
    resultAmount: 1,
    cost: { flower: 3, ice: 1 },
  },
  mana_potion: {
    id: "mana_potion",
    resultItemId: "mana_potion",
    resultAmount: 1,
    cost: { jewel: 1, ice: 2 },
  },
  antidote: {
    id: "antidote",
    resultItemId: "antidote",
    resultAmount: 1,
    cost: { cactus: 2, flower: 2 },
  },
  leather_armor: {
    id: "leather_armor",
    resultItemId: "leather_armor",
    resultAmount: 1,
    cost: { wood: 4, stone: 4 },
  },
  charm_of_warding: {
    id: "charm_of_warding",
    resultItemId: "charm_of_warding",
    resultAmount: 1,
    cost: { jewel: 1, flower: 2 },
  },
};

function canCraft(recipeId) {
  const recipe = RECIPES[recipeId];
  return Object.entries(recipe.cost).every(([itemId, amt]) => getResourceCount(itemId) >= amt);
}

function craftItem(recipeId) {
  if (!canCraft(recipeId)) return;
  const recipe = RECIPES[recipeId];

  for (const [itemId, amt] of Object.entries(recipe.cost)) {
    removeResource(itemId, amt);
  }
  addItem(recipe.resultItemId, recipe.resultAmount);

  refreshHud();
  renderCraftingPanel();
  if (isStorageOpen()) renderStoragePanel();
}

function renderCraftingPanel() {
  const list = document.getElementById("craft-list");
  list.innerHTML = "";

  Object.values(RECIPES).forEach((recipe) => {
    const resultDef = getItemDef(recipe.resultItemId);
    const affordable = canCraft(recipe.id);

    const costHtml = Object.entries(recipe.cost)
      .map(([itemId, amt]) => {
        const def = getItemDef(itemId);
        const ok = getResourceCount(itemId) >= amt;
        return `<span class="craft-cost${ok ? "" : " insufficient"}">${def.icon} ${amt}</span>`;
      })
      .join(" ");

    const row = document.createElement("div");
    row.className = "craft-row";
    row.innerHTML = `
      <div class="craft-icon">${resultDef.icon}</div>
      <div class="craft-info">
        <div class="craft-name">${resultDef.name}${recipe.resultAmount > 1 ? ` &times;${recipe.resultAmount}` : ""}</div>
        <div class="craft-costs">${costHtml}</div>
      </div>
      <button class="craft-btn"${affordable ? "" : " disabled"}>Craft</button>
    `;
    row.querySelector(".craft-btn").addEventListener("click", () => craftItem(recipe.id));
    list.appendChild(row);
  });
}

function isCraftingOpen() {
  return document.getElementById("crafting-modal").classList.contains("open");
}

function toggleCrafting() {
  const modal = document.getElementById("crafting-modal");
  if (modal.classList.contains("open")) {
    modal.classList.remove("open");
  } else {
    renderCraftingPanel();
    modal.classList.add("open");
  }
}

document.getElementById("crafting-close-btn").addEventListener("click", toggleCrafting);
