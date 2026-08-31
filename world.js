// ---------------------------------------------------------------------------
// World generation + the altar/crystal main-quest progression
//
// Each world is: an overworld (dungeon + castle + village + altar) plus a
// hidden final-boss dungeon that only becomes reachable once its altar has
// been fed 2 Guardian Crystals. World 1 is built once at load time; each
// later world is built lazily, the moment the previous world's altar opens
// its portal.
// ---------------------------------------------------------------------------

const WORLD_INFO = {}; // worldNumber -> { overworldLevelId, overworldLevel, dungeonBossId, castleBossId, finalBossId, finalBossLevelId, finalBossLevel, arrivalSpawn }
let worldProgress = {}; // worldNumber -> { finalBossRevealed, portalOpened }

function buildWorld(worldNumber) {
  const idPrefix = worldNumber === 1 ? "" : `world${worldNumber}_`;
  const levelId = (name) => idPrefix + name;

  const overworldLevel = buildOverworld();
  const overworldLevelId = levelId("overworld");

  // World 1 only: fence the village in on all 4 sides as an initial training
  // quest (see checkVillageGatesQuest() in game.js) — later worlds' villages
  // stay open exactly as buildOverworld() already leaves them.
  if (worldNumber === 1) {
    for (let y = VILLAGE_BOUNDS.y0; y <= VILLAGE_BOUNDS.y1; y++) {
      for (let x = VILLAGE_BOUNDS.x0; x <= VILLAGE_BOUNDS.x1; x++) {
        const onBorder = x === VILLAGE_BOUNDS.x0 || x === VILLAGE_BOUNDS.x1 || y === VILLAGE_BOUNDS.y0 || y === VILLAGE_BOUNDS.y1;
        if (onBorder) overworldLevel.map[y][x] = T.FENCE;
      }
    }
    Object.values(VILLAGE_GATES).forEach((gate) => {
      overworldLevel.map[gate.y][gate.x] = T.GATE;
    });
    // A cross of paths from the altar (dead center) out to each gate. Stops
    // one tile short of the border (where the gates already sit) and skips
    // the exact center tile, which buildOverworld() already stamped T.ALTAR
    // onto — a distinct tile id (not T.PATH, which is encounter-eligible)
    // so the village stays a safe zone; see groundSpriteFor() for the sprite.
    for (let y = VILLAGE_BOUNDS.y0 + 1; y <= VILLAGE_BOUNDS.y1 - 1; y++) {
      if (y === WORLD_CENTER_Y) continue;
      overworldLevel.map[y][WORLD_CENTER_X] = T.VILLAGE_PATH;
    }
    for (let x = VILLAGE_BOUNDS.x0 + 1; x <= VILLAGE_BOUNDS.x1 - 1; x++) {
      if (x === WORLD_CENTER_X) continue;
      overworldLevel.map[WORLD_CENTER_Y][x] = T.VILLAGE_PATH;
    }
  }

  // World 1 keeps its original fixed boss ids (already tested, already has
  // gear-drop items configured); every later world gets its own prefixed
  // clones so checkpoints never leak between worlds.
  const dungeonBossId = worldNumber === 1 ? "dungeon_boss" : levelId("dungeon_boss");
  const castleBossId = worldNumber === 1 ? "castle_boss" : levelId("castle_boss");
  const finalBossId = levelId("final_boss");
  if (worldNumber !== 1) {
    registerBoss(dungeonBossId, DUNGEON_GUARDIAN_TEMPLATE);
    registerBoss(castleBossId, CASTLE_GUARDIAN_TEMPLATE);
  }
  registerBoss(finalBossId, FINAL_BOSS_TEMPLATE);

  const dungeonLevel = buildDungeonMaze({
    // Sized well beyond the zoomed viewport (~16.7x12.5 tiles at 1.5x — see
    // cameraZoom) so exploring genuinely scrolls, for a sense of a bigger
    // space; the camera (see getCamera()'s fog-of-war branch) stays glued to
    // the player throughout rather than clamping near the map's edges.
    width: 40,
    height: 28,
    cameraZoom: 1.5,
    wallTile: T.DUNGEON_WALL,
    floorTile: T.DUNGEON_FLOOR,
    chests: [
      { storageId: levelId("dungeon_chest_1"), name: "Old Chest", gold: 15 },
      {
        storageId: levelId("dungeon_chest_2"),
        name: "Iron Chest",
        gold: 20,
        extraItem: { itemId: "dungeon_key", amount: 1 },
      },
    ],
    bossId: dungeonBossId,
    dramaticBossReveal: true,
  });

  const castleLevel = buildDungeonMaze({
    // Sized well beyond the zoomed viewport (~16.7x12.5 tiles at 1.5x — see
    // cameraZoom) so exploring genuinely scrolls, for a sense of a bigger
    // space; the camera (see getCamera()'s fog-of-war branch) stays glued to
    // the player throughout rather than clamping near the map's edges.
    width: 40,
    height: 28,
    cameraZoom: 1.5,
    wallTile: T.CASTLE_WALL,
    floorTile: T.CASTLE_FLOOR,
    chests: [
      { storageId: levelId("castle_chest_1"), name: "Royal Coffer", gold: 40 },
      { storageId: levelId("castle_chest_2"), name: "Treasury Chest", gold: 60 },
    ],
    bossId: castleBossId,
    dramaticBossReveal: true,
  });

  // The hidden final-boss dungeon: built now so it fully exists, but not
  // linked to the overworld until the altar reveals it (see revealFinalBoss).
  const finalBossLevelId = levelId("final_dungeon");
  const finalBossLevel = buildDungeonMaze({
    // Sized well beyond the zoomed viewport (~16.7x12.5 tiles at 1.5x — see
    // cameraZoom) so exploring genuinely scrolls, for a sense of a bigger
    // space; the camera (see getCamera()'s fog-of-war branch) stays glued to
    // the player throughout rather than clamping near the map's edges.
    width: 40,
    height: 28,
    cameraZoom: 1.5,
    wallTile: T.DUNGEON_WALL,
    floorTile: T.DUNGEON_FLOOR,
    chests: [],
    bossId: finalBossId,
    lockedDoorKeyId: "dungeon_key",
    dramaticBossReveal: true,
  });
  finalBossLevel.portals.push({
    x: finalBossLevel.doorX,
    y: finalBossLevel.doorY,
    toLevelId: overworldLevelId,
    toX: FINAL_DUNGEON_POS.x * TILE + TILE / 2,
    toY: (FINAL_DUNGEON_POS.y + 1) * TILE + TILE / 2,
    label: "leave the Hidden Dungeon",
  });

  overworldLevel.portals.push(
    {
      x: DUNGEON_ENTRANCE.x,
      y: DUNGEON_ENTRANCE.y,
      toLevelId: levelId("dungeon"),
      toX: dungeonLevel.spawnX,
      toY: dungeonLevel.spawnY,
      label: "enter the Dungeon",
    },
    {
      x: CASTLE_ENTRANCE.x,
      y: CASTLE_ENTRANCE.y,
      toLevelId: levelId("castle"),
      toX: castleLevel.spawnX,
      toY: castleLevel.spawnY,
      label: "enter the Castle",
    }
  );
  dungeonLevel.portals.push({
    x: dungeonLevel.doorX,
    y: dungeonLevel.doorY,
    toLevelId: overworldLevelId,
    toX: DUNGEON_ENTRANCE.x * TILE + TILE / 2,
    toY: (DUNGEON_ENTRANCE.y + 1) * TILE + TILE / 2,
    label: "leave the Dungeon",
  });
  castleLevel.portals.push({
    x: castleLevel.doorX,
    y: castleLevel.doorY,
    toLevelId: overworldLevelId,
    toX: CASTLE_ENTRANCE.x * TILE + TILE / 2,
    toY: (CASTLE_ENTRANCE.y + 1) * TILE + TILE / 2,
    label: "leave the Castle",
  });

  // World 1 only: Oliver's own personal house (defeat-respawn/initial spawn
  // always return here regardless of which world is currently active).
  if (worldNumber === 1) {
    const houseLevel = buildInterior({ width: 11, height: 9, wallTile: T.WALL, floorTile: T.FLOOR, chests: [] });
    houseLevel.map[6][2] = T.CHEST; // bottom-left
    houseLevel.chestTiles.push({ x: 2, y: 6, storageId: "house_chest" });

    // Decorative dressing — hand-placed only here, not through
    // buildInterior() (which every other interior, including the empty/
    // elder/trader village houses, still uses bare). Interior floor spans
    // x:1-9, y:1-7 (11x9 room, 1-tile wall border); door is at (5,8).
    // Layout: bed top-left, chest bottom-left, stove top-right, table +
    // chairs bottom-right, a big rug across the middle of the room.
    houseLevel.furniture = new Map();
    function placeFurniture(x, y, kind, yOffset) {
      houseLevel.map[y][x] = T.FURNITURE;
      houseLevel.furniture.set(key(x, y), { kind, yOffset });
    }
    placeFurniture(2, 4, "bed"); // top-left, head against the north wall
    placeFurniture(8, 1, "stove", 8); // top-right; yOffset leaves a small gap to the north wall
    placeFurniture(8, 5, "table"); // bottom-right, against the east wall
    placeFurniture(8, 4, "chair"); // north of the table
    placeFurniture(8, 6, "chair"); // south of the table
    // Windows — two adjacent wall tiles each (twice the single-tile width),
    // running along each wall's own length since it's only 1 tile thick.
    houseLevel.map[6][0] = T.WINDOW_WALL; // west wall, clear of the bed above it
    houseLevel.map[7][0] = T.WINDOW_WALL;
    houseLevel.map[3][10] = T.WINDOW_WALL; // east wall
    houseLevel.map[4][10] = T.WINDOW_WALL;
    houseLevel.rugRect = { x: 4, y: 3, w: 3, h: 3 }; // tile units — one big rug, not a single small tile

    overworldLevel.portals.push({
      x: HOUSE_ENTRANCE.x,
      y: HOUSE_ENTRANCE.y,
      toLevelId: "house",
      toX: houseLevel.spawnX,
      toY: houseLevel.spawnY,
      label: "enter the House",
    });
    houseLevel.portals.push({
      x: houseLevel.doorX,
      y: houseLevel.doorY,
      toLevelId: overworldLevelId,
      toX: HOUSE_ENTRANCE.x * TILE + TILE / 2,
      toY: (HOUSE_ENTRANCE.y + 1) * TILE + TILE / 2,
      label: "leave the House",
    });
    levels.house = houseLevel;
    LEVEL_TO_WORLD.house = worldNumber;
  }

  // Village: quest-giver + vendor houses, plus one still genuinely empty
  // (matching World 1's precedent). World 1's elder keeps its fixed id and
  // already has "gather_wood"; every world's elder also gets that world's
  // own main quest appended.
  const elderNpcId = worldNumber === 1 ? "village_elder" : levelId("village_elder");
  const mainQuestId = levelId("defeat_guardians");
  if (worldNumber !== 1) {
    registerNPC(elderNpcId, { name: "Village Elder", icon: "🧑‍🌾" });
  }
  NPC_DEFS[elderNpcId].questIds.push(mainQuestId);

  QUEST_DEFS[mainQuestId] = {
    id: mainQuestId,
    giverId: elderNpcId,
    name: `Guardians of World ${worldNumber}`,
    objective: { type: "defeat_bosses", bossIds: [dungeonBossId, castleBossId] },
    reward: {},
    dialogue: {
      offer:
        "Two Guardians protect an ancient power in this valley — one in the Dungeon, one in the Castle. Defeat them, and bring their crystals to the Altar in the village.",
      inProgress: "The Guardians still stand. Seek them out in the Dungeon and the Castle.",
      readyToComplete: "You've slain both Guardians! Now bring their crystals to the Altar at the village center.",
      completed: "The Altar's power grows with what you've brought it. Thank you, traveler.",
    },
  };

  const villageHouses = VILLAGE_HOUSE_POSITIONS.map((pos, i) => ({
    ...pos,
    npc: i === 0 ? elderNpcId : i === 1 ? "village_trader" : null,
  }));
  villageHouses.forEach((house, i) => {
    const label = `House ${i + 2}`;
    const level = buildInterior({ width: 9, height: 7, wallTile: T.WALL, floorTile: T.FLOOR, chests: [] });
    overworldLevel.portals.push({
      x: house.x,
      y: house.y,
      toLevelId: levelId(house.id),
      toX: level.spawnX,
      toY: level.spawnY,
      label: `enter ${label}`,
    });
    level.portals.push({
      x: level.doorX,
      y: level.doorY,
      toLevelId: overworldLevelId,
      toX: house.x * TILE + TILE / 2,
      toY: (house.y + 1) * TILE + TILE / 2,
      label: `leave ${label}`,
    });
    if (house.npc) {
      level.map[2][4] = T.NPC;
      level.npcTile = { x: 4, y: 2, npcId: house.npc };
    }

    // Decorative dressing, matching each house's role — applies to every
    // world (this loop already runs per-world), same as the NPC placement
    // above. Interior floor spans x:1-7, y:1-5 (9x7 room); NPC stands at
    // (4,2), door is at (4,6). House 4 (i === 2) has no NPC yet and stays
    // genuinely bare, reserved for future content.
    level.furniture = new Map();
    function placeFurniture(x, y, kind) {
      level.map[y][x] = T.FURNITURE;
      level.furniture.set(key(x, y), { kind });
    }
    if (i === 0) {
      // Elder: a humble bed, a bookshelf, a small rug.
      placeFurniture(2, 4, "bed"); // top-left, head against the north wall
      placeFurniture(6, 2, "bookshelf"); // top-right
      level.map[3][0] = T.WINDOW_WALL; // west wall (two tiles, twice the single-tile width)
      level.map[4][0] = T.WINDOW_WALL;
      level.rugRect = { x: 4, y: 3, w: 2, h: 2 };
    } else if (i === 1) {
      // Trader: a counter beside them, stock in a barrel and a cabinet.
      placeFurniture(2, 2, "table"); // counter, level with the trader
      placeFurniture(2, 4, "barrel");
      placeFurniture(6, 4, "cabinet");
      level.map[1][8] = T.WINDOW_WALL; // east wall (two tiles, twice the single-tile width)
      level.map[2][8] = T.WINDOW_WALL;
    }

    levels[levelId(house.id)] = level;
    LEVEL_TO_WORLD[levelId(house.id)] = worldNumber;
  });

  overworldLevel.altarTile = { x: ALTAR_POS.x, y: ALTAR_POS.y, world: worldNumber };

  levels[overworldLevelId] = overworldLevel;
  levels[levelId("dungeon")] = dungeonLevel;
  levels[levelId("castle")] = castleLevel;
  levels[finalBossLevelId] = finalBossLevel;
  LEVEL_TO_WORLD[overworldLevelId] = worldNumber;
  LEVEL_TO_WORLD[levelId("dungeon")] = worldNumber;
  LEVEL_TO_WORLD[levelId("castle")] = worldNumber;
  LEVEL_TO_WORLD[finalBossLevelId] = worldNumber;

  WORLD_INFO[worldNumber] = {
    overworldLevelId,
    overworldLevel,
    dungeonBossId,
    castleBossId,
    finalBossId,
    finalBossLevelId,
    finalBossLevel,
    // Just south of the altar, on open village ground — where a player
    // arrives stepping in from the previous world's portal.
    arrivalSpawn: { x: ALTAR_POS.x * TILE + TILE / 2, y: (ALTAR_POS.y + 2) * TILE + TILE / 2 },
  };
  worldProgress[worldNumber] = { finalBossRevealed: false, portalOpened: false };
}

