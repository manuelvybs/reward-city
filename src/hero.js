// Reward City — the rigged astronaut holding his phone in both hands.
// Clips come from the GLB; on top of them the phone is placed in one of three poses (carry / beam / play,
// blended) and both arms are bent onto its edges with a world-space two-bone IK, so the auto-rig's
// arbitrary bone axes never matter.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TUNING, HERO } from './config.js';
import { makePhone, PHONE } from './phone.js';

const ONCE = new Set(['jump', 'land', 'cheer']);

// phone poses in the hero model's own space (+Z forward, +Y up, hero's left = +X).
// top = where the phone's top edge points, normal = where the screen faces; the normal's x is multiplied by
// `side` (+1 = the camera is on the hero's left) so the screen always turns toward the camera; pos.x too, so
// the phone sits a little toward the camera, in front of the near arm.
const POSES = {
  carry: { pos: [0.035, 0.365, 0.180], top: [0, 0.90, 0.44], normal: [0.70, 0.30, -0.65] },
  play:  { pos: [0.030, 0.410, 0.175], top: [0, 0.75, 0.66], normal: [0.55, 0.55, -0.62] },
  beam:  { pos: [0.020, 0.395, 0.195], top: [0, 0.30, 0.95], normal: [0.80, 0.55, -0.15] },
};
for (const p of Object.values(POSES)) { p.v = new THREE.Vector3(...p.pos); p.t = new THREE.Vector3(...p.top); p.n = new THREE.Vector3(...p.normal); }
const GRIP_X = PHONE.w / 2 - 0.004, GRIP_Y = -0.03;

export async function loadHero(screenTex, url = HERO.url) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url).catch(() => new Promise(r => setTimeout(r, 400)).then(() => loader.loadAsync(url)));
  return new Hero(gltf, screenTex);
}

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0), M4 = new THREE.Matrix4();

