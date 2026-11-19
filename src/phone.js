// Reward City — the astronaut's phone, built in code: rounded indigo body, the VYBS feed on the screen,
// a glow that brightens while he plays, and a `spout` at the top edge where the coin beam comes out.
// Units are the hero model's own (the phone is parented under the scaled GLB scene).
import * as THREE from 'three';

// sized for the stretched astronaut (model units); the screen keeps the feed composite's aspect (360x591)
const SCREEN_ASPECT = 360 / 591, W = 0.155, SW = W - 0.012, SH = SW / SCREEN_ASPECT;
export const PHONE = { w: W, h: SH + 0.018, d: 0.016, r: 0.022, sw: SW, sh: SH };

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function makePhone(screenTex) {
  const { w, h, d, r } = PHONE;
  const g = new THREE.Group();
  g.name = 'phone';

  const bodyGeo = new THREE.ExtrudeGeometry(roundedRect(w, h, r), { depth: d, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 6 });
  bodyGeo.translate(0, 0, -d / 2);
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0x3A43C4, metalness: 0.45, roughness: 0.35 }));
  body.castShadow = true;
  g.add(body);

  // black bezel, then the screen (the feed composite fills it exactly)
  const bezel = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(w - 0.004, h - 0.004, r - 0.002), 6), new THREE.MeshBasicMaterial({ color: 0x0b0d22 }));
  bezel.position.z = d / 2 + 0.0024;
  g.add(bezel);
  const { sw, sh } = PHONE;
  if (screenTex) screenTex.colorSpace = THREE.SRGBColorSpace;
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex || null, color: 0xffffff, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(sw, sh, 0.012), 6), screenMat);
  uvFromBounds(screen.geometry, sw, sh);
  screen.position.z = d / 2 + 0.0032;
  g.add(screen);

  // soft halo in front of the screen, visible from the side camera while playing / beaming
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.4, h * 1.8), new THREE.MeshBasicMaterial({
    map: haloTexture(), color: 0x9fb0ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }));
  halo.position.z = d / 2 + 0.004;
  g.add(halo);

  const spout = new THREE.Object3D();
  spout.position.set(0, h / 2 + 0.006, 0);
  g.add(spout);

  g.userData = { screen, halo, spout };
  // v: 0 idle, 1 playing / beaming
  g.setGlow = (v) => {
    screenMat.color.setScalar(0.92 + 0.18 * v);
    halo.material.opacity = 0.08 + 0.35 * v;
  };
  g.setGlow(0);
  return g;
}

// ShapeGeometry UVs are in shape units; map them to 0..1 over the screen rectangle
function uvFromBounds(geo, w, h) {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  uv.needsUpdate = true;
}

let _halo = null;
function haloTexture() {
  if (_halo) return _halo;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  _halo = new THREE.CanvasTexture(c);
  return _halo;
}
