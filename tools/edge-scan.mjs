// node tools/edge-scan.mjs — autopilot run; screenshot whenever the hero is on ground near a piece edge or on bridge/stairs,
// and log where the physics says the ground is vs where the hero stands
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out = 'art-src/edge-scan'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:4174/index.html?autopilot&speed=1&mute');
await page.waitForFunction(() => window.__game?.ready);
const marks = [21.6, 22.3, 24.8, 27.2, 43.5, 44.3, 48, 51.8, 52.4, 84.8, 86.5, 88.5, 89.6, 90.4, 121.6, 122.4, 123.5, 124.5, 125.6, 126.4];
let mi = 0; const t0 = Date.now(); const log = [];
while (mi < marks.length && Date.now() - t0 < 200000) {
  const s = await page.evaluate(() => { const g = window.__game.game, p = g.player; return { x: p.x, y: p.y, on: p.onGround, vy: p.vy }; });
  if (s.x >= marks[mi]) { await page.screenshot({ path: `${out}/x${marks[mi]}.png` }); log.push(`${marks[mi]}: x ${s.x.toFixed(2)} y ${s.y.toFixed(2)} onGround ${s.on} vy ${s.vy.toFixed(2)}`); mi++; continue; }
  await page.waitForTimeout(30);
}
console.log(log.join('\n'));
await browser.close();
