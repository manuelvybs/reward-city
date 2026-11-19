// Reward City — renderer, camera, loop and glue. Gameplay runs in game.js at a fixed 120 Hz.
import * as THREE from 'three';
import { Game, autopilot } from './game.js';
import { loadHero } from './hero.js';
import { CoinRenderer } from './coins.js';
import { World } from './world.js';
import { CardsView, loadCardTextures } from './cards.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { Paint } from './paint.js';
import { Fx } from './fx.js';
import { Sound } from './audio.js';
import { CARDS } from './config.js';
import { groundBelow } from './level.js';

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
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const MIST = new THREE.Color('#dedbd4');
scene.background = MIST;
scene.fog = new THREE.Fog(MIST, 22, 70);
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 300);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

scene.add(new THREE.HemisphereLight(0xfff8ee, 0x8d8b88, 1.6));
const sun = new THREE.DirectionalLight(0xfff0dc, 2.0);
scene.add(sun, sun.target);

const hud = new Hud();
const sound = new Sound();
for (const ev of ['keydown', 'pointerdown']) addEventListener(ev, () => sound.start());   // browsers allow audio after a gesture
const input = new Input();
const loader = new THREE.TextureLoader();
const [screenTex, cardTex, paint] = await Promise.all([loader.loadAsync('assets/ui/phone-screen.webp'), loadCardTextures(CARDS), Paint.load()]);
const hero = await loadHero(screenTex);
scene.add(hero.root);
const blob = makeBlob(); scene.add(blob);

let game = new Game({ x: FLAGS.x, cards: FLAGS.cards });
if (FLAGS.colour) game.finaleT = 8.5;
const world = new World(scene, paint);
let cards = new CardsView(scene, game, cardTex, paint);
const coins = new CoinRenderer(); scene.add(coins.mesh);
const fx = new Fx(scene, cardTex);
hud.syncSlots(game);
function seedField() {                                   // cards opened by ?cards=n start fully painted
  for (const c of game.cards) if (c.state !== 'locked') paint.field.splash(c.x, c.y, 0, true);
  if (FLAGS.colour) paint.field.floodAt = -99;
}
seedField();

let state = 'title';
const cam = { x: game.player.x, y: 2, look: 1, push: 0, pull: 0 };
const glints = new Map();
const sfx = { coinAt: -1, stepDist: 0 };
const v = new THREE.Vector3();

function start() { state = 'play'; hud.start(); sound.start(); sound.music('music_city', 0.85); }
function restart() {
  for (const c of cards.cards) scene.remove(c.g);
  scene.remove(cards.bridge.mesh, cards.tower.mesh, cards.box.g);
  game = new Game({ x: FLAGS.x, cards: FLAGS.cards });
  cards = new CardsView(scene, game, cardTex, paint);
  paint.field.reset(); fx.reset(); seedField();
  hud.syncSlots(game); hud.restart(); state = 'play'; sound.music('music_city', 0.85);
}

