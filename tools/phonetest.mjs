// node tools/phonetest.mjs [base] [outDir] — phone check with real touch input (CDP touch events → pointer events):
// tap to start, hold ▶ to walk, hold BEAM until card 1 opens, two thumbs (▶ + JUMP), then a portrait screenshot.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const base = process.argv[2] || 'http://127.0.0.1:4174/index.html', out = process.argv[3] || 'tools/playtest-phone';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [], checks = {};

async function phone(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', e => errors.push(String(e)));
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
  const centre = async (sel) => { const b = await page.locator(sel).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  return { ctx, page, touch, centre };
}

{ // landscape
  const { ctx, page, touch, centre } = await phone(844, 390);
  await page.goto(`${base}?x=9`);
  await page.waitForFunction(() => window.__game?.ready);
  await page.waitForTimeout(600);
  await touch('touchStart', [[422, 200]]); await touch('touchEnd', []);
  await page.waitForTimeout(900);
  checks.started = await page.evaluate(() => window.__game.state === 'play');
  checks.padsShown = await page.locator('[data-pad=beam]').isVisible();
  const R = await centre('[data-pad=right]'), B = await centre('[data-pad=beam]'), J = await centre('[data-pad=jump]');
  const x0 = await page.evaluate(() => window.__game.game.player.x);
  await touch('touchStart', [R]); await page.waitForTimeout(560); await touch('touchEnd', []);
  await page.waitForTimeout(300);
  const x1 = await page.evaluate(() => window.__game.game.player.x);
  checks.walked = +(x1 - x0).toFixed(2);
  await touch('touchStart', [B]); await page.waitForTimeout(1200);
  await page.screenshot({ path: join(out, 'landscape-beam.png') });
  await page.waitForTimeout(1600); await touch('touchEnd', []);
  await page.waitForTimeout(800);
  checks.card1 = await page.evaluate(() => window.__game.game.cards[0].state);
  checks.beamedWithoutMouse = await page.evaluate(() => window.__game.game.cards[0].hits);
  // two thumbs: hold ▶, then press JUMP with the other thumb while still walking
  const y0 = await page.evaluate(() => window.__game.game.player.y);
  await touch('touchStart', [R]); await page.waitForTimeout(200);
  await touch('touchMove', [R, J]); await page.waitForTimeout(120);
  let peak = y0; for (let i = 0; i < 8; i++) { await page.waitForTimeout(40); peak = Math.max(peak, await page.evaluate(() => window.__game.game.player.y)); }
  await touch('touchEnd', []);
  checks.twoThumbJump = +(peak - y0).toFixed(2);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, 'landscape-after.png') });
  await ctx.close();
}
{ // portrait
  const { ctx, page, touch } = await phone(390, 844);
  await page.goto(`${base}?x=30&cards=2`);
  await page.waitForFunction(() => window.__game?.ready);
  await page.waitForTimeout(500);
  await touch('touchStart', [[195, 420]]); await touch('touchEnd', []);
  await page.waitForTimeout(2200);
  checks.portraitFov = await page.evaluate(() => +window.__game.camera.fov.toFixed(1));
  checks.rotateHint = await page.locator('#rotate').isVisible();
  await page.screenshot({ path: join(out, 'portrait.png') });
  await ctx.close();
}
await browser.close();
const ok = errors.length === 0 && checks.started && checks.padsShown && checks.walked > 0.8 && checks.card1 !== 'locked' && checks.twoThumbJump > 0.4 && checks.portraitFov > 60;
writeFileSync(join(out, 'result.json'), JSON.stringify({ ok, checks, errors }, null, 2));
console.log(JSON.stringify({ ok, checks, errors: errors.slice(0, 5) }));
process.exit(ok ? 0 : 1);