// Stamps the hidden dungeon's entrance onto its world's overworld map and
// links its portal both ways (the return portal was already wired in
// buildWorld(), it just had nowhere to be entered from until now).
function revealFinalBoss(world) {
  const info = WORLD_INFO[world];
  const pos = FINAL_DUNGEON_POS;
  info.overworldLevel.resources.delete(key(pos.x, pos.y));
  info.overworldLevel.map[pos.y][pos.x] = T.HIDDEN_DUNGEON_ENTRANCE;
  info.overworldLevel.portals.push({
    x: pos.x,
    y: pos.y,
    toLevelId: info.finalBossLevelId,
    toX: info.finalBossLevel.spawnX,
    toY: info.finalBossLevel.spawnY,
    label: "enter the Hidden Dungeon",
  });
}

// The altar is a tile-based interactable like every other one in the game
// (see nearestAltar()/the E-key cascade in game.js), not an NPC — this is
// its whole state machine: reveal -> defeat -> open portal -> step through.
function interactWithAltar(altar) {
  const world = altar.world;
  const info = WORLD_INFO[world];
  const progress = worldProgress[world];

  if (!progress.finalBossRevealed) {
    const have = getResourceCount("magic_crystal");
    if (have >= 2) {
      removeResource("magic_crystal", 2);
      progress.finalBossRevealed = true;
      revealFinalBoss(world);
      const mainQuestId = `${world === 1 ? "" : `world${world}_`}defeat_guardians`;
      questState[mainQuestId] = "completed";
      if (isQuestPanelOpen()) renderQuestPanel();
      showMessage("Altar", "The altar glows with power... a hidden path has been revealed somewhere in the valley!");
    } else {
      showMessage("Altar", `This altar needs 2 Guardian Crystals to reveal a hidden power. You have ${have}.`);
    }
    return;
  }

  if (!bossDefeated[info.finalBossId]) {
    showMessage("Altar", "A powerful guardian awaits in the hidden dungeon. Return once it has been defeated.");
    return;
  }

  if (!progress.portalOpened) {
    const have = getResourceCount("magic_crystal");
    if (have >= 1) {
      removeResource("magic_crystal", 1);
      progress.portalOpened = true;
      if (!WORLD_INFO[world + 1]) buildWorld(world + 1);
      showMessage("Altar", "The altar erupts with light... a portal to a new valley has opened!");
    } else {
      showMessage("Altar", "The altar awaits the final crystal.");
    }
    return;
  }

  const nextInfo = WORLD_INFO[world + 1];
  activateLevel(nextInfo.overworldLevelId, nextInfo.arrivalSpawn.x, nextInfo.arrivalSpawn.y);
}
