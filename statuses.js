// ---------------------------------------------------------------------------
// Status effect definitions
// ---------------------------------------------------------------------------

const STATUS_DEFS = {
  poison: {
    id: "poison",
    name: "Poison",
    icon: "☠️",
    duration: 3,
    dotDamage: 3,
  },
  paralysis: {
    id: "paralysis",
    name: "Paralysis",
    icon: "⚡",
    duration: 2,
    actChance: 0.5,
  },
  sleep: {
    id: "sleep",
    name: "Sleep",
    icon: "💤",
    duration: 3,
  },
  confusion: {
    id: "confusion",
    name: "Confusion",
    icon: "❓",
    duration: 2,
    selfHitChance: 0.5,
  },
  silence: {
    id: "silence",
    name: "Silence",
    icon: "🔇",
    duration: 2,
  },
};
