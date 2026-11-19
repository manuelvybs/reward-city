// Reward City — the astronaut's walk and jump. Pure logic (no three.js).
// input: { left, right, jump (pressed this step), beam, frozen }
import { TUNING } from './config.js';
import { STEP_UP, groundBelow, blocked } from './level.js';

export const HALF_W = 0.22;
const COYOTE = 0.1, BUFFER = 0.12;

export class Player {
  constructor(x = 0, y = 0) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.facing = 1; this.onGround = true;
    this.coyote = 0; this.jumpBuf = 0;
    this.jumped = false; this.landed = false;          // one-step flags for sound / animation
  }

  update(dt, input, pieces) {
    this.jumped = false; this.landed = false;
    const ix = input.frozen ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (ix) this.facing = ix;
    const maxV = input.beam ? TUNING.walkBeam : TUNING.walk;
    this.vx += (ix * maxV - this.vx) * (1 - Math.exp(-(ix ? 12 : 16) * dt));
    if (Math.abs(this.vx) < 1e-4) this.vx = 0;

    // jump with coyote time and a press buffer
    this.coyote = this.onGround ? COYOTE : this.coyote - dt;
    this.jumpBuf = input.jump && !input.frozen ? BUFFER : this.jumpBuf - dt;
    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.vy = TUNING.jump; this.onGround = false; this.coyote = 0; this.jumpBuf = 0; this.jumped = true;
    }

    // sideways, stopped by walls and anything taller than a step
    if (this.vx) {
      const nx = this.x + this.vx * dt;
      if (blocked(nx + Math.sign(this.vx) * HALF_W, this.y, pieces)) this.vx = 0;
      else this.x = nx;
    }

    // up and down
    if (this.onGround) {
      const g = groundBelow(this.x, this.y + STEP_UP, pieces);
      if (g !== null && g >= this.y - STEP_UP) { this.y = g; this.vy = 0; }
      else this.onGround = false;
    }
    if (!this.onGround) {
      this.vy -= TUNING.gravity * dt;
      let ny = this.y + this.vy * dt;
      if (this.vy <= 0) {
        const g = groundBelow(this.x, this.y + 1e-4, pieces);
        if (g !== null && ny <= g) { ny = g; this.vy = 0; this.onGround = true; this.landed = true; }
      }
      this.y = ny;
    }
  }
}
