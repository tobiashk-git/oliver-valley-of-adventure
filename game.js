// ---------------------------------------------------------------------------
// The Valley of Adventure - simple top-down RPG prototype
// ---------------------------------------------------------------------------

const TILE = 32;
const VIEW_W = 800;
const VIEW_H = 600;

const OVERWORLD_WIDTH = 100; // tiles
const OVERWORLD_HEIGHT = 100; // tiles

const WORLD_CENTER_X = Math.floor(OVERWORLD_WIDTH / 2);
const WORLD_CENTER_Y = Math.floor(OVERWORLD_HEIGHT / 2);
const VALLEY_RADIUS = 15; // tiles from center that stay the starting valley/grass zone

// tile ids
const T = {
  GRASS: 0,
  WALL: 1,
  FLOOR: 2,
  DOOR: 3,
  TREE: 4,
  ROCK: 5,
  PATH: 6,
  CHEST: 7,
  SNOW: 8,
  SAND: 9,
  FOREST_GROUND: 10,
  HILLS_GROUND: 11,
  ICE: 12,
  CACTUS: 13,
  FLOWER: 14,
  JEWEL: 15,
  DUNGEON_WALL: 16,
  DUNGEON_FLOOR: 17,
  CASTLE_WALL: 18,
  CASTLE_FLOOR: 19,
  DUNGEON_ENTRANCE: 20,
  CASTLE_ENTRANCE: 21,
  BOSS: 22,
};

const SOLID_TILES = new Set([
  T.WALL,
  T.TREE,
  T.ROCK,
  T.CHEST,
  T.ICE,
  T.CACTUS,
  T.FLOWER,
  T.JEWEL,
  T.DUNGEON_WALL,
  T.CASTLE_WALL,
  T.DUNGEON_ENTRANCE,
  T.CASTLE_ENTRANCE,
  T.BOSS,
]);

// Open ground where random encounters can trigger — the whole overworld (valley +
// biomes) plus the dungeon. House floor and the castle interior stay peaceful.
const ENCOUNTER_ELIGIBLE_TILES = new Set([
  T.GRASS,
  T.SNOW,
  T.SAND,
  T.FOREST_GROUND,
  T.HILLS_GROUND,
  T.PATH,
  T.DUNGEON_FLOOR,
]);

// Fixed points of interest on the overworld map.
const DUNGEON_ENTRANCE = { x: WORLD_CENTER_X, y: WORLD_CENTER_Y - 30 };
const CASTLE_ENTRANCE = { x: WORLD_CENTER_X + 35, y: WORLD_CENTER_Y };

// Which cardinal zone a tile belongs to: a central valley, surrounded by four
// wedge-shaped biomes (snow north, desert south, forest west, hills east).
function biomeAt(tx, ty) {
  const dx = tx - WORLD_CENTER_X;
  const dy = ty - WORLD_CENTER_Y;

  if (Math.abs(dx) < VALLEY_RADIUS && Math.abs(dy) < VALLEY_RADIUS) {
    return { zone: "valley", ground: T.GRASS };
  }
  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy < 0 ? { zone: "snow", ground: T.SNOW } : { zone: "desert", ground: T.SAND };
  }
  return dx < 0 ? { zone: "forest", ground: T.FOREST_GROUND } : { zone: "hills", ground: T.HILLS_GROUND };
}

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const woodCountEl = document.getElementById("wood-count");
const stoneCountEl = document.getElementById("stone-count");
const promptEl = document.getElementById("prompt");
const characterPanel = document.getElementById("character-panel");
const inventoryPanel = document.getElementById("inventory-panel");
const storageModal = document.getElementById("storage-modal");

// ---------------------------------------------------------------------------
// Map generation
// ---------------------------------------------------------------------------

function key(x, y) {
  return x + "," + y;
}

