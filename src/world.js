// Reward City — the painted town: sky, three parallax rows of watercolour buildings, the walkway pieces (painted
// street strip over stone), utility poles with sagging wires, street props, the pit, and the VYBS game kiosks
// (always in colour: they are the only lit things in the grey city).
import * as THREE from 'three';
import { PIECES, KIOSKS, WALLS, groundBelow, activePieces } from './level.js';

const ALL = activePieces({ bridge: true, tower: true });
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const groundAt = (x) => groundBelow(x, 99, ALL) ?? groundBelow(x + 3, 99, ALL) ?? groundBelow(x - 3, 99, ALL) ?? 0;

export class World {
  constructor(scene, paint) {
    this.scene = scene; this.paint = paint;
    const r = rng(11);

    // sky: a painted wash on a far plane that follows the camera
    this.sky = new THREE.Mesh(new THREE.PlaneGeometry(190, 80), paint.skyMaterial());
    this.sky.position.set(0, 20, -75); this.sky.renderOrder = -2;
    scene.add(this.sky);

    // three rows of buildings; each stands on the street level of its x (so the near row climbs onto the ledge)
    const rows = [
      { names: paint.names('far'), z: -40, haze: 0.45, gap: [-0.5, 2.5], scale: 0.55, base: () => -2.5 },
      { names: paint.names('mid'), z: -21, haze: 0.24, gap: [-0.2, 1.4], scale: 0.62, base: (x) => Math.min(groundAt(x), 1.2) - 1.0 },
      { names: [...paint.names('near'), ...paint.names('nearb')], z: -8.5, haze: 0.08, gap: [0.6, 2.4], scale: 0.66, base: (x) => groundAt(x) - 0.25 },
    ];
    for (const row of rows) {
      let x = WALLS[0] - 30, last = '';
      while (x < WALLS[1] + 30) {
        let name = row.names[Math.floor(r() * row.names.length)];
        if (name === last) name = row.names[(row.names.indexOf(name) + 1) % row.names.length];
        last = name;
        const s = paint.size(name), w = s.w * row.scale;
        const cx = x + w / 2;
        const m = paint.sprite(name, { x: cx, y: row.base(cx), z: row.z + (r() - 0.5) * 0.8, h: s.h * row.scale, haze: row.haze, flip: r() < 0.35 });
        scene.add(m);
        x += w + row.gap[0] + r() * (row.gap[1] - row.gap[0]);
      }
    }

    // ground far behind the walkway (hidden mostly; fills gaps between buildings at the bottom)
    const back = new THREE.Mesh(new THREE.PlaneGeometry(320, 60), new THREE.MeshBasicMaterial({ color: 0xb4b0a8 }));
    back.rotation.x = -Math.PI / 2; back.position.set(100, -0.3, -32); scene.add(back);

    // walkway pieces + the end walls
    const pieces = [...PIECES, { x0: WALLS[0] - 14, x1: WALLS[0], y: 3.6 }, { x0: WALLS[1], x1: WALLS[1] + 14, y: 3.6 }];
    for (const p of pieces) {
      const h = p.y + 10, mesh = new THREE.Mesh(new THREE.BoxGeometry(p.x1 - p.x0, h, 3.2), paint.groundMaterial(p.y));
      mesh.position.set((p.x0 + p.x1) / 2, p.y - h / 2, -0.3);
      scene.add(mesh);
    }
    // the gap: a dark pit
    const pit = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 3.2), new THREE.MeshBasicMaterial({ color: 0x23212a }));
    pit.position.set(48, -7, -0.3); scene.add(pit);
    const pitBack = new THREE.Mesh(new THREE.PlaneGeometry(8, 7.5), new THREE.MeshBasicMaterial({ color: 0x2c2a33 }));
    pitBack.position.set(48, -4.0, -1.89); scene.add(pitBack);

    // utility poles along the back edge of the walkway, joined by sagging wires
    const tops = [];
    for (let x = WALLS[0] + 4; x < WALLS[1]; x += 15 + r() * 6) {
      if (x > 43 && x < 53) continue;                                   // not over the gap
      const g = groundAt(x), pole = paint.sprite('prop-0', { x, y: g - 0.05, z: -1.75, h: 5.6, haze: 0.02 });
      scene.add(pole);
      tops.push(new THREE.Vector3(x, g + 5.2, -1.75));
    }
    const wire = new THREE.LineBasicMaterial({ color: 0x3a3742, transparent: true, opacity: 0.8 });
    for (let i = 0; i < tops.length - 1; i++) {
      const a = tops[i], b = tops[i + 1];
      if (b.x - a.x > 30) continue;
      for (const dy of [0, -0.35]) {
        const pts = [];
        for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + dy + (b.y - a.y) * t - Math.sin(t * Math.PI) * 0.9, a.z)); }
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wire));
      }
    }

    // props on the walkway's back edge and a few in front of the buildings
    const lamp = 'prop-1', small = ['prop-2', 'prop-3', 'prop-6', 'prop-7', 'prop-8'], back2 = ['prop-4', 'prop-5'];
    for (let x = WALLS[0] + 9; x < WALLS[1] - 2; x += 9 + r() * 9) {
      if (x > 42 && x < 54) continue;
      const g = groundAt(x);
      if (r() < 0.3) scene.add(paint.sprite(lamp, { x, y: g, z: -1.5, h: 3.4 }));
      else { const n = small[Math.floor(r() * small.length)]; scene.add(paint.sprite(n, { x, y: g - 0.04, z: -1.45 + r() * 0.2, h: paint.size(n).h * 0.7, flip: r() < 0.5 })); }
      if (r() < 0.35) { const n = back2[Math.floor(r() * back2.length)]; scene.add(paint.sprite(n, { x: x + 3, y: Math.min(g, 1.2) - 0.25, z: -4.2, h: paint.size(n).h * 0.9, haze: 0.04 })); }
    }

    // kiosks (painted arcade booths, always lit) with a screen glow that pulses while you play
    this.kiosks = KIOSKS.map(k => {
      const s = paint.sprite('kiosk', { x: k.x, y: k.y - 0.02, z: -0.75, h: 1.95, force: 1 });
      scene.add(s);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.5), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xbfd0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      glow.position.set(k.x - 0.06, k.y + 1.2, -0.7);
      scene.add(glow);
      return { s, glow };
    });
  }

  update(game, camX, t) {
    this.kiosks.forEach((k, i) => {
      const on = game.playing && game.kiosk && game.kiosk.i === i;
      k.glow.material.opacity += ((on ? 0.75 + 0.25 * Math.sin(t * 16) : 0.12) - k.glow.material.opacity) * 0.2;
    });
    this.sky.material.uniforms.uColour.value = Math.max(game.colourAt(camX), this.paint.shared.uGlobal.value);
    this.sky.position.x = camX * 0.9;
  }
}

let _glow = null;
function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (_glow = new THREE.CanvasTexture(c));
}
