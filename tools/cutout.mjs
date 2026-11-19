// Cut painted-on-white art into game sprites.
//   node tools/cutout.mjs sheet <in.png> <prefix> <columns|blobs> <tallestMetres> <maxPx> [holes]   → assets/paint/<prefix>-N.webp + manifest
//   node tools/cutout.mjs single <in.png> <name> <heightMetres> <maxPx>
//   node tools/cutout.mjs tile <in.png> <name> <x|xy> <maxPx> [trimTop]
//   node tools/cutout.mjs plain <in.png> <name> <maxPx>
// Background = the paper colour flood-filled from the image border (whites inside a building survive), 1 px soft edge.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'assets/paint', MAN = path.join(OUT, 'manifest.json');
fs.mkdirSync(OUT, { recursive: true });
const manifest = fs.existsSync(MAN) ? JSON.parse(fs.readFileSync(MAN, 'utf8')) : {};

async function load(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { d: data, w: info.width, h: info.height };
}

// alpha mask: 0 where the paper (connected to the border) shows, 255 elsewhere
function paperMask(img, tol = 26) {
  const { d, w, h } = img, n = w * h, mask = new Uint8Array(n).fill(255);
  const paper = (i) => { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; return r > 232 && g > 228 && b > 222 && Math.max(r, g, b) - Math.min(r, g, b) < tol; };
  const q = new Int32Array(n); let qh = 0, qt = 0;
  const push = (i) => { if (mask[i] && paper(i)) { mask[i] = 0; q[qt++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (qh < qt) {
    const i = q[qh++], x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w);
  }
  return mask;
}

// also clear big paper areas enclosed by ink (between water-tower legs, inside empty sign frames)
function clearHoles(img, mask, minArea = 1800, tol = 20) {
  const { d, w, h } = img, n = w * h, seen = new Uint8Array(n), q = new Int32Array(n);
  const paper = (i) => { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; return r > 238 && g > 234 && b > 228 && Math.max(r, g, b) - Math.min(r, g, b) < tol; };
  let cleared = 0;
  for (let s = 0; s < n; s++) {
    if (!mask[s] || seen[s] || !paper(s)) continue;
    let qh = 0, qt = 0; q[qt++] = s; seen[s] = 1;
    while (qh < qt) {
      const i = q[qh++], x = i % w, y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1])
        if (j >= 0 && mask[j] && !seen[j] && paper(j)) { seen[j] = 1; q[qt++] = j; }
    }
    if (qt >= minArea) { for (let k = 0; k < qt; k++) mask[q[k]] = 0; cleared++; }
  }
  return cleared;
}

async function withAlpha(img, mask) {
  // sharp may hand back a 1-channel image as 3 channels: read with the real stride
  const { data: soft, info } = await sharp(Buffer.from(mask), { raw: { width: img.w, height: img.h, channels: 1 } }).blur(0.8).raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.from(img.d), st = info.channels;
  for (let i = 0; i < img.w * img.h; i++) out[i * 4 + 3] = soft[i * st];
  return out;
}

async function save(buf, w, h, box, name, maxPx, meta) {
  let s = sharp(buf, { raw: { width: w, height: h, channels: 4 } }).extract(box);
  const scale = Math.min(1, maxPx / Math.max(box.width, box.height));
  const W = Math.round(box.width * scale), H = Math.round(box.height * scale);
  await s.resize(W, H).webp({ quality: 86, alphaQuality: 90 }).toFile(path.join(OUT, `${name}.webp`));
  manifest[name] = { file: `${name}.webp`, w: W, h: H, ...meta };
  return manifest[name];
}

// occupied column runs, ignoring the shared ink baseline (rows inked across most of the sheet)
function columnRuns(mask, w, h, minGap = 10, minW = 40) {
  // the baseline = the lowest row inked across most of the sheet; ignore it and everything below
  const skip = new Uint8Array(h);
  let base = h;
  for (let y = h - 1; y > h * 0.4; y--) { let c = 0; for (let x = 0; x < w; x++) if (mask[y * w + x]) c++; if (c > w * 0.7) { base = y; break; } }
  for (let y = Math.max(0, base - 8); y < h; y++) skip[y] = 1;
  const occ = new Uint8Array(w);
  for (let x = 0; x < w; x++) { let c = 0; for (let y = 0; y < h; y++) if (!skip[y] && mask[y * w + x]) { if (++c > 3) { occ[x] = 1; break; } } }
  const runs = []; let s = -1, gap = 0;
  for (let x = 0; x <= w; x++) {
    if (x < w && occ[x]) { if (s < 0) s = x; gap = 0; }
    else if (s >= 0 && (++gap >= minGap || x === w)) { const e = x - gap + 1; if (e - s >= minW) runs.push([s, e]); s = -1; gap = 0; }
  }
  return { runs, skip };
}

// 8-connected blobs (props sheet)
function blobs(mask, w, h, minArea = 2500) {
  const lab = new Int32Array(w * h), out = []; let id = 0;
  const q = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || lab[i]) continue;
    id++; let qh = 0, qt = 0; q[qt++] = i; lab[i] = id;
    let x0 = w, x1 = 0, y0 = h, y1 = 0, area = 0;
    while (qh < qt) {
      const j = q[qh++], x = j % w, y = (j / w) | 0; area++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = ny * w + nx; if (mask[k] && !lab[k]) { lab[k] = id; q[qt++] = k; }
      }
    }
    if (area >= minArea) out.push({ x0, x1, y0, y1, area });
  }
  return out.sort((a, b) => (Math.round(a.y0 / 300) - Math.round(b.y0 / 300)) || a.x0 - b.x0);
}

