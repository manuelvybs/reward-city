import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PIECES, BRIDGE, TOWER, WALLS, KIOSKS, CARD_DEFS, BOX, STEP_UP, groundBelow, blocked, activePieces } from '../src/level.js';
import { TUNING } from '../src/config.js';

const APEX = TUNING.jump ** 2 / (2 * TUNING.gravity);
const base = activePieces({ bridge: false, tower: false });
const all = activePieces({ bridge: true, tower: true });

test('the street starts at height 0', () => {
  assert.equal(groundBelow(0, 1, base), 0);
});

test('the first step blocks a walk but is lower than the jump apex', () => {
  assert.ok(blocked(22.05, 0, base));
  assert.ok(0.45 > STEP_UP && 0.45 < APEX - 0.2);
  assert.equal(groundBelow(23, 2, base), 0.45);
  assert.equal(groundBelow(26, 2, base), 0.9);
});

test('the gap has no ground until the card bridge grows', () => {
  assert.equal(groundBelow(48, 2, base), null);
  assert.equal(groundBelow(48, 2, all), BRIDGE.y);
});

test('the wall at 90 blocks the plaza until the card stairs grow, and every stair is jumpable', () => {
  assert.ok(!blocked(84.6, 0.3, base));            // no stairs yet: the plaza runs on to the wall
  assert.ok(blocked(90.05, 0.3, base));
  assert.ok(blocked(84.55, 0.3, all));             // first stair needs a hop
  let y = 0.3;
  for (const s of TOWER.steps) {
    const rise = s.y - y;
    assert.ok(rise > 0 && rise < APEX - 0.2, `rise ${rise}`);
    y = s.y;
  }
  assert.ok(Math.abs(y - 4.4) < 1e-6);
  assert.equal(groundBelow(95, 5, all), 4.4);
});

test('walls close both ends', () => {
  assert.ok(blocked(WALLS[0] - 0.01, 0, base));
  assert.ok(blocked(WALLS[1] + 0.01, 1.2, base));
});

test('every kiosk, card and the box stands on ground', () => {
  for (const k of KIOSKS) assert.notEqual(groundBelow(k.x, 10, all), null, `kiosk ${k.x}`);
  for (const c of CARD_DEFS) assert.notEqual(groundBelow(c.x, 10, all), null, `card ${c.brand}`);
  assert.notEqual(groundBelow(BOX.x, 10, all), null);
  assert.equal(CARD_DEFS.length, 8);
});
