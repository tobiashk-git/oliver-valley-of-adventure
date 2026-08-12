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
  if (objective.type === "defeat_bosses") {
    return { have: objective.bossIds.filter((id) => bossDefeated[id]).length, need: objective.bossIds.length };
  }
  return { have: 0, need: 0 };
}

function objectiveMet(objective) {
  const { have, need } = objectiveProgress(objective);
  return have >= need;
}

function objectiveLabel(objective) {
  const { have, need } = objectiveProgress(objective);
  if (objective.type === "defeat_bosses") return `${Math.min(have, need)}/${need} Guardians`;
  const def = getItemDef(objective.itemId);
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

// An NPC can offer more than one quest (e.g. World 1's elder has both the
// original "gather wood" quest and the main "defeat the Guardians" quest) —
// show whichever isn't completed yet, in list order; once everything's done,
// fall back to the last one so there's still a sensible "completed" line.
function pickActiveQuest(questIds) {
  const active = questIds.map((id) => QUEST_DEFS[id]).find((q) => questState[q.id] !== "completed");
  return active || QUEST_DEFS[questIds[questIds.length - 1]];
}

function renderDialogue() {
  const npc = NPC_DEFS[currentDialogueNpcId];
  const quest = pickActiveQuest(npc.questIds);
  const state = questState[quest.id];

  document.getElementById("dialogue-name").textContent = npc.name;

  let line;
  const buttons = [];
  if (state === "completed") {
    line = quest.dialogue.completed;
  } else if (state === "accepted") {
    if (objectiveMet(quest.objective)) {
      line = quest.dialogue.readyToComplete;
      // "gather" turns in right here; other types (e.g. "defeat_bosses") are
      // completed externally — the altar, not this dialogue, marks them done.
      if (quest.objective.type === "gather") {
        buttons.push({ label: "Turn In", onClick: () => turnInQuest(quest.id) });
      }
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

// A one-off message through the same modal, not tied to an NPC_DEFS entry —
// used by the altar, which isn't an NPC. Closing it behaves exactly like
// closeDialogue(), it just doesn't need currentDialogueNpcId set first.
function showMessage(title, text) {
  currentDialogueNpcId = null;
  document.getElementById("dialogue-name").textContent = title;
  document.getElementById("dialogue-text").textContent = text;
  const buttonsEl = document.getElementById("dialogue-buttons");
  buttonsEl.innerHTML = "";
  const closeBtn = document.createElement("button");
  closeBtn.className = "craft-btn";
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", closeDialogue);
  buttonsEl.appendChild(closeBtn);
  document.getElementById("dialogue-modal").classList.add("open");
}

document.getElementById("dialogue-close-btn").addEventListener("click", closeDialogue);
