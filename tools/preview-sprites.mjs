// node tools/preview-sprites.mjs <out.jpg> [prefix...] — every sprite in assets/paint on a coloured board, shelf-packed
import sharp from 'sharp';
import fs from 'node:fs';
const [out, ...prefixes] = process.argv.slice(2);
const man = JSON.parse(fs.readFileSync('assets/paint/manifest.json', 'utf8'));
const names = Object.keys(man).filter(k => !man[k].tile && k !== 'sky' && (!prefixes.length || prefixes.some(p => k.startsWith(p))));
const W = 2400, rowH = 380, comps = []; let x = 10, y = 10, h = 0;
for (const n of names) {
  const m = man[n], s = Math.min(1, rowH / m.h), w = Math.round(m.w * s), hh = Math.round(m.h * s);
  if (x + w > W - 10) { x = 10; y += h + 14; h = 0; }
  comps.push({ input: await sharp(`assets/paint/${m.file}`).resize(w, hh).png().toBuffer(), left: x, top: y });
  x += w + 14; h = Math.max(h, hh);
}
await sharp({ create: { width: W, height: y + h + 10, channels: 3, background: '#8a7fb0' } }).composite(comps).jpeg({ quality: 80 }).toFile(out);
console.log(out, names.length, 'sprites');
