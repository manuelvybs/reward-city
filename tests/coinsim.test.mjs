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

test('coins appear around the card, never at the hero', () => {
  const rnd = seeded();
  for (let k = 0; k < 40; k++) {
    const spout = { x: 0.2, y: 1.0 };
    const c = launch(spout, 1, rnd, centre);
    const fromCard = Math.hypot(c.x - centre.x, c.y - centre.y), fromHero = Math.hypot(c.x - spout.x, c.y - spout.y);
    assert.ok(fromCard >= 0.8 && fromCard <= 1.8, `spawned ${fromCard.toFixed(2)} m from the card`);
    assert.ok(fromHero > 1.0, `spawned ${fromHero.toFixed(2)} m from the hero`);
    assert.ok(c.y > centre.y - 0.5, 'not spawned below the card');
  }
});

test('every coin spirals into the card within 0.9 s, wherever the hero stands, and hits it once', () => {
  const rnd = seeded(3);
  for (const [sx, lift] of [[1.6, 0], [0.2, 0], [-2.0, 0], [3.6, 0], [7.2, 0], [0.2, 1.5]]) {
    const box = { x0: CARD.x0, x1: CARD.x1, y0: CARD.y0 + lift, y1: CARD.y1 + lift };
    for (let k = 0; k < 30; k++) {
      const c = launch({ x: sx, y: 1.0 }, sx < centre.x ? 1 : -1, rnd, { x: centre.x + (rnd() - 0.5) * 0.6, y: centre.y + lift + (rnd() - 0.5) * 0.3 });
      let hits = 0, t = 0;
      while (t < 0.9 && !c.hit) { stepCoin(c, DT); t += DT; if (hitsBox(c, box)) hits++; }
      assert.equal(hits, 1, `hero at ${sx} (lift ${lift}): no hit after ${t.toFixed(2)} s at ${c.x.toFixed(2)},${c.y.toFixed(2)}`);
    }
  }
});

test('no coin ever comes near the floor or the hero', () => {
  const rnd = seeded(11);
  for (let k = 0; k < 40; k++) {
    const spout = { x: 0.2, y: 1.0 };
    const c = launch(spout, 1, rnd, centre);
    let low = c.y, near = Infinity;
    while (!coinDone(c) && !c.hit) { stepCoin(c, DT); low = Math.min(low, c.y); near = Math.min(near, Math.hypot(c.x - spout.x, c.y - spout.y)); if (hitsBox(c, CARD)) break; }
    assert.ok(low > 0.55, `dipped to ${low}`);
    assert.ok(near > 1.0, `came within ${near.toFixed(2)} m of the hero`);
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
