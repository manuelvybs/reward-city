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

// a coin leaving the phone at `spout`, thrown forward in the facing direction (+1 right, -1 left).
// rnd() in [0,1) picks the jitter; 0.5 gives the centre of every range.
export function launch(spout, facing, rnd = Math.random) {
  const ang = (BEAM.angle + (rnd() * 2 - 1) * BEAM.angleJitter) * DEG;
  const spd = BEAM.speed + (rnd() * 2 - 1) * BEAM.speedJitter;
  return {
    x: spout.x, y: spout.y, z: (spout.z || 0) + (rnd() - 0.5) * 0.12,
    vx: facing * Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
    spin: (rnd() * 2 - 1) * 14, age: 0, landedAt: 0,
    hit: false, landed: false,
  };
}

export function stepCoin(c, dt, groundY = 0) {
  c.age += dt;
  if (c.landed) return;
  c.vy -= BEAM.gravity * dt;
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  if (c.y <= groundY + BEAM.radius) { c.y = groundY + BEAM.radius; c.landed = true; c.landedAt = c.age; }
}

// box = { x0, x1, y0, y1 }; true the first time the coin is inside it
export function hitsBox(c, box) {
  if (c.hit || c.landed) return false;
  if (c.x < box.x0 || c.x > box.x1 || c.y < box.y0 || c.y > box.y1) return false;
  c.hit = true;
  return true;
}

// a coin is finished once it hit something, or lay on the ground for its life
export const coinDone = (c) => c.hit || (c.landed && c.age - c.landedAt > BEAM.life);
