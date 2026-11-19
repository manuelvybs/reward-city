// Reward City — the astronaut's phone, built in code: rounded indigo body, the VYBS feed on the screen,
// a glow that brightens while he plays, and a `spout` at the top edge where the coin beam comes out.
// Units are the hero model's own (the phone is parented under the scaled GLB scene).
import * as THREE from 'three';

export const PHONE = { w: 0.100, h: 0.180, d: 0.014, r: 0.018 };

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
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0x2a2f86, metalness: 0.55, roughness: 0.35 }));
  body.castShadow = true;
  g.add(body);

  // screen: crop the tall feed to the screen's aspect (keep the top: balance, missions, first game)
  const sw = w - 0.008, sh = h - 0.012;
  if (screenTex) {
    screenTex.colorSpace = THREE.SRGBColorSpace;
    const texAspect = screenTex.image ? screenTex.image.width / screenTex.image.height : 360 / 804;
    const keep = Math.min(1, texAspect / (sw / sh));
    screenTex.repeat.set(1, keep);
    screenTex.offset.set(0, 1 - keep);
  }
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex || null, color: 0xffffff, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), screenMat);
  screen.position.z = d / 2 + 0.0026;
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
    screenMat.color.setScalar(1 + 0.6 * v);
    halo.material.opacity = 0.15 + 0.6 * v;
  };
  g.setGlow(0);
  return g;
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
