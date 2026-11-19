import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../src/player.js';
import { activePieces } from '../src/level.js';

const DT = 1 / 120;
const base = activePieces({});
function run(p, sec, input, pieces = base) {
  for (let i = 0; i < sec / DT; i++) { p.update(DT, typeof input === 'function' ? input(i) : input, pieces); }
  return p;
}

test('walking right for 1 s covers about 2.4 m', () => {
  const p = run(new Player(0, 0), 1, { right: true });
  assert.ok(p.x > 2.2 && p.x < 2.7, `x ${p.x}`);
  assert.equal(p.y, 0);
  assert.equal(p.facing, 1);
});

test('beaming slows the walk', () => {
  const a = run(new Player(0, 0), 1, { right: true });
  const b = run(new Player(0, 0), 1, { right: true, beam: true });
  assert.ok(b.x < a.x * 0.75);
});

test('the first step stops a walk', () => {
  const p = run(new Player(20, 0), 2, { right: true });
  assert.ok(p.x < 22 && p.x > 21.5, `x ${p.x}`);
  assert.equal(p.y, 0);
});

test('a jump lands on the first step', () => {
  const p = run(new Player(21.4, 0), 1.2, (i) => ({ right: true, jump: i === 0 }));
  assert.ok(p.x > 22, `x ${p.x}`);
  assert.ok(p.y >= 0.45 - 1e-6 && p.onGround, `y ${p.y}`);
});

test('walking off the upper street falls into the gap', () => {
  const p = run(new Player(43, 0.9), 2, { right: true });
  assert.ok(p.y < -1, `y ${p.y}`);
});

test('the high wall cannot be passed without the card stairs', () => {
  const p = run(new Player(87, 0.3), 3, (i) => ({ right: true, jump: i % 40 === 0 }));
  assert.ok(p.x < 90, `x ${p.x}`);
});

test('hopping up the card stairs reaches the ledge', () => {
  const pieces = activePieces({ tower: true });
  const p = run(new Player(83, 0.3), 8, (i) => ({ right: true, jump: i % 30 === 0 }), pieces);
  assert.ok(p.x > 91 && Math.abs(p.y - 4.4) < 1e-6, `x ${p.x} y ${p.y}`);
});

test('a frozen player does not walk', () => {
  const p = run(new Player(0, 0), 1, { right: true, frozen: true });
  assert.ok(Math.abs(p.x) < 1e-6);
});
