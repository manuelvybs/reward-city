// node tools/demo-step1.mjs [out.mp4] — records the hero viewer: kiosk refill, walk, beam until the card unlocks, cheer
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const out = process.argv[2] || 'art-src/step1-demo.mp4';
const dir = mkdtempSync(join(tmpdir(), 'rc-demo-'));
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:4174/tools/hero-viewer.html?dist=4.4&meter=25');
await page.waitForFunction(() => window.__viewer?.ready);
const k = page.keyboard, wait = (ms) => page.waitForTimeout(ms);
await wait(800);
await k.down('ArrowLeft'); await wait(900); await k.up('ArrowLeft');        // to the kiosk
await wait(1800);                                                            // plays, coins fill
await k.down('ArrowRight'); await wait(1300); await k.up('ArrowRight');      // toward the card
await k.down('KeyJ'); await wait(2600); await k.up('KeyJ');                  // beam until it unlocks
await wait(1600);
await k.press('Space'); await wait(900);
const hits = await page.evaluate(() => window.__viewer.hits);
await ctx.close(); await browser.close();
const webm = join(dir, readdirSync(dir).find(f => f.endsWith('.webm')));
execSync(`ffmpeg -loglevel error -y -i "${webm}" -c:v libx264 -pix_fmt yuv420p -crf 20 "${out}"`);
console.log(out, 'card hits', hits);
