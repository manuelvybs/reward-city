// Reward City — the course as data plus ground queries. Pure (no three.js): shared by the game, renderers and tests.
// Side view: x to the right, y up, metres. Every piece is a flat walk top, solid all the way down unless `thin`.

export const STEP_UP = 0.34;              // walk up anything this high without jumping

export const PIECES = [
  { id: 'street', x0: -6, x1: 22, y: 0 },
  { id: 'step1', x0: 22, x1: 24.5, y: 0.45 },
  { id: 'step2', x0: 24.5, x1: 27, y: 0.9 },
  { id: 'upper', x0: 27, x1: 44, y: 0.9 },
  // gap 44..52
  { id: 'plaza', x0: 52, x1: 90, y: 0.3 },
  { id: 'ledge', x0: 90, x1: 122, y: 4.4 },
  { id: 'broken1', x0: 122, x1: 124, y: 3.3 },
  { id: 'broken2', x0: 124, x1: 126, y: 2.25 },
  { id: 'yard', x0: 126, x1: 202, y: 1.2 },
];

// grown by card 3 (Starbucks): a walkway of gift cards across the gap
export const BRIDGE = { id: 'bridge', x0: 44, x1: 52, y: 0.9, thin: true };

// grown by card 6 (DoorDash): stacks of gift cards climbing to the high ledge, each one a hop higher
const STAIRS = 9, STAIR_X0 = 84.5, STAIR_X1 = 90, STAIR_FROM = 0.3, STAIR_TO = 4.4;
export const TOWER = {
  steps: Array.from({ length: STAIRS }, (_, i) => ({
    id: `stair${i}`, x0: STAIR_X0 + i * (STAIR_X1 - STAIR_X0) / STAIRS, x1: STAIR_X1,
    y: STAIR_FROM + (i + 1) * (STAIR_TO - STAIR_FROM) / STAIRS,
  })),
};

export const WALLS = [-6, 202];

export function activePieces({ bridge = false, tower = false } = {}) {
  const out = PIECES.slice();
  if (bridge) out.push(BRIDGE);
  if (tower) out.push(...TOWER.steps);
  return out;
}

// highest walk top at x that is at or below y (null over a hole)
export function groundBelow(x, y, pieces) {
  let best = null;
  for (const p of pieces) {
    if (x < p.x0 || x >= p.x1 || p.y > y + 1e-6) continue;
    if (best === null || p.y > best) best = p.y;
  }
  return best;
}

// can feet at feetY stand at x? false when a wall or a solid piece rises more than STEP_UP above them
export function blocked(x, feetY, pieces) {
  if (x < WALLS[0] || x > WALLS[1]) return true;
  for (const p of pieces) {
    if (p.thin || x < p.x0 || x >= p.x1) continue;
    if (p.y > feetY + STEP_UP) return true;
  }
  return false;
}

const ALL = activePieces({ bridge: true, tower: true });
const at = (x) => groundBelow(x, 99, ALL);

export const KIOSKS = [3, 38, 69, 99, 135, 171].map((x, i) => ({ i, x, y: at(x) }));

export const CARD_DEFS = [
  { brand: 'amazon', x: 13 },
  { brand: 'visa', x: 33 },
  { brand: 'starbucks', x: 42.5, grows: 'bridge' },
  { brand: 'netflix', x: 61 },
  { brand: 'walmart', x: 79 },
  { brand: 'doordash', x: 82, grows: 'tower' },
  { brand: 'paypal', x: 111 },
  { brand: 'cashapp', x: 150 },
].map((c, i) => ({ ...c, i, y: at(c.x) }));

// card face on its post, relative to the ground it stands on
export const CARD = { hw: 0.5, y0: 0.72, y1: 1.42, w: 1.0, h: 0.65, post: 0.75 };

export const BOX = { x: 186, y: at(186), hw: 1.4, h: 2.6, need: 90 };

export const KIOSK_REACH = 0.6;           // stand this close to a kiosk to play
