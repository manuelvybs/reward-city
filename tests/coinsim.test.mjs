import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Meter, launch, stepCoin, hitsBox, coinDone } from '../src/coinsim.js';
import { BEAM } from '../src/config.js';

const DT = 1 / 120;
const seeded = (s = 7) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const CARD = { x0: 2.1, x1: 3.1, y0: 0.72, y1: 1.42 };
const centre = { x: 2.6, y: 1.07 };

test('redeeming for 1 s drains 17 and emits about 30 coins', () => {
  const m = new Meter();
  let coins = 0;
  for (let i = 0; i < 120; i++) coins += m.beam(DT);
  assert.ok(Math.abs(m.value - (100 - BEAM.drain)) < 1e-6, `value ${m.value}`);
  assert.ok(coins >= 29 && coins <= 31, `coins ${coins}`);
});

test('the meter never goes below 0 and an empty meter emits nothing', () => {
  const m = new Meter(5);
  let coins = 0;
  for (let i = 0; i < 240; i++) coins += m.beam(DT);
  assert.equal(m.value, 0);
  const before = coins;
  for (let i = 0; i < 120; i++) coins += m.beam(DT);
  assert.equal(coins, before);
});

test('playing refills at 55/s and caps at 100', () => {
  const m = new Meter(0);
  m.refill(1);
  assert.ok(Math.abs(m.value - BEAM.refill) < 1e-6);
  m.refill(5);
  assert.equal(m.value, 100);
  assert.equal(m.full, true);
});

test('coins pop UP out of the phone first, like a fountain', () => {
  const rnd = seeded();
  for (let k = 0; k < 20; k++) {
    const c = launch({ x: 0.2, y: 1.0 }, 1, rnd, centre);
    let top = c.y;
    for (let i = 0; i < 0.3 / DT; i++) { stepCoin(c, DT); top = Math.max(top, c.y); }
    assert.ok(top > 1.0 + 0.45, `top ${top}`);
  }
});

test('every coin reaches the card within 1.3 s from near, far, either side and below, and hits it once', () => {
  const rnd = seeded(3);
  // spouts 1 m to 4.6 m away on both sides, and a card 1.5 m higher than usual (on a step)
  for (const [sx, face, lift] of [[1.6, 1, 0], [0.2, 1, 0], [-2.0, 1, 0], [3.6, -1, 0], [7.2, -1, 0], [0.2, 1, 1.5]]) {
    const box = { x0: CARD.x0, x1: CARD.x1, y0: CARD.y0 + lift, y1: CARD.y1 + lift };
    for (let k = 0; k < 30; k++) {
      const c = launch({ x: sx, y: 1.0 }, face, rnd, { x: centre.x + (rnd() - 0.5) * 0.6, y: centre.y + lift + (rnd() - 0.5) * 0.3 });
      let hits = 0, t = 0;
      while (t < 1.3 && !c.hit) { stepCoin(c, DT); t += DT; if (hitsBox(c, box)) hits++; }
      assert.equal(hits, 1, `from ${sx} (lift ${lift}): no hit after ${t.toFixed(2)} s at ${c.x.toFixed(2)},${c.y.toFixed(2)}`);
    }
  }
});

test('no coin ever drops to the floor, even one that misses its card', () => {
  const rnd = seeded(11);
  for (const target of [centre, { x: -40, y: 1 }]) {                // a card, and a target it cannot reach in its life
    for (let k = 0; k < 30; k++) {
      const c = launch({ x: 0.2, y: 1.0 }, 1, rnd, target);
      let low = c.y;
      while (!coinDone(c) && !c.hit) { stepCoin(c, DT); low = Math.min(low, c.y); if (hitsBox(c, CARD)) break; }
      assert.ok(low > 0.75, `dipped to ${low}`);
    }
  }
});

test('a coin is finished once it hits, or after its short life', () => {
  const c = launch({ x: 0.2, y: 1.0 }, 1, seeded(), centre);
  assert.equal(coinDone(c), false);
  c.hit = true;
  assert.equal(coinDone(c), true);
  const d = launch({ x: 0.2, y: 1.0 }, 1, seeded(), centre);
  for (let i = 0; i < 4 / DT; i++) stepCoin(d, DT);
  assert.equal(coinDone(d), true);
});