// vertical extent inside a column range; the baseline rows count only as the bottom edge
function bboxIn(mask, w, x0, x1, h, skip) {
  let y0 = h, y1 = 0;
  for (let y = 0; y < h; y++) {
    if (skip && skip[y] && y0 === h) continue;
    for (let x = x0; x < x1; x++) if (mask[y * w + x]) { if (y < y0) y0 = y; if (y > y1) y1 = y; break; }
  }
  if (skip) { let b = y1; for (let y = y0; y <= y1; y++) if (skip[y]) { b = y; break; } y1 = Math.min(y1, b + 3); }
  return { y0, y1 };
}

const [mode, file, name, ...rest] = process.argv.slice(2);
const img = await load(file);

if (mode === 'sheet') {
  const [how, tallestM, maxPx, holes] = [rest[0], +rest[1], +rest[2], rest[3] === 'holes'];
  const mask = paperMask(img);
  if (holes) console.log('cleared', clearHoles(img, mask), 'enclosed paper areas');
  const buf = await withAlpha(img, mask);
  let boxes;
  if (how === 'columns') {
    const { runs, skip } = columnRuns(mask, img.w, img.h);
    boxes = runs.map(([x0, x1]) => { const { y0, y1 } = bboxIn(mask, img.w, x0, x1, img.h, skip); return { x0, x1: x1 - 1, y0, y1 }; });
  } else boxes = blobs(mask, img.w, img.h);
  let tallest = Math.max(...boxes.map(b => b.y1 - b.y0 + 1));
  boxes = boxes.filter(b => b.y1 - b.y0 + 1 > tallest * 0.15);     // drop specks (antenna tips, drips)
  const mpp = tallestM / tallest;
  for (const k of Object.keys(manifest)) if (k.startsWith(name + '-')) delete manifest[k];
  let i = 0;
  for (const b of boxes) {
    const box = { left: Math.max(0, b.x0 - 2), top: Math.max(0, b.y0 - 2), width: Math.min(img.w, b.x1 + 3) - Math.max(0, b.x0 - 2), height: Math.min(img.h, b.y1 + 3) - Math.max(0, b.y0 - 2) };
    const m = await save(buf, img.w, img.h, box, `${name}-${i++}`, maxPx, { layer: name, metresW: +(box.width * mpp).toFixed(3), metresH: +(box.height * mpp).toFixed(3) });
    console.log(`${name}-${i - 1}`, m.w + 'x' + m.h, m.metresW + 'm x ' + m.metresH + 'm');
  }
} else if (mode === 'single') {
  const [heightM, maxPx, holes] = [+rest[0], +rest[1], rest[2] === 'holes'];
  const mask = paperMask(img);
  if (holes) console.log('cleared', clearHoles(img, mask), 'enclosed paper areas');
  const buf = await withAlpha(img, mask);
  const [b] = blobs(mask, img.w, img.h, 1000).sort((a, b) => b.area - a.area);
  const all = blobs(mask, img.w, img.h, 200);              // include small detached bits (bow loops, sparkles)
  const x0 = Math.min(...all.map(a => a.x0)), x1 = Math.max(...all.map(a => a.x1)), y0 = Math.min(...all.map(a => a.y0)), y1 = Math.max(...all.map(a => a.y1));
  const box = { left: Math.max(0, x0 - 2), top: Math.max(0, y0 - 2), width: Math.min(img.w, x1 + 3) - Math.max(0, x0 - 2), height: Math.min(img.h, y1 + 3) - Math.max(0, y0 - 2) };
  const m = await save(buf, img.w, img.h, box, name, maxPx, { metresH: heightM, metresW: +(heightM * box.width / box.height).toFixed(3), main: b ? 1 : 0 });
  console.log(name, m.w + 'x' + m.h, m.metresW + 'm x ' + m.metresH + 'm');
} else if (mode === 'tile') {
  const [axes, maxPx, trimTop] = [rest[0], +rest[1], rest[2] === 'trimTop'];
  let { d, w, h } = img;
  let top = 0;
  if (trimTop) {                                             // drop the paper above the kerb
    const mask = paperMask(img);
    for (; top < h; top++) { let c = 0; for (let x = 0; x < w; x++) if (mask[top * w + x]) c++; if (c > w * 0.6) break; }
  }
  const H = h - top, ox = Math.round(w * 0.12), oy = axes === 'xy' ? Math.round(H * 0.12) : 0;
  const W2 = w - ox, H2 = H - oy, out = Buffer.alloc(W2 * H2 * 4);
  const px = (x, y, c) => d[((y + top) * w + x) * 4 + c];
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) for (let c = 0; c < 4; c++) {
    let v = px(x, y, c);
    if (x < ox) { const t = x / ox; v = px(x + W2, y, c) * (1 - t) + v * t; }
    if (y < oy) { const t = y / oy; const vb = x < ox ? px(x + W2, y + H2, c) * (1 - x / ox) + px(x, y + H2, c) * (x / ox) : px(x, y + H2, c); v = vb * (1 - t) + v * t; }
    out[(y * W2 + x) * 4 + c] = c === 3 ? 255 : v;
  }
  const m = await save(out, W2, H2, { left: 0, top: 0, width: W2, height: H2 }, name, maxPx, { tile: axes });
  console.log(name, m.w + 'x' + m.h, 'tileable', axes, 'trimmed', top);
} else if (mode === 'plain') {
  const maxPx = +rest[0];
  const m = await save(img.d, img.w, img.h, { left: 0, top: 0, width: img.w, height: img.h }, name, maxPx, {});
  console.log(name, m.w + 'x' + m.h);
}
fs.writeFileSync(MAN, JSON.stringify(manifest, null, 1));
