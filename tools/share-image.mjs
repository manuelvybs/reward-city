// node tools/share-image.mjs — 1200x630 link preview (coloured street around card 5, no HUD) → assets/ui/share.jpg
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto('http://127.0.0.1:4174/index.html?autostart&x=75.5&cards=5&mute');
await page.waitForFunction(() => window.__game?.ready);
await page.waitForTimeout(3500);
await page.addStyleTag({ content: '#hud, #pads, #title, #rotate { display: none !important; }' });
await page.waitForTimeout(300);
await page.screenshot({ path: 'assets/ui/share.jpg', type: 'jpeg', quality: 84 });
await browser.close();
console.log('assets/ui/share.jpg');
