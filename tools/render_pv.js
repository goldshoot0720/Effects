#!/usr/bin/env node
/* =====================================================================
   把每首歌輸出成一支二次元風格的 PV（MP4，1920×1080）。

   用無頭 Chromium 打開 pv.html?song=<id>，透過 window.__pv 一格一格
   要畫面（JPEG），直接灌進 ffmpeg 編成 H.264，再接上延後片頭長度的
   音檔。畫面完全由時間決定，所以輸出是逐格精準、跟音樂對齊的。

   需要：Node 18+、playwright（含 Chromium）、ffmpeg

     node tools/render_pv.js                    九首全部
     node tools/render_pv.js s023 s101          只做這幾首
     node tools/render_pv.js --fps 60 --jobs 2 --out artifacts/pv   （--jobs：同時渲染幾首）
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
  const o = { fps: 30, crf: 19, out: path.join(ROOT, 'artifacts', 'pv'), ids: [], preview: false, batch: 6,
              jobs: Math.max(1, Math.min(4, require('os').cpus().length - 1)) };
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k === '--fps') o.fps = +a[++i];
    else if (k === '--crf') o.crf = +a[++i];
    else if (k === '--out') o.out = path.resolve(a[++i]);
    else if (k === '--preview') o.preview = true;
    else if (k === '--jobs') o.jobs = Math.max(1, +a[++i]);
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
  page.on('console', m => { if (m.type() === 'error') console.warn('  [console]', m.text()); });
  await page.goto(pathToFileURL(path.join(ROOT, 'pv.html')).href + '?song=' + id + '&render');
  await page.waitForFunction(() => window.__pv && window.__pv.info && (() => { try { return window.__pv.info().id; } catch (e) { return false; } })(),
                             null, { timeout: 30000 });
  // the T-pose puppets decode their art asynchronously and need WebGL2
  const ok = await page.waitForFunction(() => window.__pv.ready(), null, { timeout: 30000 }).then(() => true, () => false);
  if (!ok) throw new Error('立繪人偶沒有就緒（需要 WebGL2）');
  await page.evaluate(() => document.fonts.ready);
  return page;
}

// n JPEG frames from video time T0
async function grab(page, T0, n, fps) {
  const list = await page.evaluate(([a, b, c]) => window.__pv.grab(a, b, c), [T0, n, fps]);
  return list.map(b64 => Buffer.from(b64, 'base64'));
}

async function preview(page, info, o, base) {
  const d = info.dur, hd = info.head;
  const shots = [1.8, ...info.segs.map(s => hd + parseFloat(s.split(':')[1]) + 2.2).filter(T => T < hd + d), hd + d + 2.6, info.length - 1.2];
  for (const T of shots) {
    // run up to the frame so the meters have settled
    await grab(page, Math.max(0, T - .5), 4, 8);
    const [jpg] = await grab(page, T, 1, o.fps);
    const file = `${base}_${T.toFixed(1)}s.jpg`;
    fs.writeFileSync(file, jpg);
    console.log('  →', path.relative(ROOT, file));
  }
}

async function render(page, info, o, file, thumb, tag) {
  const total = Math.ceil(info.length * o.fps);
  const f = ffmpeg([
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(o.fps), '-i', 'pipe:0',
    '-i', path.join(ROOT, 'audio', info.id + '.mp3'),
    '-filter_complex', `[0:v]format=yuv420p[v];[1:a]adelay=${Math.round(info.head * 1000)}:all=1,apad[a]`,
    '-map', '[v]', '-map', '[a]', '-t', (total / o.fps).toFixed(3),
    '-c:v', 'libx264', '-preset', 'medium', '-tune', 'animation', '-crf', String(o.crf),
    '-r', String(o.fps), '-g', String(o.fps * 2),
    '-c:a', 'aac', '-b:a', '192k',
    '-metadata', `title=${info.title}`, '-metadata', `artist=${info.cast}`,
    '-metadata', `comment=鋒兄宇宙 PV · ${info.tagline || ''}`,
    '-movflags', '+faststart', file
  ]);
  const t0 = Date.now();
  const thumbAt = Math.round(info.head * .8 * o.fps);
  let last = 0;
  for (let k = 0; k < total; k += o.batch) {
    const n = Math.min(o.batch, total - k);
    const jpgs = await grab(page, k / o.fps, n, o.fps);
    if (thumbAt >= k && thumbAt < k + n) fs.writeFileSync(thumb, jpgs[thumbAt - k]);
    for (const j of jpgs) await write(f.p.stdin, j);
    if (Date.now() - last > 15000 || k + n >= total) {
      last = Date.now();
      const el = (Date.now() - t0) / 1000, done = (k + n) / total;
      console.log(`  ${tag} ${(done * 100).toFixed(1).padStart(5)}%  ${clock((k + n) / o.fps)} / ${clock(total / o.fps)}` +
                  `  ${((k + n) / el).toFixed(1)} fps  剩 ${clock(el / done - el)}`);
    }
  }
  f.p.stdin.end();
  await f.done;
}

// GPU compositing off: without a real GPU, the 2D canvas otherwise rasterises
// through SwiftShader and every read-back costs a second. WebGL (the puppets)
// still runs on SwiftShader.
const CHROME_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
                     '--disable-gpu-compositing', '--allow-file-access-from-files', '--mute-audio'];

async function one(chromium, s, cat, o) {
  const no = String(cat.indexOf(s) + 1).padStart(2, '0');
  const base = path.join(o.out, `PV${no}_${safe(s.title)}`);
  const tag = `[${no} ${s.title}]`;
  const browser = await chromium.launch({ args: CHROME_ARGS });
  try {
    const page = await openSong(browser, s.id);
    const info = await page.evaluate(() => window.__pv.info());
    console.log(`▶ ${tag} ${clock(info.length)}`);
    if (o.preview) await preview(page, info, o, base);
    else {
      await render(page, info, o, base + '.mp4', base + '.jpg', tag);
      const mb = fs.statSync(base + '.mp4').size / 1048576;
      console.log(`✔ ${tag} → ${path.relative(ROOT, base)}.mp4  ${clock(info.length)}  ${mb.toFixed(1)} MB`);
    }
  } finally {
    await browser.close();
  }
}

(async () => {
  const o = args();
  const cat = catalog();
  const want = o.ids.length ? cat.filter(s => o.ids.includes(s.id)) : cat;
  if (!want.length) { console.error('沒有這些歌：', o.ids.join(' ')); process.exit(1); }
  fs.mkdirSync(o.out, { recursive: true });
  const { chromium } = loadPlaywright();
  // longest songs first, so the workers finish together
  const queue = want.slice().sort((a, b) => b.dur - a.dur);
  let failed = 0;
  const worker = async () => {
    for (let s; (s = queue.shift());) {
      try { await one(chromium, s, cat, o); }
      catch (e) { failed++; console.error(`✘ [${s.id} ${s.title}]`, e.message); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(o.jobs, want.length) }, worker));
  if (failed) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
