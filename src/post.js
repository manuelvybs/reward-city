// Reward City — post: soft bloom on the lit bits (coins, sparkles, kiosk glow), a gentle grade, watercolour paper
// grain fixed to the screen, a vignette, and a frame-rate watchdog.   ?lowq  no bloom, pixel ratio 1   ?hiq  never downgrade
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1.04 }, uContrast: { value: 1.04 }, uWarm: { value: 0.02 }, uVignette: { value: 0.22 }, uGrain: { value: 0.06 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uSat, uContrast, uWarm, uVignette, uGrain; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSat);
      c = (c - 0.18) * uContrast + 0.18;                         // around linear mid-grey
      c *= vec3(1.0 + uWarm, 1.0 + uWarm * 0.2, 1.0 - uWarm * 0.5);
      vec2 px = vUv * uRes;                                          // watercolour paper: fibres + tooth, fixed to the screen
      float paper = n2(px * 0.012) * 0.5 + n2(px * 0.06) * 0.3 + h(px) * 0.2;
      c *= 1.0 - uGrain * (paper - 0.5) * 2.0;
      float d = distance(vUv, vec2(0.5));
      c *= 1.0 - uVignette * smoothstep(0.38, 0.9, d);
      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }`,
};

export class Post {
  constructor(renderer, scene, camera, q) {
    this.renderer = renderer;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.25, 0.5, 0.92);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.low = q.has('lowq'); this.lock = q.has('hiq');
    if (this.low) { this.bloom.enabled = false; renderer.setPixelRatio(1); }
    this.win = { t: 0, frames: 0 }; this.level = this.low ? 2 : 0; this.fps = 60;
  }

  setSize(w, h) { this.composer.setSize(w, h); this.bloom.setSize(w, h); this.grade.uniforms.uRes.value.set(w * this.renderer.getPixelRatio(), h * this.renderer.getPixelRatio()); }

  // drop bloom, then resolution, when the frame rate stays low (only while playing)
  watch(dt, playing) {
    if (!playing || this.lock) return;
    const w = this.win; w.t += dt; w.frames++;
    if (w.t < 3) return;
    this.fps = w.frames / w.t; w.t = 0; w.frames = 0;
    if (this.fps < 40 && this.level < 2) {
      this.level++;
      if (this.level === 1) this.bloom.enabled = false;
      if (this.level === 2) { this.renderer.setPixelRatio(1); this.setSize(innerWidth, innerHeight); }
      console.info(`quality down to ${this.level} (${this.fps.toFixed(0)} fps)`);
    }
  }

  render() { this.composer.render(); }
}
