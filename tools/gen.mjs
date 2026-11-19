// node tools/gen.mjs <endpoint> <prompt.json...>  — runs fal jobs in parallel, saves art-src/paint/<name>-<i>.png
import fs from 'node:fs';
import path from 'node:path';
import { run, download } from './fal.mjs';
const [endpoint, ...files] = process.argv.slice(2);
await Promise.all(files.map(async (f) => {
  const name = path.basename(f, '.json').replace(/^paint-/, '');
  try {
    const res = await run(endpoint, JSON.parse(fs.readFileSync(f, 'utf8')), name, { onSubmit: s => console.error(`submitted ${name} ${s.request_id}`) });
    const imgs = res.images || [];
    for (let i = 0; i < imgs.length; i++) {
      const out = `art-src/paint/${name}${imgs.length > 1 ? '-' + i : ''}.png`;
      await download(imgs[i].url, out);
      console.log(out);
    }
  } catch (e) { console.error(name, 'FAILED', e.message); }
}));
