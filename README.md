# Reward City

Play games, earn coins, unlock gift cards. The VYBS astronaut walks through a grey watercolour city with his phone: play at the VYBS kiosks to fill the coin meter, walk up to each of the eight locked gift cards and hold the button: he dances, coins pop out of his phone and fly into the card, and every card you unlock paints its street back into colour. Open the giant gift box at the end and the whole city comes alive.

A browser game in plain JavaScript on Three.js, no build step.

**Play:** https://manuelvybs.github.io/reward-city/

## Controls

| | Keyboard | Mouse | Touch (landscape) |
|---|---|---|---|
| Walk | ← → or A D | | ◀ ▶ pads |
| Jump | Space, ↑ or W | | JUMP |
| Redeem coins at a gift card (he dances) | hold J, Shift or X | hold the left button | hold REDEEM |
| Play at a kiosk | stand still at it | | stand still at it |
| Start · restart · sound | Enter · R · M | click | tap |

Best on a laptop, or a phone turned sideways. Add `?lowq` on slow devices.

## How it was made

The gameplay beats follow fal's "Rust Bloom" showcase (a grey city that regains colour, refill stations, a grown bridge, a grown climb, a final bloom). The code, the level, the art and the sound are our own:

- **Hero:** the VYBS astronaut rigged for Reward River, stretched taller (`tools/stretch-hero.mjs`), holding a phone built in code with the VYBS app on its screen; two-bone IK keeps both hands on it.
- **Art:** watercolour + ink line, chosen from three style concepts; 12 images from Nano Banana Pro on fal, cut out and sliced with `tools/cutout.mjs`. One shader shows every painting grey until a growing "wet paint" field reaches it.
- **Sound:** 12 effects (`fal-ai/elevenlabs/sound-effects/v2`) and 2 music tracks (`elevenlabs/music/v2.5`), loudness-matched; footsteps, jump and land come from Reward River.
- **Gift cards:** the card images VYBS uses in its playable ads.

The design and the step-by-step plans are in `docs/`.

## Develop

```bash
npm install
npx http-server . -p 4174 -c-1
npm test
node tools/playtest.mjs
node tools/phonetest.mjs
```

`npm test` runs the level, player and game rules in Node, including an autopilot run of the whole course. `node tools/playtest.mjs` plays the full level in headless Chromium and fails on any console error, missing file or sound (`--video --speed=1` records it with the game's own audio). `node tools/phonetest.mjs` drives the touch pads with real touch events.

URL flags: `?autopilot`, `?autostart`, `?x=<metres>`, `?cards=<n>` (start with n cards open), `?colour`, `?speed=<n>`, `?mute`, `?lowq`, `?hiq`.
