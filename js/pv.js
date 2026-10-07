/* =====================================================================
   鋒兄宇宙 · PV — 二次元風格的宣傳影片
   跟像素 MV（js/px.js）是兩套東西：這裡是原生 1920×1080、平滑漸層、
   柔邊立繪，語彙取自 B 站的動畫 PV：

   * 片頭：糖果色粗描邊大標題（每個字一個顏色、白色粗外框、硬陰影），
     膠囊標籤，主角們在下面跳舞。
   * 主歌：兩種輪流 ——「殘光」式底片條（歌詞一格一字，兩側捲動）
     或漫畫對話泡泡（指著唱的人）。
   * 副歌：彩色彈跳大字，放射光、紙花、聚光燈，全員齊跳。
   * Hook／前奏／尾奏：「花束」式星空，主角旁邊站著一個裝滿銀河的
     剪影分身，歌詞直排散落在夜空。
   * 間奏與謝幕：桌面上一個個彈出來的「鋒兄.pet」視窗。
   * 四角 HUD：曲名、SEC 段落、時間碼、BAR 小節、♩=BPM。

   畫面完全由時間決定（window.__pv.grab 逐格要畫面），所以
   tools/render_pv.js 可以把它輸出成跟音樂逐格對齊的 MP4。
   ===================================================================== */
