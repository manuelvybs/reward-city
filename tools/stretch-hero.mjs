// node tools/stretch-hero.mjs <in.glb> <out.glb> [thigh=1.5] [shin=1.4] [waist=1.4] [arm=1.3]
// Makes the rigged astronaut taller without touching the helmet or mittens: lengthens the thigh, shin,
// lower-spine and arm bones (their local +Y translations, on the nodes AND in every clip's constant translation tracks),
// raises the hips in every clip so the toes stay on the ground, moves each vertex by its bones' displacement
// interpolated ALONG the bone (so the stretch spreads over the limb instead of bunching at the joints),
// and rebuilds the inverse bind matrices from the new rest skeleton.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as THREE from 'three';

const [inp, out, kThigh = 1.5, kShin = 1.4, kWaist = 1.4, kArm = 1.3] = process.argv.slice(2);
const SCALE = { LeftLeg: +kThigh, RightLeg: +kThigh, LeftFoot: +kShin, RightFoot: +kShin, Spine02: +kWaist, Spine01: +kWaist,
  LeftForeArm: +kArm, RightForeArm: +kArm, LeftHand: +kArm, RightHand: +kArm };
// which child carries the stretch for joints with several children
const PREFER = { Hips: 'Spine02', Spine: 'neck' };

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
const root = doc.getRoot();
const skin = root.listSkins()[0];
const joints = skin.listJoints();
const meshNode = root.listNodes().find(n => n.getSkin() === skin);
const byName = Object.fromEntries(root.listNodes().map(n => [n.getName(), n]));
const M = (n) => new THREE.Matrix4().fromArray(n.getWorldMatrix());
const P = (n) => new THREE.Vector3().setFromMatrixPosition(M(n));

const oldPos = new Map(joints.map(j => [j, P(j)]));
const toe = byName.LeftToeBase, toeY0 = P(toe).y;

// 1. lengthen the bones on the nodes
for (const [name, k] of Object.entries(SCALE)) {
  const n = byName[name];
  n.setTranslation(n.getTranslation().map(v => v * k));
}
// 2. raise the hips so the toes land where they were (in the hips' parent space)
const hips = byName.Hips;
const drop = toeY0 - P(toe).y;                                         // model units
const parentM = hips.getParentNode() ? M(hips.getParentNode()) : new THREE.Matrix4();
const parentScale = new THREE.Vector3().setFromMatrixScale(parentM).y;
const hipsLift = drop / parentScale;                                    // hips-local units
const ht = hips.getTranslation(); hips.setTranslation([ht[0], ht[1] + hipsLift, ht[2]]);
const newPos = new Map(joints.map(j => [j, P(j)]));
const disp = new Map(joints.map(j => [j, newPos.get(j).clone().sub(oldPos.get(j))]));

// 3. the segment each joint stretches along
const childOf = new Map();
for (const j of joints) {
  const kids = j.listChildren().filter(c => joints.includes(c));
  const pick = kids.find(c => c.getName() === PREFER[j.getName()]) || kids.find(c => SCALE[c.getName()]) || kids[0];
  childOf.set(j, pick || null);
}

// 4. move the vertices
// skinned vertices live in bind space (World*IBM = I here); the mesh node's own transform is ignored by glTF
const meshM = new THREE.Matrix4(), meshInv = new THREE.Matrix4();
const tmp = new THREE.Vector3(), seg = new THREE.Vector3(), d = new THREE.Vector3();
let moved = 0;
for (const prim of meshNode.getMesh().listPrimitives()) {
  const pos = prim.getAttribute('POSITION'), J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0');
  const v = [0, 0, 0], jj = [0, 0, 0, 0], ww = [0, 0, 0, 0];
  for (let i = 0; i < pos.getCount(); i++) {
    pos.getElement(i, v); J.getElement(i, jj); W.getElement(i, ww);
    const wsum = ww[0] + ww[1] + ww[2] + ww[3] || 1;                     // weights may be stored as normalized ints
    const p = new THREE.Vector3(...v).applyMatrix4(meshM);               // model space
    d.set(0, 0, 0);
    for (let k = 0; k < 4; k++) {
      if (!ww[k]) continue;
      const j = joints[jj[k]], c = childOf.get(j), a = oldPos.get(j);
      let t = 0;
      if (c) { seg.subVectors(oldPos.get(c), a); t = THREE.MathUtils.clamp(tmp.subVectors(p, a).dot(seg) / seg.lengthSq(), 0, 1); }
      const dj = disp.get(j), dc = c ? disp.get(c) : dj;
      d.addScaledVector(tmp.copy(dj).lerp(dc, t), ww[k] / wsum);
    }
    if (d.lengthSq() > 1e-12) moved++;
    p.add(d).applyMatrix4(meshInv);
    pos.setElement(i, [p.x, p.y, p.z]);
  }
}

// 5. new inverse bind matrices from the new rest skeleton
const ibm = skin.getInverseBindMatrices();
joints.forEach((j, i) => ibm.setElement(i, M(j).invert().multiply(meshM).toArray()));

// 6. clips: same bone lengths, hips raised
let tracks = 0;
const done = new Set();                                                 // clips can share output accessors: edit each once
for (const anim of root.listAnimations()) for (const ch of anim.listChannels()) {
  if (ch.getTargetPath() !== 'translation') continue;
  const name = ch.getTargetNode().getName(), o = ch.getSampler().getOutput(), e = [0, 0, 0];
  if (done.has(o)) continue;
  done.add(o);
  if (SCALE[name]) { for (let i = 0; i < o.getCount(); i++) { o.getElement(i, e); o.setElement(i, e.map(x => x * SCALE[name])); } tracks++; }
  else if (name === 'Hips') { for (let i = 0; i < o.getCount(); i++) { o.getElement(i, e); o.setElement(i, [e[0], e[1] + hipsLift, e[2]]); } tracks++; }
}

await io.write(out, doc);
const head = byName.head_end ? P(byName.head_end).y : NaN;
console.log(`${out}: hips +${drop.toFixed(3)} model units, ${moved} vertices moved, ${tracks} tracks edited, head_end y ${head.toFixed(3)}`);
