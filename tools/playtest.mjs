// node tools/playtest.mjs [base] [outDir] [--video] [--speed=N]
// Plays the whole level in headless GPU Chromium with ?autopilot. Saves a screenshot at every unlocked card, the
// finale and the end card; fails on any console error, page error, failed request or a run that doesn't finish.
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, writeFileSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const args = process.argv.slice(2);
const base = args.find(a => a.startsWith('http')) || 'http://127.0.0.1:4174/index.html';
const out = args.find(a => !a.startsWith('http') && !a.startsWith('--')) || 'tools/playtest';
const video = args.includes('--video');
const speed = +(args.find(a => a.startsWith('--speed='))?.split('=')[1] || (video ? 1 : 3));
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...(video ? { recordVideo: { dir: out, size: { width: 1280, height: 720 } } } : {}) });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', e => errors.push(String(e)));
const failed = new Set(), loaded = new Set();
page.on('requestfailed', r => failed.add(r.url()));
page.on('response', r => { if (r.ok()) loaded.add(r.url()); });
const videoT0 = Date.now();
const t0 = Date.now();
await page.goto(`${base}?autopilot&speed=${speed}${video ? '&recordaudio' : ''}`);
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 30000 });
let open = -1, finale = false, s = null;
const shots = [];
const limit = 200000 / speed + 20000;
while (Date.now() - t0 < limit) {
  s = await page.evaluate(() => window.__game.summary());
  if (s.open !== open) { open = s.open; if (open > 0) { await page.waitForTimeout(700 / speed); const f = join(out, `card${open}.png`); await page.screenshot({ path: f }); shots.push(f); } }
  if (s.finale && !finale) { finale = true; await page.waitForTimeout(4000 / speed); const f = join(out, 'finale.png'); await page.screenshot({ path: f }); shots.push(f); }
  if (s.state === 'end') { await page.waitForTimeout(1500); const f = join(out, 'end.png'); await page.screenshot({ path: f }); shots.push(f); break; }
  await page.waitForTimeout(150);
}
// sound: every file decoded, then (video) the recorded mix
const snd = await page.evaluate(() => ({ ready: window.__game.sound.ready, errors: window.__game.sound.errors }));
if (!snd.ready) errors.push('sound never became ready');
for (const e of snd.errors) errors.push('sound: ' + e);
let audio = null;
if (video) audio = await page.evaluate(() => window.__game.sound.stopRecording());
await ctx.close(); await browser.close();
// the local server drops a parallel request now and then; loaders retry, so only never-loaded URLs count
for (const u of failed) if (!loaded.has(u)) errors.push('request failed: ' + u);
let mp4 = null;
if (video) {
  const webm = readdirSync(out).filter(f => f.endsWith('.webm')).map(f => join(out, f)).pop();
  if (webm) { mp4 = join(out, 'playtest.webm'); renameSync(webm, mp4); }
  if (webm && audio) {
    writeFileSync(join(out, 'audio.webm'), Buffer.from(audio.b64, 'base64'));
    const offset = Math.max(0, (audio.origin + audio.start - videoT0) / 1000);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-itsoffset', offset.toFixed(3), '-i', join(out, 'audio.webm'),
      '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '128k', '-shortest', join(out, 'playtest.mp4')]);
    mp4 = join(out, 'playtest.mp4');
  }
}
const ok = s?.state === 'end' && errors.length === 0;
const result = { ok, secs: Math.round((Date.now() - t0) / 1000), speed, last: s, errors, shots, video: mp4 };
writeFileSync(join(out, 'result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ok, secs: result.secs, last: s, errors: errors.slice(0, 5) }));
process.exit(ok ? 0 : 1);
