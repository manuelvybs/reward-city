// node tools/feet-check.mjs — for every hero clip, how high the lowest toe sits above the ground point (metres)
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
await page.goto('http://127.0.0.1:4174/index.html?mute');
await page.waitForFunction(() => window.__game?.ready);
const r = await page.evaluate(() => {
  const h = window.__game.hero, m = h.model, out = {};
  const toes = ['LeftToeBase', 'RightToeBase', 'LeftFoot', 'RightFoot'].map(n => m.getObjectByName(n));
  const v = new (h.root.position.constructor)();
  h.ik = false;
  for (const [name, a] of Object.entries(h.actions)) {
    h.mixer.stopAllAction(); a.reset().play(); a.setEffectiveWeight(1);
    const dur = a.getClip().duration, rows = [];
    for (let i = 0; i <= 10; i++) {
      h.mixer.setTime(dur * i / 10);
      h.root.position.set(0, 0, 0); h.root.updateMatrixWorld(true);
      rows.push(Math.min(...toes.map(t => t.getWorldPosition(v).y)));
    }
    out[name] = { min: +Math.min(...rows).toFixed(3), max: +Math.max(...rows).toFixed(3), samples: rows.map(x => +x.toFixed(2)) };
  }
  return out;
});
for (const [k, v] of Object.entries(r)) console.log(k.padEnd(9), 'lowest toe', String(v.min).padStart(6), '..', String(v.max).padStart(6), ' ', v.samples.join(' '));
await browser.close();