(function () {
'use strict';

const W = 1920, H = 1080, TAU = Math.PI * 2;
const HEAD = 3.4, TAIL = 8.5, CASTT = 3.8;
const cvs = document.getElementById('pv');
const qs = new URLSearchParams(location.search);
// ?render: tools/render_pv.js pulls frames itself. Then the canvas is drawn on
// the CPU — without a GPU, Skia on the CPU is far faster than a software-
// emulated GPU canvas, and every frame is read back. In a browser it stays
// on the GPU for smooth playback.
const RENDER = qs.has('render');
const MAIN = cvs.getContext('2d', RENDER ? { willReadFrequently: true } : undefined);
let ctx = MAIN;
// draw something once into its own canvas and keep it: the static layers of
// each background are baked, so a frame only paints what moves
const BAKED = new Map();
function bake(key, fn, w, h) {
  let c = BAKED.get(key);
  if (c) return c;
  c = document.createElement('canvas'); c.width = w || W; c.height = h || H;
  const keep = ctx;
  ctx = c.getContext('2d');
  try { fn(); } finally { ctx = keep; }
  BAKED.set(key, c);
  return c;
}
const CAT = window.MV_SONGS || [];
const FONT = '"Noto Sans CJK TC","Noto Sans TC","Microsoft JhengHei","PingFang TC","WenQuanYi Zen Hei",sans-serif';
const MONO = '"Noto Sans Mono CJK TC","DejaVu Sans Mono",Menlo,Consolas,monospace';

/* ------------------------------ utils ------------------------------ */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t * t;
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeBack = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeElastic = t => t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * TAU / 3) + 1;
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const p2 = n => String(n).padStart(2, '0'), p3 = n => String(n).padStart(3, '0');
function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(a, b, k) {
  const x = rgb(a), y = rgb(b);
  return '#' + x.map((v, i) => Math.round(lerp(v, y[i], k)).toString(16).padStart(2, '0')).join('');
}
function rgba(hex, a) { const c = rgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
const shade = (hex, k) => k < 1 ? mix(hex, '#000000', 1 - k) : mix(hex, '#ffffff', k - 1);
function b64u8(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function font(px, w) { ctx.font = `${w || 900} ${Math.round(px)}px ${FONT}`; }
function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

/* ------------------------------ state ------------------------------ */
let SONG = null, AA = null, BANDS = null, RMSA = null, NB = 12, DUR = 1, BEAT = .6;
let LINES = [], SEC = [], SEGS = [], CUTS = [], PAL = null, LEAD = [], ALL = [], CHORUS = [], CANDY = [], NO = 1, BANNER = '';
const F = { bass: 0, low: 0, mid: 0, high: 0, level: 0, flash: 0, beat: 0 };
let onsetIdx = 0, lastT = -1;

function bandAt(t, a, c) {
  const ff = t * AA.bandFps, f0 = clamp(Math.floor(ff), 0, AA.frames - 1);
  const f1 = Math.min(f0 + 1, AA.frames - 1), fr = clamp(ff - f0, 0, 1);
  let s = 0;
  for (let i = a; i <= c; i++) s += lerp(BANDS[f0 * NB + i], BANDS[f1 * NB + i], fr);
  return s / ((c - a + 1) * 255);
}
function rmsAt(t) { return RMSA[clamp(Math.round(t * AA.rmsFps), 0, RMSA.length - 1)] / 255; }
function meters(t, dt) {
  if (t < lastT - .05) { onsetIdx = 0; while (onsetIdx < AA.onsets.length && AA.onsets[onsetIdx] < t) onsetIdx++; }
  lastT = t;
  const tg = { bass: bandAt(t, 0, 1), low: bandAt(t, 2, 3), mid: bandAt(t, 4, 7), high: bandAt(t, 8, 11), level: rmsAt(t) };
  for (const k in tg) F[k] += (tg[k] - F[k]) * (1 - Math.pow(1 - (tg[k] > F[k] ? .55 : .12), dt * 60));
  const ph = ((t - AA.beat0) / BEAT) % 1;
  F.beat = Math.pow(1 - (ph < 0 ? ph + 1 : ph), 4);
  let hit = false;
  while (onsetIdx < AA.onsets.length && AA.onsets[onsetIdx] <= t) { onsetIdx++; hit = true; }
  if (hit && F.flash < .55) F.flash = 1;
  F.flash *= Math.pow(.0025, dt);
}
const beatN = t => (t - AA.beat0) / BEAT + 64;
function lineAt(t) {
  let lo = 0, hi = LINES.length - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (LINES[m].t <= t) { r = m; lo = m + 1; } else hi = m - 1; }
  if (r >= 0 && t > LINES[r].t + LINES[r].d + 1.2) return -1;
  return r;
}

/* The song cut into segments, each with one look. Sections give the shape:
   chorus → candy type over a sunburst or a stage, verse → film strips or
   speech bubbles in turn, hook / intro / outro → the galaxy night. A gap
   long enough to breathe becomes a desktop of .pet windows. */
const KIND = { c: 'CHORUS', v: 'VERSE', h: 'HOOK' };
function buildSegs() {
  SEGS = [];
  let nv = 0, nc = 0, nh = 0;
  if (!SEC.length || SEC[0].start > 1.5) SEGS.push({ t0: 0, mode: 'night', label: 'INTRO', who: 0 });
  SEC.forEach((s, i) => {
    const k = (s.kind || 'v')[0];
    // a breath between sections: an interlude on the desktop
    if (i > 0 && s.start - SEC[i - 1].end > 3) SEGS.push({ t0: SEC[i - 1].end + .4, mode: 'desk', label: 'INTERLUDE', who: i });
    let seg;
    if (k === 'c') seg = { mode: 'chorus', sub: nc++ % 2 ? 'stage' : 'burst' };
    else if (k === 'h') seg = { mode: 'night', sub: nh++ };
    else seg = { mode: 'verse', sub: nv++ % 2 ? 'bubble' : 'film' };
    const prev = SEGS[SEGS.length - 1];
    seg.t0 = prev ? Math.max(prev.t0 + .8, s.start - .3) : 0;
    seg.label = 'SEC.' + p2(i + 1) + '  ' + (KIND[k] || 'VERSE');
    seg.who = i;
    SEGS.push(seg);
  });
  const end = SEC.length ? SEC[SEC.length - 1].end + .6 : DUR;
  if (DUR - end > 3) SEGS.push({ t0: end, mode: 'night', label: 'OUTRO', who: SEC.length });
  CUTS = [HEAD, ...SEGS.slice(1).map(s => HEAD + s.t0), HEAD + DUR, HEAD + DUR + CASTT];
}
function segAt(t) { let r = SEGS[0]; for (const s of SEGS) if (t >= s.t0) r = s; return r; }

/* ------------------------------ assets ------------------------------ */
// an offscreen layer the size of the frame (the galaxy twin)
const LAYER = document.createElement('canvas'); LAYER.width = W; LAYER.height = H;
const lctx = LAYER.getContext('2d', { willReadFrequently: true });
// a small copy of it, scaled back up, is the soft glow around the twin
const HALO = document.createElement('canvas'); HALO.width = 240; HALO.height = 135;
const hctx = HALO.getContext('2d');
const STARS = document.createElement('canvas'); STARS.width = W; STARS.height = H;
(function () {
  const x = STARS.getContext('2d');
  for (let i = 0; i < 900; i++) {
    const r = hash(i + 3) < .92 ? .6 + hash(i) * 1.4 : 2 + hash(i + 1) * 2;
    x.fillStyle = `rgba(255,255,255,${.35 + hash(i + 7) * .65})`;
    x.beginPath(); x.arc(hash(i + 11) * W, hash(i + 13) * H, r, 0, TAU); x.fill();
  }
})();

/* ---------------------------- characters ---------------------------- */
const MOVES = ['wave', 'point', 'heart', 'clap', 'cheer', 'bounce', 'chuuni', 'jump'];
// a bar-by-bar list for the dancing scenes, crossfaded by js/puppet.js
const DANCE = ['clap', 'heart', 'cheer', 'wave', 'chuuni', 'jump', 'point', 'clap', 'cheer', 'heart'];
function fig(c, who, o) {
  if (!who || !window.MV_PUPPET) return;
  MV_PUPPET.draw(c, {
    id: who.id, x: o.x, y: o.y, h: o.h, t: o.t, beat: o.beat, move: o.move || 'bounce', i: o.i || 0, flip: o.flip,
    box: o.box, smooth: true, rim: o.rim === undefined ? 7 : o.rim, outline: o.outline === undefined ? '#ffffff' : o.outline, tint: o.tint,
    shadow: o.shadow === false ? null : { x: o.sx === undefined ? 16 : o.sx, y: o.sy === undefined ? 12 : o.sy, color: o.shadowColor || 'rgba(20,10,40,.32)' }
  });
}
// the 花束 twin: the same dancer, filled with a galaxy
function galaxyTwin(who, o, t) {
  const bx = Math.max(0, Math.floor(o.x - o.h * .8)), by = Math.max(0, Math.floor(o.y - o.h * 1.15));
  const bw = Math.min(W - bx, Math.ceil(o.h * 1.6)), bh = Math.min(H - by, Math.ceil(o.h * 1.2));
  lctx.clearRect(bx, by, bw, bh);
  fig(lctx, who, { ...o, tint: '#ffffff', outline: false, shadow: false });
  lctx.save();
  lctx.globalCompositeOperation = 'source-in';
  const g = lctx.createLinearGradient(0, o.y - o.h, 0, o.y);
  g.addColorStop(0, mix(PAL.acc2, '#1a1050', .3)); g.addColorStop(.5, mix(PAL.acc, '#2a1a70', .45)); g.addColorStop(1, '#0d0a2a');
  lctx.fillStyle = g; lctx.fillRect(bx, by, bw, bh);
  lctx.globalCompositeOperation = 'source-atop';
  const sx = (bx + t * 12) % W;
  lctx.drawImage(STARS, sx, by, Math.min(bw, W - sx), bh, bx, by, Math.min(bw, W - sx), bh);
  if (bw > W - sx) lctx.drawImage(STARS, 0, by, bw - (W - sx), bh, bx + (W - sx), by, bw - (W - sx), bh);
  const n = lctx.createRadialGradient(o.x, o.y - o.h * .6, 10, o.x, o.y - o.h * .6, o.h * .5);
  n.addColorStop(0, rgba(PAL.lamp, .45)); n.addColorStop(1, rgba(PAL.lamp, 0));
  lctx.fillStyle = n; lctx.fillRect(bx, by, bw, bh);
  lctx.restore();
  hctx.clearRect(0, 0, 240, 135);
  hctx.drawImage(LAYER, 0, 0, W, H, 0, 0, 240, 135);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(HALO, -W * .01, -H * .01, W * 1.02, H * 1.02);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = .92;
  ctx.drawImage(LAYER, bx, by, bw, bh, bx, by, bw, bh);
  ctx.restore();
}
function lineup(list, t, o) {
  const n = list.length, gap = Math.min(W * .86 / Math.max(1, n), o.h * .75);
  list.forEach((who, i) => fig(ctx, who, {
    x: W / 2 + (i - (n - 1) / 2) * gap, y: o.y, h: o.h, t, beat: beatN(t) + (o.stagger ? i * .5 : 0),
    move: typeof o.move === 'function' ? o.move(i) : o.move, i, flip: o.flipLast && i === n - 1 && n > 1, rim: o.rim
  }));
}

/* ----------------------------- backgrounds -------------------------- */
function sky(t, top, bot) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function glow(x, y, r, col, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function sparkle(x, y, r, col, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill(); ctx.restore();
}
function petals(t, n, cols) {
  for (let i = 0; i < n; i++) {
    const sp = .05 + hash(i * 1.3 + 5) * .06;
    const y = ((hash(i + 13) + t * sp) % 1.2 - .1) * H;
    const x = ((hash(i + 31) + t * sp * .5) % 1) * W + Math.sin(t * 1.3 + i) * 30;
    const r = 7 + hash(i + 2) * 9, rot = t * (1 + hash(i)) + i;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, .45 + .4 * Math.sin(t * 2 + i));
    ctx.fillStyle = cols[i % cols.length]; ctx.globalAlpha = .85;
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * .55, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
function bgNight(t) {
  ctx.drawImage(bake('night', () => {
    sky(0, mix(PAL.sky, '#05040f', .3), mix(PAL.bg2, PAL.acc2, .25));
    glow(W * .3, H * .4, 700, PAL.acc, .18);
    glow(W * .75, H * .25, 600, PAL.acc2, .2);
    // the moon, a fat crescent with a halo
    const mx = W * .83, my = H * .2;
    glow(mx, my, 260, PAL.lamp, .35);
    ctx.save();
    ctx.beginPath(); ctx.arc(mx, my, 78, 0, TAU); ctx.clip();
    ctx.beginPath(); ctx.rect(mx - 100, my - 100, 200, 200); ctx.arc(mx + 34, my - 18, 70, 0, TAU, true);
    ctx.fillStyle = mix(PAL.lamp, '#fffbe8', .5); ctx.fill();
    ctx.restore();
    // a low hill of light the dancers stand on
    const fl = ctx.createLinearGradient(0, H * .82, 0, H);
    fl.addColorStop(0, rgba(PAL.bg0, 0)); fl.addColorStop(1, rgba(PAL.bg0, .9));
    ctx.fillStyle = fl; ctx.fillRect(0, H * .82, W, H * .18);
  }), 0, 0);
  ctx.save(); ctx.globalAlpha = .9;
  ctx.drawImage(STARS, -(t * 6 % W), 0); ctx.drawImage(STARS, W - (t * 6 % W), 0);
  ctx.restore();
  for (let i = 0; i < 26; i++) {
    const tw = .5 + .5 * Math.sin(t * (1.5 + hash(i) * 3) + i * 7);
    sparkle(hash(i + 50) * W, hash(i + 70) * H * .8, 6 + hash(i + 9) * 14, '#ffffff', tw * .9);
  }
  // a shooting star every few seconds
  const ss = (t % 6.5) / .9;
  if (ss < 1) {
    const sx = W * (.15 + hash(Math.floor(t / 6.5)) * .5) + ss * 500, sy = H * .12 + ss * 220;
    const g = ctx.createLinearGradient(sx - 260, sy - 115, sx, sy);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.9)');
    ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx - 260, sy - 115); ctx.lineTo(sx, sy); ctx.stroke();
  }
  petals(t, 22, ['#ffffff', mix(PAL.acc2, '#ffffff', .5), mix(PAL.acc, '#ffffff', .55)]);
}
function bgPaper(t, seg) {
  ctx.drawImage(bake('paper', () => {
    sky(0, mix(PAL.ink, '#ffffff', .55), mix(PAL.acc2, '#ffffff', .55));
    ctx.fillStyle = rgba(PAL.acc, .22);
    for (let y = 0; y < 330; y += 22) for (let x = 0; x < 330; x += 22) {
      const r = Math.max(0, 7 - Math.hypot(x, y) / 52);
      if (r > .4) { ctx.beginPath(); ctx.arc(W - x - 10, y + 10, r, 0, TAU); ctx.arc(x + 10, H - y - 10, r, 0, TAU); ctx.fill(); }
    }
  }), 0, 0);
  // huge outlined banner type drifting behind everything
  const type = bake('paperType', () => {
    ctx.translate(W * .5 + 120, H * .5 + 120); ctx.rotate(-.12);
    font(420); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = rgba(PAL.acc, .16);
    for (let r = -2; r <= 2; r++) ctx.strokeText(BANNER, (r % 2 ? -1 : 1) * 120 - 240, r * 470);
  }, W + 240, H + 240);
  ctx.drawImage(type, -120 + Math.sin(t * .25) * 110, -120 + Math.cos(t * .2) * 40);
  // diagonal stripes in a band, and halftone dots in two corners
  ctx.save();
  ctx.beginPath(); ctx.rect(0, H * .66, W, H * .16); ctx.clip();
  ctx.fillStyle = rgba(PAL.warm, .22);
  for (let x = -H; x < W + H; x += 60) { ctx.beginPath(); ctx.moveTo(x + (t * 40) % 60, H * .66); ctx.lineTo(x + 30 + (t * 40) % 60, H * .66); ctx.lineTo(x - 130 + (t * 40) % 60, H * .82); ctx.lineTo(x - 160 + (t * 40) % 60, H * .82); ctx.fill(); }
  ctx.restore();
  // bokeh
  for (let i = 0; i < 14; i++) {
    const x = ((hash(i) + t * .01 * (1 + hash(i + 4))) % 1) * W, y = hash(i + 8) * H;
    glow(x, y, 60 + hash(i + 2) * 90, '#ffffff', .35);
  }
}
function bgBurst(t) {
  const cx = W / 2, cy = H * .42;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * .75);
  g.addColorStop(0, mix(PAL.warm, '#ffffff', .35)); g.addColorStop(.45, PAL.acc); g.addColorStop(1, mix(PAL.bg1, PAL.acc, .3));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * .18 + F.beat * .03);
  ctx.fillStyle = 'rgba(255,255,255,.13)';
  for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, W, i * TAU / 18, i * TAU / 18 + TAU / 36); ctx.fill(); }
  ctx.restore();
  // rings thrown out on every beat
  const bn = beatN(t), ph = bn % 1;
  for (let k = 0; k < 3; k++) {
    const p = (ph + k) / 3;
    ctx.strokeStyle = `rgba(255,255,255,${(1 - p) * .5})`; ctx.lineWidth = 10 * (1 - p) + 2;
    ctx.beginPath(); ctx.arc(cx, cy, 120 + p * W * .6, 0, TAU); ctx.stroke();
  }
  confetti(t, 60);
}
function bgStage(t) {
  sky(t, mix(PAL.sky, '#000000', .3), mix(PAL.bg1, PAL.sky, .4));
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const cols = [PAL.acc, PAL.acc2, PAL.warm, PAL.acc];
  for (let i = 0; i < 4; i++) {
    const x0 = W * (.12 + i * .25), sw = Math.sin(t * (.8 + i * .13) + i * 2) * .35 + Math.sin(beatN(t) * Math.PI) * .05;
    const ex = x0 + Math.sin(sw) * H * 1.2, ey = H * 1.02;
    const g = ctx.createLinearGradient(x0, 0, ex, ey);
    g.addColorStop(0, rgba(cols[i], .55)); g.addColorStop(1, rgba(cols[i], .04));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x0 - 18, -10); ctx.lineTo(x0 + 18, -10); ctx.lineTo(ex + 230, ey); ctx.lineTo(ex - 230, ey); ctx.fill();
    glow(ex, ey - 20, 260, cols[i], .35);
  }
  ctx.restore();
  // stage floor
  const fl = ctx.createLinearGradient(0, H * .8, 0, H);
  fl.addColorStop(0, rgba(PAL.bg2, .0)); fl.addColorStop(1, rgba(PAL.bg2, .85));
  ctx.fillStyle = fl; ctx.fillRect(0, H * .8, W, H * .2);
  for (let i = 0; i < 30; i++) sparkle(hash(i + 300) * W, hash(i + 301) * H * .7, 5 + hash(i) * 10, '#ffffff', (.5 + .5 * Math.sin(t * 3 + i)) * .8);
  confetti(t, 30);
}
function confetti(t, n) {
  const cols = [PAL.warm, PAL.acc2, '#ffffff', PAL.acc, '#8f6bff'];
  for (let i = 0; i < n; i++) {
    const sp = .09 + hash(i * 2.1) * .1;
    const y = ((hash(i + 91) + t * sp) % 1.15 - .08) * H, x = hash(i + 17) * W + Math.sin(t * 2 + i) * 40;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 3 * (hash(i) - .5) + i); ctx.scale(1, Math.cos(t * 5 + i));
    ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(-9, -5, 18, 10);
    ctx.restore();
  }
}
function bgDesk(t) {
  ctx.drawImage(bake('desk', () => {
    sky(0, '#fffafc', mix(PAL.acc2, '#ffffff', .62));
    ctx.fillStyle = rgba(PAL.acc, .2);
    for (let y = 30; y < H; y += 46) for (let x = 30 + (y / 46 % 2) * 23; x < W; x += 46) { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.fill(); }
    glow(W * .2, H * .2, 500, '#ffffff', .6);
  }), 0, 0);
  for (let i = 0; i < 12; i++) sparkle(hash(i + 40) * W, hash(i + 41) * H * .85, 10 + hash(i + 4) * 18, i % 2 ? PAL.acc : PAL.acc2, .5 + .5 * Math.sin(t * 2.4 + i));
}

