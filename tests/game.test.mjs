import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, autopilot } from '../src/game.js';
import { CARD_DEFS, KIOSKS, BOX, groundBelow } from '../src/level.js';

const DT = 1 / 120;
function run(g, sec, input) {
  for (let i = 0; i < sec / DT; i++) g.step(DT, typeof input === 'function' ? input(g, i) : input);
  return g;
}
const types = (g) => g.log.map(e => e.type);

test('beaming at a card from 2.6 m unlocks it in under 2.5 s', () => {
  const c = CARD_DEFS[0];
  const g = new Game({ x: c.x - 2.6 });
  run(g, 2.5, { beam: true });
  assert.notEqual(g.cards[0].state, 'locked', `hits ${g.cards[0].hits}`);
  assert.ok(types(g).includes('unlock'));
});

test('card 3 grows the bridge and card 6 the stairs', () => {
  const g = new Game({ x: CARD_DEFS[2].x - 2.6, y: 0.9, cards: 2 });          // as in play: the earlier cards are open
  run(g, 2.5, { beam: true });
  assert.equal(g.bridge, true);
  assert.notEqual(groundBelow(48, 2, g.pieces), null);
  const h = new Game({ x: CARD_DEFS[5].x - 2.6, y: 0.3, cards: 5 });
  run(h, 2.5, { beam: true });
  assert.equal(h.tower, true);
});

test('redeeming stands still, faces the card, and spends nothing with no card in reach', () => {
  const c = CARD_DEFS[0];
  const g = new Game({ x: c.x + 2.6 });                                     // card to the LEFT
  g.player.facing = 1;
  run(g, 0.5, { beam: true, right: true });
  assert.ok(Math.abs(g.player.x - (c.x + 2.6)) < 0.05, `walked to ${g.player.x}`);
  assert.equal(g.player.facing, -1);
  const far = new Game({ x: 5 });                                           // 8 m from the first card
  run(far, 1, { beam: true });
  assert.equal(far.meter.value, 100);
  assert.equal(far.coins.length, 0);
  assert.ok(types(far).includes('notarget'));
});

test('the gift box refuses coins until all eight cards are open', () => {
  const g = new Game({ x: BOX.x - 2.9, y: BOX.y });
  run(g, 2, { beam: true });
  assert.equal(g.box.hits, 0);
  assert.equal(g.box.state, 'locked');
  assert.ok(types(g).includes('deny'));
});

test('the gift box opens the finale once every card is open', () => {
  const g = new Game({ x: BOX.x - 2.9, y: BOX.y, cards: 8 });
  run(g, 6, { beam: true });
  assert.notEqual(g.box.state, 'locked', `box hits ${g.box.hits}`);
  assert.ok(g.finaleT >= 0);
  run(g, 10, {});
  assert.equal(g.ended, true);
});

test('standing at a kiosk refills the meter', () => {
  const k = KIOSKS[1];
  const g = new Game({ x: k.x, y: k.y, meter: 10 });
  run(g, 2, {});
  assert.equal(g.meter.value, 100);
  assert.ok(types(g).includes('play'));
});

test('falling into the gap respawns at the last checkpoint', () => {
  const g = new Game({ x: 43, y: 0.9 });
  g.checkpoint = { x: 38, y: 0.9 };
  run(g, 3, { right: true });
  assert.ok(types(g).includes('respawn'));
  assert.ok(g.player.y > 0);
});

test('colour comes back only around opened cards', () => {
  const g = new Game({ x: CARD_DEFS[0].x - 2.6 });
  assert.equal(g.colourAt(CARD_DEFS[0].x), 0);
  run(g, 6, { beam: true });
  assert.ok(g.colourAt(CARD_DEFS[0].x) > 0.9);
  assert.equal(g.colourAt(100), 0);
});

test('the autopilot finishes the course', () => {
  const g = new Game();
  let t = 0;
  while (!g.ended && t < 400) { g.step(DT, autopilot(g)); t += DT; }
  assert.equal(g.cards.filter(c => c.state !== 'locked').length, 8, `stuck at x ${g.player.x.toFixed(1)} y ${g.player.y.toFixed(2)}`);
  assert.equal(g.ended, true, `t ${t.toFixed(0)} x ${g.player.x.toFixed(1)}`);
  assert.ok(!types(g).includes('respawn'));
  console.log(`  autopilot run: ${t.toFixed(0)} s simulated`);
});
