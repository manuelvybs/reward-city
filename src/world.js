// Reward City — greybox world (step 2 placeholders): sky, ground pieces, background buildings at three depths,
// game kiosks. Everything grey turns to its VYBS colour where game.colourAt(x) says colour has come back.
import * as THREE from 'three';
import { PIECES, KIOSKS, WALLS } from './level.js';

const GREY = new THREE.Color('#a9a69f');
const STONE = new THREE.Color('#8f8c86');
const HUES = ['#5B69FE', '#3A43C4', '#A8B1E7', '#FFD401', '#FF8FA3', '#5CD6C0', '#FFB15C', '#8E6CFF'].map(c => new THREE.Color(c));
const tmpC = new THREE.Color(), tmpM = new THREE.Matrix4();

function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

export class World {
  constructor(scene) {
    this.scene = scene;
    this.sky = makeSky(); scene.add(this.sky);

    // ground: pieces cut into 2 m chunks so colour can spread along them
    const chunks = [];
    for (const p of PIECES) for (let x = p.x0; x < p.x1 - 1e-6; x += 2) chunks.push({ x0: x, x1: Math.min(p.x1, x + 2), y: p.y });
    chunks.push({ x0: WALLS[0] - 12, x1: WALLS[0], y: 3.5 }, { x0: WALLS[1], x1: WALLS[1] + 12, y: 3.5 });   // end walls
    this.ground = instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.95 }), chunks, (c, m) => {
      const h = c.y + 9;
      m.compose(new THREE.Vector3((c.x0 + c.x1) / 2, c.y - h / 2, -0.3), new THREE.Quaternion(), new THREE.Vector3(c.x1 - c.x0 + 0.01, h, 3.2));
    });
    this.ground.mesh.receiveShadow = true;
    scene.add(this.ground.mesh);
    this.groundItems = chunks.map((c, i) => ({ x: (c.x0 + c.x1) / 2, hue: HUES[i % 3 === 0 ? 3 : 2].clone().lerp(STONE, 0.55) }));

    // buildings at three depths (near, mid, far)
    const r = rng(7), blds = [];
    for (const [z, wMin, wMax, hMin, hMax] of [[-6, 2.5, 5, 2.5, 5.5], [-13, 4, 8, 5, 11], [-26, 6, 12, 9, 20]]) {
      for (let x = WALLS[0] - 10; x < WALLS[1] + 10;) {
        const w = wMin + r() * (wMax - wMin), h = hMin + r() * (hMax - hMin);
        blds.push({ x: x + w / 2, w, h, z, base: z < -20 ? -2 : -1, hue: HUES[Math.floor(r() * HUES.length)] });
        x += w + 0.3 + r() * 1.2;
      }
    }
    this.blds = instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), blds, (b, m) => {
      m.compose(new THREE.Vector3(b.x, b.base + b.h / 2, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, b.h, 2.5));
    });
    this.blds.mesh.receiveShadow = true;
    scene.add(this.blds.mesh);
    this.bldItems = blds;

    // the gap between the upper street and the plaza: a dark pit
    const pit = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 3.2), new THREE.MeshBasicMaterial({ color: 0x1d1c22 }));
    pit.position.set(48, -6, -0.3); scene.add(pit);
    const pitWalls = new THREE.Mesh(new THREE.PlaneGeometry(8, 7), new THREE.MeshBasicMaterial({ color: 0x2a2930 }));
    pitWalls.position.set(48, -2.5, -1.9); scene.add(pitWalls);

    // kiosks: the only VYBS things lit in the grey city
    this.kiosks = KIOSKS.map(k => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.75, 0.55), new THREE.MeshStandardMaterial({ color: 0x3A43C4, roughness: 0.5 }));
      body.position.y = 0.875; body.castShadow = true;
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.42), new THREE.MeshBasicMaterial({ color: 0x9fb0ff, toneMapped: false }));
      screen.position.set(0, 1.3, 0.28);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.2, 0.1), new THREE.MeshBasicMaterial({ color: 0xFFD401, toneMapped: false }));
      sign.position.set(0, 1.86, 0.1);
      g.add(body, screen, sign);
      g.position.set(k.x, k.y, -0.75);
      scene.add(g);
      return { g, screen };
    });
  }

  update(game, camX, t) {
    for (let i = 0; i < this.groundItems.length; i++) {
      const it = this.groundItems[i];
      this.ground.mesh.setColorAt(i, tmpC.copy(STONE).lerp(it.hue, game.colourAt(it.x)));
    }
    this.ground.mesh.instanceColor.needsUpdate = true;
    for (let i = 0; i < this.bldItems.length; i++) {
      const b = this.bldItems[i];
      const fog = b.z < -20 ? 0.35 : b.z < -10 ? 0.18 : 0;
      this.blds.mesh.setColorAt(i, tmpC.copy(GREY).lerp(b.hue, game.colourAt(b.x) * (1 - fog)));
    }
    this.blds.mesh.instanceColor.needsUpdate = true;
    this.kiosks.forEach((k, i) => {
      const on = game.playing && game.kiosk && game.kiosk.i === i;
      k.screen.material.color.setHex(0x9fb0ff).multiplyScalar(on ? 1.25 + 0.25 * Math.sin(t * 18) : 0.95);
    });
    this.sky.material.uniforms.uColour.value = game.colourAt(camX);
    this.sky.position.x = camX;
  }
}

function instanced(geo, mat, items, place) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((it, i) => { place(it, tmpM); mesh.setMatrixAt(i, tmpM); mesh.setColorAt(i, GREY); });
  mesh.instanceMatrix.needsUpdate = true;
  return { mesh };
}

function makeSky() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(160, 70), new THREE.ShaderMaterial({
    depthWrite: false, fog: false,
    uniforms: { uColour: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uColour; varying vec2 vUv;
      void main(){
        vec3 grey = mix(vec3(0.89, 0.88, 0.85), vec3(0.80, 0.80, 0.80), vUv.y);
        vec3 dusk = mix(vec3(1.0, 0.80, 0.62), mix(vec3(0.66, 0.69, 0.91), vec3(0.23, 0.26, 0.77), smoothstep(0.45, 1.0, vUv.y)), smoothstep(0.25, 0.6, vUv.y));
        gl_FragColor = vec4(mix(grey, dusk, uColour), 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  m.position.set(0, 18, -40);
  m.renderOrder = -1;
  return m;
}
