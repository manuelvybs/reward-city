// Reward City — renderer, camera, loop and glue. Gameplay runs in game.js at a fixed 120 Hz.
import * as THREE from 'three';
import { Game, autopilot } from './game.js';
import { loadHero } from './hero.js';
import { CoinRenderer } from './coins.js';
import { World } from './world.js';
import { CardsView, loadCardTextures } from './cards.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { CARDS } from './config.js';

const Q = new URLSearchParams(location.search);
const FLAGS = {
  autostart: Q.has('autostart') || Q.has('autopilot'), autopilot: Q.has('autopilot'),
  x: Q.has('x') ? +Q.get('x') : undefined, cards: +(Q.get('cards') || 0), colour: Q.has('colour'),
  speed: Math.max(1, Math.min(8, +(Q.get('speed') || 1))),
};
const STEP = 1 / 120;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const MIST = new THREE.Color('#dedbd4');
scene.background = MIST;
scene.fog = new THREE.Fog(MIST, 22, 70);
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 300);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

scene.add(new THREE.HemisphereLight(0xfff8ee, 0x8d8b88, 1.6));
const sun = new THREE.DirectionalLight(0xfff0dc, 2.0);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 10, bottom: -6, near: 1, far: 60 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

const hud = new Hud();
const input = new Input();
const loader = new THREE.TextureLoader();
const [screenTex, cardTex] = await Promise.all([loader.loadAsync('assets/ui/phone-screen.webp'), loadCardTextures(CARDS)]);
const hero = await loadHero(screenTex);
scene.add(hero.root);

let game = new Game({ x: FLAGS.x, cards: FLAGS.cards });
if (FLAGS.colour) game.finaleT = 8.5;
const world = new World(scene);
let cards = new CardsView(scene, game, cardTex);
const coins = new CoinRenderer(); scene.add(coins.mesh);
hud.syncSlots(game);

let state = 'title';
const cam = { x: game.player.x, y: 2, look: 1 };
const v = new THREE.Vector3();

function start() { state = 'play'; hud.start(); }
function restart() {
  for (const c of cards.cards) scene.remove(c.g);
  scene.remove(cards.bridge.mesh, cards.tower.mesh, cards.box.g);
  game = new Game({ x: FLAGS.x, cards: FLAGS.cards });
  cards = new CardsView(scene, game, cardTex);
  hud.syncSlots(game); hud.restart(); state = 'play';
}

function handle(e) {
  cards.onEvent(e, game);
  if (e.type === 'unlock') {
    cards.facePosition(e.i, v).project(camera);
    hud.fly(e.i, (v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight);
  }
  if (e.type === 'deny') { hud.pulseMissing(game); hud.hint('the gift box opens with all 8 cards', 2.5); }
  if (e.type === 'empty') hud.hint('out of coins · stand at a VYBS kiosk to play and earn more', 3);
  if (e.type === 'play') hud.hint('playing on VYBS · earning coins', 1.8);
  if (e.type === 'end') { state = 'end'; hud.end(); }
}

let acc = 0, last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 1 / 20); last = now;
  const inp = input.read();
  if (state === 'title' && (inp.start || FLAGS.autostart)) start();
  else if (state === 'end' && inp.start) state = 'play';                    // wander on after the end card
  if (inp.restart && state !== 'title') restart();

  if (state !== 'title') {
    acc += dt * FLAGS.speed;
    let first = true;
    while (acc >= STEP) {
      const i = FLAGS.autopilot ? autopilot(game) : { ...inp, jump: first && inp.jump };
      game.step(STEP, i, hero.spout.lengthSq() ? { x: hero.spout.x, y: hero.spout.y, z: hero.spout.z } : null);
      acc -= STEP; first = false;
    }
    for (const e of game.drainEvents()) handle(e);
  }

  const p = game.player;
  hero.sync({ x: p.x, y: p.y, facing: p.facing, vx: p.vx, vy: p.vy, onGround: p.onGround,
    beam: game.beaming, play: game.playing, cheer: game.lockT > 0 || game.finaleT >= 0 }, dt * (state === 'title' ? 1 : FLAGS.speed));

  // camera: side-on, looks ahead, rises with the ground
  cam.look += (p.facing * 1.4 - cam.look) * (1 - Math.exp(-1.5 * dt));
  cam.x += (p.x + cam.look - cam.x) * (1 - Math.exp(-4 * dt));
  cam.y += (p.y + 1.9 - cam.y) * (1 - Math.exp(-2.5 * dt));
  camera.position.set(cam.x, cam.y + 0.6, 12.5);
  camera.lookAt(cam.x, cam.y - 0.35, 0);
  sun.position.set(cam.x - 6, cam.y + 12, 9); sun.target.position.set(cam.x, cam.y - 2, 0);

  world.update(game, cam.x, now / 1000);
  cards.update(game, dt * FLAGS.speed);
  coins.draw(game.coins);
  hud.update(game);
  renderer.render(scene, camera);
  input.endFrame();
  requestAnimationFrame(frame);
}
hud.ready();
requestAnimationFrame(frame);

window.__game = {
  ready: true,
  get game() { return game; }, get state() { return state; }, hero, camera,
  summary() { const p = game.player; return { x: +p.x.toFixed(2), y: +p.y.toFixed(2), meter: Math.round(game.meter.value), open: game.openCount, finale: game.finaleT >= 0, ended: game.ended, state }; },
};