function handle(e) {
  cards.onEvent(e, game);
  if (e.type === 'hit' && e.i !== 'box') fx.sparkAt(e.x, e.y);
  if (e.type === 'hit' && game.time - sfx.coinAt > 0.055) { sfx.coinAt = game.time; sound.play('coin', 0.32, 0.9 + Math.random() * 0.35); }
  if (e.type === 'jump') sound.play('jump', 0.7, 0.95 + Math.random() * 0.1);
  if (e.type === 'land') sound.play('land', 0.55);
  if (e.type === 'play') sound.play('kiosk', 0.8);
  if (e.type === 'full') sound.play('full', 0.8);
  if (e.type === 'deny') sound.play('deny', 0.9);
  if (e.type === 'empty') sound.play('empty', 0.7);
  if (e.type === 'unlock') { sound.play('unlock', 1); setTimeout(() => sound.play('wash', 0.7), 300); }
  if (e.type === 'finale') { sound.play('finale', 1); sound.play('wash', 0.8); sound.music('music_end', 1, 1.2); }
  if (e.type === 'unlock') {
    const c = game.cards[e.i];
    paint.field.splash(c.x, c.y, game.time);
    cards.facePosition(e.i, v); fx.burst(v.x, v.y);
    v.project(camera);
    hud.fly(e.i, (v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight);
    cam.push = 1;
  }
  if (e.type === 'land') fx.dust(game.player.x, game.player.y);
  if (e.type === 'finale') { paint.field.startFlood(game.time); cards.facePosition(0, v); fx.burst(game.box.x, game.box.y + 2.2); }
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
  if (input.took('KeyM')) sound.mute();

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

  // camera: side-on, looks ahead, rises with the ground; pushes in on an unlock, pulls back for the finale
  const sdt = dt * (state === 'title' ? 1 : FLAGS.speed);
  cam.look += (p.facing * 1.4 - cam.look) * (1 - Math.exp(-1.5 * dt));
  cam.x += (p.x + cam.look - cam.x) * (1 - Math.exp(-4 * dt));
  cam.y += (p.y + 1.9 - cam.y) * (1 - Math.exp(-2.5 * dt));
  cam.push = Math.max(0, cam.push - sdt * 0.8);
  const pullTo = game.finaleT >= 0 ? Math.min(1, game.finaleT / 4) : 0;
  cam.pull += (pullTo - cam.pull) * (1 - Math.exp(-1.2 * dt));
  const pushK = Math.sin(Math.min(1, (1 - cam.push) * 1.25) * Math.PI) * (cam.push > 0 ? 1 : 0);
  camera.position.set(cam.x, cam.y + 0.6 + cam.pull * 1.6, 12.5 - pushK * 0.8 + cam.pull * 4.5);
  camera.lookAt(cam.x, cam.y - 0.35 + cam.pull * 1.2, 0);
  sun.position.set(cam.x - 6, cam.y + 12, 9); sun.target.position.set(cam.x, cam.y - 2, 0);

  const gy = groundBelowP(p.x, p.y + 0.05);
  blob.visible = gy !== null;
  if (gy !== null) { const hgt = p.y - gy; blob.position.set(p.x, gy + 0.015, 0.05); blob.scale.setScalar(Math.max(0.4, 1 - hgt / 3)); blob.material.opacity = 0.32 * Math.max(0, 1 - hgt / 2.5); }
  // effects driven by the game state
  if (state !== 'title') {
    if (game.finaleT >= 0) { paint.field.flood(game.time, cam.x, cam.y); fx.rain(cam.x, cam.y + cam.pull * 1.6, sdt); }
    if (game.playing && Math.random() < sdt * 14) fx.playSparkle(hero.spout.x, hero.spout.y);
    for (const c of game.cards) {
      if (c.state !== 'locked' || Math.abs(c.x - p.x) > 14) continue;
      const t = (glints.get(c.i) ?? 0) - sdt;
      if (t <= 0) { fx.glint(c.x + (Math.random() - 0.5) * 0.8, c.y + 0.8 + Math.random() * 0.55); glints.set(c.i, 1.8 + Math.random() * 1.4); }
      else glints.set(c.i, t);
    }
  }
  // sound beds follow the state: beam and kiosk loops, footsteps, the city waking up as colour comes back
  if (state !== 'title') {
    if (p.onGround && Math.abs(p.vx) > 0.3) { sfx.stepDist += Math.abs(p.vx) * sdt; if (sfx.stepDist > 0.55) { sfx.stepDist = 0; sound.play('step', 0.3, 0.9 + Math.random() * 0.2); } }
    sound.loop('beam', game.beaming && !game.meter.empty ? 0.5 : 0);
    sound.loop('play', game.playing ? 0.45 : 0);
    const c = Math.max(game.colourAt(cam.x), paint.shared.uGlobal.value);
    sound.loop('city_grey', 0.5 * (1 - c));
    sound.loop('city_colour', 0.45 * c);
  }
  paint.update(game.time);
  fx.update(sdt);
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
  get game() { return game; }, get state() { return state; }, hero, camera, sound,
  summary() { const p = game.player; return { x: +p.x.toFixed(2), y: +p.y.toFixed(2), meter: Math.round(game.meter.value), open: game.openCount, finale: game.finaleT >= 0, ended: game.ended, state }; },
};

function groundBelowP(x, y) { return groundBelow(x, y, game.pieces); }
function makeBlob() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  r.addColorStop(0, 'rgba(40,36,60,1)'); r.addColorStop(1, 'rgba(40,36,60,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.42), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}
