// Reward City — painted art: loads the sprites listed in assets/paint/manifest.json and draws them with one shader
// that shows the watercolour grey until colour comes back. Where colour has come back is a 2-D field over (x, y)
// painted by ColourField from growing blobs ("paint sources"); its edge gets a noisy, slightly darker wet-paint rim.
import * as THREE from 'three';

const FX0 = -30, FX1 = 230, FY0 = -10, FY1 = 40, RES = 0.5;      // field covers this world rect, 0.5 m per pixel
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

export class ColourField {
  constructor() {
    this.w = Math.round((FX1 - FX0) / RES); this.h = Math.round((FY1 - FY0) / RES);
    this.canvas = document.createElement('canvas'); this.canvas.width = this.w; this.canvas.height = this.h;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = this.texture.magFilter = THREE.LinearFilter; this.texture.generateMipmaps = false;
    this.sources = []; this.dirty = true; this.floodAt = -1; this.nextFlood = 0;
    this.rnd = ((s) => () => ((s = (s * 16807) % 2147483647) / 2147483647))(99);
  }
  reset() { this.sources = []; this.dirty = true; this.floodAt = -1; }
  add(x, y, r, t0, dur, a = 1) { this.sources.push({ x, y, r, t0, dur, a }); }
  // a card opened at (x, y): one big blob, satellites around it, and a plume climbing the buildings
  splash(x, y, t, grown = false) {
    const R = this.rnd, T = grown ? -99 : t;
    this.add(x, y + 0.5, 8.5, T, 2.5);
    for (let k = 0; k < 8; k++) this.add(x + (R() * 2 - 1) * 7, y + R() * 9, 2.5 + R() * 2.5, T + 0.2 + R(), 1.5 + R(), 0.9);
    for (const dy of [4, 8, 12]) this.add(x + (R() * 2 - 1) * 2.5, y + dy, 5 + R() * 3, T + 0.3 + dy * 0.07, 2.2, 0.85);
    this.dirty = true;
  }
  // finale: blobs keep landing around the camera while uGlobal brings up everything else
  startFlood(t) { this.floodAt = t; this.nextFlood = t; }
  flood(t, camX, camY) {
    if (this.floodAt < 0) return;
    const R = this.rnd;
    while (this.nextFlood <= t && t - this.floodAt < 7) {
      this.add(camX + (R() * 2 - 1) * 22, camY - 3 + R() * 16, 4 + R() * 5, this.nextFlood, 1.2 + R() * 1.2);
      this.nextFlood += 0.12;
    }
  }
  global(t) { return this.floodAt < 0 ? 0 : clamp((t - this.floodAt - 1) / 7, 0, 1) ** 1.5; }
  update(t) {
    const growing = this.sources.some(s => t < s.t0 + s.dur);
    if (!growing && !this.dirty) return;
    const c = this.ctx;
    c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000'; c.fillRect(0, 0, this.w, this.h);
    c.globalCompositeOperation = 'lighter';
    for (const s of this.sources) {
      const k = easeOut((t - s.t0) / s.dur); if (k <= 0) continue;
      const r = (s.r * k) / RES, px = (s.x - FX0) / RES, py = (FY1 - s.y) / RES;
      const g = c.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(255,255,255,${s.a})`); g.addColorStop(0.5, `rgba(255,255,255,${s.a * 0.9})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill();
    }
    this.texture.needsUpdate = true; this.dirty = false;
  }
}

const COMMON = /* glsl */`
uniform sampler2D uField; uniform vec4 uFieldRect; uniform float uGlobal; uniform float uForce; uniform float uHaze; uniform vec3 uMist;
varying vec2 vUv; varying vec3 vWorld; varying vec3 vNormalW;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float washAt(vec3 w){
  vec2 uv = clamp(vec2((w.x - uFieldRect.x) * uFieldRect.z, (w.y - uFieldRect.y) * uFieldRect.w), 0.001, 0.999);
  float f = max(texture2D(uField, uv).r, uGlobal);
  float n = vnoise(w.xy * 0.45 + w.z * 0.13) * 0.6 + vnoise(w.xy * 1.7 + 3.1) * 0.4;
  return max(uForce, smoothstep(0.40, 0.60, f + (n - 0.5) * 0.6));
}
vec3 greyOf(vec3 c){ float L = dot(c, vec3(0.299, 0.587, 0.114)); return mix(vec3(L) * vec3(1.03, 1.0, 0.95), vec3(0.80, 0.79, 0.76), 0.25); }
vec3 finish(vec3 c){
  float t = washAt(vWorld);
  float edge = 1.0 - abs(t * 2.0 - 1.0);                 // watercolour dries darker at the rim of a wash
  vec3 wet = c * (1.0 - edge * 0.22);
  return mix(mix(greyOf(c), wet, t), uMist, uHaze);
}
`;
const VERT = /* glsl */`
varying vec2 vUv; varying vec3 vWorld; varying vec3 vNormalW;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w; }`;

export class Paint {
  static async load(base = 'assets/paint/') {
    const man = await (await fetch(base + 'manifest.json')).json();
    const loader = new THREE.TextureLoader(), tex = {};
    await Promise.all(Object.entries(man).map(async ([k, m]) => {
      const t = await loader.loadAsync(base + m.file).catch(() => loader.loadAsync(base + m.file));
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      if (m.tile) { t.wrapS = THREE.RepeatWrapping; if (m.tile === 'xy') t.wrapT = THREE.RepeatWrapping; }
      tex[k] = t;
    }));
    return new Paint(man, tex);
  }

