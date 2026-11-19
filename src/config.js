// Reward City — tuning numbers, palette, cards and strings shared by the game, the viewer and the tests.

export const TUNING = {
  heroHeight: 1.2,      // metres
  walk: 2.6,            // m/s
  walkBeam: 1.6,        // m/s while beaming
  jump: 6.2,            // m/s take-off
  gravity: 17,          // m/s² for the hero
};

export const BEAM = {
  drain: 17,            // meter per second while beaming
  rate: 30,             // coins per second
  refill: 55,           // meter per second while playing at a kiosk
  need: 38,             // coin hits that unlock a card
  speed: 5.2,           // coin launch speed, m/s
  angle: 45,            // launch angle, degrees above the facing direction
  angleJitter: 8,       // ± degrees
  speedJitter: 0.25,    // ± m/s
  gravity: 9.8,
  radius: 0.045,        // coin disc radius, metres
  life: 2.2,            // seconds before a landed coin is gone
};

export const HERO = {
  url: 'assets/models/hero.glb',
  // the GLB faces +Z; facing right is yaw +PI/2, turned this much back toward the camera
  camTurn: 0.35,
  bones: {
    head: 'Head', neck: 'neck', spine: 'Spine',
    lArm: 'LeftArm', lFore: 'LeftForeArm', lHand: 'LeftHand',
    rArm: 'RightArm', rFore: 'RightForeArm', rHand: 'RightHand',
  },
};

export const PALETTE = {
  indigo: '#3A43C4',
  vybs: '#5B69FE',
  lavender: '#A8B1E7',
  ice: '#E6F9FE',
  gold: '#FFD401',
  coin: '#F5B700',
  grey: '#B9B6AE',
  mist: '#E4E1DA',
};

// the eight gift cards, in the order they stand along the street
export const CARDS = ['amazon', 'visa', 'starbucks', 'netflix', 'walmart', 'doordash', 'paypal', 'cashapp'];

export const GAME = {
  title: 'Reward City',
  endLine: 'Play games. Earn gift cards.',
};