/* ------------------------------ type -------------------------------- */
// split a line into rows that fit, breaking at spaces first
function rows(str, px, maxW) {
  font(px);
  const parts = str.split(/[ 　]+/).filter(Boolean);
  const out = [];
  let cur = '';
  for (const p of parts) {
    const t = cur ? cur + ' ' + p : p;
    if (ctx.measureText(t).width <= maxW) { cur = t; continue; }
    if (cur) out.push(cur);
    cur = '';
    for (const ch of p) {
      if (ctx.measureText(cur + ch).width > maxW && cur) { out.push(cur); cur = ''; }
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}
// candy type: each character its own colour, white rim, hard shadow,
// popping in one after another with a little tilt
function candy(str, cx, cy, size, maxW, appear, t, seed, opt) {
  opt = opt || {};
  let px = size, rs = rows(str, px, maxW);
  while (rs.length > (opt.maxRows || 2) && px > 50) { px -= 8; rs = rows(str, px, maxW); }
  // a line with no spaces wraps into even rows, not a full row and a widow
  if (rs.length > 1 && !/[ 　]/.test(str.trim())) {
    const cs = [...str.trim()], n = rs.length, per = Math.ceil(cs.length / n);
    rs = Array.from({ length: n }, (_, i) => cs.slice(i * per, (i + 1) * per).join('')).filter(Boolean);
  }
  font(px);
  const lh = px * 1.18, y0 = cy - (rs.length - 1) * lh / 2;
  let k = 0;
  for (let r = 0; r < rs.length; r++) {
    const cs = [...rs[r]];
    const ws = cs.map(c => ctx.measureText(c).width);
    let x = cx - ws.reduce((a, b) => a + b, 0) / 2;
    for (let i = 0; i < cs.length; i++, k++) {
      const ch = cs[i], w = ws[i];
      if (ch === ' ') { x += w; continue; }
      const p = clamp((t - appear - k * (opt.step || .05)) / .45, 0, 1);
      if (p <= 0) { x += w; continue; }
      const col = CANDY[(k + seed) % CANDY.length];
      const hop = opt.hop ? Math.max(0, Math.sin((beatN(t) - k * .25) * Math.PI)) * px * .06 : 0;
      ctx.save();
      ctx.translate(x + w / 2, y0 + r * lh - hop);
      ctx.rotate((hash(k * 3.1 + seed) - .5) * .22);
      const sc = easeElastic(p);
      ctx.scale(sc, sc);
      font(px); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.fillStyle = shade(col, .42);
      ctx.strokeStyle = shade(col, .42); ctx.lineWidth = px * .26;
      ctx.strokeText(ch, px * .06, px * .08); ctx.fillText(ch, px * .06, px * .08);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = px * .22;
      ctx.strokeText(ch, 0, 0);
      const g = ctx.createLinearGradient(0, -px * .5, 0, px * .5);
      g.addColorStop(0, mix(col, '#ffffff', .35)); g.addColorStop(.55, col); g.addColorStop(1, shade(col, .82));
      ctx.fillStyle = g; ctx.fillText(ch, 0, 0);
      ctx.restore();
      x += w;
    }
  }
  return y0 + (rs.length - 1) * lh + px / 2;
}
// a plain, readable subtitle in the lower third
function subtitle(str, p, y) {
  const rs = rows(str, 50, W * .8);
  font(50, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = clamp(p * 4, 0, 1);
  rs.forEach((r, i) => {
    const yy = (y || H * .9) - (rs.length - 1 - i) * 62;
    ctx.lineJoin = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(16,10,30,.85)';
    ctx.strokeText(r, W / 2, yy);
    ctx.fillStyle = '#ffffff'; ctx.fillText(r, W / 2, yy);
  });
  ctx.globalAlpha = 1;
}
// 殘光: a film strip with one character to a frame
function filmStrip(x, chars, firstK, total, line, t, dir) {
  const sw = 250, m = Math.max(3, chars.length), cell = Math.min(205, (H - 70) / m);
  const fh = cell - 16, fw = sw - 76;
  ctx.save();
  ctx.fillStyle = 'rgba(10,9,16,.93)'; ctx.fillRect(x - sw / 2, 0, sw, H);
  // sprocket holes rolling past
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  const off = (t * 60 * dir) % 34;
  for (let y = -34 + off; y < H + 34; y += 34) {
    rrect(x - sw / 2 + 9, y, 16, 20, 4); ctx.fill();
    rrect(x + sw / 2 - 25, y, 16, 20, 4); ctx.fill();
  }
  for (let k = 0; k < m; k++) {
    const cy = H / 2 + (k - (m - 1) / 2) * cell;
    const fx = x - fw / 2, fy = cy - fh / 2;
    const g = ctx.createLinearGradient(0, fy, 0, fy + fh);
    g.addColorStop(0, '#1a1726'); g.addColorStop(1, '#0c0b12');
    ctx.fillStyle = g; ctx.fillRect(fx, fy, fw, fh);
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2; ctx.strokeRect(fx, fy, fw, fh);
    const ch = chars[k];
    const gi = firstK + k;
    const at = line.t + (gi / Math.max(1, total)) * Math.max(.6, line.d * .8);
    const p = ch ? clamp((t - at) / .3, 0, 1) : 0;
    if (p > 0) {
      font(Math.min(fh * .66, 132), 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.save(); ctx.translate(x, cy); ctx.scale(lerp(1.35, 1, easeOut(p)), lerp(1.35, 1, easeOut(p)));
      ctx.globalAlpha = p;
      ctx.shadowColor = rgba(PAL.lamp, .9); ctx.shadowBlur = 24;
      ctx.fillStyle = '#fff7ea'; ctx.fillText(ch, 0, 4);
      ctx.restore();
      if (p < 1) { ctx.fillStyle = `rgba(255,255,255,${(1 - p) * .5})`; ctx.fillRect(fx, fy, fw, fh); }
    } else {
      // an empty frame waits with its number in a circle
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, cy, Math.min(fh, fw) * .28, 0, TAU); ctx.stroke();
      font(Math.min(fh, fw) * .26, 300); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(gi + 1), x, cy + 2);
    }
  }
  ctx.restore();
}
// 達拉崩吧: a comic speech bubble pointing at whoever sings
function speech(str, p, tail, t, k) {
  if (p <= 0) return;
  const maxW = 680;
  const px = str.length > 18 ? 58 : 70;
  const rs = rows(str, px, maxW);
  font(px);
  const tw = Math.max(...rs.map(r => ctx.measureText(r).width));
  const bw = Math.max(330, tw + 130), bh = rs.length * px * 1.25 + 100;
  const bx = W * .72 - bw / 2 + (k % 2 ? 40 : -20), by = H * .3 - bh / 2 + (k % 2 ? 60 : 0);
  const cx = bx + bw / 2, cy = by + bh / 2;
  const sc = easeElastic(clamp(p * 1.6, 0, 1)) * (1 + Math.sin(t * 6) * .006);
  ctx.save();
  ctx.translate(tail[0], tail[1]); ctx.scale(sc, sc); ctx.translate(-tail[0], -tail[1]);
  ctx.lineJoin = 'round';
  const oval = rs.length === 1 && [...str].length <= 9;
  const body = () => { ctx.beginPath(); if (oval) ctx.ellipse(cx, cy, bw / 2, bh / 2, 0, 0, TAU); else ctx.roundRect(bx, by, bw, bh, 60); };
  // the tail, a curved wedge from inside the bubble out to the face
  const a = Math.atan2(tail[1] - cy, tail[0] - cx), sx = cx + Math.cos(a) * bw * .3, sy = cy + Math.sin(a) * bh * .3;
  const nx = -Math.sin(a) * 40, ny = Math.cos(a) * 40;
  const wedge = () => {
    ctx.beginPath(); ctx.moveTo(sx + nx, sy + ny);
    ctx.quadraticCurveTo((sx + tail[0]) / 2 + nx * .25, (sy + tail[1]) / 2 + ny * .25, tail[0], tail[1]);
    ctx.quadraticCurveTo((sx + tail[0]) / 2 - nx * .25, (sy + tail[1]) / 2 - ny * .25, sx - nx, sy - ny);
    ctx.closePath();
  };
  ctx.fillStyle = 'rgba(30,16,40,.25)';
  ctx.save(); ctx.translate(12, 14); body(); ctx.fill(); wedge(); ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#1d1626'; ctx.lineWidth = 14;
  body(); ctx.stroke(); wedge(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  body(); ctx.fill(); wedge(); ctx.fill();
  font(px); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#1d1626';
  const shown = [...str].slice(0, Math.ceil([...str].length * clamp(p * 2.2, 0, 1))).join('');
  let left = [...shown].length;
  rs.forEach((r, i) => {
    const rc = [...r], s = rc.slice(0, Math.max(0, left)).join(''); left -= rc.length + 1;
    font(px); const fullW = ctx.measureText(r).width;
    ctx.textAlign = 'left';
    ctx.fillText(s, cx - fullW / 2, cy + (i - (rs.length - 1) / 2) * px * 1.25 + 4);
  });
  ctx.restore();
  // anime emphasis marks next to the bubble
  ctx.save(); ctx.strokeStyle = PAL.acc; ctx.lineWidth = 9; ctx.lineCap = 'round';
  const mx = bx + bw + 10, my = by + 10;
  ctx.globalAlpha = clamp(p * 3, 0, 1);
  for (let i = 0; i < 3; i++) {
    const ang = -.9 + i * .45, r0 = 30, r1 = 70 + (i === 1 ? 14 : 0);
    ctx.beginPath(); ctx.moveTo(mx + Math.cos(ang) * r0, my + Math.sin(ang) * r0); ctx.lineTo(mx + Math.cos(ang) * r1, my + Math.sin(ang) * r1); ctx.stroke();
  }
  ctx.restore();
}
// 花束: the characters of a line scattered down the sky in columns
function scatter(line, t) {
  const cs = [...line.text].filter(c => c.trim());
  const xs = [.07, .15, .23, .77, .85, .93];
  font(66, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  cs.forEach((ch, k) => {
    const at = line.t + k / cs.length * Math.max(.6, line.d * .85);
    const a = clamp((t - at) / .5, 0, 1);
    if (a <= 0) return;
    const col = k % xs.length, row = Math.floor(k / xs.length);
    const x = W * xs[(col * 4 + line.idx) % xs.length] + (hash(k + line.idx * 13) - .5) * 30;
    const y = H * (.18 + row * .13 + hash(k * 7 + line.idx) * .1) + (t - at) * 14;
    ctx.save(); ctx.globalAlpha = a * .95;
    ctx.shadowColor = rgba(PAL.lamp, 1); ctx.shadowBlur = 26;
    ctx.fillStyle = mix(PAL.lamp, '#ffffff', .6); ctx.fillText(ch, x, y);
    ctx.restore();
  });
}

/* ------------------------------ windows ----------------------------- */
// a desktop-pet window: coloured title bar, paw, file name, id tag,
// three buttons, polka-dot wallpaper and the character close up
function petWin(who, x, y, w, h, col, t, i, p) {
  if (p <= 0) return;
  const s = easeBack(clamp(p, 0, 1));
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2); ctx.scale(s, s); ctx.translate(-(x + w / 2), -(y + h / 2));
  ctx.fillStyle = 'rgba(40,20,60,.28)'; rrect(x + 14, y + 18, w, h, 22); ctx.fill();
  ctx.fillStyle = '#ffffff'; rrect(x, y, w, h, 22); ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = '#2a1d3a'; ctx.stroke();
  const bar = 62;
  ctx.save(); rrect(x, y, w, h, 22); ctx.clip();
  ctx.fillStyle = col; ctx.fillRect(x, y, w, bar);
  ctx.fillStyle = shade(col, .8); ctx.fillRect(x, y + bar - 6, w, 6);
  // the wallpaper and the close-up
  const g = ctx.createLinearGradient(0, y + bar, 0, y + h);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, mix(col, '#ffffff', .55));
  ctx.fillStyle = g; ctx.fillRect(x, y + bar, w, h - bar);
  ctx.fillStyle = rgba(col, .28);
  for (let yy = y + bar + 18; yy < y + h; yy += 36) for (let xx = x + 18 + ((yy - y) / 36 % 2) * 18; xx < x + w; xx += 36) { ctx.beginPath(); ctx.arc(xx, yy, 5, 0, TAU); ctx.fill(); }
  ctx.save(); ctx.beginPath(); ctx.rect(x, y + bar, w, h - bar); ctx.clip();
  fig(ctx, who, { box: { x: x + 6, y: y + bar + 8, w: w - 12, h: h - bar - 8 }, t, beat: beatN(t - HEAD) + i * .5, move: 'bounce', i: 1, rim: 6, shadow: false });
  ctx.restore();
  ctx.restore();
  ctx.lineWidth = 6; ctx.strokeStyle = '#2a1d3a'; rrect(x, y, w, h, 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y + bar); ctx.lineTo(x + w, y + bar); ctx.stroke();
  // paw
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + 34, y + 31, 17, 0, TAU); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + 34, y + 35, 6.5, 0, TAU); ctx.fill();
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x + 26 + k * 8, y + 25, 3.2, 0, TAU); ctx.fill(); }
  font(30, 900); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#2a1d3a';
  ctx.fillText((who.name || who.id) + '.pet', x + 62, y + 32);
  font(17, 700); ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(42,29,58,.75)';
  ctx.fillText([...String(who.id).toUpperCase()].join(' '), x + w - 132, y + 33);
  for (let k = 0; k < 3; k++) {
    const bx = x + w - 104 + k * 34, by = y + 31;
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(bx, by, 13, 0, TAU); ctx.fill();
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#2a1d3a'; ctx.stroke();
    ctx.beginPath();
    if (k === 0) { ctx.moveTo(bx - 6, by); ctx.lineTo(bx + 6, by); }
    else if (k === 1) ctx.rect(bx - 5, by - 5, 10, 10);
    else { ctx.moveTo(bx - 5, by - 5); ctx.lineTo(bx + 5, by + 5); ctx.moveTo(bx + 5, by - 5); ctx.lineTo(bx - 5, by + 5); }
    ctx.lineWidth = 3; ctx.stroke();
  }
  ctx.restore();
}
// window layouts, kept below the HUD and above the task bar
const PETLAY = {
  1: [[.3, .13]], 2: [[.08, .13], [.5, .27]], 3: [[.05, .12], [.35, .34], [.63, .11]],
  4: [[.03, .12], [.28, .4], [.5, .1], [.66, .42]]
};
function petDesk(list, t, u) {
  const n = Math.min(4, list.length), lay = PETLAY[n] || PETLAY[1];
  const w = W * (n >= 3 ? .33 : n === 2 ? .4 : .42), h = H * (n === 4 ? .5 : n === 3 ? .52 : n === 2 ? .6 : .66);
  const cols = [PAL.warm, PAL.acc2, PAL.acc, '#a98bff'];
  for (let i = 0; i < n; i++)
    petWin(list[i], W * lay[i][0], H * lay[i][1], w, h, mix(cols[i % 4], '#ffffff', .12), t, i, (u - .15 - i * .32) / .42);
}
function taskbar(t, label) {
  ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillRect(0, H - 64, W, 64);
  ctx.fillStyle = '#2a1d3a'; ctx.fillRect(0, H - 64, W, 4);
  ctx.fillStyle = PAL.acc; rrect(18, H - 50, 150, 38, 19); ctx.fill();
  font(22, 900); ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, 93, H - 30);
  font(22, 700); ctx.fillStyle = '#2a1d3a'; ctx.textAlign = 'left';
  ctx.fillText(SONG.title + '　·　' + SONG.cast, 190, H - 30);
}

