// Reward City — the rules: coin meter, coin stream, locked cards, card bridge and stairs, kiosks, gift box,
// checkpoints, respawn and finale. Pure logic (no three.js): the browser renders it, Node tests it.
import { BEAM } from './config.js';
import { CARD_DEFS, CARD, KIOSKS, KIOSK_REACH, BOX, activePieces, groundBelow } from './level.js';
import { Player, HALF_W } from './player.js';
import { Meter, launch, stepCoin, hitsBox, coinDone } from './coinsim.js';

export const OPEN_TIME = 1.0;            // card pop + flight
export const CHEER_LOCK = 1.1;           // the hero celebrates; no walking
export const FINALE_FLOOD = 7;           // seconds for colour to fill the city
export const END_AT = 9;                 // end card
const COLOUR_RADIUS = 9;

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => t * t * (3 - 2 * t);

export class Game {
  // opts: { x, y, meter, cards (n already open), seed }
  constructor(opts = {}) {
    this.cards = CARD_DEFS.map(d => ({ ...d, hits: 0, state: 'locked', t: 0, openedAt: -99 }));
    this.box = { ...BOX, hits: 0, state: 'locked', t: 0, denyAt: -99 };
    this.bridge = false; this.tower = false;
    this.time = 0; this.finaleT = -1; this.ended = false;
    this.events = []; this.log = [];
    this.coins = [];
    this.rnd = mulberry32(opts.seed ?? 1234);
    for (let i = 0; i < (opts.cards || 0); i++) this.open(this.cards[i], true);
    const x = opts.x ?? 0;
    const y = opts.y ?? groundBelow(x, 99, this.pieces) ?? 0;
    this.player = new Player(x, y);
    this.meter = new Meter(opts.meter ?? 100);
    this.checkpoint = { x, y };
    this.lockT = 0; this.playing = false; this.beaming = false; this.kiosk = null; this.emptyAt = -99;
  }

  get pieces() { return activePieces({ bridge: this.bridge, tower: this.tower }); }
  get openCount() { return this.cards.filter(c => c.state !== 'locked').length; }

  emit(e) { e.t = this.time; this.events.push(e); this.log.push(e); if (this.log.length > 400) this.log.shift(); }

  // spout: where coins leave the phone (the browser passes the phone's real top edge)
  step(dt, input = {}, spout = null) {
    this.time += dt;
    const p = this.player, pieces = this.pieces;
    const frozen = this.finaleT >= 0 || this.lockT > 0;
    this.lockT = Math.max(0, this.lockT - dt);

    // kiosk: stand still at one to play and fill the meter
    const k = KIOSKS.find(k => Math.abs(p.x - k.x) < KIOSK_REACH && Math.abs(p.y - k.y) < 0.3 && p.onGround) || null;
    if (k && this.kiosk !== k) this.setCheckpoint(k.x, k.y);
    this.kiosk = k;
    const moving = input.left || input.right;
    const wasPlaying = this.playing;
    this.playing = !!k && !moving && !input.beam && !frozen && !this.meter.full;
    if (this.playing) {
      if (!wasPlaying) this.emit({ type: 'play', k: k.i });
      this.meter.refill(dt);
      if (this.meter.full) this.emit({ type: 'full', k: k.i });
    }

    this.beaming = !!input.beam && !frozen && !this.playing;
    p.update(dt, { left: input.left, right: input.right, jump: input.jump, beam: this.beaming, frozen }, pieces);
    if (p.jumped) this.emit({ type: 'jump' });
    if (p.landed) this.emit({ type: 'land' });

    // coins out of the phone
    if (this.beaming) {
      const n = this.meter.beam(dt);
      const s = spout || { x: p.x + p.facing * HALF_W, y: p.y + 0.87, z: 0.1 };
      for (let i = 0; i < n; i++) this.coins.push(launch(s, p.facing, this.rnd));
      if (this.meter.empty && this.time - this.emptyAt > 1.5) { this.emptyAt = this.time; this.emit({ type: 'empty' }); }
    }
    this.stepCoins(dt, pieces);

    for (const c of this.cards) if (c.state === 'opening' && (c.t += dt) >= OPEN_TIME) c.state = 'open';
    if (this.box.state === 'opening' && (this.box.t += dt) >= OPEN_TIME) this.box.state = 'open';

    if (this.finaleT >= 0) {
      this.finaleT += dt;
      if (!this.ended && this.finaleT >= END_AT) { this.ended = true; this.emit({ type: 'end' }); }
    }

    if (p.y < -4) {
      p.x = this.checkpoint.x; p.y = this.checkpoint.y; p.vx = p.vy = 0; p.onGround = true;
      this.emit({ type: 'respawn' });
    }
  }

