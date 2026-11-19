// Reward City — the eight locked gift cards, the card bridge, the card stairs and the gift box (step 2 placeholders
// in shape, real card images on the faces). Driven by the game state; reacts to its events.
import * as THREE from 'three';
import { CARD, BRIDGE, TOWER, BOX } from './level.js';
import { OPEN_TIME } from './game.js';
import { BEAM } from './config.js';

const BRAND_HUES = { amazon: 0x232f3e, visa: 0x1a1f71, starbucks: 0x00704a, netflix: 0xb20710, walmart: 0x0071ce, doordash: 0xeb1700, paypal: 0x003087, cashapp: 0x00c244 };
const HUE_LIST = Object.values(BRAND_HUES);
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

    // bridge: gift cards laid side by side across the gap
    const n = 9, bw = (BRIDGE.x1 - BRIDGE.x0) / n;
    this.bridge = { mesh: new THREE.InstancedMesh(new THREE.BoxGeometry(bw * 0.96, 0.08, 1.5), new THREE.MeshStandardMaterial({ roughness: 0.4 }), n), n, bw, t: -1 };
    for (let i = 0; i < n; i++) this.bridge.mesh.setColorAt(i, new THREE.Color(HUE_LIST[i % HUE_LIST.length]));
    this.bridge.mesh.castShadow = this.bridge.mesh.receiveShadow = true;
    this.bridge.mesh.count = 0;
    scene.add(this.bridge.mesh);

    // stairs: stacks of card slabs rising to each step top
    const slabs = [];
    let prevTop = 0.3;
    TOWER.steps.forEach((s, i) => {
      const x1 = i < TOWER.steps.length - 1 ? TOWER.steps[i + 1].x0 : s.x1;
      for (let y = 0.3, k = 0; y < s.y - 1e-6; y += 0.075, k++) slabs.push({ x: (s.x0 + x1) / 2, w: x1 - s.x0, y: Math.min(y + 0.075, s.y), i, k, hue: HUE_LIST[(i * 3 + k) % HUE_LIST.length], twist: ((i * 7 + k * 13) % 9 - 4) * 0.012 });
      prevTop = s.y;
    });
    this.slabs = slabs;
    this.tower = { mesh: new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.07, 1.5), new THREE.MeshStandardMaterial({ roughness: 0.45 }), slabs.length), t: -1 };
    slabs.forEach((s, i) => this.tower.mesh.setColorAt(i, new THREE.Color(s.hue)));
    this.tower.mesh.castShadow = this.tower.mesh.receiveShadow = true;
    this.tower.mesh.count = 0;
    scene.add(this.tower.mesh);

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

    // bridge grows plank by plank once card 3 opens
    if (game.bridge) {
      const b = this.bridge; b.t = b.t < 0 ? (game.cards[2].openedAt < -50 ? 9 : 0) : b.t + dt;
      const m = new THREE.Matrix4();
      b.mesh.count = b.n;
      for (let i = 0; i < b.n; i++) {
        const k = back((b.t - i * 0.12) / 0.35);
        m.compose(new THREE.Vector3(BRIDGE.x0 + (i + 0.5) * b.bw, BRIDGE.y - 0.04 - (1 - clamp(k, 0, 1)) * 1.5, -0.2),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (i % 2 ? 1 : -1) * 0.02), new THREE.Vector3(Math.max(0.001, k), 1, 1));
        b.mesh.setMatrixAt(i, m);
      }
      b.mesh.instanceMatrix.needsUpdate = true;
    }
    // stairs stack up once card 6 opens
    if (game.tower) {
      const tw = this.tower; tw.t = tw.t < 0 ? (game.cards[5].openedAt < -50 ? 9 : 0) : tw.t + dt;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), ax = new THREE.Vector3(0, 1, 0);
      tw.mesh.count = this.slabs.length;
      this.slabs.forEach((s, i) => {
        const k = clamp((tw.t - s.i * 0.12 - s.k * 0.008) / 0.25, 0, 1);
        m.compose(new THREE.Vector3(s.x, s.y - 0.035 + (1 - k) * 2.5, -0.2), q.setFromAxisAngle(ax, s.twist), new THREE.Vector3(s.w * 0.98, k > 0 ? 1 : 0.001, 1));
        tw.mesh.setMatrixAt(i, m);
      });
      tw.mesh.instanceMatrix.needsUpdate = true;
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
