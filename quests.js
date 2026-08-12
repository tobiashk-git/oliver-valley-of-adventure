// ---------------------------------------------------------------------------
// Quests: definitions, state, and the dialogue modal
// ---------------------------------------------------------------------------

const QUEST_DEFS = {
  gather_wood: {
    id: "gather_wood",
    giverId: "village_elder",
    name: "A Village in Need",
    objective: { type: "gather", itemId: "wood", amount: 5 },
    reward: { gold: 20, itemId: "healing_potion", itemAmount: 1 },
    dialogue: {
      offer: "Traveler! Our village could use some wood for repairs. Could you bring me 5 Wood?",
      inProgress: "I still need 5 Wood — do you have any to spare?",
      readyToComplete: "Wonderful, you've brought the wood! Thank you.",
      completed: "Thanks again for your help, traveler.",
    },
  },
};

let questState = {}; // questId -> "accepted" | "completed" (absent = not yet offered)
let currentDialogueNpcId = null;

function objectiveProgress(objective) {
  if (objective.type === "gather") {
    return { have: getResourceCount(objective.itemId), need: objective.amount };
  }
  return { have: 0, need: 0 };
}

function objectiveMet(objective) {
  const { have, need } = objectiveProgress(objective);
  return have >= need;
}

function objectiveLabel(objective) {
  const def = getItemDef(objective.itemId);
  const { have, need } = objectiveProgress(objective);
  return `${Math.min(have, need)}/${need} ${def.name}`;
}

function isDialogueOpen() {
  return document.getElementById("dialogue-modal").classList.contains("open");
}

function openDialogue(npcId) {
  currentDialogueNpcId = npcId;
  renderDialogue();
  document.getElementById("dialogue-modal").classList.add("open");
}

function closeDialogue() {
  document.getElementById("dialogue-modal").classList.remove("open");
  currentDialogueNpcId = null;
}

function renderDialogue() {
  const npc = NPC_DEFS[currentDialogueNpcId];
  const quest = QUEST_DEFS[npc.questId];
  const state = questState[quest.id];

  document.getElementById("dialogue-name").textContent = npc.name;

  let line;
  const buttons = [];
  if (state === "completed") {
    line = quest.dialogue.completed;
  } else if (state === "accepted") {
    if (objectiveMet(quest.objective)) {
      line = quest.dialogue.readyToComplete;
      buttons.push({ label: "Turn In", onClick: () => turnInQuest(quest.id) });
    } else {
      line = `${quest.dialogue.inProgress} (${objectiveLabel(quest.objective)})`;
    }
  } else {
    line = quest.dialogue.offer;
    buttons.push({ label: "Accept", onClick: () => acceptQuest(quest.id) });
  }

  document.getElementById("dialogue-text").textContent = line;

  const buttonsEl = document.getElementById("dialogue-buttons");
  buttonsEl.innerHTML = "";
  buttons.forEach((b) => {
    const btn = document.createElement("button");
    btn.className = "craft-btn";
    btn.textContent = b.label;
    btn.addEventListener("click", b.onClick);
    buttonsEl.appendChild(btn);
  });
  const closeBtn = document.createElement("button");
  closeBtn.className = "craft-btn";
  closeBtn.textContent = buttons.length ? "Not now" : "Close";
  closeBtn.addEventListener("click", closeDialogue);
  buttonsEl.appendChild(closeBtn);
}

function acceptQuest(questId) {
  questState[questId] = "accepted";
  renderDialogue();
  if (isQuestPanelOpen()) renderQuestPanel();
}

function turnInQuest(questId) {
  const quest = QUEST_DEFS[questId];
  removeResource(quest.objective.itemId, quest.objective.amount);
  addItem("gold", quest.reward.gold);
  if (quest.reward.itemId) addItem(quest.reward.itemId, quest.reward.itemAmount);
  questState[questId] = "completed";
  refreshHud();
  renderDialogue();
  if (isQuestPanelOpen()) renderQuestPanel();
}

function isQuestPanelOpen() {
  return document.getElementById("quest-panel").classList.contains("open");
}

function questStatusLine(quest) {
  const state = questState[quest.id];
  if (state === "completed") return `${quest.name} — Completed`;
  if (state === "accepted") {
    return objectiveMet(quest.objective)
      ? `${quest.name} — Ready to turn in!`
      : `${quest.name} — ${objectiveLabel(quest.objective)}`;
  }
  return null; // not yet offered — hidden from the journal
}

function renderQuestPanel() {
  const list = document.getElementById("quest-list");
  const lines = Object.values(QUEST_DEFS)
    .map(questStatusLine)
    .filter((line) => line !== null);

  list.innerHTML = lines.length
    ? lines.map((line) => `<div class="quest-entry">${line}</div>`).join("")
    : `<div class="quest-entry quest-empty">No quests yet.</div>`;
}

document.getElementById("dialogue-close-btn").addEventListener("click", closeDialogue);
