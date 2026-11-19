# Reward City — design

Approved by Manuel 2026-11-19 in chat. Companion game to Reward River (2026-11-18).

A browser game starring the VYBS astronaut. It keeps the gameplay beats of the fal showcase game
"Rust Bloom" (https://fal-video-to-game.vercel.app/A05_RUST-BLOOM/index.html): a 2.5D side-scroller
through a grey city where colour comes back as you go. The code, art, layout and sound are our own;
nothing is copied from the reference (not its code, sprites, textures, models, sounds or level map).
Manuel asked for "like Rust Bloom, but the astronaut"; we keep the mood (soft painted, misty, grey
ruins) and the beats, and draw everything new.

## The idea

Play games, earn rewards. The astronaut carries his phone with the VYBS app. At game kiosks he plays
and fills his coin meter. Holding the action button beams a stream of gold coins from the phone. Eight
grey, locked gift cards stand along the way; fill one with coins and it pops open, flies into the HUD
row and paints the city around it back into colour. A giant grey gift box at the end opens only once
all eight cards are unlocked: the whole city floods with colour and the end card reads
"Play games. Earn gift cards."

## Mechanic map (reference role → ours)

| Reference | Reward City |
|---|---|
| Robot | VYBS astronaut (rigged hero from Reward River, 13 clips) |
| Watering can | Phone with the VYBS app (screen shows real VYBS UI) |
| Water meter (100) | Coin meter (100), bottom-left, a coin stack that empties |
| Hand pump refill | Game kiosk: stand at it, the hero plays on the phone, coins fill at 55/s |
| Pour (hold) | Beam (hold): coins arc from the phone, 17 coins/s drain, slower walk while beaming |
| Rusted flower ×8 | Locked grey gift card on a stand ×8; needs 38 coin hits; wobbles and warms as it fills |
| Bloom | Card pops open (crumble + reveal), flies to its HUD slot, colour wash spreads ~8 m |
| Vine bridge | Gift-card bridge across a gap, grown by card 3 |
| Giant stalk | Tower of stacked gift cards, grown by card 6; its cards are steps up to the high ledge |
| Great bud | Giant grey gift box; needs all 8 cards (beaming it early shakes it and pulses the empty slots) |
| Finale | Box bursts, colour floods the whole city over ~7 s, cards and confetti rain, end card |

Cards, in order: Amazon, Visa, Starbucks, Netflix, Walmart, DoorDash, PayPal, Cash App
(the card images VYBS already uses in its playables, `vybs-playables/src/assets/cards/`).

## World and look

A crumbling grey town in morning mist: shuttered shopfronts, a dead arcade hall, empty billboards and
sign frames, a water tower, tram wires, rubble and broken paving. Soft storybook paint, distant layers
fading into haze. The art is painted **in colour** (VYBS evening palette: indigo `#3A43C4`, VYBS indigo
`#5B69FE`, lavender `#A8B1E7`, gold `#FFD401`, warm window light) and the shader shows it grey until
the colour field reaches it. The wash edge is a soft, noisy wet-paint border.

## Level (side view, x to the right, metres; feet heights)

| x | Beat |
|---|---|
| -6 | left wall |
| 0–22 | start street; kiosk K1 at 3; card 1 Amazon at 13 |
| 22–27 | two steps up to 0.9 |
| 27–44 | upper street; card 2 Visa at 33; kiosk K2 at 38; card 3 Starbucks at 42.5 on the gap edge |
| 44–52 | gap (falling respawns at the last checkpoint); card 3 grows the card bridge across it |
| 52–90 | plaza at 0.3; card 4 Netflix at 61; kiosk K3 at 69; card 5 Walmart at 79 |
| 88 | card 6 DoorDash at the foot of a 4.4 m wall; it grows the card tower (steps every ~0.45 m) |
| 90–122 | high ledge at 4.4; kiosk K4 at 99; card 7 PayPal at 111 |
| 122–128 | broken stairs down to 1.2 |
| 128–160 | yard; kiosk K5 at 135; card 8 Cash App at 150 |
| 160–200 | square; kiosk K6 at 171; gift box at 186 |
| 202 | right wall |

Checkpoints: every kiosk and every unlocked card.

## Controls

- Keyboard: ← → / A D walk, Space / W / ↑ jump, hold J / Shift / X to beam, Enter start, M mute, R restart.
- Mouse: hold the left button to beam.
- Touch (landscape): left/right pads bottom-left, jump and beam buttons bottom-right.
- Feel: coyote time and jump buffer; walk 2.6 m/s, 1.6 m/s while beaming.

## Code layout (plain ES modules, three 0.187.0 vendored, no build step)

| File | Job |
|---|---|
| `index.html` | canvas, title/HUD/end overlays, touch pads, import map |
| `src/config.js` | tuning, palette, card list, strings, hero clip map |
| `src/level.js` | pure data + queries: walk pieces, ground/blocked tests, cards, kiosks, bridge/tower pieces |
| `src/player.js` | pure player logic: walk, jump, coin meter, beam, kiosk refill, respawn, `autopilot()` |
| `src/hero.js` | loads the rigged astronaut, animation state, phone prop, arm IK for the beam/play poses |
| `src/coins.js` | coin stream projectiles and hits (instanced) |
| `src/cards.js` | locked cards, unlock sequence, bridge, tower, gift box |
| `src/wash.js` | colour field texture (where colour has come back) and the grey↔colour layer shader |
| `src/world.js` | sky, parallax layers, ground strips, foreground silhouettes, props |
| `src/fx.js` | sparkles, confetti, dust |
| `src/hud.js` | card slots, coin meter, hints, end card |
| `src/audio.js` | WebAudio one-shots, beam loop, music |
| `src/main.js` | renderer, post, camera, loop, input, `window.__game` test hooks |
| `tools/` | fal client + log, screenshot and playtest scripts |
| `art-src/` | concepts and raw images (not shipped) |
| `assets/` | shipped GLB, cards, painted layers, sprites, audio |

## Assets

| Role | Asset |
|---|---|
| Hero | `assets/models/hero.glb` (copied from Reward River) |
| Phone | built in code (rounded body + screen texture from `~/Desktop/VYBS_Screens/UI games.png`) |
| Gift cards | 8 PNGs (webp for shipping) |
| Sky | painted misty morning sky, colour |
| Buildings | 3 parallax layers (far, mid, near), each a set of painted building cut-outs |
| Ground | tiling paving/rubble strip texture |
| Foreground | silhouettes: broken sign frame, girder, cables, rubble |
| Kiosk | VYBS game kiosk (arcade booth) sprite |
| Card stand | grey stand that holds a locked card |
| Gift box | giant gift box, grey and opened states |
| FX | coin, sparkle, confetti atlas |
| Audio | SFX: step, jump, land, beam loop, coin hit, card unlock, kiosk play, kiosk full, box deny, finale, ambience; music: calm grey loop + finale |

Pipeline: concepts with Nano Banana (Manuel approves each look) → cut-outs with `fal-ai/birefnet/v2` →
webp. Audio: `fal-ai/elevenlabs/sound-effects/v2`, `elevenlabs/music/v2.5`. Every fal call is logged
by `tools/fal.mjs` to `tools/fal-log.jsonl`. Prices in USD.

## Steps (a check-in with Manuel after each)

1. Hero: astronaut walks, jumps, holds the phone, beams coins, plays at a kiosk (viewer page).
2. Rough playable level with placeholder shapes: full course, kiosks, 8 cards, bridge, tower, box, HUD, finale logic.
3. Painted art: concepts → approve → layers, kiosk, stand, box, FX.
4. Colour wash shader, card unlock sequence, finale, end card.
5. Sound.
6. Polish: post, particles, touch controls, phone layout, playtest video.
7. Deploy: public repo `manuelvybs/reward-city` → GitHub Pages (ask before pushing).

## Testing

- `npm test`: level queries and player logic in Node, including an autopilot run that unlocks all 8
  cards, opens the box and reaches the end.
- `node tools/playtest.mjs`: headless GPU Chromium plays the level through real key presses,
  saves a screenshot per beat, fails on any console error or missing asset.
- URL flags: `?autostart`, `?x=<metres>`, `?cards=<n>` (start with n unlocked), `?colour` (all colour), `?autopilot`, `?mute`.