function buildOverworld() {
  const width = OVERWORLD_WIDTH;
  const height = OVERWORLD_HEIGHT;

  const map = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push(biomeAt(x, y).ground);
    }
    map.push(row);
  }

  // house rectangle, centered in the map
  const houseW = 9;
  const houseH = 7;
  const hx = Math.floor((width - houseW) / 2);
  const hy = Math.floor((height - houseH) / 2);

  for (let y = hy; y < hy + houseH; y++) {
    for (let x = hx; x < hx + houseW; x++) {
      const isBorder = y === hy || y === hy + houseH - 1 || x === hx || x === hx + houseW - 1;
      map[y][x] = isBorder ? T.WALL : T.FLOOR;
    }
  }

  // door gap at the bottom center of the house
  const doorX = hx + Math.floor(houseW / 2);
  map[hy + houseH - 1][doorX] = T.DOOR;
  // small path leading away from the door
  map[hy + houseH][doorX] = T.PATH;

  // chest in the near corner of the house interior
  const chestX = hx + 1;
  const chestY = hy + 1;
  map[chestY][chestX] = T.CHEST;

  const resources = new Map(); // key "x,y" -> {itemId, amount}

  // scatter trees and rocks in the valley, avoiding the house footprint
  function inHouse(x, y) {
    return x >= hx - 1 && x <= hx + houseW && y >= hy - 1 && y <= hy + houseH;
  }
  const isValleyGrass = (x, y) => !inHouse(x, y) && map[y][x] === T.GRASS;
  const isZoneGround = (zone, ground) => (x, y) => biomeAt(x, y).zone === zone && map[y][x] === ground;

  // Places `count` resource nodes of `tileType`/`itemId` at random tiles that satisfy isValidTile(x, y).
  function scatterResource(count, itemId, tileType, isValidTile) {
    let placed = 0;
    let attempts = 0;
    const maxAttempts = count * 300;

    while (placed < count && attempts < maxAttempts) {
      attempts++;
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);
      if (!isValidTile(x, y)) continue;
      map[y][x] = tileType;
      resources.set(key(x, y), { itemId, amount: 3 });
      placed++;
    }
  }

  scatterResource(70, "wood", T.TREE, isValleyGrass);
  scatterResource(40, "stone", T.ROCK, isValleyGrass);

  // biome-specific resources
  scatterResource(90, "ice", T.ICE, isZoneGround("snow", T.SNOW));
  scatterResource(90, "cactus", T.CACTUS, isZoneGround("desert", T.SAND));
  scatterResource(90, "flower", T.FLOWER, isZoneGround("forest", T.FOREST_GROUND));
  scatterResource(90, "jewel", T.JEWEL, isZoneGround("hills", T.HILLS_GROUND));

  // points of interest
  resources.delete(key(DUNGEON_ENTRANCE.x, DUNGEON_ENTRANCE.y));
  resources.delete(key(CASTLE_ENTRANCE.x, CASTLE_ENTRANCE.y));
  map[DUNGEON_ENTRANCE.y][DUNGEON_ENTRANCE.x] = T.DUNGEON_ENTRANCE;
  map[CASTLE_ENTRANCE.y][CASTLE_ENTRANCE.x] = T.CASTLE_ENTRANCE;

  return {
    map,
    width,
    height,
    resources,
    chestTiles: [{ x: chestX, y: chestY, storageId: "house_chest" }],
    portals: [], // linked to dungeon/castle interiors after they're built
    playerStart: { x: (hx + houseW / 2) * TILE, y: (hy + houseH / 2) * TILE },
    houseCenterTile: { x: hx + Math.floor(houseW / 2), y: hy + Math.floor(houseH / 2) },
  };
}

// Builds a small single-room interior (dungeon/castle) with a door back out,
// gold chests, and an optional fixed boss tile.
function buildInterior({ width, height, wallTile, floorTile, chests, boss }) {
  const map = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const isBorder = y === 0 || y === height - 1 || x === 0 || x === width - 1;
      row.push(isBorder ? wallTile : floorTile);
    }
    map.push(row);
  }

  const doorX = Math.floor(width / 2);
  const doorY = height - 1;
  map[doorY][doorX] = T.DOOR;

  const chestTiles = [];
  for (const chest of chests) {
    map[chest.y][chest.x] = T.CHEST;
    chestTiles.push({ x: chest.x, y: chest.y, storageId: chest.storageId });
    createFilledStorage(chest.storageId, chest.name, 10, "gold", chest.gold);
  }

  let bossTile = null;
  if (boss) {
    map[boss.y][boss.x] = T.BOSS;
    bossTile = { x: boss.x, y: boss.y, bossId: boss.bossId };
  }

  return {
    map,
    width,
    height,
    resources: new Map(),
    chestTiles,
    bossTile,
    portals: [], // filled in below with the exit-to-overworld portal
    doorX,
    doorY,
    spawnX: doorX * TILE + TILE / 2,
    spawnY: (height - 2) * TILE + TILE / 2,
  };
}

