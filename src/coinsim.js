// Reward City — coin meter and coin flight. Pure logic (no three.js), shared by the game, the viewer and the tests.
import { BEAM } from './config.js';

const DEG = Math.PI / 180;

export class Meter {
  constructor(value = 100) { this.value = value; this.acc = 0; }
  get full() { return this.value >= 100; }
  get empty() { return this.value <= 0; }
  // drain while beaming; returns how many coins to emit this frame
  beam(dt) {
    if (this.value <= 0) { this.acc = 0; return 0; }
    this.value = Math.max(0, this.value - BEAM.drain * dt);
    this.acc += BEAM.rate * dt;
    const n = Math.floor(this.acc + 1e-9);
    this.acc -= n;
    return n;
  }
  refill(dt) { this.value = Math.min(100, this.value + BEAM.refill * dt); }
}

// Redeeming: coins appear out of thin air in a ring around the gift card (on its far side and above it, never on
// the hero's side) and spiral into it. Nothing travels from the hero, nothing falls to the floor.
// rnd() in [0,1) picks the spread. target = { x, y } (world) or null (viewer only: a little pop above the phone).
const PULL = 0.16;                         // seconds before the pull into the card is at full strength
export function launch(spout, facing, rnd = Math.random, target = null) {
  if (!target) return { x: spout.x, y: spout.y, z: spout.z || 0, vx: (rnd() - 0.5), vy: 2 + rnd(), spin: 10, age: 0, hit: false, target: null };
  const side = Math.sign(target.x - spout.x) || facing;            // +1: the card is to the hero's right
  // angles measured from +x: right half + top when the hero is on the left, mirrored otherwise
  const a0 = side > 0 ? -0.1 : Math.PI * 0.25, a1 = side > 0 ? Math.PI * 0.75 : Math.PI + 0.1;
  const ang = a0 + rnd() * (a1 - a0), r = 0.8 + rnd() * 0.8, swirl = 2.2 + rnd() * 1.2;
  const ox = Math.cos(ang), oy = Math.sin(ang);
  return {
    x: target.x + ox * r, y: target.y + oy * r, z: (rnd() - 0.5) * 0.3 + 0.15,
    vx: -oy * swirl * side + ox * 0.6, vy: ox * swirl * side + oy * 0.6,          // around the card, a touch outward
    spin: (rnd() * 2 - 1) * 14, age: 0, hit: false,
    target: { x: target.x, y: target.y },
  };
}

export function stepCoin(c, dt) {
  c.age += dt;
  if (c.target) {
    const k = Math.min(1, c.age / PULL);
    const dx = c.target.x - c.x, dy = c.target.y - c.y, d = Math.hypot(dx, dy) || 1e-6;
    const speed = 3 + 7 * k + d * 2;
    const steer = 1 - Math.exp(-(4 + 12 * k) * dt);
    c.vx += (dx / d * speed - c.vx) * steer;
    c.vy += (dy / d * speed - c.vy) * steer;
  } else c.vy -= 4 * dt;
  c.x += c.vx * dt;
  c.y += c.vy * dt;
}

// box = { x0, x1, y0, y1 }; true the first time the coin is inside it
export function hitsBox(c, box) {
  if (c.hit || c.landed) return false;
  if (c.x < box.x0 || c.x > box.x1 || c.y < box.y0 || c.y > box.y1) return false;
  c.hit = true;
  return true;
}

// a coin is finished once it hit something, or after its short life in the air
export const coinDone = (c) => c.hit || c.age > BEAM.life;