  stepCoins(dt, pieces) {
    const all = this.openCount === this.cards.length;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      stepCoin(c, dt, groundBelow(c.x, c.y + 0.2, pieces) ?? -10);
      for (const card of this.cards) {
        if (card.state !== 'locked') continue;
        if (hitsBox(c, { x0: card.x - CARD.hw, x1: card.x + CARD.hw, y0: card.y + CARD.y0, y1: card.y + CARD.y1 })) {
          this.emit({ type: 'hit', i: card.i });
          if (++card.hits >= BEAM.need) this.open(card);
          break;
        }
      }
      const b = this.box;
      if (!c.hit && b.state === 'locked' && hitsBox(c, { x0: b.x - b.hw, x1: b.x + b.hw, y0: b.y, y1: b.y + b.h })) {
        if (!all) {
          if (this.time - b.denyAt > 1.2) { b.denyAt = this.time; this.emit({ type: 'deny' }); }
        } else {
          this.emit({ type: 'hit', i: 'box' });
          if (++b.hits >= b.need) { b.state = 'opening'; this.finaleT = 0; this.emit({ type: 'finale' }); }
        }
      }
      if (coinDone(c) || c.y < -6) this.coins.splice(i, 1);
    }
  }

  open(card, silent = false) {
    card.state = silent ? 'open' : 'opening';
    card.t = silent ? OPEN_TIME : 0;
    card.openedAt = silent ? -99 : this.time;
    card.hits = Math.max(card.hits, BEAM.need);
    if (card.grows === 'bridge') this.bridge = true;
    if (card.grows === 'tower') this.tower = true;
    if (silent) return;
    this.lockT = CHEER_LOCK;
    const cx = card.x - 1.5;
    this.setCheckpoint(cx, groundBelow(cx, card.y + 0.5, this.pieces) ?? card.y);
    this.emit({ type: 'unlock', i: card.i, brand: card.brand });
  }

  setCheckpoint(x, y) { this.checkpoint = { x, y }; }

  // how much colour has come back at x (0 grey .. 1 full colour)
  colourAt(x) {
    let v = 0;
    for (const c of this.cards) {
      if (c.state === 'locked') continue;
      const grow = c.openedAt < -50 ? 1 : smooth(clamp((this.time - c.openedAt) / 2.5, 0, 1));
      const r = COLOUR_RADIUS * grow;
      if (r <= 0) continue;
      v = Math.max(v, 1 - smooth(clamp((Math.abs(x - c.x) - r * 0.55) / (r * 0.45), 0, 1)));
    }
    if (this.finaleT >= 0) v = Math.max(v, smooth(clamp((this.finaleT - 1) / FINALE_FLOOD, 0, 1)));
    return v;
  }

  drainEvents() { const e = this.events; this.events = []; return e; }
}

// --- autopilot: plays the whole course (tests, playtest, ?autopilot) ----------------------------------------
import { blocked } from './level.js';
const STAND_CARD = 2.6, STAND_BOX = 2.9;

export function autopilot(g) {
  const p = g.player, out = { left: false, right: false, jump: false, beam: false };
  if (g.finaleT >= 0 || g.lockT > 0) return out;
  const mem = g._ap || (g._ap = { refill: null });
  const target = g.cards.find(c => c.state === 'locked') || (g.box.state === 'locked' ? g.box : null);
  if (!target) return out;

  // out of coins: walk back to the nearest kiosk behind and play until full
  if (g.meter.empty && !mem.refill) mem.refill = [...KIOSKS].filter(k => k.x <= p.x + 0.5).pop() || KIOSKS[0];
  if (mem.refill) {
    if (g.meter.full) mem.refill = null;
    else return steer(g, mem.refill.x, out, 0.25);
  }
  // top up at any kiosk we pass on the way
  if (g.kiosk && !g.meter.full && g.kiosk.x < target.x) return out;

  const spot = target.x - (target === g.box ? STAND_BOX : STAND_CARD);
  if (Math.abs(p.x - spot) < 0.3 && p.onGround && Math.abs(p.y - target.y) < 0.6) {
    if (p.facing < 0) { out.right = true; return out; }       // turn to face it
    out.beam = true;
    return out;
  }
  return steer(g, spot, out, 0.15);
}

function steer(g, x, out, tol) {
  const p = g.player;
  if (Math.abs(p.x - x) <= tol) return out;
  const dir = x > p.x ? 1 : -1;
  if (dir > 0) out.right = true; else out.left = true;
  if (p.onGround && blocked(p.x + dir * (HALF_W + 0.2), p.y, g.pieces)) out.jump = true;
  return out;
}
