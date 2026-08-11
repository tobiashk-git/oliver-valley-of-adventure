// ---------------------------------------------------------------------------
// Character system: identity + core stats
// ---------------------------------------------------------------------------

const character = {
  name: "Oliver",
  hp: 20,
  maxHp: 20,
  mp: 10,
  maxMp: 10,
  stats: {
    strength: 5,
    agility: 5,
  },
};

function renderCharacterPanel() {
  const nameEl = document.getElementById("char-name");
  const hpBar = document.getElementById("char-hp-bar");
  const hpText = document.getElementById("char-hp-text");
  const mpBar = document.getElementById("char-mp-bar");
  const mpText = document.getElementById("char-mp-text");
  const strEl = document.getElementById("char-str");
  const agiEl = document.getElementById("char-agi");

  nameEl.textContent = character.name;
  hpBar.style.width = `${(character.hp / character.maxHp) * 100}%`;
  hpText.textContent = `${character.hp} / ${character.maxHp}`;
  mpBar.style.width = `${(character.mp / character.maxMp) * 100}%`;
  mpText.textContent = `${character.mp} / ${character.maxMp}`;
  strEl.textContent = character.stats.strength;
  agiEl.textContent = character.stats.agility;
}
