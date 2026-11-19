// node tools/bones.mjs <glb> — world positions (bind pose, model space) of every joint, for sizing poses and IK
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
for (const n of doc.getRoot().listNodes()) {
  const m = n.getWorldMatrix();
  console.log(n.getName().padEnd(16), [m[12], m[13], m[14]].map(v => v.toFixed(3)).join('  '));
}
