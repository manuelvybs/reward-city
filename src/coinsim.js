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

// Coins pop UP out of the phone screen like a little fountain, then curve over and fly into their target (a point
// on the gift card). They never fall to the floor: a coin that reaches nothing just fades out in the air.
// rnd() in [0,1) picks the spread. target = { x, y } (world) or null.
const RISE = 0.22;                         // seconds of free fountain before the homing ramps in
export function launch(spout, facing, rnd = Math.random, target = null) {
  const dir = target ? (Math.sign(target.x - spout.x) || facing) : facing;
  return {
    x: spout.x, y: spout.y, z: (spout.z || 0) + (rnd() - 0.5) * 0.12,
    vx: dir * (0.3 + rnd() * 0.9) + (rnd() - 0.5) * 0.6, vy: BEAM.popUp + rnd() * 1.2,
    spin: (rnd() * 2 - 1) * 14, age: 0, hit: false,
    target: target ? { x: target.x, y: target.y } : null,
  };
}

export function stepCoin(c, dt) {
  c.age += dt;
  const k = c.target ? Math.min(1, Math.max(0, (c.age - RISE * 0.5) / RISE)) : 0;
  if (k > 0) {
    const dx = c.target.x - c.x, dy = c.target.y - c.y, d = Math.hypot(dx, dy) || 1e-6;
    const speed = 4 + 9 * k + d * 1.5;                       // faster the further it has to go
    const steer = 1 - Math.exp(-14 * k * dt);
    c.vx += (dx / d * speed - c.vx) * steer;
    c.vy += (dy / d * speed - c.vy) * steer;
  } else c.vy -= 3 * dt;                                     // the fountain slows as it rises
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
