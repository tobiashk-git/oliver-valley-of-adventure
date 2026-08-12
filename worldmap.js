// ---------------------------------------------------------------------------
// World map + fast travel: minimap of the overworld, travel to discovered POIs
// ---------------------------------------------------------------------------

const MINIMAP_SIZE = 300;
const MINIMAP_COLORS = {
  valley: "#4a7c3a",
  snow: "#eef4f8",
  desert: "#dcb35c",
  forest: "#2f5c28",
  hills: "#8a8a5b",
};

const discoveredPOIs = { house: true, dungeon: false, castle: false };
let minimapBuilt = false;

function buildMinimapImage() {
  const canvas = document.getElementById("worldmap-canvas");
  const mctx = canvas.getContext("2d");
  const scaleX = MINIMAP_SIZE / OVERWORLD_WIDTH;
  const scaleY = MINIMAP_SIZE / OVERWORLD_HEIGHT;

  for (let ty = 0; ty < OVERWORLD_HEIGHT; ty++) {
    for (let tx = 0; tx < OVERWORLD_WIDTH; tx++) {
      mctx.fillStyle = MINIMAP_COLORS[biomeAt(tx, ty).zone];
      mctx.fillRect(Math.floor(tx * scaleX), Math.floor(ty * scaleY), Math.ceil(scaleX), Math.ceil(scaleY));
    }
  }
}

function worldMapPOIs() {
  return [
    { id: "house", name: "House", x: HOUSE_ENTRANCE.x, y: HOUSE_ENTRANCE.y, icon: "🏠" },
    { id: "dungeon", name: "Dungeon", x: DUNGEON_ENTRANCE.x, y: DUNGEON_ENTRANCE.y, icon: "⛰️" },
    { id: "castle", name: "Castle", x: CASTLE_ENTRANCE.x, y: CASTLE_ENTRANCE.y, icon: "🏰" },
  ];
}

// Where the player's position should be shown on the overworld minimap,
// even when they're currently inside an interior level.
function playerOverworldTile() {
  if (currentLevelId === "overworld") return { x: player.x / TILE, y: player.y / TILE };
  if (currentLevelId === "dungeon") return DUNGEON_ENTRANCE;
  if (currentLevelId === "castle") return CASTLE_ENTRANCE;
  if (currentLevelId === "house") return HOUSE_ENTRANCE;
  return { x: WORLD_CENTER_X, y: WORLD_CENTER_Y };
}

function travelTo(poiId) {
  if (poiId === "house") {
    activateLevel("overworld", HOUSE_ENTRANCE.x * TILE + TILE / 2, (HOUSE_ENTRANCE.y + 1) * TILE + TILE / 2);
  } else if (poiId === "dungeon") {
    activateLevel("overworld", DUNGEON_ENTRANCE.x * TILE + TILE / 2, (DUNGEON_ENTRANCE.y + 1) * TILE + TILE / 2);
  } else if (poiId === "castle") {
    activateLevel("overworld", CASTLE_ENTRANCE.x * TILE + TILE / 2, (CASTLE_ENTRANCE.y + 1) * TILE + TILE / 2);
  }
  toggleWorldMap();
}

function renderWorldMap() {
  const markersEl = document.getElementById("worldmap-markers");
  markersEl.innerHTML = "";

  for (const poi of worldMapPOIs()) {
    const discovered = discoveredPOIs[poi.id];
    const el = document.createElement("button");
    el.className = "map-marker" + (discovered ? "" : " locked");
    el.style.left = `${(poi.x / OVERWORLD_WIDTH) * 100}%`;
    el.style.top = `${(poi.y / OVERWORLD_HEIGHT) * 100}%`;
    el.textContent = discovered ? poi.icon : "?";
    el.title = discovered ? poi.name : "Undiscovered";
    el.disabled = !discovered;
    if (discovered) el.addEventListener("click", () => travelTo(poi.id));
    markersEl.appendChild(el);
  }

  const p = playerOverworldTile();
  const playerDot = document.createElement("div");
  playerDot.className = "map-player-dot";
  playerDot.style.left = `${(p.x / OVERWORLD_WIDTH) * 100}%`;
  playerDot.style.top = `${(p.y / OVERWORLD_HEIGHT) * 100}%`;
  markersEl.appendChild(playerDot);

  const statusLabel =
    currentLevelId === "overworld"
      ? "the Valley"
      : currentLevelId === "dungeon"
        ? "the Dungeon"
        : currentLevelId === "castle"
          ? "the Castle"
          : "your House";
  document.getElementById("worldmap-status").textContent = `You are in ${statusLabel}`;
}

function isWorldMapOpen() {
  return document.getElementById("worldmap-modal").classList.contains("open");
}

function toggleWorldMap() {
  const modal = document.getElementById("worldmap-modal");
  if (modal.classList.contains("open")) {
    modal.classList.remove("open");
    return;
  }
  // worldMapPOIs()/travelTo() are hardcoded to World 1's fixed level ids
  // (dungeon/castle/house) — showing/using them from another world would
  // silently teleport the player back into World 1's copies. Multi-world
  // map support is a later phase; for now just say so.
  if (currentWorld !== 1) {
    document.getElementById("worldmap-markers").innerHTML = "";
    document.getElementById("worldmap-status").textContent = `The World Map only covers World 1 for now — you're exploring World ${currentWorld}.`;
    modal.classList.add("open");
    return;
  }
  if (!minimapBuilt) {
    buildMinimapImage();
    minimapBuilt = true;
  }
  renderWorldMap();
  modal.classList.add("open");
}

document.getElementById("worldmap-close-btn").addEventListener("click", toggleWorldMap);
