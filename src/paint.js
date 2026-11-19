// Reward City — painted art: loads the sprites listed in assets/paint/manifest.json and draws them with one shader
// that shows the watercolour grey until colour comes back. Where colour has come back is a 1-D field over x, filled
// each frame from game.colourAt(x); its edge gets a soft noisy wet-paint border.
import * as THREE from 'three';

const FIELD_X0 = -30, FIELD_X1 = 230, FIELD_N = 520;

const COMMON = /* glsl */`
uniform sampler2D uField; uniform vec2 uFieldRange; uniform float uForce; uniform float uHaze; uniform vec3 uMist;
varying vec2 vUv; varying vec3 vWorld; varying vec3 vNormalW;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float washAt(vec3 w){
  float f = texture2D(uField, vec2((w.x - uFieldRange.x) * uFieldRange.y, 0.5)).r;
  float n = vnoise(w.xy * 0.45 + w.z * 0.13) * 0.6 + vnoise(w.xy * 1.7 + 3.1) * 0.4;
  return max(uForce, smoothstep(0.40, 0.60, f + (n - 0.5) * 0.6));
}
vec3 greyOf(vec3 c){ float L = dot(c, vec3(0.299, 0.587, 0.114)); return mix(vec3(L) * vec3(1.03, 1.0, 0.95), vec3(0.80, 0.79, 0.76), 0.25); }
vec3 finish(vec3 c){ float t = washAt(vWorld); return mix(mix(greyOf(c), c, t), uMist, uHaze); }
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
    this.fieldData = new Uint8Array(FIELD_N * 4);
    this.field = new THREE.DataTexture(this.fieldData, FIELD_N, 1, THREE.RGBAFormat);
    this.field.magFilter = this.field.minFilter = THREE.LinearFilter;
    this.field.needsUpdate = true;
    this.shared = {
      uField: { value: this.field },
      uFieldRange: { value: new THREE.Vector2(FIELD_X0, 1 / (FIELD_X1 - FIELD_X0)) },
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
        uRect: { value: new THREE.Vector4(uv[0], uv[1], uv[2] - uv[0], uv[3] - uv[1]) }, uOpacity: { value: o.opacity ?? 1 } },
      vertexShader: VERT,
      fragmentShader: COMMON + /* glsl */`
        uniform sampler2D map; uniform vec4 uRect; uniform float uOpacity;
        void main(){
          vec4 t = texture2D(map, uRect.xy + vUv * uRect.zw);
          if (t.a < 0.03) discard;
          gl_FragColor = vec4(finish(t.rgb), t.a * uOpacity);
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

  updateField(game) {
    const d = this.fieldData;
    for (let i = 0; i < FIELD_N; i++) {
      const x = FIELD_X0 + (i / (FIELD_N - 1)) * (FIELD_X1 - FIELD_X0);
      d[i * 4] = Math.round(game.colourAt(x) * 255);
    }
    this.field.needsUpdate = true;
  }
}