class Hero {
  constructor(gltf, screenTex) {
    const model = gltf.scene;
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    const box = new THREE.Box3().setFromObject(model);
    this.scale = TUNING.heroHeight / (box.max.y - box.min.y);
    model.scale.setScalar(this.scale);
    model.position.y = -box.min.y * this.scale;
    this.model = model;
    this.root = new THREE.Group();
    this.root.add(model);

    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const c of gltf.animations) {
      const a = this.mixer.clipAction(c);
      if (ONCE.has(c.name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      this.actions[c.name] = a;
    }
    this.b = {};
    for (const [k, n] of Object.entries(HERO.bones)) this.b[k] = model.getObjectByName(n);
    this.ikBones = ['lArm', 'lFore', 'lHand', 'rArm', 'rFore', 'rHand', 'head', 'neck'].map(k => this.b[k]).filter(Boolean);

    this.phone = makePhone(screenTex);
    model.add(this.phone);                         // phone lives in model units
    model.updateMatrixWorld(true);
    this.spineBind = this.b.spine ? model.worldToLocal(this.b.spine.getWorldPosition(new THREE.Vector3())) : new THREE.Vector3();

    this.w = { beam: 0, play: 0 };                 // pose weights
    this.side = -1;                                // smoothed camera side in hero space
    this.yaw = Math.PI / 2 - HERO.camTurn;
    this.name = ''; this.current = null; this.saved = null;
    this.spout = new THREE.Vector3();
  }

  play(name, speed = 1, fade = 0.2) {
    const a = this.actions[name] || this.actions.idle;
    if (name !== this.name) {
      a.reset().setEffectiveWeight(1).fadeIn(fade).play();
      if (this.current && this.current !== a) this.current.fadeOut(fade);
      this.current = a; this.name = name;
    }
    a.timeScale = speed;
  }

  // s = { x, y, facing (+1/-1), vx, vy, onGround, beam (bool), play (bool), cheer (bool) }
  sync(s, dt) {
    // undo last frame's overlay first: clamped clips are not rewritten by the mixer
    if (this.saved) { for (const [bone, q] of this.saved) bone.quaternion.copy(q); this.saved = null; }

    let anim = 'idle', speed = 1;
    if (s.cheer) anim = 'cheer';
    else if (!s.onGround) anim = s.vy > 0.5 ? 'jump' : 'fall';
    else if (Math.abs(s.vx) > 0.15) { anim = 'walk'; speed = Math.abs(s.vx) / 1.6; }
    this.play(anim, anim === 'jump' ? 1.6 : speed, anim === 'jump' ? 0.08 : 0.2);
    this.mixer.update(dt);

    const k = 1 - Math.exp(-8 * dt);
    this.w.beam += ((s.beam ? 1 : 0) - this.w.beam) * k;
    this.w.play += ((s.play && !s.beam ? 1 : 0) - this.w.play) * k;
    this.side += (-s.facing - this.side) * (1 - Math.exp(-10 * dt));
    const targetYaw = s.facing * (Math.PI / 2 - HERO.camTurn);
    this.yaw += (targetYaw - this.yaw) * (1 - Math.exp(-12 * dt));
    this.root.position.set(s.x, s.y, 0);
    this.root.quaternion.setFromAxisAngle(UP, this.yaw);
    this.root.updateMatrixWorld(true);

    this.saved = this.ikBones.map(bone => [bone, bone.quaternion.clone()]);
    this.placePhone();
    this.reachPhone();
    if (this.w.play > 0.01) this.nod(this.w.play);
    this.phone.setGlow(Math.max(this.w.beam, this.w.play));
    this.phone.userData.spout.getWorldPosition(this.spout);
  }

  placePhone() {
    const { beam, play } = this.w, carry = Math.max(0, 1 - beam - play), sd = this.side;
    const P = this.phone, n = v2.set(0, 0, 0), t = v3.set(0, 0, 0);
    P.position.set(0, 0, 0);
    for (const [pose, w] of [[POSES.carry, carry], [POSES.play, play], [POSES.beam, beam]]) {
      if (w <= 0) continue;
      P.position.x += pose.v.x * sd * w; P.position.y += pose.v.y * w; P.position.z += pose.v.z * w;
      t.addScaledVector(pose.t, w);
      n.x += pose.n.x * sd * w; n.y += pose.n.y * w; n.z += pose.n.z * w;
    }
    n.normalize(); t.addScaledVector(n, -t.dot(n)).normalize();
    const x = v1.crossVectors(t, n);
    P.quaternion.setFromRotationMatrix(M4.makeBasis(x, t, n));
    // follow the torso's bob from the clip
    if (this.b.spine) P.position.add(this.model.worldToLocal(this.b.spine.getWorldPosition(v1)).sub(this.spineBind).multiplyScalar(0.9));
    P.updateMatrixWorld(true);
  }

  reachPhone() {
    const side = v3.set(1, 0, 0).applyQuaternion(this.root.quaternion);      // hero's left in world space
    // which phone edge is on the hero's left?
    const px = v2.set(1, 0, 0).applyQuaternion(this.phone.quaternion).x >= 0 ? 1 : -1;
    for (const [arm, fore, hand, s] of [['lArm', 'lFore', 'lHand', 1], ['rArm', 'rFore', 'rHand', -1]]) {
      const A = this.b[arm], B = this.b[fore], C = this.b[hand];
      if (!A || !B || !C) continue;
      // the hand on the camera side holds the bottom edge so its arm stays below the screen
      const near = s === (Math.sign(this.side) || -1);
      const grip = near ? new THREE.Vector3(GRIP_X * 0.3 * px * s, -PHONE.h / 2 + 0.012, -0.004) : new THREE.Vector3(GRIP_X * px * s, GRIP_Y, -0.002);
      const target = this.phone.localToWorld(grip);
      const pole = new THREE.Vector3(0, -1, 0).addScaledVector(side, s * 0.8).add(new THREE.Vector3(0, 0, -0.4).applyQuaternion(this.root.quaternion));
      twoBoneIK(A, B, C, target, pole);
    }
  }

  nod(w) {
    const right = v3.set(-1, 0, 0).applyQuaternion(this.root.quaternion);
    turn(this.b.head, right, -0.22 * w);          // look down at the screen
  }
}

// --- world-space helpers ------------------------------------------------------------------------------

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _e = new THREE.Vector3(), _u = new THREE.Vector3(), _p = new THREE.Vector3();
const _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

// rotate `bone` so that the point `from` (world, rigidly attached to it) swings toward `to`
function aim(bone, from, to) {
  const o = bone.getWorldPosition(_p);
  _d1.subVectors(from, o).normalize(); _d2.subVectors(to, o).normalize();
  _q1.setFromUnitVectors(_d1, _d2);
  bone.getWorldQuaternion(_q2);
  _q2.premultiply(_q1);                                          // new world rotation
  bone.parent.getWorldQuaternion(_q1).invert();
  bone.quaternion.copy(_q1.multiply(_q2));
  bone.updateMatrixWorld(true);
}

function twoBoneIK(A, B, C, target, pole) {
  A.getWorldPosition(_a); B.getWorldPosition(_b); C.getWorldPosition(_c);
  const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
  const toT = _u.subVectors(target, _a); let d = toT.length();
  d = Math.min(Math.max(d, Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4);
  toT.normalize();
  const bend = pole.clone().addScaledVector(toT, -pole.dot(toT)).normalize();
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  _e.copy(_a).addScaledVector(toT, l1 * cosA).addScaledVector(bend, l1 * sinA);   // where the elbow goes
  aim(A, _b.clone(), _e);
  C.getWorldPosition(_c);
  aim(B, _c.clone(), target);
}

const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _la = new THREE.Vector3();
function turn(bone, axis, angle) {
  if (!bone || !angle) return;
  bone.parent.getWorldQuaternion(_qa);
  _la.copy(axis).applyQuaternion(_qa.invert());
  bone.quaternion.premultiply(_qb.setFromAxisAngle(_la, angle));
  bone.updateMatrixWorld(true);
}
