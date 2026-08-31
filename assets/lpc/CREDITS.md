# Art credits

Assets from the Liberated Pixel Cup (LPC) base asset pack (opengameart.org).

## OGA-BY 3.0 (attribution required, no share-alike)

- `grass.png` — Lanea Zimmerman ("Sharm")
- `tree.png` (cropped from `treetop.png`) — Lanea Zimmerman ("Sharm")
- `rock.png` — Lanea Zimmerman ("Sharm")
- `dungeon_wall.png` (cropped from `dungeon.png`) — Lanea Zimmerman ("Sharm")
- `dungeon_floor.png` / `path.png` (cropped from `dirt.png`) — Lanea Zimmerman ("Sharm")
- `chest.png` (cropped from `chests.png`) — Lanea Zimmerman ("Sharm")
- `fence.png` / `gate.png` (cropped from `bridges.png`) — Lanea Zimmerman ("Sharm")
- `altar.png` (from `cup.png`) — Lanea Zimmerman ("Sharm")

## CC-BY-SA 3.0 / GPL 3.0 (attribution required, share-alike for derivatives)

- `castle_wall.png` (cropped from `castlewalls.png`) — Daniel Armstrong ("HughSpectrum")
- `castle_floor.png` (cropped from `castlefloors.png`) — Daniel Armstrong ("HughSpectrum")

Base pack source: https://opengameart.org/content/liberated-pixel-cup-lpc-base-assets-sprites-map-tiles

## Player sprites — composited from the wider Universal LPC Spritesheet
## Character Generator (same 64x64 grid as the base pack above, so all of
## these layer together directly)

Source: https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator
All layers below: OGA-BY 3.0 (also dual/multi-licensed CC-BY-SA/GPL —
using the most permissive applicable option).

**`player_base.png`** (currently in use) — humble starting look: body +
head + simple shirt/pants + hair, no armor. (The "body" layer in this repo
is headless by design — heads are their own separate layer; missing that
the first time round is what left the face blank.)
- Body (`body/bodies/male/walk.png`) — bluecarrot16, JaidynReiman, Benjamin
  K. Smith, Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano,
  Durrani, Johannes Sjölund (wulax), Stephen Challener (Redshrike)
- Head (`head/heads/human/male/walk.png`) — bluecarrot16, Benjamin K. Smith
  (BenCreating), Stephen Challener (Redshrike)
- Pants (`legs/pants/male/walk.png`) — bluecarrot16, JaidynReiman, ElizaWy,
  Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener
- Shirt (`torso/clothes/longsleeve/longsleeve/male/walk.png`) —
  JaidynReiman, Johannes Sjölund (wulax)
- Hair (`hair/plain/adult/walk.png`) — JaidynReiman, Manuel Riecke
  (MrBeast), Joe White — **recolored blonde** (no pre-made blonde file
  exists in the repo; the tool applies color at runtime, so this was done
  as a direct palette remap of the shading ramp, preserving the shading
  structure)

**`soldier_helmet.png`** (kept, currently unused) — `soldier.png` armor
from the base pack (Manuel Riecke) + a "norman" helmet
(`hat/helmet/norman/adult/walk.png` — ElizaWy, Sander Frenken/"castelonia")
— earmarked for a possible future "found armor visually changes the
player" mechanic.

## NPC sprites — same base body/head/pants as the player, single static
## down-facing frame each (NPCs never move, so no walk cycle is needed)

**`elder.png`** (Village Elder) — body/head/pants as above + the player's
existing longsleeve shirt layer, recolored **grey** hair (same manual
palette-remap technique used for the player's blonde hair — no pre-made
grey/white file exists in the repo either).
- Hair (`hair/plain/adult/walk.png`) — JaidynReiman, Manuel Riecke
  (MrBeast), Joe White — **recolored grey**

**`trader.png`** (Village Trader) — body/head/pants + the player's shirt
layer + a leather apron on top, plain (unrecolored) hair for contrast
against the player's blonde and the elder's grey.
- Apron (`torso/aprons/apron/male/walk/leather.png`) — Nila122

Both licensed OGA-BY 3.0 (also dual/multi-licensed CC-BY-SA/GPL — using
the most permissive applicable option), same as every other layer above.

## Enemy/boss sprites — `assets/lpc/enemies/`, a single down-facing frame
## each (used as a static portrait in the battle screen/encounter marker
## and, for bosses, drawn oversized on their overworld boss tile)

From the LPC base asset pack's own `sprites/monsters/` folder (same source/
license as the tile assets above — Lanea Zimmerman "Sharm", OGA-BY 3.0):
- `bat.png` (Cave Bat)
- `ghost.png` (Ghost)
- `royal_wraith.png` (Castle Boss) — cropped from `pumpking.png`, a
  crowned pumpkin monster; picked over a plain reskin of the Ghost sprite
  above specifically because it's already wearing a crown, matching "Royal"
  more directly than a recolor would.

From the Universal LPC Spritesheet Character Generator repo (same source as
the player/NPC sprites above), OGA-BY 3.0:
- `skeleton.png` (Skeleton) — `body/bodies/skeleton/walk.png` —
  bluecarrot16, Napsio, JaidynReiman, Johannes Sjölund (wulax), Stephen
  Challener (Redshrike)
- `bone_lord.png` (Dungeon Boss) — `body/bodies/zombie/walk.png` +
  `head/heads/zombie/adult/walk.png` (the zombie body is headless by
  design too, same gotcha as the player's — caught before shipping this
  time) — Stephen Challener (Redshrike), Johannes Sjölund (wulax), Sander
  Frenken (castelonia), Benjamin K. Smith (BenCreating), bluecarrot16
- `shadow_sovereign.png` (Final Boss) — the same skeleton body above,
  **recolored** dark purple/black with glowing red eyes (manual palette
  remap of the shading ramp, same technique as the blonde/grey hair
  recolors) — differentiates it from the plain white Skeleton enemy and
  the Dungeon Boss without needing a fourth body type sourced.

`rat.png` (Dungeon Rat) — from the separate "Rodents" pack (32x32,
orthogonal directions), not LPC-sourced:
- Tuomo Untinen (Reemax), Jordan Irwin (AntumDeluge) — CC-BY 3.0 / CC-BY-SA 3.0
- https://opengameart.org/content/rodents-rat-rework

`spider.png` (Giant Spider) — from a separate commissioned spider sheet set,
not LPC-sourced:
- Stephen "Redshrike" Challener (graphic artist), William.Thompsonj
  (contributor) — OGA-BY 3.0 (also multi-licensed CC-BY/GPL)
- https://opengameart.org/content/lpc-spider
