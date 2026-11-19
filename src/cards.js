// Reward City — the eight locked gift cards, the card bridge, the card stairs and the gift box (step 2 placeholders
// in shape, real card images on the faces). Driven by the game state; reacts to its events.
import * as THREE from 'three';
import { CARD, BRIDGE, TOWER, BOX } from './level.js';
import { OPEN_TIME } from './game.js';
import { BEAM } from './config.js';

const BRAND_HUES = { amazon: 0x232f3e, visa: 0x1a1f71, starbucks: 0x00704a, netflix: 0xb20710, walmart: 0x0071ce, doordash: 0xeb1700, paypal: 0x003087, cashapp: 0x00c244 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const back = (t) => { t = clamp(t, 0, 1); const s = 1.7; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };

export async function loadCardTextures(brands) {
  const loader = new THREE.TextureLoader();
  const out = {};
  await Promise.all(brands.map(async b => {
    const t = await loader.loadAsync(`assets/cards/${b}.webp`).catch(() => loader.loadAsync(`assets/cards/${b}.webp`));
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; out[b] = t;
  }));
  return out;
}

export class CardsView {
  constructor(scene, game, tex, paint) {
    this.scene = scene; this.tex = tex; this.paint = paint;
    this.lockTex = lockTexture();
    this.cards = game.cards.map(c => {
      const g = new THREE.Group();
      // the painted stand's post and base (its own portrait frame is cropped off: the card sits on top)
      const post = paint.sprite('stand', { x: 0, y: -0.02, z: -0.03, uv: [0, 0, 1, 0.64], h: 0.95 });
      const face = new THREE.Mesh(new THREE.PlaneGeometry(CARD.w, CARD.h), new THREE.MeshBasicMaterial({ map: this.lockTex, transparent: true, color: 0xffffff }));
      face.position.y = (CARD.y0 + CARD.y1) / 2;
      const backing = new THREE.Mesh(new THREE.BoxGeometry(CARD.w * 0.98, CARD.h * 0.98, 0.03), new THREE.MeshStandardMaterial({ color: 0x9a978f }));
      backing.position.set(0, face.position.y, -0.02); backing.castShadow = true;
      // progress bar under the card: fills gold as coins land
      const barBg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.075), new THREE.MeshBasicMaterial({ color: 0x2b2f7a, transparent: true, opacity: 0.55, depthWrite: false }));
      barBg.position.set(0, CARD.y0 - 0.1, 0.02);
      const barGeo = new THREE.PlaneGeometry(0.86, 0.045); barGeo.translate(0.43, 0, 0);
      const bar = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0xFFD401, toneMapped: false }));
      bar.position.set(-0.43, CARD.y0 - 0.1, 0.025); bar.scale.x = 0.001;
      barBg.visible = bar.visible = false;
      g.add(post, backing, face, barBg, bar);
      g.position.set(c.x, c.y, -0.15);
      scene.add(g);
      if (c.state !== 'locked') { face.material.map = tex[c.brand]; backing.material.color.setHex(BRAND_HUES[c.brand]); }   // opened before the view existed
      return { g, face, backing, bar, barBg, shake: 0, popped: false };
    });

    // bridge: a painted footbridge of gift cards (watercolour + ink), drawn a little from above like the street;
    // squashed to the game's low viewing angle, its deck's middle line sits on the walk height
    const BW = 8.6, SQUASH = 0.6, man = paint.man.bridge;
    const natH = BW / (man.w / man.h), deckMid = (man.deckTop + man.deckBottom) / 2;
    const bridge = paint.sprite('bridge', { x: (BRIDGE.x0 + BRIDGE.x1) / 2, y: 0, z: -0.12, h: natH, force: 1 });
    bridge.scale.y = SQUASH;
    bridge.position.y = BRIDGE.y - (1 - deckMid) * natH * SQUASH;
    bridge.visible = false;
    scene.add(bridge);
    this.bridge = { mesh: bridge, t: -1 };

    // stairs: each step is a painted pile of gift cards (watercolour + ink): a cap (the top card, whose face is the
    // step) plus body slices cut from different heights of the same pile so no two steps look alike
    const PW = 0.66, pm = paint.man.pile, PH = PW / (pm.w / pm.h);            // full pile height at this width
    const CAP = 0.09, WALK = 0.03, BODY0 = 0.02;                              // fractions of the pile height
    const rnd = ((s) => () => ((s = (s * 16807) % 2147483647) / 2147483647))(42);
    const towerGroup = new THREE.Group();
    this.steps = TOWER.steps.map((st, i) => {
      const g = new THREE.Group(), x1 = i < TOWER.steps.length - 1 ? TOWER.steps[i + 1].x0 : st.x1, cx = (st.x0 + x1) / 2;
      const flip = i % 3 === 1, z = -0.15 - i * 0.012;
      const capBottom = st.y + WALK * PH - CAP * PH;
      const cap = paint.sprite('pile', { x: 0, y: capBottom, z, uv: [0, 1 - CAP, 1, 1], h: CAP * PH, force: 1, flip });
      g.add(cap);
      let top = capBottom, bottom = 0.22;
      while (top > bottom + 1e-3) {
        const len = Math.min(top - bottom, (1 - CAP - BODY0) * PH * 0.85), span = len / PH;
        const v0 = BODY0 + rnd() * (1 - CAP - BODY0 - span);
        g.add(paint.sprite('pile', { x: 0, y: top - len, z, uv: [0, v0, 1, v0 + span], h: len, force: 1, flip }));
        top -= len;
      }
      g.position.x = cx; g.userData.height = st.y + WALK * PH - bottom;
      towerGroup.add(g);
      return g;
    });
    towerGroup.visible = false;
    towerGroup.userData.grown = 0;
    scene.add(towerGroup);
    this.tower = { mesh: towerGroup, t: -1 };

    // gift box: painted, closed until the finale, then the opened painting with its lid off
    const closed = paint.sprite('box-closed', { x: 0, y: -0.05, z: 0, h: 3.2 });
    const open = paint.sprite('box-open', { x: 1.7, y: -0.05, z: 0, h: 3.4, force: 1 });
    open.visible = false;
    const box = new THREE.Group();
    box.add(closed, open);
    box.position.set(BOX.x, BOX.y, -0.4);
    scene.add(box);
    this.box = { g: box, closed, open, shake: 0, t: -1 };
  }

  onEvent(e, game) {
    if (e.type === 'hit' && e.i !== 'box') this.cards[e.i].shake = 0.18;
    if (e.type === 'deny') this.box.shake = 0.45;
    if (e.type === 'unlock') {
      const c = this.cards[e.i];
      c.face.material.map = this.tex[e.brand]; c.face.material.color.setHex(0xffffff); c.face.material.needsUpdate = true;
      c.backing.material.color.setHex(BRAND_HUES[e.brand]);
    }
  }

  // screen position of a card face, for the HUD flight
  facePosition(i, out = new THREE.Vector3()) { return this.cards[i].face.getWorldPosition(out); }

  update(game, dt) {
    game.cards.forEach((c, i) => {
      const v = this.cards[i];
      if (c.state === 'locked') {
        v.shake = Math.max(0, v.shake - dt);
        v.g.position.x = c.x + Math.sin(game.time * 70) * v.shake * 0.06;
        const warm = c.hits / BEAM.need;                       // warms toward gold as it fills
        v.face.material.color.setRGB(1, 1 - warm * 0.12, 1 - warm * 0.45);
        v.bar.visible = v.barBg.visible = c.hits > 0;
        v.bar.scale.x = Math.max(0.001, warm);
      } else {
        v.g.position.x = c.x;
        v.bar.visible = v.barBg.visible = false;
        const t = c.state === 'opening' ? c.t / OPEN_TIME : 1;
        const s = c.state === 'opening' ? 1 + Math.sin(t * Math.PI) * 0.45 : 1;
        v.face.scale.setScalar(s);
        v.face.position.y = (CARD.y0 + CARD.y1) / 2 + Math.sin(clamp(t, 0, 1) * Math.PI) * 0.25;
        v.face.rotation.y = c.state === 'opening' ? (1 - easeOut(t)) * Math.PI * 2 : 0;
      }
    });

    // the bridge paints itself in from left to right once card 3 opens
    if (game.bridge) {
      const b = this.bridge; b.t = b.t < 0 ? (game.cards[2].openedAt < -50 ? 9 : 0) : b.t + dt;
      b.mesh.visible = true;
      b.mesh.material.uniforms.uReveal.value = easeOut(clamp(b.t / 1.3, 0, 1));
    }
    // the piles grow up out of the plaza one after another once card 6 opens (hidden inside the plaza until then)
    if (game.tower) {
      const tw = this.tower; tw.t = tw.t < 0 ? (game.cards[5].openedAt < -50 ? 9 : 0) : tw.t + dt;
      tw.mesh.visible = true;
      let least = 1;
      this.steps.forEach((g, i) => {
        const k = back((tw.t - i * 0.11) / 0.4);
        g.position.y = -(1 - clamp(k, 0, 1)) * g.userData.height;
        least = Math.min(least, clamp((tw.t - i * 0.11) / 0.4, 0, 1));
      });
      tw.mesh.userData.grown = least;
    }
    // gift box: shakes when refused, glows toward colour once every card is in, swaps to the opened painting
    const bx = this.box, gb = game.box;
    bx.shake = Math.max(0, bx.shake - dt);
    bx.g.position.x = BOX.x + Math.sin(game.time * 60) * bx.shake * 0.08;
    const ready = game.openCount === game.cards.length;
    if (gb.state === 'locked') {
      const u = bx.closed.material.uniforms.uForce;
      u.value = ready ? Math.max(gb.hits / gb.need, 0.35 + 0.25 * Math.sin(game.time * 4)) : 0;
      bx.closed.scale.setScalar(1 + (ready ? 0.015 * Math.sin(game.time * 8) : 0));
    } else {
      bx.t = bx.t < 0 ? 0 : bx.t + dt;
      bx.closed.visible = false; bx.open.visible = true;
      bx.open.scale.setScalar(1 + Math.sin(clamp(bx.t / 0.6, 0, 1) * Math.PI) * 0.12);
    }
  }
}

function lockTexture() {
  const c = document.createElement('canvas'); c.width = 400; c.height = 260;
  const x = c.getContext('2d');
  const rr = (l, t, w, h, r) => { x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); };
  x.fillStyle = '#a5a29b'; rr(4, 4, 392, 252, 26); x.fill();
  x.strokeStyle = '#85827c'; x.lineWidth = 6; rr(4, 4, 392, 252, 26); x.stroke();
  x.fillStyle = '#76736e'; rr(168, 118, 64, 54, 9); x.fill();
  x.strokeStyle = '#76736e'; x.lineWidth = 13; x.beginPath(); x.arc(200, 118, 22, Math.PI, 0); x.stroke();
  x.fillStyle = '#8e8b85'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText('GIFT CARD', 200, 220);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
