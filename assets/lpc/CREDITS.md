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
