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
  HOUSE_ENTRANCE: 23,
  VILLAGE_GROUND: 24,
  NPC: 25,
  ALTAR: 26,
  HIDDEN_DUNGEON_ENTRANCE: 27,
  LOCKED_DOOR: 28,
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
  T.HOUSE_ENTRANCE,
  T.NPC,
  T.ALTAR,
  T.HIDDEN_DUNGEON_ENTRANCE,
  T.LOCKED_DOOR,
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
const HOUSE_ENTRANCE = { x: WORLD_CENTER_X, y: WORLD_CENTER_Y };

// A small safe, resource-free village square around the house. Bounds stamped
// as T.VILLAGE_GROUND before resources scatter (so nothing can spawn inside),
// and never added to ENCOUNTER_ELIGIBLE_TILES (so it's safe with no extra
// "zone" logic needed). The other 2 houses are still genuinely empty — future
// function (trader, a second quest giver, etc.) hangs off these same ids later.
const VILLAGE_BOUNDS = {
  x0: WORLD_CENTER_X - 8,
  x1: WORLD_CENTER_X + 8,
  y0: WORLD_CENTER_Y - 6,
  y1: WORLD_CENTER_Y + 6,
};
// Village house positions are reused identically by every world (each world's
// map is its own independent grid, so there's no collision risk) — only which
// NPC (if any) lives in each is world.js's decision, since World 1's elder
// keeps its fixed id while later worlds' elders get their own.
const VILLAGE_HOUSE_POSITIONS = [
  { id: "village_house_1", x: WORLD_CENTER_X - 5, y: WORLD_CENTER_Y - 2 },
  { id: "village_house_2", x: WORLD_CENTER_X + 5, y: WORLD_CENTER_Y - 2 },
  { id: "village_house_3", x: WORLD_CENTER_X, y: WORLD_CENTER_Y + 4 },
];
// Where the altar sits in every world's village square.
const ALTAR_POS = { x: WORLD_CENTER_X, y: WORLD_CENTER_Y - 2 };
// Where each world's hidden final-boss dungeon appears once revealed — the
// forest zone (west), well outside the central valley/village.
const FINAL_DUNGEON_POS = { x: WORLD_CENTER_X - 25, y: WORLD_CENTER_Y };

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
const worldIndicatorEl = document.getElementById("world-indicator");
const promptEl = document.getElementById("prompt");
const characterPanel = document.getElementById("character-panel");
const inventoryPanel = document.getElementById("inventory-panel");
const questPanel = document.getElementById("quest-panel");
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

  // village square: stamped before resources scatter, so nothing can spawn on it
  for (let y = VILLAGE_BOUNDS.y0; y <= VILLAGE_BOUNDS.y1; y++) {
    for (let x = VILLAGE_BOUNDS.x0; x <= VILLAGE_BOUNDS.x1; x++) {
      map[y][x] = T.VILLAGE_GROUND;
    }
  }

  const resources = new Map(); // key "x,y" -> {itemId, amount}

  // scatter trees and rocks across the valley
  const isValleyGrass = (x, y) => map[y][x] === T.GRASS;
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
  resources.delete(key(HOUSE_ENTRANCE.x, HOUSE_ENTRANCE.y));
  map[DUNGEON_ENTRANCE.y][DUNGEON_ENTRANCE.x] = T.DUNGEON_ENTRANCE;
  map[CASTLE_ENTRANCE.y][CASTLE_ENTRANCE.x] = T.CASTLE_ENTRANCE;
  map[HOUSE_ENTRANCE.y][HOUSE_ENTRANCE.x] = T.HOUSE_ENTRANCE;
  for (const house of VILLAGE_HOUSE_POSITIONS) {
    map[house.y][house.x] = T.HOUSE_ENTRANCE;
  }
  resources.delete(key(ALTAR_POS.x, ALTAR_POS.y));
  map[ALTAR_POS.y][ALTAR_POS.x] = T.ALTAR;

  return {
    map,
    width,
    height,
    resources,
    chestTiles: [],
    portals: [], // linked to dungeon/castle/house interiors after they're built
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

// Builds a roguelike-style maze interior: 5 rooms carved out of solid wall and
// connected by winding corridors, with the room furthest from the entrance
// holding the boss. Returns the same shape buildInterior() does (doorX/doorY/
// spawnX/spawnY etc.) plus a `revealed` tile set, which is what marks a level
// as fog-of-war-active (see isRevealed()/render()) — callers that don't want
// fog just keep using buildInterior(), which never sets that field.
function buildDungeonMaze({ width, height, wallTile, floorTile, chests, bossId, lockedDoorKeyId, dramaticBossReveal, cameraZoom }) {
  const ROOM_COUNT = 5;
  const ROOM_MIN = 3;
  const ROOM_MAX = 5;
  const ROOM_PADDING = 1; // minimum gap kept between rooms so they don't visually merge

  const map = [];
  for (let y = 0; y < height; y++) map.push(new Array(width).fill(wallTile));

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function overlaps(a, b, padding) {
    return (
      a.x - padding < b.x + b.w &&
      a.x + a.w + padding > b.x &&
      a.y - padding < b.y + b.h &&
      a.y + a.h + padding > b.y
    );
  }

  function tryPlaceRoom(yMin, yMax, existing) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const w = randInt(ROOM_MIN, ROOM_MAX);
      const h = randInt(ROOM_MIN, ROOM_MAX);
      const x = randInt(1, width - 1 - w);
      const y = randInt(yMin, Math.max(yMin, Math.min(yMax, height - 1 - h)));
      const candidate = { x, y, w, h };
      if (existing.every((r) => !overlaps(candidate, r, ROOM_PADDING))) return candidate;
    }
    // Extremely unlikely at this grid size, but generation must never hang.
    return { x: randInt(1, width - 1 - ROOM_MIN), y: randInt(yMin, yMax), w: ROOM_MIN, h: ROOM_MIN };
  }

  function roomCenter(room) {
    return { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) };
  }

  function carveRoom(room) {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) map[y][x] = floorTile;
    }
  }

  function carveCorridor(from, to) {
    let { x, y } = from;
    let steps = 0;
    const maxSteps = width + height + 40; // safety cap — carving must never hang
    while ((x !== to.x || y !== to.y) && steps < maxSteps) {
      map[y][x] = floorTile;
      const moveX = x !== to.x && (y === to.y || Math.random() < 0.5);
      if (moveX) x += Math.sign(to.x - x);
      else y += Math.sign(to.y - y);
      map[y][x] = floorTile;
      if (Math.random() < 0.15) {
        // occasional sideways jog so corridors read as winding, not ruler-straight
        x = Math.max(1, Math.min(width - 2, x + (Math.random() < 0.5 ? -1 : 1)));
      }
      steps++;
    }
    map[to.y][to.x] = floorTile;
  }

  // Entrance room: lower band of the grid, so the door sits naturally at the bottom.
  const entranceRoom = tryPlaceRoom(Math.floor(height * 0.65), height - 1 - ROOM_MIN, []);
  const rooms = [entranceRoom];
  for (let i = 0; i < ROOM_COUNT - 1; i++) rooms.push(tryPlaceRoom(1, height - 1 - ROOM_MIN, rooms));
  rooms.forEach(carveRoom);

  const doorX = Math.max(1, Math.min(width - 2, roomCenter(entranceRoom).x));
  const doorY = height - 1;
  carveCorridor(roomCenter(entranceRoom), { x: doorX, y: doorY - 1 });
  map[doorY][doorX] = T.DOOR;

  // Chain the other 4 rooms in order of distance from the entrance, so the
  // corridor path deepens naturally and the furthest room reads as "the depths."
  const others = rooms.slice(1);
  const entranceCenter = roomCenter(entranceRoom);
  others.sort((a, b) => {
    const ca = roomCenter(a);
    const cb = roomCenter(b);
    return Math.hypot(ca.x - entranceCenter.x, ca.y - entranceCenter.y) - Math.hypot(cb.x - entranceCenter.x, cb.y - entranceCenter.y);
  });
  let prevCenter = entranceCenter;
  others.forEach((room) => {
    const c = roomCenter(room);
    carveCorridor(prevCenter, c);
    prevCenter = c;
  });

  function isWalkableTile(x, y) {
    const t = map[y][x];
    return t === floorTile || t === T.DOOR || t === T.BOSS || t === T.CHEST || t === T.LOCKED_DOOR;
  }

  // A corridor's winding, jog-prone path can cut across a room it isn't even
  // connecting to (see carveCorridor's random sideways jog) — so a spot that
  // *looks* safe (a corner, away from this room's own connection point) can
  // still turn out to be a different corridor's only route through. This
  // confirms turning (x,y) solid genuinely can't strand anything, by actually
  // flood-filling from the door and comparing reachable counts.
  function wouldStayConnectedIfBlocked(x, y) {
    let totalOther = 0;
    for (let ty = 0; ty < height; ty++)
      for (let tx = 0; tx < width; tx++) if (!(tx === x && ty === y) && isWalkableTile(tx, ty)) totalOther++;

    const visited = new Set();
    const stack = [[doorX, doorY]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      const k = cx + "," + cy;
      if (visited.has(k) || cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
      if (cx === x && cy === y) continue;
      if (!isWalkableTile(cx, cy)) continue;
      visited.add(k);
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    return visited.size === totalOther;
  }

  // Candidates in preference order: the room's 4 corners first (reads as
  // "against the wall"), falling back to any other floor tile in the room —
  // each checked with wouldStayConnectedIfBlocked so nothing is ever placed
  // somewhere that seals off part of the maze.
  // Placing a chest already mutates its tile away from floorTile, so a second
  // call for the same room naturally skips whatever the first one picked —
  // no separate "already used" bookkeeping needed.
  function pickSafeSpotInRoom(room) {
    const candidates = [
      { x: room.x, y: room.y },
      { x: room.x + room.w - 1, y: room.y + room.h - 1 },
      { x: room.x + room.w - 1, y: room.y },
      { x: room.x, y: room.y + room.h - 1 },
    ];
    for (let ry = room.y; ry < room.y + room.h; ry++)
      for (let rx = room.x; rx < room.x + room.w; rx++) candidates.push({ x: rx, y: ry });
    return candidates.find((c) => map[c.y][c.x] === floorTile && wouldStayConnectedIfBlocked(c.x, c.y));
  }

  const bossRoom = others[others.length - 1];
  const intermediateRooms = others.slice(0, -1);

  const bossSpot = pickSafeSpotInRoom(bossRoom) || { x: bossRoom.x + bossRoom.w - 1, y: roomCenter(bossRoom).y };
  map[bossSpot.y][bossSpot.x] = T.BOSS;
  const bossTile = { x: bossSpot.x, y: bossSpot.y, bossId };
  const bossCenter = roomCenter(bossRoom); // still needed below: the room's corridor-connection point

  // The corridor always enters a room at its exact center (see carveCorridor
  // above) — stamping the locked door there blocks the boss room's only
  // entrance until the key is used, without touching the boss's own tile.
  let lockedDoor = null;
  if (lockedDoorKeyId) {
    map[bossCenter.y][bossCenter.x] = T.LOCKED_DOOR;
    lockedDoor = { x: bossCenter.x, y: bossCenter.y, keyId: lockedDoorKeyId };
  }

  const chestTiles = [];
  (chests || []).forEach((chest, i) => {
    const room = intermediateRooms[i % Math.max(1, intermediateRooms.length)];
    if (!room) return;
    const spot = pickSafeSpotInRoom(room);
    if (!spot) return; // no safe tile found (shouldn't happen — the room's own floor is always a valid fallback)
    map[spot.y][spot.x] = T.CHEST;
    chestTiles.push({ x: spot.x, y: spot.y, storageId: chest.storageId });
    createFilledStorage(chest.storageId, chest.name, 10, "gold", chest.gold);
    if (chest.extraItem) addToSlots(storages[chest.storageId].slots, chest.extraItem.itemId, chest.extraItem.amount);
  });

  return {
    map,
    width,
    height,
    resources: new Map(),
    chestTiles,
    bossTile,
    lockedDoor,
    bossRoom: { x: bossRoom.x, y: bossRoom.y, w: bossRoom.w, h: bossRoom.h },
    bossRoomEntryX: bossCenter.x,
    // Consumed (set false) the first time the player steps into the room —
    // see revealRoomDramatically()/update() — so the sweep only ever plays once.
    bossRoomRevealPending: !!dramaticBossReveal,
    portals: [],
    doorX,
    doorY,
    spawnX: doorX * TILE + TILE / 2,
    spawnY: (doorY - 1) * TILE + TILE / 2,
    revealed: new Set(), // presence of this field is what marks the level fog-of-war-active
    cameraZoom: cameraZoom || 1,
  };
}

// `levels`/`bossDefeated` start empty and get populated by buildWorld() (see
// world.js) — called once for World 1 right below, and again later (at
// runtime, via the altar) for each subsequent world.
let levels = {};
let bossDefeated = {};
let LEVEL_TO_WORLD = {}; // levelId -> world number, populated by buildWorld()

buildWorld(1);
// World 1 is the only world with Oliver's own personal house (defeat-respawn
// and the initial spawn always return here, regardless of which world the
// player is currently adventuring in) — kept as a plain alias so the two
// places that need it (below, and handleDefeat() in combat.js) don't need
// to change.
const houseLevel = levels.house;

let currentLevelId = null;
let currentWorld = 1;
let map, MAP_W, MAP_H, resources, chestTiles, portals, bossTile, npcTile, altarTile, revealed, lockedDoor, bossRoom, bossRoomEntryX, cameraZoom;
let lastPlayerTileX = null;
let lastPlayerTileY = null;

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
  npcTile = lvl.npcTile;
  altarTile = lvl.altarTile;
  revealed = lvl.revealed;
  lockedDoor = lvl.lockedDoor;
  bossRoom = lvl.bossRoom;
  bossRoomEntryX = lvl.bossRoomEntryX;
  cameraZoom = lvl.cameraZoom || 1;
  if (spawnX !== undefined) {
    player.x = spawnX;
    player.y = spawnY;
  }
  // Forces update()'s tile-change check to fire on the very next frame — needed
  // so a fog-of-war level reveals its spawn tile immediately instead of staying
  // black for a frame (and incidentally makes that check robust to a new
  // level's spawn tile numerically matching wherever the player last was).
  lastPlayerTileX = null;
  lastPlayerTileY = null;
  closeStorage();
  if (levelId in discoveredPOIs) discoveredPOIs[levelId] = true;
  // Suffix checks (not exact match) so this still applies to later worlds'
  // own dungeon/castle/final-boss dungeon, which use prefixed ids like
  // "world2_dungeon" or "world1_final_dungeon" but always end the same way.
  if (levelId.endsWith("dungeon")) armEncounterGracePeriod(ENCOUNTER_ENTRY_GRACE_STEPS);
  if (levelId in LEVEL_TO_WORLD) {
    currentWorld = LEVEL_TO_WORLD[levelId];
    updateWorldIndicator();
  }
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

activateLevel("house", houseLevel.spawnX, houseLevel.spawnY);

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
        const npc = nearestNPC();
        if (npc) {
          interactWithNPC(npc.npcId);
        } else {
          const altar = nearestAltar();
          if (altar) {
            if (isDialogueOpen()) {
              closeDialogue();
            } else {
              interactWithAltar(altar);
            }
          } else {
            const lockedDoorNearby = nearestLockedDoor();
            if (lockedDoorNearby) {
              if (isDialogueOpen()) {
                closeDialogue();
              } else {
                interactWithLockedDoor(lockedDoorNearby);
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
  if (k === "q" && !e.repeat) {
    togglePanel(questPanel, renderQuestPanel);
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
// Fog of war — only active on levels whose `revealed` field is set (the maze
// interiors built by buildDungeonMaze()). Gates rendering only, not collision
// — unseen walls still block movement, exactly like real fog of war.
// ---------------------------------------------------------------------------

const FOG_REVEAL_RADIUS = 2;

function revealTilesAround(centerX, centerY) {
  for (let dy = -FOG_REVEAL_RADIUS; dy <= FOG_REVEAL_RADIUS; dy++) {
    for (let dx = -FOG_REVEAL_RADIUS; dx <= FOG_REVEAL_RADIUS; dx++) {
      if (dx * dx + dy * dy > FOG_REVEAL_RADIUS * FOG_REVEAL_RADIUS) continue;
      revealed.add(key(centerX + dx, centerY + dy));
    }
  }
}

function isRevealed(tx, ty) {
  return !revealed || revealed.has(key(tx, ty));
}

const ROOM_REVEAL_STEP_DELAY = 90; // ms between each column of the dramatic boss-room sweep

// One-time dramatic reveal for a boss room: sweeps outward column-by-column
// from the doorway the player just walked through, instead of the normal
// radius-2 creep — reads as the fog "rolling back" off the whole room at
// once. `targetRevealed` is captured explicitly (not read live off the
// module-level `revealed` var) so a mid-sweep level change can't make later
// steps write into the wrong level's revealed set.
function revealRoomDramatically(room, entryX, targetRevealed) {
  const columns = [];
  for (let x = room.x; x < room.x + room.w; x++) columns.push(x);
  columns.sort((a, b) => Math.abs(a - entryX) - Math.abs(b - entryX));

  function revealNextColumn(i) {
    if (i >= columns.length) return;
    const x = columns[i];
    for (let y = room.y; y < room.y + room.h; y++) targetRevealed.add(key(x, y));
    setTimeout(() => revealNextColumn(i + 1), ROOM_REVEAL_STEP_DELAY);
  }
  revealNextColumn(0);
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

function updateWorldIndicator() {
  worldIndicatorEl.textContent = `World ${currentWorld}`;
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

function nearestNPC() {
  if (!npcTile) return null;
  const cx = npcTile.x * TILE + TILE / 2;
  const cy = npcTile.y * TILE + TILE / 2;
  const dist = Math.hypot(cx - player.x, cy - player.y);
  return dist <= TILE * 1.3 ? npcTile : null;
}

function nearestAltar() {
  if (!altarTile) return null;
  const cx = altarTile.x * TILE + TILE / 2;
  const cy = altarTile.y * TILE + TILE / 2;
  const dist = Math.hypot(cx - player.x, cy - player.y);
  return dist <= TILE * 1.3 ? altarTile : null;
}

// Checks the live map tile (not just the presence of `lockedDoor`) so the door
// stops being interactable the moment it's unlocked — mirrors how resources
// stop being gatherable once their tile is mutated back to plain ground.
function nearestLockedDoor() {
  if (!lockedDoor || map[lockedDoor.y][lockedDoor.x] !== T.LOCKED_DOOR) return null;
  const cx = lockedDoor.x * TILE + TILE / 2;
  const cy = lockedDoor.y * TILE + TILE / 2;
  const dist = Math.hypot(cx - player.x, cy - player.y);
  return dist <= TILE * 1.3 ? lockedDoor : null;
}

// Backpack-only check (getItemCount/removeItem), not the pooled
// getResourceCount/removeResource every other material uses — the key is
// pre-seeded into a chest's storage at world-generation time, so pooling
// would count it as "possessed" before the player ever finds it. Requiring
// it in the backpack means the player must actually loot it first.
function interactWithLockedDoor(door) {
  if (getItemCount(door.keyId) >= 1) {
    removeItem(door.keyId, 1);
    map[door.y][door.x] = baseTileFor(T.LOCKED_DOOR);
    showMessage("Locked Door", "You use the Ancient Key to unlock the door. It swings open, revealing the chamber beyond.");
  } else {
    showMessage("Locked Door", "This door is locked tight. You'll need to find a key.");
  }
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
    if (revealed) revealTilesAround(tileX, tileY);
    if (
      bossRoom &&
      levels[currentLevelId].bossRoomRevealPending &&
      tileX >= bossRoom.x &&
      tileX < bossRoom.x + bossRoom.w &&
      tileY >= bossRoom.y &&
      tileY < bossRoom.y + bossRoom.h
    ) {
      levels[currentLevelId].bossRoomRevealPending = false;
      revealRoomDramatically(bossRoom, bossRoomEntryX, revealed);
    }
    if (ENCOUNTER_ELIGIBLE_TILES.has(map[tileY][tileX])) {
      checkRandomEncounter();
      if (inCombat) return;
    }
  }

  const near = nearestResourceTile();
  const nearChest = near ? null : nearestChest();
  const nearNPC = near || nearChest ? null : nearestNPC();
  const nearAltar = near || nearChest || nearNPC ? null : nearestAltar();
  const nearLockedDoor = near || nearChest || nearNPC || nearAltar ? null : nearestLockedDoor();
  const nearBoss = near || nearChest || nearNPC || nearAltar || nearLockedDoor ? null : nearestBoss();
  const nearPortal = near || nearChest || nearNPC || nearAltar || nearLockedDoor || nearBoss ? null : nearestPortal();
  if (near) {
    const itemDef = getItemDef(near.res.itemId);
    promptEl.textContent = `Press E to gather ${itemDef.name}`;
    promptEl.style.display = "block";
  } else if (nearChest) {
    promptEl.textContent = isStorageOpen() ? "Press E to close" : "Press E to open Chest";
    promptEl.style.display = "block";
  } else if (nearNPC) {
    const npcDef = NPC_DEFS[nearNPC.npcId];
    promptEl.textContent = npcDef.shop ? `Press E to trade with ${npcDef.name}` : `Press E to talk to ${npcDef.name}`;
    promptEl.style.display = "block";
  } else if (nearAltar) {
    promptEl.textContent = "Press E to use the Altar";
    promptEl.style.display = "block";
  } else if (nearLockedDoor) {
    promptEl.textContent = "Press E to open the locked door";
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
    // Suffix checks, not exact match: later worlds' dungeon/castle/final-boss
    // dungeon use prefixed ids ("world2_dungeon", "world1_final_dungeon", ...)
    // but always end the same way.
    if (currentLevelId.endsWith("dungeon")) return T.DUNGEON_FLOOR;
    if (currentLevelId.endsWith("castle")) return T.CASTLE_FLOOR;
    return T.FLOOR;
  }
  if (t === T.ICE) return T.SNOW;
  if (t === T.CACTUS) return T.SAND;
  if (t === T.FLOWER) return T.FOREST_GROUND;
  if (t === T.JEWEL) return T.HILLS_GROUND;
  if (t === T.DUNGEON_ENTRANCE) return T.SNOW;
  if (t === T.CASTLE_ENTRANCE) return T.HILLS_GROUND;
  if (t === T.HOUSE_ENTRANCE || t === T.ALTAR) return T.VILLAGE_GROUND;
  if (t === T.NPC) return T.FLOOR;
  if (t === T.HIDDEN_DUNGEON_ENTRANCE) return T.FOREST_GROUND;
  if (t === T.LOCKED_DOOR) return T.DUNGEON_FLOOR; // only ever placed inside maze ("dungeon"-type) interiors
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
    case T.VILLAGE_GROUND:
      return "#cbb27e";
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

function drawHouseEntrance(px, py) {
  ctx.font = "22px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🏠", px + TILE / 2, py + TILE / 2 + 1);
}

function drawNpc(px, py) {
  if (!npcTile) return;
  const def = NPC_DEFS[npcTile.npcId];
  ctx.font = "28px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(def ? def.icon : "🧑", px + TILE / 2, py + TILE / 2 + 1);
}

function drawAltar(px, py) {
  ctx.font = "26px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("⛩️", px + TILE / 2, py + TILE / 2 + 1);
}

function drawHiddenDungeonEntrance(px, py) {
  ctx.font = "24px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🌋", px + TILE / 2, py + TILE / 2 + 1);
}

function drawLockedDoor(px, py) {
  ctx.fillStyle = "#3a2a1a";
  ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
  ctx.font = "20px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🔒", px + TILE / 2, py + TILE / 2 + 1);
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
  [T.HOUSE_ENTRANCE]: drawHouseEntrance,
  [T.NPC]: drawNpc,
  [T.ALTAR]: drawAltar,
  [T.HIDDEN_DUNGEON_ENTRANCE]: drawHiddenDungeonEntrance,
  [T.LOCKED_DOOR]: drawLockedDoor,
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

// Shared by render() and combat.js's on-map encounter marker, which needs the
// same camera the world is actually drawn with. `viewW`/`viewH` are the
// visible area in world pixels — shrunk by cameraZoom, since zooming in means
// fewer world pixels fit in the fixed 800x600 canvas.
function getCamera() {
  const viewW = VIEW_W / cameraZoom;
  const viewH = VIEW_H / cameraZoom;
  let camX, camY;
  if (revealed) {
    // Fog-of-war maze interiors: the camera always tracks the player exactly,
    // never clamped to the map's edge — the view scrolls continuously with
    // you (showing a bit of void past a boundary is fine, and reads as "a
    // bigger space to explore" rather than the map feeling boxed-in).
    camX = Math.round(player.x - viewW / 2);
    camY = Math.round(player.y - viewH / 2);
  } else {
    // Every other level: small interiors (house/village houses) are smaller
    // than the view, so clamping alone would pin them to the top-left rather
    // than centering — center directly whenever the map doesn't fill the
    // view; otherwise clamp-scroll (e.g. the 100x100 overworld) so the true
    // map edge is visible instead of scrolling past it into void.
    camX = Math.round(
      MAP_W * TILE <= viewW ? (MAP_W * TILE - viewW) / 2 : Math.max(0, Math.min(MAP_W * TILE - viewW, player.x - viewW / 2))
    );
    camY = Math.round(
      MAP_H * TILE <= viewH ? (MAP_H * TILE - viewH) / 2 : Math.max(0, Math.min(MAP_H * TILE - viewH, player.y - viewH / 2))
    );
  }
  return { camX, camY, viewW, viewH };
}

function render() {
  const { camX, camY, viewW, viewH } = getCamera();

  // Scales everything drawn below (tiles, sprites, the player) uniformly —
  // this is the "zoom" itself. Coordinates throughout this function stay in
  // world-pixel space exactly as before; the transform does the rest.
  ctx.save();
  ctx.scale(cameraZoom, cameraZoom);

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, viewW, viewH);

  const startTx = Math.floor(camX / TILE);
  const endTx = Math.ceil((camX + viewW) / TILE);
  const startTy = Math.floor(camY / TILE);
  const endTy = Math.ceil((camY + viewH) / TILE);

  // base tiles
  for (let ty = startTy; ty < endTy; ty++) {
    for (let tx = startTx; tx < endTx; tx++) {
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue;
      const px = tx * TILE - camX;
      const py = ty * TILE - camY;
      if (!isRevealed(tx, ty)) {
        ctx.fillStyle = "#000";
        ctx.fillRect(px, py, TILE, TILE);
        continue;
      }
      const t = map[ty][tx];
      ctx.fillStyle = tileColor(baseTileFor(t));
      ctx.fillRect(px, py, TILE, TILE);
    }
  }

  // build draw list (resources + player) sorted by y for simple depth ordering
  const drawables = [];
  for (let ty = startTy; ty < endTy; ty++) {
    for (let tx = startTx; tx < endTx; tx++) {
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue;
      if (!isRevealed(tx, ty)) continue;
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
  ctx.restore();
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
