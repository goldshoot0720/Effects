#!/usr/bin/env node
/* =====================================================================
   把每首歌輸出成一支 PV（MP4）。

   用無頭 Chromium 打開 index.html?pv=<id>，透過 window.__pv 一格一格
   把 384×216 的像素緩衝區抓出來，直接灌進 ffmpeg，最後以最近鄰放大
   成 1080p（或 --height 指定的高度），再接上延後 PV 片頭長度的音檔。
   引擎的畫面完全由時間決定，所以輸出是逐格精準、跟音樂對齊的。

   需要：Node 18+、playwright（含 Chromium）、ffmpeg

     node tools/render_pv.js                    九首全部
     node tools/render_pv.js s023 s101          只做這幾首
     node tools/render_pv.js --fps 60 --height 2160 --out artifacts/pv
     node tools/render_pv.js --preview s023     只輸出片頭與副歌的 PNG 檢查用
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { }
  try {
    const g = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    return require(path.join(g, 'playwright'));
  } catch (e) { }
  console.error('找不到 playwright：請先 `npm i -D playwright && npx playwright install chromium`');
  process.exit(1);
}

function args() {
  const o = { fps: 30, height: 1080, crf: 18, out: path.join(ROOT, 'artifacts', 'pv'), ids: [], preview: false, batch: 15 };
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k === '--fps') o.fps = +a[++i];
    else if (k === '--height') o.height = +a[++i];
    else if (k === '--crf') o.crf = +a[++i];
    else if (k === '--out') o.out = path.resolve(a[++i]);
    else if (k === '--preview') o.preview = true;
    else if (k === '-h' || k === '--help') { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]); process.exit(0); }
    else o.ids.push(k);
  }
  return o;
}

function catalog() {
  const src = fs.readFileSync(path.join(ROOT, 'data', 'songs.js'), 'utf8');
  return JSON.parse(src.slice(src.indexOf('['), src.lastIndexOf(']') + 1));
}

const safe = s => s.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function ffmpeg(argv) {
  const p = spawn('ffmpeg', argv, { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', d => { err = (err + d).slice(-4000); });
  const done = new Promise((ok, no) => p.on('close', c => c === 0 ? ok() : no(new Error('ffmpeg ' + c + '\n' + err))));
  return { p, done };
}
// respect back-pressure so a fast browser does not buffer a whole song in RAM
const write = (stream, buf) => new Promise(ok => stream.write(buf) ? ok() : stream.once('drain', ok));

async function openSong(browser, id) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', e => console.warn('  [page]', e.message));
  page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') console.warn('  [console]', m.text()); });
  await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href + '?pv=' + id);
  await page.waitForFunction(() => window.__pv && window.__pv.info && (() => { try { return window.__pv.info().id; } catch (e) { return false; } })(),
                             null, { timeout: 30000 });
  // the T-pose puppets decode their art asynchronously; fall back to the cel figures if WebGL2 never comes up
  const ok = await page.waitForFunction(() => window.__pv.ready(), null, { timeout: 20000 }).then(() => true, () => false);
  if (!ok) { console.warn('  立繪人偶沒有就緒（WebGL2？），改用手繪賽璐璐人物'); await page.evaluate(() => window.__pv.cel(true)); }
  return page;
}

async function grab(page, T0, n, fps) {
  return Buffer.from(await page.evaluate(([a, b, c]) => window.__pv.grab(a, b, c), [T0, n, fps]), 'base64');
}

async function preview(page, info, o, base) {
  const shots = [1.6, info.head + 0.2, info.head + info.dur * .35, info.head + info.dur * .7,
                 info.head + info.dur + 2.6, info.length - 1.5];
  for (const T of shots) {
    const raw = await grab(page, T, 1, o.fps);
    const file = `${base}_${T.toFixed(1)}s.png`;
    const f = ffmpeg(['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${info.bw}x${info.bh}`, '-i', 'pipe:0',
                      '-vf', `scale=-2:${o.height}:flags=neighbor`, '-frames:v', '1', file]);
    f.p.stdin.end(raw);
    await f.done;
    console.log('  →', path.relative(ROOT, file));
  }
}

async function render(page, info, o, file, thumb) {
  const total = Math.ceil(info.length * o.fps);
  const head = info.head.toFixed(3);
  const f = ffmpeg([
    '-y', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${info.bw}x${info.bh}`, '-r', String(o.fps), '-i', 'pipe:0',
    '-i', path.join(ROOT, 'audio', info.id + '.mp3'),
    '-filter_complex', `[0:v]scale=-2:${o.height}:flags=neighbor,format=yuv420p[v];` +
                       `[1:a]adelay=${Math.round(info.head * 1000)}:all=1,apad[a]`,
    '-map', '[v]', '-map', '[a]', '-t', (total / o.fps).toFixed(3),
    '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', String(o.crf),
    '-r', String(o.fps), '-g', String(o.fps * 2),
    '-c:a', 'aac', '-b:a', '192k',
    '-metadata', `title=${info.title}`, '-metadata', `artist=${info.cast}`,
    '-metadata', `comment=鋒兄宇宙 PIXEL PV · ${info.tagline || ''}`,
    '-movflags', '+faststart', file
  ]);
  const t0 = Date.now();
  let thumbRaw = null;
  const thumbAt = Math.round(info.head * .75 * o.fps);
  for (let k = 0; k < total; k += o.batch) {
    const n = Math.min(o.batch, total - k);
    const raw = await grab(page, k / o.fps, n, o.fps);
    const fb = info.bw * info.bh * 3;
    if (thumbAt >= k && thumbAt < k + n) thumbRaw = Buffer.from(raw.subarray((thumbAt - k) * fb, (thumbAt - k + 1) * fb));
    await write(f.p.stdin, raw);
    if ((k / o.batch) % 40 === 0 || k + n >= total) {
      const el = (Date.now() - t0) / 1000, done = (k + n) / total;
      process.stdout.write(`\r  ${(done * 100).toFixed(1).padStart(5)}%  ${clock((k + n) / o.fps)} / ${clock(total / o.fps)}` +
                           `  ${((k + n) / el).toFixed(0)} fps  剩 ${clock(el / done - el)}   `);
    }
  }
  f.p.stdin.end();
  await f.done;
  process.stdout.write('\n');
  if (thumbRaw) {
    // the cover: the title card, upscaled the same way
    const t = ffmpeg(['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${info.bw}x${info.bh}`, '-i', 'pipe:0',
                      '-vf', `scale=-2:${o.height}:flags=neighbor`, '-frames:v', '1', thumb]);
    t.p.stdin.end(thumbRaw);
    await t.done;
  }
  const err = await page.evaluate(() => window.__pv.info().err);
  if (err) console.warn('  [story]', err);
}

(async () => {
  const o = args();
  const cat = catalog();
  const want = o.ids.length ? cat.filter(s => o.ids.includes(s.id)) : cat;
  if (!want.length) { console.error('沒有這些歌：', o.ids.join(' ')); process.exit(1); }
  fs.mkdirSync(o.out, { recursive: true });

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
           '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required', '--mute-audio']
  });
  try {
    for (const s of want) {
      const no = String(cat.indexOf(s) + 1).padStart(2, '0');
      const base = path.join(o.out, `PV${no}_${safe(s.title)}`);
      console.log(`▶ ${no} ${s.title}`);
      const page = await openSong(browser, s.id);
      const info = await page.evaluate(() => window.__pv.info());
      if (o.preview) await preview(page, info, o, base);
      else {
        await render(page, info, o, base + '.mp4', base + '.png');
        const mb = fs.statSync(base + '.mp4').size / 1048576;
        console.log(`  → ${path.relative(ROOT, base)}.mp4  ${clock(info.length)}  ${mb.toFixed(1)} MB`);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
