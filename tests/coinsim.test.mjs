import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Meter, launch, stepCoin, hitsBox } from '../src/coinsim.js';
import { BEAM } from '../src/config.js';

const fixed = () => 0.5;   // rnd that gives the centre of every jitter range

function fly(c, groundY = 0) {
  let top = c.y;
  for (let i = 0; i < 400 && !c.landed; i++) { stepCoin(c, 1 / 120, groundY); top = Math.max(top, c.y); }
  return top;
}

test('beaming for 1 s drains 17 and emits about 30 coins', () => {
  const m = new Meter();
  let coins = 0;
  for (let i = 0; i < 120; i++) coins += m.beam(1 / 120);
  assert.ok(Math.abs(m.value - (100 - BEAM.drain)) < 1e-6, `value ${m.value}`);
  assert.ok(coins >= 29 && coins <= 31, `coins ${coins}`);
});

test('the meter never goes below 0 and an empty meter emits nothing', () => {
  const m = new Meter(5);
  let coins = 0;
  for (let i = 0; i < 240; i++) coins += m.beam(1 / 120);
  assert.equal(m.value, 0);
  const before = coins;
  for (let i = 0; i < 120; i++) coins += m.beam(1 / 120);
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

test('a coin launched facing right lands 1.2-4.5 m ahead and arcs above the spout', () => {
  const spout = { x: 0, y: 0.8 };
  const c = launch(spout, 1, fixed);
  const top = fly(c);
  assert.ok(c.landed);
  assert.ok(c.x > 1.2 && c.x < 4.5, `landed at ${c.x}`);
  assert.ok(top > spout.y + 0.3, `top ${top}`);
});

test('facing left mirrors the flight', () => {
  const r = launch({ x: 0, y: 0.8 }, 1, fixed), l = launch({ x: 0, y: 0.8 }, -1, fixed);
  fly(r); fly(l);
  assert.ok(Math.abs(r.x + l.x) < 1e-6, `${r.x} vs ${l.x}`);
});

test('jitter spreads the stream', () => {
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);   // seeded, independent draws
  const xs = Array.from({ length: 50 }, () => { const c = launch({ x: 0, y: 0.8 }, 1, rnd); fly(c); return c.x; });
  assert.ok(Math.max(...xs) - Math.min(...xs) > 0.4, `spread ${Math.max(...xs) - Math.min(...xs)}`);
});

test('a coin passing through a box hits it once', () => {
  const box = { x0: 1.5, x1: 2.4, y0: 0, y1: 1.6 };
  const c = launch({ x: 0, y: 0.8 }, 1, fixed);
  let hits = 0;
  for (let i = 0; i < 400 && !c.landed; i++) { stepCoin(c, 1 / 120, 0); if (hitsBox(c, box)) hits++; }
  assert.equal(hits, 1);
  assert.equal(c.hit, true);
});
