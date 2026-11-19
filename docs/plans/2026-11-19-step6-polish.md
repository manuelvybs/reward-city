# Reward City — Step 6 (polish: touch, phone layout, post) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Plays well on a phone and looks finished: on-screen pads, a layout that works in landscape and portrait, a soft painterly post pass, and small feel fixes.

**Architecture:** `input.js` gains touch pads (multi-touch pointer events on DOM buttons; mouse beam only for real mice). `index.html` shows the pads on coarse pointers (`body.touch`), moves the coin meter to the top-left there. `main.js` keeps at least 11 m of street in view at any aspect (vertical FOV widens in portrait) and shows a "turn your phone" hint in portrait. `post.js` (from Reward River): soft bloom on the lit bits, a gentle grade, watercolour paper grain and a vignette, with the frame-rate watchdog (`?lowq` / `?hiq`).

---

## Tasks

- [ ] **1. Touch:** pads ◀ ▶ bottom-left, JUMP and BEAM (hold) bottom-right, ~18 vmin, translucent, pressed state; each pad tracks its own pointerId (two thumbs at once); tap anywhere on title/end still starts. `touch-action: none` on the page.
- [ ] **2. Layout:** vertical FOV = max(30°, the one that shows 11 m of street); portrait banner "turn your phone sideways for the best view" (non-blocking, fades after 5 s); HUD sizes in vmin so the 8 slots and hints fit on a 390 px wide screen.
- [ ] **3. Post:** bloom 0.25 / threshold 0.92 (coins, sparkles, kiosk glow, windows in colour); grade (slight contrast, warm-cool split); paper grain texture (procedural, fixed to the screen) at 6%; vignette; watchdog drops bloom then pixel ratio below 40 fps.
- [ ] **4. Feel:** quick fade-to-white flash on a respawn; game and audio pause while the tab is hidden; share tags (title, description, image) for step 7.
- [ ] **5. Check:** `npm test`; desktop playtest; phone playtest (844×390, hasTouch): pads drive the real input (walk, jump, beam a card open), screenshots landscape + portrait; video → Manuel.

## As built (2026-11-19)

- Touch pads (◀ ▶ JUMP, HOLD·BEAM) shown on coarse pointers or the first touch; each pad tracks its own pointerIds (two thumbs), pad presses stopPropagation so they never count as "tap to start"; mouse beam only for `pointerType === 'mouse'`. Meter moves top-left on touch; first hint says "hold BEAM" on touch.
- Vertical FOV = max(30°, the one showing 11 m of street): 87° in portrait, plus a fading "turn your phone sideways" banner.
- `post.js` (from Reward River): bloom 0.25 / thr 0.92, gentle grade, procedural paper grain 6%, vignette, watchdog (bloom off, then pixel ratio 1 below 40 fps); `?lowq`, `?hiq`.
- Respawn flash; audio suspends with the tab; share tags + `assets/ui/share.jpg` (`tools/share-image.mjs`).
- Fix: cards opened before the view existed (`?cards=n`, restart) now show their brand face.
- `tools/phonetest.mjs`: CDP touch events → real pads: tap start, walk 1.46 m, beam card 1 open (38 hits), two-thumb jump 1.1 m, portrait FOV 87°; 0 errors. Desktop playtest 0 errors; `npm test` 29/29.