  constructor(man, tex) {
    this.man = man; this.tex = tex;
    this.field = new ColourField();
    this.shared = {
      uField: { value: this.field.texture },
      uFieldRect: { value: new THREE.Vector4(FX0, FY0, 1 / (FX1 - FX0), 1 / (FY1 - FY0)) },
      uGlobal: { value: 0 },
      uMist: { value: new THREE.Color('#dedbd4') },
    };
  }

  names(prefix) { return Object.keys(this.man).filter(k => k.startsWith(prefix + '-')).sort(); }
  size(name) { const m = this.man[name]; return { w: m.metresW, h: m.metresH, aspect: m.w / m.h }; }

  // sprite material: o = { haze, force, uv: [u0, v0, u1, v1], opacity }
  material(name, o = {}) {
    const uv = o.uv || [0, 0, 1, 1];
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: o.depthWrite ?? true,
      uniforms: { ...this.shared, map: { value: this.tex[name] }, uForce: { value: o.force ?? 0 }, uHaze: { value: o.haze ?? 0 },
        uRect: { value: new THREE.Vector4(uv[0], uv[1], uv[2] - uv[0], uv[3] - uv[1]) }, uOpacity: { value: o.opacity ?? 1 },
        uReveal: { value: o.reveal ?? 1 } },
      vertexShader: VERT,
      fragmentShader: COMMON + /* glsl */`
        uniform sampler2D map; uniform vec4 uRect; uniform float uOpacity; uniform float uReveal;
        void main(){
          vec4 t = texture2D(map, uRect.xy + vUv * uRect.zw);
          if (t.a < 0.03) discard;
          vec3 col = finish(t.rgb);
          if (uReveal < 0.999) {                                  // paints itself in from the left, wet gold edge
            float edge = uReveal * 1.1 - 0.05 + (vnoise(vWorld.xy * 2.5) - 0.5) * 0.08;
            if (vUv.x > edge) discard;
            col = mix(col, vec3(1.0, 0.86, 0.45), smoothstep(edge - 0.05, edge, vUv.x) * 0.7);
          }
          gl_FragColor = vec4(col, t.a * uOpacity);
          #include <colorspace_fragment>
        }`,
    });
  }

  // a bottom-anchored painted sprite of height h metres (or the manifest height); uv crops it
  sprite(name, { x = 0, y = 0, z = 0, h, haze = 0, force = 0, uv, flip = false, depthWrite } = {}) {
    const m = this.man[name], r = uv ? (uv[2] - uv[0]) / (uv[3] - uv[1]) : 1;
    const H = h ?? m.metresH * (uv ? uv[3] - uv[1] : 1), W = H * (m.w / m.h) * r;
    const geo = new THREE.PlaneGeometry(W, H); geo.translate(0, H / 2, 0);
    const mesh = new THREE.Mesh(geo, this.material(name, { haze, force, uv, depthWrite }));
    mesh.position.set(x, y, z);
    if (flip) mesh.scale.x = -1;
    mesh.userData.w = W; mesh.userData.h = H;
    return mesh;
  }

  // front/top/side of a walkway piece: painted street strip under the top edge, stone wall below, paving on top
  groundMaterial(top) {
    const strip = this.man.ground, stripH = 2.0, tileW = stripH * strip.w / strip.h;
    return new THREE.ShaderMaterial({
      uniforms: { ...this.shared, uStrip: { value: this.tex.ground }, uWall: { value: this.tex.wall }, uTop: { value: top },
        uStripH: { value: stripH }, uTileW: { value: tileW }, uForce: { value: 0 }, uHaze: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: COMMON + /* glsl */`
        uniform sampler2D uStrip, uWall; uniform float uTop, uStripH, uTileW;
        void main(){
          vec3 c;
          if (vNormalW.y > 0.5) c = texture2D(uWall, vWorld.xz * vec2(0.22, 0.5)).rgb * vec3(1.08, 1.06, 1.04);         // paving on top
          else if (abs(vNormalW.x) > 0.5) c = texture2D(uWall, vWorld.zy * 0.3).rgb * 0.62;                       // cut ends
          else {
            float d = uTop - vWorld.y;
            c = d < uStripH ? texture2D(uStrip, vec2(vWorld.x / uTileW, 1.0 - d / uStripH)).rgb
                            : texture2D(uWall, vWorld.xy * 0.3).rgb * mix(0.72, 0.45, clamp((d - uStripH) / 4.0, 0.0, 1.0));
          }
          gl_FragColor = vec4(finish(c), 1.0);
          #include <colorspace_fragment>
        }`,
    });
  }

  skyMaterial() {
    return new THREE.ShaderMaterial({
      depthWrite: false,
      uniforms: { map: { value: this.tex.sky }, uColour: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */`
        uniform sampler2D map; uniform float uColour; varying vec2 vUv;
        void main(){
          vec3 c = texture2D(map, vUv).rgb; float L = dot(c, vec3(0.299, 0.587, 0.114));
          vec3 g = mix(vec3(L) * vec3(1.02, 1.0, 0.96), vec3(0.86, 0.85, 0.83), 0.45);
          gl_FragColor = vec4(mix(g, c, uColour), 1.0);
          #include <colorspace_fragment>
        }`,
    });
  }

  // per frame: grow the field; sky + global flood follow the game clock
  update(t) { this.field.update(t); this.shared.uGlobal.value = this.field.global(t); }
}
