// Reward City — particles and the finale's falling gift cards. Three instanced layers (sparkle: additive star,
// confetti: tumbling paper, dust: soft dot), all camera-facing quads; gift cards are small double-sided planes.
import * as THREE from 'three';

const PAL = ['#5B69FE', '#3A43C4', '#A8B1E7', '#FFD401', '#FF8FA3', '#ffffff', '#FFB15C'].map(c => new THREE.Color(c));
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();
const R = (a, b) => a + (b - a) * Math.random();

function sprite(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  if (kind === 'spark') {
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#fff'; x.beginPath();                                    // four-point star, the VYBS visor sparkle
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 6 : 31; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
    x.fill();
  } else if (kind === 'dot') {
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 31); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  } else { x.fillStyle = '#fff'; x.fillRect(8, 18, 48, 28); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Fx {
  constructor(scene, cardTex) {
    this.scene = scene; this.cardTex = cardTex; this.parts = []; this.cards = [];
    const make = (kind, blending, max) => {
      const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: sprite(kind), transparent: true, depthWrite: false, blending, toneMapped: false, side: THREE.DoubleSide }), max);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 5;
      mesh.setColorAt(0, PAL[0]); scene.add(mesh);
      return { mesh, max };
    };
    this.layers = { spark: make('spark', THREE.AdditiveBlending, 500), conf: make('conf', THREE.NormalBlending, 900), dot: make('dot', THREE.NormalBlending, 200) };
    this.cardGeo = new THREE.PlaneGeometry(0.66, 0.43);
  }

  add(kind, o) {
    this.parts.push({ kind, x: o.x, y: o.y, z: o.z ?? 0.4, vx: o.vx ?? 0, vy: o.vy ?? 0, vz: o.vz ?? 0, g: o.g ?? 0, drag: o.drag ?? 0,
      life: o.life ?? 1, age: 0, size: o.size ?? 0.2, rot: o.rot ?? R(0, 6.28), vr: o.vr ?? 0, tilt: R(0, 6.28), vt: o.vt ?? 0,
      color: o.color || PAL[0], grow: o.grow ?? 0 });
  }

  // a coin lands on a locked card
  sparkAt(x, y) { for (let i = 0; i < 2; i++) this.add('spark', { x, y, z: 0.1, vx: R(-1, 1), vy: R(0.3, 1.6), g: 4, life: R(0.25, 0.45), size: R(0.12, 0.22), color: PAL[3], vr: R(-6, 6) }); }
  // a card opens: confetti fountain + a ring of sparkles
  burst(x, y) {
    for (let i = 0; i < 70; i++) { const a = R(0.15, Math.PI - 0.15), v = R(3, 7.5); this.add('conf', { x, y, z: R(-0.3, 0.8), vx: Math.cos(a) * v * 0.8, vy: Math.sin(a) * v, vz: R(-1, 1), g: 7, drag: 1.6, life: R(1.6, 2.6), size: R(0.09, 0.15), color: PAL[i % PAL.length], vr: R(-9, 9), vt: R(-10, 10) }); }
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; this.add('spark', { x, y, z: 0.3, vx: Math.cos(a) * 3.2, vy: Math.sin(a) * 3.2, drag: 3, life: 0.7, size: 0.32, color: i % 2 ? PAL[3] : PAL[5], vr: 4 }); }
    this.add('spark', { x, y, z: 0.35, life: 0.5, size: 1.6, grow: 2.5, color: PAL[5] });
  }
  // locked cards catch the light now and then
  glint(x, y) { this.add('spark', { x, y, z: 0.05, life: 0.9, size: 0.38, grow: -0.6, color: new THREE.Color('#fff2c8'), vr: 1.5 }); }
  dust(x, y) { for (let i = 0; i < 6; i++) this.add('dot', { x: x + R(-0.25, 0.25), y: y + 0.05, z: R(-0.1, 0.3), vx: R(-0.9, 0.9), vy: R(0.1, 0.5), drag: 3, life: R(0.4, 0.7), size: R(0.18, 0.32), grow: 1.2, color: new THREE.Color('#b9b3a8') }); }
  // twinkles that stay right at the phone (playing at a kiosk, redeeming): nothing streams away from the hero
  playSparkle(x, y) { this.add('spark', { x: x + R(-0.14, 0.14), y: y + R(-0.12, 0.1), z: 0.3, life: R(0.25, 0.4), size: R(0.08, 0.15), grow: -0.5, color: Math.random() < 0.7 ? PAL[3] : PAL[5], vr: R(-3, 3) }); }
  // a coin pops into existence next to the card
  coinPop(x, y) { this.add('spark', { x, y, z: 0.2, life: 0.22, size: 0.22, grow: -0.7, color: PAL[3] }); }
  // finale: confetti falling over the whole view, and the gift cards tumbling down with it
  rain(camX, camY, dt) {
    const n = Math.random() < dt * 90 ? 2 : 0;
    for (let i = 0; i < n; i++) this.add('conf', { x: camX + R(-11, 11), y: camY + 6, z: R(-1, 2), vx: R(-0.4, 0.4), vy: R(-1.6, -0.8), g: 0.6, drag: 0.4, life: 7, size: R(0.1, 0.16), color: PAL[Math.floor(R(0, PAL.length))], vr: R(-6, 6), vt: R(-8, 8) });
    if (Math.random() < dt * 2.4 && this.cards.length < 40) {
      const brands = Object.keys(this.cardTex), b = brands[Math.floor(R(0, brands.length))];
      const m = new THREE.Mesh(this.cardGeo, new THREE.MeshBasicMaterial({ map: this.cardTex[b], side: THREE.DoubleSide, transparent: true }));
      m.position.set(camX + R(-9, 9), camY + 6.5, R(0, 1.8)); m.renderOrder = 4;
      m.userData = { vy: R(-1.4, -0.8), sway: R(0, 6.28), spin: new THREE.Vector3(R(-2, 2), R(-3, 3), R(-1.5, 1.5)), floor: camY - 7 };
      this.scene.add(m); this.cards.push(m);
    }
  }

  update(dt, camera) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.age += dt;
      if (p.age >= p.life) { this.parts.splice(i, 1); continue; }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy = p.vy * d - p.g * dt; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vr * dt; p.tilt += p.vt * dt;
    }
    const counts = { spark: 0, conf: 0, dot: 0 };
    for (const p of this.parts) {
      const L = this.layers[p.kind]; if (counts[p.kind] >= L.max) continue;
      const t = p.age / p.life, fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : Math.min(1, p.age / 0.06);
      const s = p.size * (1 + p.grow * t) * fade;
      if (p.kind === 'conf') E.set(Math.sin(p.tilt) * 1.2, Math.cos(p.tilt * 0.7), p.rot); else E.set(0, 0, p.rot);
      Q.setFromEuler(E);
      M.compose(P.set(p.x, p.y, p.z), Q, S.set(s, s, s));
      L.mesh.setMatrixAt(counts[p.kind], M); L.mesh.setColorAt(counts[p.kind], p.color);
      counts[p.kind]++;
    }
    for (const [k, L] of Object.entries(this.layers)) { L.mesh.count = counts[k]; L.mesh.instanceMatrix.needsUpdate = true; if (L.mesh.instanceColor) L.mesh.instanceColor.needsUpdate = true; }

    for (let i = this.cards.length - 1; i >= 0; i--) {
      const m = this.cards[i], u = m.userData;
      u.sway += dt * 1.7;
      m.position.y += u.vy * dt; m.position.x += Math.sin(u.sway) * 0.6 * dt;
      m.rotation.x += u.spin.x * dt; m.rotation.y += u.spin.y * dt; m.rotation.z += u.spin.z * dt;
      if (m.position.y < u.floor) { this.scene.remove(m); m.material.dispose(); this.cards.splice(i, 1); }
    }
  }

  reset() { this.parts = []; for (const m of this.cards) this.scene.remove(m); this.cards = []; }
}
