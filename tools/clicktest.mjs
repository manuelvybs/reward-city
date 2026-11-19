// node tools/clicktest.mjs [base] [out.mp4] — real-speed recording of a player holding the mouse at card 1
import { chromium } from 'playwright';
import { mkdtempSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const base = process.argv[2] || 'http://127.0.0.1:4174/index.html', out = process.argv[3] || 'art-src/clicktest.mp4';
const dir = mkdtempSync(join(tmpdir(), 'rc-click-'));
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
await page.goto(`${base}?x=10.2&mute`);
await page.waitForFunction(() => window.__game?.ready);
await page.waitForTimeout(500);
await page.mouse.click(640, 360);                  // start
await page.waitForTimeout(1500);
await page.mouse.move(640, 360); await page.mouse.down();
await page.waitForTimeout(2600);
await page.mouse.up();
await page.waitForTimeout(1500);
const s = await page.evaluate(() => ({ card1: window.__game.game.cards[0].state, hits: window.__game.game.cards[0].hits }));
await ctx.close(); await browser.close();
const webm = join(dir, readdirSync(dir).find(f => f.endsWith('.webm')));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', out]);
console.log(out, JSON.stringify(s));