const overworldLevel = buildOverworld();

const dungeonLevel = buildInterior({
  width: 9,
  height: 7,
  wallTile: T.DUNGEON_WALL,
  floorTile: T.DUNGEON_FLOOR,
  chests: [
    { x: 2, y: 2, storageId: "dungeon_chest_1", name: "Old Chest", gold: 15 },
    { x: 6, y: 2, storageId: "dungeon_chest_2", name: "Iron Chest", gold: 20 },
  ],
  boss: { x: 4, y: 2, bossId: "dungeon_boss" },
});

const castleLevel = buildInterior({
  width: 11,
  height: 8,
  wallTile: T.CASTLE_WALL,
  floorTile: T.CASTLE_FLOOR,
  chests: [
    { x: 2, y: 2, storageId: "castle_chest_1", name: "Royal Coffer", gold: 40 },
    { x: 9, y: 2, storageId: "castle_chest_2", name: "Treasury Chest", gold: 60 },
  ],
  boss: { x: 5, y: 2, bossId: "castle_boss" },
});

// link the overworld entrances to their interiors, and each interior's door back out
overworldLevel.portals.push(
  {
    x: DUNGEON_ENTRANCE.x,
    y: DUNGEON_ENTRANCE.y,
    toLevelId: "dungeon",
    toX: dungeonLevel.spawnX,
    toY: dungeonLevel.spawnY,
    label: "enter the Dungeon",
  },
  {
    x: CASTLE_ENTRANCE.x,
    y: CASTLE_ENTRANCE.y,
    toLevelId: "castle",
    toX: castleLevel.spawnX,
    toY: castleLevel.spawnY,
    label: "enter the Castle",
  },
);
dungeonLevel.portals.push({
  x: dungeonLevel.doorX,
  y: dungeonLevel.doorY,
  toLevelId: "overworld",
  toX: DUNGEON_ENTRANCE.x * TILE + TILE / 2,
  toY: (DUNGEON_ENTRANCE.y + 1) * TILE + TILE / 2,
  label: "leave the Dungeon",
});
castleLevel.portals.push({
  x: castleLevel.doorX,
  y: castleLevel.doorY,
  toLevelId: "overworld",
  toX: CASTLE_ENTRANCE.x * TILE + TILE / 2,
  toY: (CASTLE_ENTRANCE.y + 1) * TILE + TILE / 2,
  label: "leave the Castle",
});

const levels = { overworld: overworldLevel, dungeon: dungeonLevel, castle: castleLevel };

// Checkpoint state: once a boss is beaten it never fights again.
const bossDefeated = { dungeon_boss: false, castle_boss: false };

let currentLevelId = null;
let map, MAP_W, MAP_H, resources, chestTiles, portals, bossTile;

