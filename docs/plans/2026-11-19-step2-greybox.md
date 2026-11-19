# Reward City — Step 2 (rough playable level) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The whole course playable end to end with the taller astronaut and placeholder shapes: street, steps, 6 kiosks, 8 locked cards, the gap crossed on the card bridge, the card-stair tower up to the high ledge, broken stairs down, the gift box that needs all 8 cards, finale, end card.

**Architecture:** Gameplay is pure logic that runs in Node and in the browser: `level.js` (walk pieces + ground queries), `player.js` (walk/jump physics), `game.js` (meter, coins, cards, kiosks, checkpoints, respawn, finale, events, `colourAt(x)`, `autopilot`). The browser renders it: `world.js` (greybox), `cards.js` (cards, bridge, tower, box), `hud.js`, `input.js`, `main.js` (fixed 120 Hz step, camera, `window.__game`).

**Tech Stack:** three.js 0.187.0 (vendored), ES modules, `node:test`, Playwright 1.61.1.

---

## File map

| File | Responsibility | Depends on |
|---|---|---|
| `src/level.js` | `PIECES` (flat walk tops, solid below), `BRIDGE`, `TOWER` (enabled by cards 3 / 6), `WALLS`, `KIOSKS`, `CARD_DEFS`, `BOX`; `groundBelow(x, y, pieces)`, `blocked(x, feetY, pieces)`, `activePieces(state)` | config |
| `src/player.js` | `Player`: `update(dt, input, pieces)` walk 2.6 / 1.6 m/s, jump 6.2 m/s, gravity 17, coyote 0.1 s, buffer 0.12 s, step-up 0.34 m, half-width 0.22 m, walls | level, config |
| `src/game.js` | `Game`: `step(dt, input, spout?)` → meter, coin stream, card hits/unlocks, bridge/tower growth, kiosk play/refill, box deny/open, finale timer, checkpoints, respawn below y −4, `events[]`; `colourAt(x)`; `autopilot(game)` → input | level, player, coinsim, config |
| `src/input.js` | keyboard + mouse → `{left,right,jump,beam,start,restart}` (jump/start/restart as presses) | — |
| `src/world.js` | sky gradient, greybox pieces (stone grey), background block buildings at 3 depths tinted by `colourAt`, kiosk placeholders with screens | three, level |
| `src/cards.js` | card stands (lock texture → brand card, pop + flight to the HUD), card bridge (8 m of cards appearing plank by plank), card stairs (stacks rising), gift box (shake on deny, burst on open) | three, level |
| `src/hud.js` | title, 8 card slots (grey → brand), coin meter, hint line, end card | config |
| `src/main.js` | renderer, lights, camera follow, loop, URL flags (`?autostart ?x= ?cards= ?colour ?autopilot ?speed=`), `window.__game` | all |
| `index.html` | canvas, overlays, import map | — |
| `tests/level.test.mjs`, `tests/player.test.mjs`, `tests/game.test.mjs` | node tests | level, player, game |
| `tools/playtest.mjs` | headless GPU run with `?autopilot&speed=3`: screenshots at every unlock, finale and end; fails on console errors; `--video` | — |

## Course (metres, feet heights; matches the spec, two shifts noted)

- Street 0 at −6…22; steps 0.45 at 22…24.5 and 0.9 at 24.5…27 (each needs a jump); upper street 0.9 at 27…44.
- Gap 44…52 (no ground): the card bridge (0.9) appears when card 3 opens.
- Plaza 0.3 at 52…90. **Card 6 moved to 82** so the card stairs fit: 9 steps 84.5…90, each 0.61 m wide and 0.455 m higher, top at 4.4.
- Wall at 90; high ledge 4.4 at 90…122; broken stairs 3.3 / 2.25 at 122…126; yard 1.2 at 126…202.
- Kiosks 3, 38, 69, 99, 135, 171. Cards: Amazon 13, Visa 33, Starbucks 42.5 (bridge), Netflix 61, Walmart 79, DoorDash 82 (stairs), PayPal 111, Cash App 150. Gift box 186.
- Card face 1.0 × 0.65 m on a 0.75 m post: hit box x ±0.5, y ground+0.72…1.42. Box hit box x ±1.4, y ground…ground+2.6; needs 90 hits after all 8 cards.
- Spout default (Node): x + facing·0.22, y + 0.87; the browser passes the phone's real spout.
- Finale: colour floods over 7 s; end card at 9 s.

## Tasks

- [ ] **1. level.js + tests (TDD):** ground at the start is 0; the steps block walking (0.45 > 0.34) but are under jump apex; the gap has no ground without the bridge and 0.9 with it; the wall at 90 blocks from the plaza; with the tower each step is jumpable and the top meets the ledge; walls at −6 and 202.
- [ ] **2. player.js + tests (TDD):** walking right for 1 s covers 2.4–2.7 m; the first step stops a walk but a jump lands on it; walking off the upper street into the gap falls (and `Game` respawns at the last checkpoint); can't pass x 90 without the tower.
- [ ] **3. game.js + tests (TDD):** beaming from 2.3 m unlocks a card in under 2.5 s and emits an `unlock` event; card 3 enables the bridge; beaming the box early emits `deny` and counts nothing; standing at a kiosk refills to 100; `colourAt` is 0 far from cards and rises near an opened one; autopilot finishes the course (8 cards, finale, `ended`) within 400 simulated seconds.
- [ ] **4. world.js + cards.js:** greybox and placeholders driven by the game state; coins drawn with `CoinRenderer`.
- [ ] **5. hud.js + input.js + main.js + index.html:** title → play → end; camera follow (fov 30, ~11.5 m back, look-ahead, smooth y).
- [ ] **6. Check:** `npm test`; `node tools/playtest.mjs --video` passes with 0 console errors; look at the beat screenshots; commit; check-in with Manuel.

## As built (2026-11-19)

- 29 node tests pass; the autopilot finishes the course in 111 simulated seconds with no respawns (≈ a 2-minute game).
- `node tools/playtest.mjs` passes in the browser (speed 3: 40 s, 0 errors) with a screenshot per card, finale and end; `--video --speed=1` recorded `art-src/step2-playthrough.mp4` (114 s).
- Card 6 moved to x 82 so 9 card stairs fit at 84.5–90. Coins hit best from 2.6 m (box 2.9 m).
- Greybox colour = per-chunk ground tint + coloured building blocks from `game.colourAt(x)`; step 4 swaps it for the painted wash.