/* ------------------------------- HUD -------------------------------- */
// 殘光: crop marks and four corners of quiet information
function hud(t, T, seg, dark) {
  const ink = dark ? 'rgba(40,26,60,.85)' : 'rgba(255,255,255,.88)';
  ctx.save();
  ctx.strokeStyle = ink; ctx.lineWidth = 3;
  const m = 34, L = 46;
  [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.beginPath(); ctx.moveTo(x + sx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * L); ctx.stroke();
  });
  ctx.font = `600 22px ${MONO}`;
  const back = dark ? 'rgba(255,255,255,.55)' : 'rgba(10,6,24,.35)';
  const plate = (x, y, w, h) => { ctx.fillStyle = back; rrect(x, y, w, h, 8); ctx.fill(); };
  const tlw = Math.max(ctx.measureText(SONG.title + ' / ' + SONG.cast).width, ctx.measureText(seg.label).width) + 24;
  plate(m + 8, m + 10, tlw, 70); plate(W - m - 8 - 250, m + 10, 250, 70);
  plate(m + 8, H - m - 50, 150, 40); plate(W - m - 8 - 120, H - m - 50, 120, 40);
  ctx.fillStyle = ink; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.fillText(SONG.title + ' / ' + SONG.cast, m + 20, m + 18);
  ctx.fillText(seg.label, m + 20, m + 50);
  const f = Math.floor(T * 30 + 1e-6), s = Math.floor(f / 30);
  ctx.textAlign = 'right';
  ctx.fillText(p2(Math.floor(s / 3600)) + ':' + p2(Math.floor(s / 60) % 60) + ':' + p2(s % 60) + ':' + p2(f % 30), W - m - 20, m + 18);
  const bn = (t - AA.beat0) / BEAT, bars = Math.max(1, Math.ceil((DUR - AA.beat0) / BEAT / 4));
  ctx.fillText('BAR ' + p3(clamp(Math.floor(bn / 4) + 1, 1, bars)) + ' / ' + p3(bars), W - m - 20, m + 50);
  ctx.textBaseline = 'bottom'; ctx.textAlign = 'left';
  ctx.fillText('♩=' + AA.bpm.toFixed(1), m + 20, H - m - 18);
  // four squares, the beat inside the bar
  const q = ((Math.floor(bn) % 4) + 4) % 4;
  for (let i = 0; i < 4; i++) {
    const x = W - m - 20 - (3 - i) * 22 - 14;
    if (i === q && t > 0) ctx.fillRect(x, H - m - 32, 14, 14); else ctx.strokeRect(x, H - m - 32, 14, 14);
  }
  ctx.restore();
}
// a section label that slides in when the look changes
function stinger(seg, t) {
  const u = t - seg.t0;
  if (u < 0 || u > 1.8 || seg.label === 'INTRO') return;
  const p = easeOut(clamp(u / .35, 0, 1)), q = u > 1.4 ? easeIn((u - 1.4) / .4) : 0;
  const x = lerp(-520, 0, p) - q * 520;
  ctx.save();
  ctx.fillStyle = PAL.acc; ctx.fillRect(x, H * .64, 470, 74);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x, H * .64 + 74, 470 * p, 6);
  ctx.font = `800 40px ${MONO}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
  ctx.fillText(seg.label, x + 70, H * .64 + 38);
  ctx.restore();
}

/* ---------------------------- the scenes ---------------------------- */
function whoOf(seg, k) { return LEAD[(seg.who + (k || 0)) % LEAD.length]; }
function songFrame(t, T) {
  const seg = segAt(t), idx = lineAt(t), line = idx >= 0 ? LINES[idx] : null;
  const bt = beatN(t), age = t - seg.t0;
  if (seg.mode === 'night') {
    bgNight(t);
    const who = whoOf(seg);
    const base = { y: H * .97, h: H * .8, t, beat: bt };
    const twin = LEAD.length > 1 ? LEAD[(seg.who + 1) % LEAD.length] : who;
    galaxyTwin(twin, { ...base, x: W * .36, h: H * .88, flip: true, move: DANCE, i: 1 }, t);
    fig(ctx, who, { ...base, x: W * .62, move: age < 2 ? 'wave' : DANCE, i: 0 });
    if (line) { scatter(line, t); subtitle(line.text, (t - line.t) / .6); }
  } else if (seg.mode === 'verse' && seg.sub === 'film') {
    bgPaper(t, seg);
    const who = whoOf(seg);
    const mv = line ? MOVES[line.idx % MOVES.length] : 'bounce';
    fig(ctx, who, { x: W / 2, y: H * 1.36, h: H * 1.32, t, beat: bt, move: mv, i: 1, rim: 9 });
    if (line) {
      const cs = [...line.text].filter(c => c.trim()), half = Math.ceil(cs.length / 2);
      filmStrip(W * .1, cs.slice(0, half), 0, cs.length, line, t, 1);
      filmStrip(W * .9, cs.slice(half), half, cs.length, line, t, -1);
      subtitle(line.text, (t - line.t) / .6);
    } else { filmStrip(W * .1, [], 0, 1, { t: 1e9, d: 1 }, t, 1); filmStrip(W * .9, [], 0, 1, { t: 1e9, d: 1 }, t, -1); }
  } else if (seg.mode === 'verse') {
    bgPaper(t, seg);
    const who = whoOf(seg, line ? line.idx % Math.min(2, LEAD.length) : 0);
    const mv = line ? MOVES[(line.idx + 3) % MOVES.length] : 'bounce';
    fig(ctx, who, { x: W * .28, y: H * 1.3, h: H * 1.28, t, beat: bt, move: mv, i: 1, rim: 9 });
    const J = MV_PUPPET.joints(who.id), face = J && J.face ? J.face : [W * .28, H * .3];
    if (line) speech(line.text, (t - line.t) / .55, [face[0] + 150, face[1] + 40], t, line.idx);
  } else if (seg.mode === 'chorus') {
    if (seg.sub === 'stage') bgStage(t); else bgBurst(t);
    const n = CHORUS.length;
    const zoom = 1 + F.beat * .012 * (F.level + .4);
    ctx.save(); ctx.translate(W / 2, H); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H);
    lineup(CHORUS, t, { y: H * 1.0, h: H * (n > 2 ? .6 : .68), move: DANCE, stagger: true });
    ctx.restore();
    if (line) candy(line.text, W / 2, H * .25, 150, W * .86, line.t - .05, t, line.idx * 3, { hop: true, maxRows: 2 });
  } else if (seg.mode === 'desk') {
    bgDesk(t);
    // each interlude opens the windows in a different order
    const k = seg.who % Math.max(1, LEAD.length);
    petDesk(LEAD.slice(k).concat(LEAD.slice(0, k)), t, age);
    taskbar(t, 'PETS');
    if (line) subtitle(line.text, (t - line.t) / .6, H * .86);
  }
  stinger(seg, t);
  hud(t, T, seg, seg.mode === 'verse' || seg.mode === 'desk');
}

function titleCard(T) {
  bgDesk(T);
  glow(W / 2, H * .32, 760, mix(PAL.acc2, '#ffffff', .4), .5);
  for (let i = 0; i < 8; i++) {
    const x = W * (.05 + hash(i + 90) * .9), y = H * (.08 + hash(i + 91) * .5);
    ctx.fillStyle = rgba(i % 2 ? PAL.acc : PAL.acc2, .14);
    ctx.beginPath(); ctx.arc(x, y, 40 + hash(i + 92) * 120, 0, TAU); ctx.fill();
  }
  lineup(LEAD, T, { y: H * 1.06, h: H * .62, move: i => ['cheer', 'wave', 'heart', 'clap'][i % 4], flipLast: true, stagger: true });
  // the logo
  const cs = [...SONG.title], long = cs.length > 10;
  // a long title with nowhere to break is split into two even halves
  const title = long && !/\s/.test(SONG.title) ? cs.slice(0, Math.ceil(cs.length / 2)).join('') + ' ' + cs.slice(Math.ceil(cs.length / 2)).join('') : SONG.title;
  const y = candy(title, W / 2, H * (long ? .24 : .28), long ? 120 : 168, W * .88, .15, T, 0, { maxRows: 2, step: .06, hop: true });
  // capsule labels
  const p = easeBack(clamp((T - .9) / .4, 0, 1));
  if (p > 0) {
    const tag = SONG.tagline || SONG.cast;
    font(34, 900);
    const tw = ctx.measureText(tag).width + 150;
    ctx.save(); ctx.translate(W / 2, y + 84); ctx.scale(p, p);
    ctx.fillStyle = '#2a1d3a'; rrect(-tw / 2 + 6, -34, tw, 72, 36); ctx.fill();
    ctx.fillStyle = '#ffffff'; rrect(-tw / 2, -40, tw, 72, 36); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#2a1d3a'; ctx.stroke();
    ctx.fillStyle = PAL.acc; ctx.beginPath(); ctx.arc(-tw / 2 + 42, -4, 17, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-tw / 2 + 42, -4, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a1d3a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(tag, 18, -2);
    ctx.restore();
  }
  ctx.save();
  ctx.font = `700 24px ${MONO}`; ctx.fillStyle = 'rgba(42,29,58,.8)'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('No.' + p2(NO) + '  鋒兄宇宙 PV', 60, 52);
  ctx.textAlign = 'right'; ctx.fillText(SONG.cast, W - 60, 52);
  ctx.restore();
}
function endCard(T) {
  const u = T - HEAD - DUR;
  if (u < CASTT) {
    bgDesk(T);
    petDesk(LEAD, T, u);
    taskbar(T, 'CAST');
    return;
  }
  const v = u - CASTT;
  bgNight(T);
  lineup(ALL, T, { y: H * .99, h: H * .5, move: v > TAIL - CASTT - 1.5 ? 'bow' : DANCE });
  const y = candy('THE END', W / 2, H * .24, 170, W * .8, HEAD + DUR + CASTT, T, 2, { step: .07 });
  ctx.save();
  ctx.globalAlpha = clamp((v - .8) / .5, 0, 1);
  font(40, 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
  ctx.shadowColor = rgba(PAL.acc2, 1); ctx.shadowBlur = 20;
  ctx.fillText(SONG.title, W / 2, y + 70);
  font(26, 700); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.shadowBlur = 0;
  ctx.fillText('MUSIC & LYRICS © 鋒兄 · 塗哥　　鋒兄宇宙 PV', W / 2, y + 122);
  ctx.restore();
}

/* the anime cut: three slanted colour bands sweeping across a scene change */
function slash(T) {
  let best = 1e9, cut = 0;
  for (const c of CUTS) if (Math.abs(T - c) < Math.abs(best)) { best = T - c; cut = c; }
  if (Math.abs(best) > .32) return;
  const u = best / .32;            // -1 … 1, the cut at 0
  const cols = [PAL.acc2, '#ffffff', PAL.acc];
  for (let i = 0; i < 3; i++) {
    const x = lerp(-W * 1.2, W * 1.2, easeInOut((u + 1) / 2)) + (i - 1) * 140 * (1 - Math.abs(u));
    ctx.fillStyle = cols[i];
    ctx.beginPath();
    ctx.moveTo(x - W * .1, 0); ctx.lineTo(x + W * .9, 0); ctx.lineTo(x + W * .7, H); ctx.lineTo(x - W * .3, H);
    ctx.fill();
  }
}
function post(T) {
  ctx.drawImage(bake('vignette', () => {
    const v = ctx.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * 1.05);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,0,30,.32)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }), 0, 0);
  // a flash on the big hits
  if (F.flash > .05 && T > HEAD && T < HEAD + DUR) { ctx.fillStyle = `rgba(255,255,255,${F.flash * .1})`; ctx.fillRect(0, 0, W, H); }
}

function frame(T, dt) {
  const t = clamp(T - HEAD, 0, DUR);
  meters(t, dt);
  ctx.save();
  if (T < HEAD) titleCard(T);
  else if (T > HEAD + DUR) endCard(T);
  else songFrame(t, T);
  ctx.restore();
  slash(T);
  post(T);
}

/* ------------------------------- boot ------------------------------- */
function apply(d, i) {
  SONG = d; AA = d.analysis; NO = i + 1;
  BANDS = b64u8(AA.bands); RMSA = b64u8(AA.rms); NB = AA.bandCount;
  DUR = AA.duration; BEAT = 60 / AA.bpm;
  LINES = d.lines.map((l, k) => ({ ...l, idx: k }));
  SEC = d.sections || [];
  const st = window.MV_STORY[d.id] || window.MV_STORY.__default(d);
  PAL = st.pal; BANNER = st.banner || d.title;
  LEAD = window.MV_STORY.__lead(d.id);
  ALL = window.MV_STORY.__cast();
  // a solo song still gets a chorus line: two of the others dance either side of the lead
  CHORUS = LEAD.slice();
  if (CHORUS.length < 3) {
    const rest = ALL.filter(c => !LEAD.includes(c));
    const k = Math.floor(hash(NO * 7.3) * rest.length);
    const back = [rest[k % rest.length], rest[(k + 3) % rest.length]];
    CHORUS = CHORUS.length === 1 ? [back[0], CHORUS[0], back[1]] : [back[0], ...CHORUS];
  }
  CANDY = [PAL.acc, PAL.acc2, PAL.warm, '#8f6bff', '#3ddc97', '#ff7a45'];
  buildSegs();
  BAKED.clear();
  lastT = -1; onsetIdx = 0;
  for (const k in F) F[k] = 0;
  document.title = d.title + ' · 第一版本 · 二次元 PV';
}
// load a song by id (its data file on demand), then call back.
// repeated taps share one script tag so a slow phone does not inject it twice.
const songWaiters = {};
const songLoading = new Set();
function load(id, cb) {
  const i = Math.max(0, CAT.findIndex(s => s.id === id));
  const meta = CAT[i];
  if (!meta) return;
  const done = () => { apply(window.MV_SONG_DATA[meta.id], i); if (cb) cb(); };
  if (window.MV_SONG_DATA && window.MV_SONG_DATA[meta.id]) return done();
  (songWaiters[id] || (songWaiters[id] = [])).push(done);
  if (songLoading.has(id)) return;
  songLoading.add(id);
  const s = document.createElement('script');
  s.src = 'data/song/' + meta.id + '.js?v=2.0.0';
  s.onload = () => {
    songLoading.delete(id);
    const list = songWaiters[id] || [];
    songWaiters[id] = [];
    if (window.MV_SONG_DATA && window.MV_SONG_DATA[meta.id]) list.forEach(fn => fn());
  };
  document.head.appendChild(s);
}
if (window.MV_PUPPET) MV_PUPPET.preload();

window.__pv = {
  ready: () => !!SONG && !!window.MV_PUPPET && Object.keys(window.MV_CAST_ART || {}).every(id => MV_PUPPET.ready(id)),
  info: () => ({ id: SONG.id, title: SONG.title, cast: SONG.cast, tagline: SONG.tagline, dur: DUR, head: HEAD,
                 tail: TAIL, length: HEAD + DUR + TAIL, w: W, h: H, gl: MV_PUPPET.ok(), segs: SEGS.map(s => s.mode + ':' + s.t0.toFixed(1)) }),
  frame: (T, dt) => frame(T, dt),
  // n frames from video time T0 as JPEG base64 strings
  grab(T0, n, fps, q) {
    const out = [];
    for (let k = 0; k < n; k++) {
      frame(T0 + k / fps, 1 / fps);
      out.push(cvs.toDataURL('image/jpeg', q || .94).slice(23));
    }
    return out;
  }
};

if (RENDER) {
  document.documentElement.classList.add('render');
  load(qs.get('song') || (CAT[0] && CAT[0].id));
} else player();

/* ------------------------------ player ------------------------------ */
// The web page: the PV plays along with the music. The clock follows the
// audio while the song sounds and the wall clock over the title card and
// the curtain call, so seeking anywhere just works.
function player() {
  const $ = s => document.querySelector(s);
  const audio = new Audio();
  audio.preload = 'auto';
  audio.playsInline = true;
  let T = 0, playing = false, anchor = 0, last = performance.now(), idx = 0, lastUi = '';
  let unlockP = null, unlocking = false;
  const LEN = () => HEAD + DUR + TAIL;
  const fmt = v => Math.floor(v / 60) + ':' + p2(Math.floor(v % 60));
  const audible = () => { const st = T - HEAD; return playing && st >= 0 && st < DUR - .05; };
  // iOS only starts audio inside the tap. The title card is silent for a few
  // seconds, so the tap plays the file muted (that unlocks the element) and
  // the clock starts the real playback once the song begins.
  function unlock(src) {
    if (src && !String(audio.src || '').endsWith(src)) audio.src = src;
    if (!audio.src) return;
    const on = audible();
    audio.muted = !on;
    const p = audio.play();
    unlockP = p;
    unlocking = true;
    const finish = () => {
      if (unlockP !== p) return;
      unlocking = false;
      if (!audible()) audio.pause();
      audio.muted = false;
    };
    if (p && p.then) p.then(finish).catch(() => { if (unlockP === p) { unlocking = false; audio.muted = false; } });
    else { unlocking = false; audio.muted = false; }
  }

  function syncAudio() {
    const st = T - HEAD;
    if (playing && st >= 0 && st < DUR - .05) {
      audio.muted = false;
      if (Math.abs(audio.currentTime - st) > .3) audio.currentTime = st;
      if (audio.paused) { const p = audio.play(); if (p && p.catch) p.catch(() => { }); }
    } else if (!audio.paused && !unlocking) audio.pause();
  }
  function seek(v) { T = clamp(v, 0, LEN() - .01); anchor = performance.now() - T * 1000; syncAudio(); }
  function play() {
    if (!SONG) return;
    if (T >= LEN() - .1) T = 0;
    playing = true; seek(T);
    if (!audible()) unlock(SONG.audio);
    ui(); wake();
  }
  function pause() { playing = false; unlocking = false; audio.pause(); audio.muted = false; ui(); wake(); }
  const toggle = () => playing ? pause() : play();
  function pick(i, auto) {
    idx = ((i % CAT.length) + CAT.length) % CAT.length;
    const meta = CAT[idx];
    if (!auto) { playing = false; unlocking = false; audio.pause(); }
    load(meta.id, () => {
      if (!(meta.audio && String(audio.src || '').endsWith(meta.audio))) audio.src = SONG.audio;
      T = 0; anchor = performance.now();
      try { localStorage.setItem('pv.song', SONG.id); } catch (e) { }
      const u = new URL(location.href); u.searchParams.set('song', SONG.id); history.replaceState(null, '', u);
      document.querySelectorAll('.card').forEach((c, k) => c.classList.toggle('cur', k === idx));
      if ($('#ttl')) { $('#ttl').textContent = SONG.title; $('#cast').textContent = SONG.cast; }
      if (auto) play(); else { playing = false; audio.pause(); ui(); }
    });
  }
  function ui() {
    const b = $('#play');
    if (b) { b.textContent = playing ? '❚❚' : '▶'; b.setAttribute('aria-label', playing ? '暫停' : '播放'); }
    document.documentElement.classList.toggle('playing', playing);
  }
  const listOpen = () => $('#start') && !$('#start').classList.contains('gone');
  const showList = () => $('#start') && $('#start').classList.remove('gone');
  const hideList = () => $('#start') && $('#start').classList.add('gone');
  const coarse = () => matchMedia('(hover: none) and (pointer: coarse)').matches;
  // a tap that starts a song has to call play() itself; loading the score is async
  function gesturePick(i) {
    const n = ((i % CAT.length) + CAT.length) % CAT.length;
    const meta = CAT[n];
    playing = false;
    if (meta && meta.audio) unlock(meta.audio);
    pick(n, true);
  }

  // the song cards
  const grid = $('#grid');
  if (grid) CAT.forEach((s, i) => {
    const d = document.createElement('button');
    d.className = 'card';
    d.innerHTML = '<span class="n">PV ' + p2(i + 1) + '</span><span class="t"></span><span class="c"></span>';
    d.querySelector('.t').textContent = s.title;
    d.querySelector('.c').textContent = s.cast + '　·　' + fmt(s.dur);
    d.onclick = () => { hideList(); gesturePick(i); };
    grid.appendChild(d);
  });
  const on = (id, f) => { const e = $(id); if (e) e.onclick = f; };
  on('#play', () => { hideList(); toggle(); });
  on('#bPrev', () => gesturePick(idx - 1));
  on('#bNext', () => gesturePick(idx + 1));
  on('#bList', () => listOpen() ? hideList() : showList());
  on('#bFull', () => {
    const el = document.documentElement;
    const onFs = document.fullscreenElement || document.webkitFullscreenElement;
    if (onFs) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) { try { const p = exit.call(document); if (p && p.catch) p.catch(() => { }); } catch (e) { } }
      return;
    }
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;
    try { const p = req.call(el); if (p && p.catch) p.catch(() => { }); } catch (e) { }
  });
  cvs.addEventListener('click', () => { if (!listOpen() && !coarse()) toggle(); });
  const scrub = $('#scrub');
  if (scrub) {
    const to = x => { const r = scrub.getBoundingClientRect(); seek(LEN() * clamp((x - r.left) / r.width, 0, 1)); };
    scrub.addEventListener('pointerdown', e => { scrub.setPointerCapture(e.pointerId); to(e.clientX); });
    scrub.addEventListener('pointermove', e => { if (e.buttons) to(e.clientX); });
  }
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.code === 'Space' ? ' ' : (e.key || '').toLowerCase();
    if (k === ' ') { e.preventDefault(); hideList(); toggle(); }
    else if (k === 'arrowleft') seek(T - 5);
    else if (k === 'arrowright') seek(T + 5);
    else if (k === 'n') gesturePick(idx + 1);
    else if (k === 'p') gesturePick(idx - 1);
    else if (k === 's') listOpen() ? hideList() : showList();
    else if (k === 'f') $('#bFull') && $('#bFull').click();
    else if (k === 'escape') hideList();
    else if (/^[0-9]$/.test(k)) seek(LEN() * (+k) / 10);
  });
  // the controls fade away while it plays. On a phone, a short tap on the
  // picture shows or hides them; the play button is what pauses.
  let idle = 0, hold = 0;
  function wake() {
    document.documentElement.classList.remove('idle');
    clearTimeout(idle);
    const wait = coarse() ? 3200 : 2600;
    idle = setTimeout(() => {
      if (hold > 0) { wake(); return; }
      if (playing && !listOpen()) document.documentElement.classList.add('idle');
    }, wait);
  }
  addEventListener('pointermove', wake);
  addEventListener('pointerdown', wake);
  const bar = $('#bar');
  if (bar) {
    bar.addEventListener('pointerdown', () => { hold++; });
    bar.addEventListener('pointerup', () => { hold = Math.max(0, hold - 1); wake(); });
    bar.addEventListener('pointercancel', () => { hold = Math.max(0, hold - 1); wake(); });
  }
  let tap = null;
  cvs.addEventListener('pointerdown', e => {
    tap = { x: e.clientX, y: e.clientY, t: performance.now(), idle: document.documentElement.classList.contains('idle') };
  });
  cvs.addEventListener('pointerup', e => {
    if (!tap || !coarse() || listOpen()) { tap = null; return; }
    const dt = performance.now() - tap.t, dist = Math.hypot(e.clientX - tap.x, e.clientY - tap.y);
    const wasIdle = tap.idle;
    tap = null;
    if (dt > 350 || dist > 14) return;
    if (wasIdle) wake();
    else { clearTimeout(idle); document.documentElement.classList.add('idle'); }
  });
  function pin() {
    const vv = window.visualViewport;
    const vw = Math.max(2, vv ? vv.width : innerWidth);
    const vh = Math.max(2, vv ? vv.height : innerHeight);
    const ox = vv ? vv.offsetLeft : 0, oy = vv ? vv.offsetTop : 0;
    const gap = Math.max(0, innerHeight - vh - oy);
    cvs.style.left = ox + 'px'; cvs.style.top = oy + 'px';
    cvs.style.width = vw + 'px'; cvs.style.height = vh + 'px';
    cvs.style.right = 'auto'; cvs.style.bottom = 'auto';
    const start = $('#start');
    if (start) {
      start.style.left = ox + 'px'; start.style.top = oy + 'px';
      start.style.width = vw + 'px'; start.style.height = vh + 'px';
      start.style.right = 'auto'; start.style.bottom = 'auto';
    }
    if (!bar) return;
    const probe = $('#safe'), cs = probe ? getComputedStyle(probe) : null;
    const edge = side => { const n = cs ? parseFloat(cs.getPropertyValue('border-' + side + '-width')) : 0; return Number.isFinite(n) ? n : 0; };
    const gutter = vw < 420 ? 12 : 24;
    bar.style.width = Math.min(960, Math.max(120, vw - gutter - edge('left') - edge('right'))) + 'px';
    bar.style.left = (ox + vw / 2) + 'px';
    bar.style.bottom = (gap + Math.max(14, edge('bottom'))) + 'px';
    bar.style.right = 'auto'; bar.style.top = 'auto';
  }
  addEventListener('resize', pin);
  if (window.visualViewport) {
    visualViewport.addEventListener('resize', pin);
    visualViewport.addEventListener('scroll', pin);
  }
  pin();
  wake();

  function tick(now) {
    requestAnimationFrame(tick);
    const dt = clamp((now - last) / 1000, .001, .1); last = now;
    if (!SONG || !window.__pv.ready()) {
      ctx.fillStyle = '#120c22'; ctx.fillRect(0, 0, W, H);
      font(44, 700); ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('載入中…', W / 2, H / 2);
      return;
    }
    if (playing) {
      const st = T - HEAD;
      if (!audio.paused && st >= 0 && st < DUR) { T = HEAD + audio.currentTime; anchor = now - T * 1000; }
      else T = (now - anchor) / 1000;
      syncAudio();
      if (T >= LEN()) { pick(idx + 1, true); return; }
    }
    frame(T, dt);
    const tt = fmt(T) + ' / ' + fmt(LEN());
    if (tt !== lastUi) { lastUi = tt; if ($('#time')) $('#time').textContent = tt; }
    if ($('#played')) $('#played').style.width = (T / LEN() * 100).toFixed(2) + '%';
  }
  let first = qs.get('song');
  if (!first) { try { first = localStorage.getItem('pv.song'); } catch (e) { } }
  pick(Math.max(0, CAT.findIndex(s => s.id === first)), false);
  requestAnimationFrame(tick);
}
})();