function activateLevel(levelId, spawnX, spawnY) {
  currentLevelId = levelId;
  const lvl = levels[levelId];
  map = lvl.map;
  MAP_W = lvl.width;
  MAP_H = lvl.height;
  resources = lvl.resources;
  chestTiles = lvl.chestTiles;
  portals = lvl.portals;
  bossTile = lvl.bossTile;
  if (spawnX !== undefined) {
    player.x = spawnX;
    player.y = spawnY;
  }
  closeStorage();
  if (levelId in discoveredPOIs) discoveredPOIs[levelId] = true;
  if (levelId === "dungeon") armEncounterGracePeriod(ENCOUNTER_ENTRY_GRACE_STEPS);
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

const player = {
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  speed: 160, // px/sec
  dir: "down", // facing direction, for rendering
};

activateLevel("overworld", overworldLevel.playerStart.x, overworldLevel.playerStart.y);

const keys = new Set();

function togglePanel(panel, onOpen) {
  const opening = !panel.classList.contains("open");
  panel.classList.toggle("open");
  if (opening && onOpen) onOpen();
}

window.addEventListener("keydown", (e) => {
  if (inCombat) return;
  const k = e.key.toLowerCase();
  if (["w", "a", "s", "d"].includes(k)) {
    keys.add(k);
  }
  if (k === "e" && !e.repeat) {
    const gathered = tryGather();
    if (!gathered) {
      const chest = nearestChest();
      if (chest) {
        if (isStorageOpen()) {
          closeStorage();
        } else {
          openStorage(chest.storageId);
        }
      } else {
        const boss = nearestBoss();
        if (boss) {
          startBossFight(boss.bossId);
        } else {
          const portal = nearestPortal();
          if (portal) {
            activateLevel(portal.toLevelId, portal.toX, portal.toY);
          }
        }
      }
    }
  }
  if (k === "i" && !e.repeat) {
    togglePanel(inventoryPanel);
  }
  if (k === "c" && !e.repeat) {
    togglePanel(characterPanel, renderCharacterPanel);
  }
  if (k === "r" && !e.repeat) {
    toggleCrafting();
  }
  if (k === "m" && !e.repeat) {
    toggleWorldMap();
  }
  if (k === "escape" && !e.repeat) {
    closeStorage();
    if (isCraftingOpen()) toggleCrafting();
    if (isWorldMapOpen()) toggleWorldMap();
  }
});

window.addEventListener("keyup", (e) => {
  keys.delete(e.key.toLowerCase());
});

// ---------------------------------------------------------------------------
// Collision helpers
// ---------------------------------------------------------------------------

function tileAt(px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return T.WALL;
  return map[ty][tx];
}

function isSolid(px, py) {
  return SOLID_TILES.has(tileAt(px, py));
}

function canMoveTo(x, y) {
  const half = player.w / 2;
  const corners = [
    [x - half, y - half],
    [x + half, y - half],
    [x - half, y + half],
    [x + half, y + half],
  ];
  return corners.every(([cx, cy]) => !isSolid(cx, cy));
}

// ---------------------------------------------------------------------------
// Gathering
// ---------------------------------------------------------------------------

function nearestResourceTile() {
  const px = Math.floor(player.x / TILE);
  const py = Math.floor(player.y / TILE);
  let best = null;
  let bestDist = Infinity;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = px + dx;
      const ty = py + dy;
      const res = resources.get(key(tx, ty));
      if (!res) continue;
      const cx = tx * TILE + TILE / 2;
      const cy = ty * TILE + TILE / 2;
      const dist = Math.hypot(cx - player.x, cy - player.y);
      if (dist < bestDist && dist <= TILE * 1.3) {
        bestDist = dist;
        best = { tx, ty, res };
      }
    }
  }
  return best;
}

function tryGather() {
  const found = nearestResourceTile();
  if (!found) return false;
  const { tx, ty, res } = found;

  res.amount -= 1;
  addItem(res.itemId, 1);
  refreshHud();

  if (res.amount <= 0) {
    resources.delete(key(tx, ty));
    map[ty][tx] = baseTileFor(map[ty][tx]);
  }
  return true;
}

function refreshHud() {
  woodCountEl.textContent = getResourceCount("wood");
  stoneCountEl.textContent = getResourceCount("stone");
  renderInventoryPanel();
}

function nearestChest() {
  for (const chest of chestTiles) {
    const cx = chest.x * TILE + TILE / 2;
    const cy = chest.y * TILE + TILE / 2;
    const dist = Math.hypot(cx - player.x, cy - player.y);
    if (dist <= TILE * 1.3) return chest;
  }
  return null;
}

function nearestBoss() {
  if (!bossTile || bossDefeated[bossTile.bossId]) return null;
  const cx = bossTile.x * TILE + TILE / 2;
  const cy = bossTile.y * TILE + TILE / 2;
  const dist = Math.hypot(cx - player.x, cy - player.y);
  return dist <= TILE * 1.3 ? bossTile : null;
}

