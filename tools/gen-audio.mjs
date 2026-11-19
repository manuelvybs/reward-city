// node tools/gen-audio.mjs <prompt.json...> — sfx-*.json → fal-ai/elevenlabs/sound-effects/v2, music_*.json → elevenlabs/music/v2.5
// saves art-src/audio/raw/<name>.mp3 (name = file name without the sfx- prefix)
import fs from 'node:fs';
import path from 'node:path';
import { run, download } from './fal.mjs';
await Promise.all(process.argv.slice(2).map(async (f) => {
  const base = path.basename(f, '.json'), music = base.startsWith('music_');
  const name = base.replace(/^sfx-/, ''), endpoint = music ? 'elevenlabs/music/v2.5' : 'fal-ai/elevenlabs/sound-effects/v2';
  try {
    const res = await run(endpoint, JSON.parse(fs.readFileSync(f, 'utf8')), base, { onSubmit: s => console.error(`submitted ${base} ${s.request_id}`) });
    const url = (JSON.stringify(res).match(/https:\/\/[^"]+\.(mp3|wav)/) || [])[0];
    if (!url) throw new Error('no audio url in ' + JSON.stringify(res).slice(0, 200));
    await download(url, `art-src/audio/raw/${name}.mp3`);
    console.log(name);
  } catch (e) { console.error(base, 'FAILED', e.message); }
}));
