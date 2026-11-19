// node tools/deck-line.mjs <sprite> <manifestKey> — rows where the sprite is solid across most of its width = the deck;
// stores deckTop / deckBottom as fractions of the height (0 = top) in assets/paint/manifest.json
import sharp from 'sharp';
import fs from 'node:fs';
const [file, key] = process.argv.slice(2);
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h, channels: ch } = info, rows = [];
for (let y = 0; y < h; y++) { let c = 0; for (let x = 0; x < w; x++) if (data[(y * w + x) * ch + 3] > 128) c++; rows.push(c / w); }
const deck = rows.map((r, y) => [r, y]).filter(([r]) => r > 0.8).map(([, y]) => y);
const top = deck[0], bottom = deck[deck.length - 1];
const man = JSON.parse(fs.readFileSync('assets/paint/manifest.json', 'utf8'));
man[key].deckTop = +(top / h).toFixed(4); man[key].deckBottom = +(bottom / h).toFixed(4);
fs.writeFileSync('assets/paint/manifest.json', JSON.stringify(man, null, 1));
console.log(key, `${w}x${h}`, 'deck rows', top, '..', bottom, '→', man[key].deckTop, man[key].deckBottom);