function nearestPortal() {
  for (const portal of portals) {
    const cx = portal.x * TILE + TILE / 2;
    const cy = portal.y * TILE + TILE / 2;
    const dist = Math.hypot(cx - player.x, cy - player.y);
    if (dist <= TILE * 1.3) return portal;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

let lastTime = performance.now();
let lastPlayerTileX = null;
let lastPlayerTileY = null;

function update(dt) {
  if (inCombat) return;

  let dx = 0;
  let dy = 0;
  if (keys.has("w")) dy -= 1;
  if (keys.has("s")) dy += 1;
  if (keys.has("a")) dx -= 1;
  if (keys.has("d")) dx += 1;

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;

    if (Math.abs(dx) > Math.abs(dy)) {
      player.dir = dx > 0 ? "right" : "left";
    } else {
      player.dir = dy > 0 ? "down" : "up";
    }

    const nx = player.x + dx * player.speed * dt;
    const ny = player.y + dy * player.speed * dt;

    if (canMoveTo(nx, player.y)) player.x = nx;
    if (canMoveTo(player.x, ny)) player.y = ny;
  }

  player.x = Math.max(TILE / 2, Math.min(MAP_W * TILE - TILE / 2, player.x));
  player.y = Math.max(TILE / 2, Math.min(MAP_H * TILE - TILE / 2, player.y));

  const tileX = Math.floor(player.x / TILE);
  const tileY = Math.floor(player.y / TILE);
  if (tileX !== lastPlayerTileX || tileY !== lastPlayerTileY) {
    lastPlayerTileX = tileX;
    lastPlayerTileY = tileY;
    if (ENCOUNTER_ELIGIBLE_TILES.has(map[tileY][tileX])) {
      checkRandomEncounter();
      if (inCombat) return;
    }
  }

  const near = nearestResourceTile();
  const nearChest = near ? null : nearestChest();
  const nearBoss = near || nearChest ? null : nearestBoss();
  const nearPortal = near || nearChest || nearBoss ? null : nearestPortal();
  if (near) {
    const itemDef = getItemDef(near.res.itemId);
    promptEl.textContent = `Press E to gather ${itemDef.name}`;
    promptEl.style.display = "block";
  } else if (nearChest) {
    promptEl.textContent = isStorageOpen() ? "Press E to close" : "Press E to open Chest";
    promptEl.style.display = "block";
  } else if (nearBoss) {
    promptEl.textContent = `Press E to challenge ${BOSS_DEFS[nearBoss.bossId].name}`;
    promptEl.style.display = "block";
  } else if (nearPortal) {
    promptEl.textContent = `Press E to ${nearPortal.label}`;
    promptEl.style.display = "block";
  } else {
    promptEl.style.display = "none";
  }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function baseTileFor(t) {
  if (t === T.TREE || t === T.ROCK) return T.GRASS;
  if (t === T.CHEST || t === T.BOSS) {
    if (currentLevelId === "dungeon") return T.DUNGEON_FLOOR;
    if (currentLevelId === "castle") return T.CASTLE_FLOOR;
    return T.FLOOR;
  }
  if (t === T.ICE) return T.SNOW;
  if (t === T.CACTUS) return T.SAND;
  if (t === T.FLOWER) return T.FOREST_GROUND;
  if (t === T.JEWEL) return T.HILLS_GROUND;
  if (t === T.DUNGEON_ENTRANCE) return T.SNOW;
  if (t === T.CASTLE_ENTRANCE) return T.HILLS_GROUND;
  return t;
}

function tileColor(t) {
  switch (t) {
    case T.WALL:
      return "#6b4a34";
    case T.FLOOR:
      return "#d8c396";
    case T.DOOR:
      return "#8a5a34";
    case T.PATH:
      return "#b09a6a";
    case T.SNOW:
      return "#eef4f8";
    case T.SAND:
      return "#dcb35c";
    case T.FOREST_GROUND:
      return "#2f5c28";
    case T.HILLS_GROUND:
      return "#8a8a5b";
    case T.DUNGEON_WALL:
      return "#39393f";
    case T.DUNGEON_FLOOR:
      return "#5c5c66";
    case T.CASTLE_WALL:
      return "#8a7a5a";
    case T.CASTLE_FLOOR:
      return "#d9c9a0";
    default:
      return "#4a7c3a";
  }
}

function drawTree(px, py) {
  ctx.fillStyle = "#6b4423";
  ctx.fillRect(px + TILE / 2 - 3, py + TILE / 2, 6, TILE / 2 - 4);
  ctx.fillStyle = "#2f6b2f";
  ctx.beginPath();
  ctx.arc(px + TILE / 2, py + TILE / 2 - 4, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3a8a3a";
  ctx.beginPath();
  ctx.arc(px + TILE / 2 - 4, py + TILE / 2 - 8, 10, 0, Math.PI * 2);
  ctx.fill();
}

function drawRock(px, py) {
  ctx.fillStyle = "#8a8a8a";
  ctx.beginPath();
  ctx.moveTo(px + 6, py + TILE - 6);
  ctx.lineTo(px + 4, py + TILE / 2);
  ctx.lineTo(px + TILE / 2, py + 6);
  ctx.lineTo(px + TILE - 5, py + TILE / 2 - 2);
  ctx.lineTo(px + TILE - 6, py + TILE - 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#adadad";
  ctx.beginPath();
  ctx.moveTo(px + TILE / 2, py + 6);
  ctx.lineTo(px + TILE - 5, py + TILE / 2 - 2);
  ctx.lineTo(px + TILE / 2 + 4, py + TILE / 2 + 4);
  ctx.closePath();
  ctx.fill();
}

function drawChest(px, py) {
  const w = TILE - 8;
  const h = TILE - 10;
  const x = px + 4;
  const y = py + 6;

  ctx.fillStyle = "#7a4a24";
  ctx.fillRect(x, y + 6, w, h - 6);
  ctx.fillStyle = "#5a3418";
  ctx.fillRect(x, y, w, 7);
  ctx.fillStyle = "#e8c368";
  ctx.fillRect(x, y + 6, w, 2);
  ctx.fillStyle = "#3d2b1f";
  ctx.fillRect(x + w / 2 - 2, y + 5, 4, 4);
}

function drawIce(px, py) {
  const cx = px + TILE / 2;
  const cy = py + TILE / 2;
  ctx.fillStyle = "#bfe8f5";
  ctx.beginPath();
  ctx.moveTo(cx, cy - 14);
  ctx.lineTo(cx + 8, cy - 2);
  ctx.lineTo(cx + 4, cy + 14);
  ctx.lineTo(cx - 4, cy + 14);
  ctx.lineTo(cx - 8, cy - 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e6f8ff";
  ctx.beginPath();
  ctx.moveTo(cx, cy - 14);
  ctx.lineTo(cx + 8, cy - 2);
  ctx.lineTo(cx, cy + 6);
  ctx.lineTo(cx - 8, cy - 2);
  ctx.closePath();
  ctx.fill();
}

function drawCactus(px, py) {
  const cx = px + TILE / 2;
  const baseY = py + TILE - 6;
  ctx.fillStyle = "#3f8f4a";
  ctx.fillRect(cx - 4, baseY - 22, 8, 22);
  ctx.fillRect(cx - 11, baseY - 14, 7, 6);
  ctx.fillRect(cx - 11, baseY - 18, 4, 10);
  ctx.fillRect(cx + 4, baseY - 18, 7, 6);
  ctx.fillRect(cx + 7, baseY - 22, 4, 10);
  ctx.fillStyle = "#2f6b38";
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(cx - 3, baseY - 20 + i * 5, 1, 1);
    ctx.fillRect(cx + 2, baseY - 20 + i * 5, 1, 1);
  }
}

function drawFlower(px, py) {
  const cx = px + TILE / 2;
  const cy = py + TILE / 2 + 4;
  ctx.strokeStyle = "#3a8a3a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 10);
  ctx.lineTo(cx, cy);
  ctx.stroke();

  ctx.fillStyle = "#e8608a";
  const petalOffsets = [
    [0, -8],
    [7, -2],
    [4, 7],
    [-4, 7],
    [-7, -2],
  ];
  for (const [ox, oy] of petalOffsets) {
    ctx.beginPath();
    ctx.arc(cx + ox, cy + oy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#f5d347";
  ctx.beginPath();
  ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawJewel(px, py) {
  const cx = px + TILE / 2;
  const cy = py + TILE / 2;
  ctx.fillStyle = "#a05acb";
  ctx.beginPath();
  ctx.moveTo(cx, cy - 12);
  ctx.lineTo(cx + 10, cy - 2);
  ctx.lineTo(cx, cy + 12);
  ctx.lineTo(cx - 10, cy - 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#d9a8f0";
  ctx.beginPath();
  ctx.moveTo(cx, cy - 12);
  ctx.lineTo(cx + 10, cy - 2);
  ctx.lineTo(cx, cy - 2);
  ctx.closePath();
  ctx.fill();
}

function drawDungeonEntrance(px, py) {
  const cx = px + TILE / 2;
  const topY = py + 2;
  ctx.fillStyle = "#4a4a4a";
  ctx.beginPath();
  ctx.moveTo(cx - 14, py + TILE);
  ctx.lineTo(cx - 14, topY + 10);
  ctx.quadraticCurveTo(cx - 14, topY, cx, topY);
  ctx.quadraticCurveTo(cx + 14, topY, cx + 14, topY + 10);
  ctx.lineTo(cx + 14, py + TILE);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#0a0a0a";
  ctx.beginPath();
  ctx.moveTo(cx - 9, py + TILE);
  ctx.lineTo(cx - 9, topY + 12);
  ctx.quadraticCurveTo(cx - 9, topY + 6, cx, topY + 6);
  ctx.quadraticCurveTo(cx + 9, topY + 6, cx + 9, topY + 12);
  ctx.lineTo(cx + 9, py + TILE);
  ctx.closePath();
  ctx.fill();
}

function drawCastleEntrance(px, py) {
  const x = px + 3;
  const y = py - 6;
  ctx.fillStyle = "#9a8a6a";
  ctx.fillRect(x, y + 10, TILE - 6, TILE - 4);
  ctx.fillStyle = "#7a6a4a";
  ctx.fillRect(x, y, 8, 14);
  ctx.fillRect(x + TILE - 14, y, 8, 14);
  ctx.fillStyle = "#3a2a1a";
  ctx.fillRect(px + TILE / 2 - 4, py + TILE - 12, 8, 12);
  ctx.fillStyle = "#c0392b";
  ctx.fillRect(x + 2, y - 6, 6, 6);
}

function drawBoss(px, py) {
  if (!bossTile) return;
  const def = BOSS_DEFS[bossTile.bossId];
  const defeated = bossDefeated[bossTile.bossId];

  ctx.save();
  if (defeated) ctx.globalAlpha = 0.4;
  ctx.fillStyle = defeated ? "#3a3a3a" : "#4a1010";
  ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
  ctx.font = "20px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(def ? def.icon : "👹", px + TILE / 2, py + TILE / 2 + 1);
  ctx.restore();
}

const TILE_SPRITES = {
  [T.TREE]: drawTree,
  [T.ROCK]: drawRock,
  [T.CHEST]: drawChest,
  [T.ICE]: drawIce,
  [T.CACTUS]: drawCactus,
  [T.DUNGEON_ENTRANCE]: drawDungeonEntrance,
  [T.CASTLE_ENTRANCE]: drawCastleEntrance,
  [T.FLOWER]: drawFlower,
  [T.JEWEL]: drawJewel,
  [T.BOSS]: drawBoss,
};

function drawPlayer(px, py) {
  const half = player.w / 2;
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(px, py + half + 2, half, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // body
  ctx.fillStyle = "#3a5fcc";
  ctx.fillRect(px - half, py - half, player.w, player.h);

  // head
  ctx.fillStyle = "#f2c49b";
  ctx.beginPath();
  ctx.arc(px, py - half - 2, 8, 0, Math.PI * 2);
  ctx.fill();

  // facing indicator
  ctx.fillStyle = "#222";
  const eyeOffsets = {
    down: [
      [-3, -half - 2],
      [3, -half - 2],
    ],
    up: [],
    left: [[-5, -half - 2]],
    right: [[5, -half - 2]],
  };
  const eyes = eyeOffsets[player.dir] || [];
  for (const [ox, oy] of eyes) {
    ctx.beginPath();
    ctx.arc(px + ox, py + oy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function render() {
  const camX = Math.round(Math.max(0, Math.min(MAP_W * TILE - VIEW_W, player.x - VIEW_W / 2)));
  const camY = Math.round(Math.max(0, Math.min(MAP_H * TILE - VIEW_H, player.y - VIEW_H / 2)));

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const startTx = Math.floor(camX / TILE);
  const endTx = Math.ceil((camX + VIEW_W) / TILE);
  const startTy = Math.floor(camY / TILE);
  const endTy = Math.ceil((camY + VIEW_H) / TILE);

  // base tiles
  for (let ty = startTy; ty < endTy; ty++) {
    for (let tx = startTx; tx < endTx; tx++) {
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue;
      const t = map[ty][tx];
      const px = tx * TILE - camX;
      const py = ty * TILE - camY;
      ctx.fillStyle = tileColor(baseTileFor(t));
      ctx.fillRect(px, py, TILE, TILE);
    }
  }

  // build draw list (resources + player) sorted by y for simple depth ordering
  const drawables = [];
  for (let ty = startTy; ty < endTy; ty++) {
    for (let tx = startTx; tx < endTx; tx++) {
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue;
      const t = map[ty][tx];
      const spriteFn = TILE_SPRITES[t];
      if (spriteFn) {
        drawables.push({
          y: ty * TILE + TILE,
          draw: () => spriteFn(tx * TILE - camX, ty * TILE - camY),
        });
      }
    }
  }
  drawables.push({
    y: player.y,
    draw: () => drawPlayer(player.x - camX, player.y - camY),
  });
  drawables.sort((a, b) => a.y - b.y);
  drawables.forEach((d) => d.draw());
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

addItem("healing_potion", 10);

renderCharacterPanel();
refreshHud();

requestAnimationFrame((now) => {
  lastTime = now;
  requestAnimationFrame(loop);
});

// ---------------------------------------------------------------------------
// Responsive scaling — the canvas keeps rendering at its native 800x600
// internally; this just visually scales the whole #stage (canvas + every
// absolutely-positioned overlay panel on top of it) down to fit small screens.
// ---------------------------------------------------------------------------

const stageEl = document.getElementById("stage");
const STAGE_W = 800;
const STAGE_H = 600;
const STAGE_BORDER = 8; // 4px border on each side (see #stage in style.css)
const TOUCH_COVER_MAX_SCALE = 1.8; // sane ceiling on how far cover-fit can zoom in

function isTouchDevice() {
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

function fitStage() {
  const touch = isTouchDevice();
  const wrap = document.getElementById("game-wrap");
  const reserved = wrap.querySelectorAll(":scope > *:not(#stage)");
  let reservedHeight = 0;
  reserved.forEach((el) => {
    if (getComputedStyle(el).display !== "none") reservedHeight += el.offsetHeight;
  });

  // Touch layout goes edge-to-edge (see the mobile media query in style.css,
  // which makes #game-wrap fill the viewport with overflow:hidden), so
  // there's no title/help to reserve room for and no side margin needed.
  const availW = touch ? window.innerWidth : window.innerWidth - 16;
  const availH = touch ? window.innerHeight : window.innerHeight - reservedHeight - 16;

  // Desktop: "contain" — shrink to fit entirely on screen, never cropping.
  // Touch: "cover" — fill the screen edge-to-edge, cropping the excess
  // dimension (here, the sides) rather than leaving the 4:3 canvas
  // letterboxed inside a tall phone screen. A landscape-shaped canvas can
  // never exactly fill a portrait screen either way; cover reads as "the
  // game fills my phone," contain reads as "a small game floats in the
  // middle of my phone" — cover is the better trade-off for a phone browser.
  const scale = touch
    ? Math.min(TOUCH_COVER_MAX_SCALE, Math.max(availW / (STAGE_W + STAGE_BORDER), availH / (STAGE_H + STAGE_BORDER)))
    : Math.min(1, availW / (STAGE_W + STAGE_BORDER), availH / (STAGE_H + STAGE_BORDER));

  // `zoom` (unlike `transform: scale`) actually resizes #stage's layout box,
  // so #game-wrap's flex centering correctly centers the *rendered* size
  // instead of centering the original 800x600 box and leaving the visually
  // shrunk content stranded up in its top-left corner.
  stageEl.style.zoom = scale;
  // `zoom`, like `transform`, still scales down `position: fixed` descendants
  // along with everything else (fixed elements aren't immune to an ancestor
  // zoom, the same way they aren't immune to the browser's own page zoom) —
  // so panels/modals inside #stage need this to counteract it and render at
  // their originally-authored native size. See the touch media query in
  // style.css. No-op on desktop, where scale (and this variable) is 1.
  document.documentElement.style.setProperty("--inv-stage-scale", 1 / scale);
}

window.addEventListener("resize", fitStage);
window.addEventListener("orientationchange", fitStage);
document.addEventListener("fullscreenchange", fitStage);
if (window.visualViewport) window.visualViewport.addEventListener("resize", fitStage);
fitStage();
// Mobile browsers can report a transient viewport size before their address
// bar/chrome finishes settling right after load — recheck shortly after.
setTimeout(fitStage, 300);
