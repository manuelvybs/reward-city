// Reward City — draws the coin stream (logic lives in coinsim.js) as one instanced mesh of spinning gold discs.
import * as THREE from 'three';
import { BEAM } from './config.js';

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();

export class CoinRenderer {
  constructor(max = 240) {
    const r = BEAM.radius;
    const geo = new THREE.CylinderGeometry(r, r, r * 0.28, 20);
    geo.rotateX(Math.PI / 2);                                   // face the camera by default
    const mat = new THREE.MeshStandardMaterial({ color: 0xffc93a, metalness: 0.6, roughness: 0.3, emissive: 0xffa800, emissiveIntensity: 0.7 });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.max = max;
  }

  // coins: array from coinsim (x, y, z, spin, age, landed, landedAt)
  draw(coins) {
    let n = 0;
    for (const c of coins) {
      if (n >= this.max) break;
      const fade = c.landed ? Math.max(0, 1 - (c.age - c.landedAt - (BEAM.life - 0.3)) / 0.3) : 1;
      const grow = Math.min(1, c.age / 0.08);
      E.set(c.landed ? Math.PI / 2 : 0.3, c.landed ? 0 : c.age * c.spin, 0);
      Q.setFromEuler(E);
      M.compose(P.set(c.x, c.y, c.z), Q, S.setScalar(Math.min(fade, 1) * grow));
      this.mesh.setMatrixAt(n++, M);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
