/* =====================================================================
   鋒兄宇宙 · 3D MV — motion-graphics music video engine
   Pure canvas 2D with a hand-rolled perspective camera. No dependencies,
   runs straight from file:// : every song's spectrum / loudness / onset
   track is pre-baked into data/song/<id>.js by tools/build_songs.py, so
   nothing here needs the Web Audio API or fetch().
   ===================================================================== */
(function () {
'use strict';

/* ------------------------------ utils ------------------------------ */
const CAT = window.MV_SONGS || [];
const VERSION = '1.1.0';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeOutQ = t => 1 - Math.pow(1 - t, 5);
const easeBack = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const rnd = (a, b) => a + Math.random() * (b - a);
const $ = s => document.querySelector(s);
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function b64u8(s) {
  const bin = atob(s), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
// file:// and private windows can throw on storage access — never fatal
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } }
};
// viewer preferences that survive a reload (quality, volume, loop, panel, last song)
const PREF = {
  num(k, d) { const v = parseFloat(store.get('mv.pref.' + k)); return isFinite(v) ? v : d; },
  str(k, d) { const v = store.get('mv.pref.' + k); return v === null ? d : v; },
  set(k, v) { store.set('mv.pref.' + k, String(v)); }
};
// honour the OS "reduce motion" switch: calmer camera, no strobing flashes
const RM = (() => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
})();
const MOTION = RM ? .25 : 1;

/* ------------------------------ themes ----------------------------- */
/* Every song picks a theme: two accent colours, two background tints,
   motif glyphs for the particle systems and a watermark. */
const THEMES = {
  wed:   { a1: [255, 210, 74], a2: [255, 59, 107], bgV: [40, 10, 28], bgC: [58, 10, 22],
           glyphs: ['囍', '❤', '💍', '✦'], mark: '囍', mark2: '539', shape: 'oct', balls: true },
  dream: { a1: [130, 160, 255], a2: [255, 214, 120], bgV: [16, 14, 48], bgC: [30, 20, 64],
           glyphs: ['★', '夢', '✦', '∞'], mark: '夢', mark2: '百年', shape: 'cube', balls: false },
  volt:  { a1: [53, 232, 255], a2: [140, 255, 190], bgV: [6, 26, 44], bgC: [8, 36, 52],
           glyphs: ['⚡', '💧', '✦', '⚙'], mark: '電', mark2: '進化', shape: 'cube', balls: false },
  meow:  { a1: [255, 150, 205], a2: [255, 235, 175], bgV: [40, 16, 40], bgC: [56, 20, 44],
           glyphs: ['🐾', '喵', '♥', '✦'], mark: '喵', mark2: '掉毛', shape: 'oct', balls: false },
  crown: { a1: [255, 210, 74], a2: [183, 108, 255], bgV: [26, 14, 46], bgC: [44, 22, 18],
           glyphs: ['★', '獎', '✦', '億'], mark: '獎', mark2: '頭獎', shape: 'oct', balls: true },
  blaze: { a1: [255, 146, 56], a2: [53, 232, 255], bgV: [40, 18, 12], bgC: [54, 22, 10],
           glyphs: ['🔥', '讚', '✦', '⚡'], mark: '爆', mark2: '水電', shape: 'cube', balls: false },
  neon:  { a1: [140, 255, 130], a2: [255, 60, 200], bgV: [10, 30, 22], bgC: [36, 10, 40],
           glyphs: ['⚡', '進', '化', '✦'], mark: '化', mark2: 'SHOW', shape: 'oct', balls: false },
  memo:  { a1: [130, 225, 210], a2: [255, 200, 130], bgV: [12, 28, 34], bgC: [34, 26, 20],
           glyphs: ['✎', '冊', '憶', '✦'], mark: '憶', mark2: '畢業', shape: 'cube', balls: false },
  money: { a1: [130, 255, 175], a2: [255, 210, 74], bgV: [8, 30, 24], bgC: [34, 30, 10],
           glyphs: ['$', '獎', '票', '✦'], mark: '$', mark2: '頭獎', shape: 'oct', balls: true }
};
let TH = THEMES.wed;

const darken = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
function palFor(act) {
  switch (act) {
    case 'intro':  return { bg: darken(TH.bgV, .55), bg2: [2, 3, 9], a1: TH.a1, a2: TH.a2, ink: [255, 255, 255] };
    case 'hook':   return { bg: darken(TH.bgV, .85), bg2: [3, 3, 11], a1: TH.a2, a2: TH.a1, ink: [255, 255, 255] };
    case 'verse':  return { bg: TH.bgV, bg2: darken(TH.bgV, .16), a1: TH.a1, a2: TH.a2, ink: [255, 255, 255] };
    case 'chorus': return { bg: TH.bgC, bg2: darken(TH.bgC, .18), a1: TH.a2, a2: TH.a1, ink: [255, 255, 255] };
    case 'brk':    return { bg: darken(TH.bgC, .5), bg2: [3, 3, 10], a1: TH.a2, a2: TH.a1, ink: [255, 255, 255] };
    default:       return { bg: darken(TH.bgV, .7), bg2: [2, 3, 9], a1: TH.a1, a2: TH.a2, ink: [255, 255, 255] };
  }
}
const P = { bg: [10, 12, 32], bg2: [2, 3, 9], a1: [53, 232, 255], a2: [255, 210, 74], ink: [255, 255, 255] };
function mixPal(target, dt) {
  const k = 1 - Math.pow(.02, dt);
  for (const key in target) for (let i = 0; i < 3; i++) P[key][i] = lerp(P[key][i], target[key][i], k);
}
const rgb = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a === undefined ? 1 : a})`;
const ACT_LABEL = { intro: 'INTRO', hook: 'HOOK', verse: 'VERSE', chorus: 'CHORUS', brk: 'BREAK', outro: 'OUTRO' };

/* --------------------------- current song -------------------------- */
let SONG = null, AA = null, LY = null;
let BANDS = null, RMSA = null, NB = 12, DUR = 1, BEAT = .7;
let SEC = [], LAST_END = 1, FIRST_T = 0, INTRO = { end: 0, cards: [] };
let songIdx = 0;

/* --------------------------- audio features ------------------------ */
const F = { bass: 0, low: 0, mid: 0, high: 0, level: 0, flash: 0, beat: 0, punch: 0 };
let onsetIdx = 0;

function bandAt(t, a, b) {
  if (!BANDS) return 0;
  const ff = t * AA.bandFps, f0 = clamp(Math.floor(ff), 0, AA.frames - 1);
  const f1 = Math.min(f0 + 1, AA.frames - 1), fr = clamp(ff - f0, 0, 1);
  let s = 0;
  for (let i = a; i <= b; i++) s += lerp(BANDS[f0 * NB + i], BANDS[f1 * NB + i], fr);
  return s / ((b - a + 1) * 255);
}
function rmsAt(t) {
  if (!RMSA) return 0;
  return RMSA[clamp(Math.round(t * AA.rmsFps), 0, RMSA.length - 1)] / 255;
}
function resetOnsets(t) {
  onsetIdx = 0;
  const O = AA ? AA.onsets : [];
  while (onsetIdx < O.length && O[onsetIdx] < t) onsetIdx++;
}
function sampleAudio(t, dt) {
  const tg = {
    bass: bandAt(t, 0, 1), low: bandAt(t, 2, 3),
    mid: bandAt(t, 4, 7), high: bandAt(t, 8, 11), level: rmsAt(t)
  };
  for (const k in tg) {
    const up = tg[k] > F[k];
    const r = 1 - Math.pow(1 - (up ? .55 : .12), dt * 60);
    F[k] += (tg[k] - F[k]) * r;
  }
  const ph = ((t - AA.beat0) / BEAT) % 1;
  F.beat = Math.pow(1 - (ph < 0 ? ph + 1 : ph), 4);

  const O = AA.onsets;
  let hit = false;
  while (onsetIdx < O.length && O[onsetIdx] <= t) { onsetIdx++; hit = true; }
  if (hit && F.flash < .55) F.flash = 1;
  F.flash *= Math.pow(.0025, dt);
  F.punch = Math.max(F.flash * .55, F.beat * (F.level * .6 + F.bass * .4));
}

/* ------------------------------ canvas ----------------------------- */
const cvs = $('#stage'), ctx = cvs.getContext('2d', { alpha: false });
// two-step downscale buffers for the bloom — kept big enough that the
// browser keeps them GPU-backed (small canvases fall back to software)
const bA = document.createElement('canvas'), actx = bA.getContext('2d', { alpha: false });
const bB = document.createElement('canvas'), bctx = bB.getContext('2d', { alpha: false });
let W = 0, H = 0, CX = 0, CY = 0, DPR = 1, MIN = 800;
// projection scale: keeps the 3D scene framed the same way on a phone
// and on a desktop instead of being calibrated to one device size
let VIEWK = 1;
let QUAL = clamp(Math.round(PREF.num('qual', 2)), 0, 2);
const QNAME = ['低', '中', '高'];

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, QUAL === 2 ? 1.6 : 1.15);
  W = Math.floor(innerWidth * DPR); H = Math.floor(innerHeight * DPR);
  cvs.width = W; cvs.height = H;
  CX = W / 2; CY = H / 2; MIN = Math.min(W, H);
  VIEWK = Math.min(W / 1250, H / 700);   // 'contain' the 3D scene in any aspect
  bA.width = Math.max(256, Math.floor(W * .5)); bA.height = Math.max(256, Math.floor(H * .5));
  const bs = QUAL === 2 ? .25 : .18;
  bB.width = Math.max(256, Math.floor(W * bs)); bB.height = Math.max(256, Math.floor(H * bs));
  safeAt = -1e9; buildStars(); layoutCache.clear(); drawWave();
}
addEventListener('resize', resize);

const S = v => v * (MIN / 900);
const FAM = '"Microsoft JhengHei UI","Microsoft JhengHei","PingFang TC","Noto Sans TC","Segoe UI Emoji",sans-serif';
function font(px, weight) { ctx.font = `${weight || 900} ${px}px ${FAM}`; }

/* ------------------------------ camera ----------------------------- */
const CAM = {
  x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, fov: 1000,
  tx: 0, ty: 0, tz: 0, tyaw: 0, tpitch: 0, troll: 0, tfov: 1000,
  shx: 0, shy: 0, whip: 0
};
function camUpdate(t, dt) {
  const k = 1 - Math.pow(.0001, dt);
  CAM.x = lerp(CAM.x, CAM.tx, k); CAM.y = lerp(CAM.y, CAM.ty, k); CAM.z = lerp(CAM.z, CAM.tz, k);
  CAM.yaw = lerp(CAM.yaw, CAM.tyaw + CAM.whip, Math.min(1, k * 1.6));
  CAM.pitch = lerp(CAM.pitch, CAM.tpitch, k);
  CAM.roll = lerp(CAM.roll, CAM.troll, k); CAM.fov = lerp(CAM.fov, CAM.tfov, k);
  CAM.whip *= Math.pow(.02, dt);
  const amp = S(10) * (F.punch * 1.4 + F.bass * .5) * MOTION;
  CAM.shx = Math.sin(t * 61.3) * amp;
  CAM.shy = Math.cos(t * 47.7) * amp;
}
function project(x, y, z) {
  let dx = x - CAM.x, dy = y - CAM.y, dz = z - CAM.z;
  const cy = Math.cos(CAM.yaw), sy = Math.sin(CAM.yaw);
  let X = dx * cy - dz * sy, Z = dx * sy + dz * cy;
  const cp = Math.cos(CAM.pitch), sp = Math.sin(CAM.pitch);
  let Y = dy * cp - Z * sp; Z = dy * sp + Z * cp;
  if (Z <= 25) return null;
  const k = (CAM.fov * VIEWK) / Z;
  return { x: CX + X * k + CAM.shx, y: CY + Y * k + CAM.shy, k: k, z: Z };
}

/* ---------------------------- star field --------------------------- */
let stars = [], travel = 0;
function buildStars() {
  const n = QUAL === 2 ? 520 : QUAL === 1 ? 320 : 170;
  stars = new Array(n);
  for (let i = 0; i < n; i++) stars[i] = {
    x: rnd(-2800, 2800), y: rnd(-1900, 1900), z: rnd(60, 5400),
    r: rnd(.7, 3.1), c: Math.random() < .25 ? 1 : 0
  };
}
function drawStars(dt, speed) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    s.z -= speed * dt;
    if (s.z < 60) { s.z += 5340; s.x = rnd(-2800, 2800); s.y = rnd(-1900, 1900); }
    const p = project(s.x, s.y, s.z);
    if (!p) continue;
    const fade = clamp(1 - s.z / 5400, 0, 1);
    const r = Math.max(.4, s.r * p.k * 1.5);
    const a = fade * (.35 + F.level * .5);
    if (speed > 800 && r > .9) {
      const p2 = project(s.x, s.y, s.z + speed * .055);
      if (p2) {
        ctx.strokeStyle = rgb(s.c ? P.a2 : P.a1, a * .55);
        ctx.lineWidth = r * .8;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      }
    }
    ctx.fillStyle = s.c ? rgb(P.a2, a) : `rgba(255,255,255,${a})`;
    if (r < 1.6) ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    else { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

/* ---------------------------- tunnel rings ------------------------- */
function drawRings(t, spin) {
  const N = QUAL === 2 ? 15 : 9, SP = 460;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = N - 1; i >= 0; i--) {
    const z = 260 + ((i * SP - travel * .35) % (N * SP) + N * SP) % (N * SP);
    const fade = clamp(1 - z / (N * SP), 0, 1);
    if (fade <= .02) continue;
    const seg = 26, R = 1150 + Math.sin(z * .002 + t) * 120;
    const rot = spin + z * .0007 + t * .25;
    ctx.beginPath();
    let ok = false;
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * TAU + rot;
      const rr = R * (1 + Math.sin(a * 3 + t * 2) * .05 * (.4 + F.bass));
      const p = project(Math.cos(a) * rr, Math.sin(a) * rr * .72, z);
      if (!p) { ok = false; break; }
      if (j === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      ok = true;
    }
    if (!ok) continue;
    ctx.strokeStyle = rgb(i % 2 ? P.a1 : P.a2, fade * (.1 + F.mid * .3));
    ctx.lineWidth = Math.max(1, S(2) * fade * (1 + F.bass));
    ctx.stroke();
  }
  ctx.restore();
}

/* ----------------------------- floor grid -------------------------- */
const FLOOR = 560;
function drawGrid(t) {
  const FAR = 6200, STEP = 300;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = Math.max(1, S(1.4));
  const wob = (x, z) => Math.sin(z * .0035 + t * 2.2) * 40 * F.bass + Math.cos(x * .002 + t) * 18 * F.low;
  const off = (travel * .55) % STEP;
  for (let z = STEP - off; z < FAR; z += STEP) {
    const fade = Math.pow(1 - z / FAR, 1.6) * (.22 + F.low * .5);
    if (fade < .015) continue;
    ctx.beginPath(); let started = false;
    for (let x = -4200; x <= 4200; x += 700) {
      const p = project(x, FLOOR + wob(x, z), z);
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = rgb(P.a1, fade); ctx.stroke();
  }
  for (let x = -4200; x <= 4200; x += 700) {
    ctx.beginPath(); let started = false;
    for (let z = 240; z < FAR; z += 320) {
      const p = project(x, FLOOR + wob(x, z), z);
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = rgb(P.a2, .08 + F.low * .16); ctx.stroke();
  }
  ctx.restore();
}

/* ---------------------------- light rays --------------------------- */
function drawRays(t) {
  const n = QUAL === 2 ? 18 : 10;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.translate(CX + CAM.shx * .4, CY + CAM.shy * .4);
  ctx.rotate(t * .06);
  const L = MIN * (.75 + F.level * .55);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + Math.sin(t * .3 + i) * .06;
    const w = (.010 + (i % 3 === 0 ? .022 : .006)) * (1 + F.mid * 1.8);
    const g = ctx.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L);
    const col = i % 2 ? P.a1 : P.a2;
    g.addColorStop(0, rgb(col, 0));                 // keep the hot centre clean
    g.addColorStop(.32, rgb(col, .05 + F.level * .07));
    g.addColorStop(1, rgb(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a - w) * L, Math.sin(a - w) * L);
    ctx.lineTo(Math.cos(a + w) * L, Math.sin(a + w) * L);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------ bokeh ------------------------------ */
const bokeh = [];
for (let i = 0; i < 30; i++) bokeh.push({
  x: rnd(-1800, 1800), y: rnd(-1100, 1100), z: rnd(220, 2600),
  r: rnd(30, 150), sp: rnd(.05, .35), ph: rnd(0, TAU), c: Math.random() < .5
});
function drawBokeh(t) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const lim = QUAL === 2 ? 28 : QUAL === 1 ? 16 : 9;
  for (let i = 0; i < lim; i++) {
    const b = bokeh[i];
    const p = project(b.x + Math.sin(t * b.sp + b.ph) * 260,
                      b.y + Math.cos(t * b.sp * .8 + b.ph) * 180, b.z);
    if (!p) continue;
    const r = b.r * p.k;
    if (r < 1 || r > MIN * .5) continue;
    const col = b.c ? P.a1 : P.a2;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, rgb(col, .07 + F.level * .07));
    g.addColorStop(.55, rgb(col, .02));
    g.addColorStop(1, rgb(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/* ------------------- circular spectrum analyser (3D) --------------- */
function drawEQ(t, power) {
  if (power < .02) return;
  const N = QUAL === 2 ? 56 : 32, R = 1450;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < N; i++) {
    const u = i / N;
    const a = u * TAU + t * .12;
    const bi = Math.min(NB - 1, Math.floor(Math.abs(.5 - u) * 2 * NB));   // mirrored
    const v = bandAt(clock, bi, bi);
    const h = 90 + v * v * 1750 * power;
    const z = 2000 + Math.sin(a) * R, x = Math.cos(a) * R;
    const p1 = project(x, FLOOR, z), p2 = project(x, FLOOR - h, z);
    if (!p1 || !p2) continue;
    const g = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
    g.addColorStop(0, rgb(P.a1, 0));
    g.addColorStop(.35, rgb(P.a1, .45 * power));
    g.addColorStop(1, rgb(P.a2, .8 * power));
    ctx.strokeStyle = g;
    ctx.lineWidth = Math.max(1, 26 * p1.k);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
  }
  ctx.restore();
}

/* ------------------- rotating wireframe solid (3D) ----------------- */
const SOLIDS = {
  cube: {
    v: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
    e: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]
  },
  oct: {
    v: [[0, -1, 0], [0, 1, 0], [-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1]],
    e: [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [4, 3], [3, 5], [5, 2]]
  }
};
function drawSolid(t, power) {
  if (power < .02) return;
  const S3 = SOLIDS[TH.shape] || SOLIDS.oct;
  const sc = 340 * (1 + F.bass * .35), cy = -90, cz = 1750;
  const ry = t * .55, rx = Math.sin(t * .33) * .7;
  const pts = S3.v.map(v => {
    const [x, y, z] = v;
    let X = x * Math.cos(ry) - z * Math.sin(ry), Z = x * Math.sin(ry) + z * Math.cos(ry);
    const Y = y * Math.cos(rx) - Z * Math.sin(rx); Z = y * Math.sin(rx) + Z * Math.cos(rx);
    return project(X * sc, cy + Y * sc, cz + Z * sc);
  });
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = Math.max(1, S(2.2));
  for (const e of S3.e) {
    const p = pts[e[0]], q = pts[e[1]];
    if (!p || !q) continue;
    const g = ctx.createLinearGradient(p.x, p.y, q.x, q.y);
    g.addColorStop(0, rgb(P.a1, .45 * power));
    g.addColorStop(1, rgb(P.a2, .45 * power));
    ctx.strokeStyle = g;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
  }
  for (const p of pts) {
    if (!p) continue;
    ctx.fillStyle = rgb(P.a2, .7 * power);
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.5, S(3.4) * (1 + F.punch)), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/* --------------------- beat-triggered light pillars ---------------- */
const pillars = [];
function spawnPillar() {
  if (pillars.length > 14) return;
  pillars.push({ x: rnd(-2600, 2600), z: rnd(500, 4200), life: 1, c: Math.random() < .5 });
}
function drawPillars(dt) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = pillars.length - 1; i >= 0; i--) {
    const p = pillars[i];
    p.life -= dt * 1.3;
    if (p.life <= 0) { pillars.splice(i, 1); continue; }
    const w = 90 * p.life;
    const b1 = project(p.x - w, FLOOR, p.z), b2 = project(p.x + w, FLOOR, p.z);
    const t1 = project(p.x - w, FLOOR - 1500, p.z);
    if (!b1 || !b2 || !t1) continue;
    const g = ctx.createLinearGradient(b1.x, b1.y, b1.x, t1.y);
    const col = p.c ? P.a1 : P.a2;
    g.addColorStop(0, rgb(col, .34 * p.life));
    g.addColorStop(1, rgb(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(b1.x, t1.y, Math.max(1, b2.x - b1.x), b1.y - t1.y);
  }
  ctx.restore();
}

/* ------------------------ onset shockwave rings -------------------- */
const waves = [];
function drawWaves(dt) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i];
    w.age += dt;
    const p = w.age / w.dur;
    if (p >= 1) { waves.splice(i, 1); continue; }
    const r = easeOut(p) * w.max, seg = 30;
    ctx.beginPath();
    let ok = false;
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * TAU;
      const q = project(Math.cos(a) * r, Math.sin(a) * r * .55 - 40, w.z);
      if (!q) { ok = false; break; }
      if (j === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
      ok = true;
    }
    if (!ok) continue;
    ctx.strokeStyle = rgb(w.c ? P.a2 : P.a1, (1 - p) * .45);
    ctx.lineWidth = Math.max(1, S(3) * (1 - p));
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------ drifting motif glyphs -------------------- */
const motifs = [];
for (let i = 0; i < 26; i++) motifs.push({
  x: rnd(-2200, 2200), y: rnd(-1200, 1000), z: rnd(300, 4800),
  s: rnd(70, 190), rot: rnd(-.4, .4), sp: rnd(.4, 1), gi: (Math.random() * 4) | 0
});
const GBASE = 100;
function drawMotifs(t, dt, power) {
  if (power < .02) return;
  ctx.save();
  font(GBASE, 800);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalCompositeOperation = 'lighter';
  for (const m of motifs) {
    m.z -= (60 + F.level * 180) * m.sp * dt;
    if (m.z < 200) { m.z += 4600; m.x = rnd(-2200, 2200); m.y = rnd(-1200, 1000); }
    const p = project(m.x, m.y + Math.sin(t * .4 + m.x) * 40, m.z);
    if (!p) continue;
    const sz = m.s * p.k;
    if (sz < 6) continue;
    const a = clamp(1 - m.z / 4800, 0, 1) * .2 * power;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(m.rot + Math.sin(t * .3 + m.z) * .08);
    ctx.scale(sz / GBASE, sz / GBASE);
    ctx.fillStyle = rgb(m.gi % 2 ? P.a1 : P.a2, a);
    ctx.fillText(TH.glyphs[m.gi % TH.glyphs.length], 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

/* --------------------------- lottery balls ------------------------- */
const BALLNUM = ['05', '03', '09', '13', '19', '23', '29', '33', '39'];
const balls = BALLNUM.map((n, i) => ({ n: n, a: (i / BALLNUM.length) * TAU, ph: rnd(0, TAU) }));
let ballPower = 0;
function drawBalls(t) {
  if (ballPower < .01) return;
  const R = 1050, sorted = [];
  for (const b of balls) {
    const a = b.a + t * .22;
    const p = project(Math.cos(a) * R * (1 + F.bass * .12),
                      150 + Math.sin(t * 1.1 + b.ph) * 150 - ballPower * 60,
                      2150 + Math.sin(a) * R);
    if (p) sorted.push({ p: p, b: b });
  }
  sorted.sort((u, v) => v.p.z - u.p.z);
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const it of sorted) {
    const p = it.p, r = 56 * p.k;
    if (r < 2) continue;
    const near = clamp((p.z - 900) / 500, 0, 1);     // never let one block the lyric
    const a = clamp(ballPower * (1 - p.z / 3800), 0, 1) * .9 * near;
    if (a < .01) continue;
    const g = ctx.createRadialGradient(p.x - r * .34, p.y - r * .4, r * .06, p.x, p.y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(.45, rgb(P.a2, a * .95));
    g.addColorStop(1, `rgba(120,30,10,${a})`);
    ctx.shadowColor = rgb(P.a2, .8 * a); ctx.shadowBlur = r * .9;
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    font(r * .78, 900);
    ctx.fillStyle = `rgba(60,10,20,${a})`;
    ctx.fillText(it.b.n, p.x, p.y + r * .04);
  }
  ctx.restore();
}

/* ----------------------------- red string -------------------------- */
let stringPower = 0;
function drawString(t) {
  if (stringPower < .01) return;
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    const p = project(lerp(-1900, 1900, u),
                      Math.sin(u * Math.PI * 2.2 + t * 1.3) * 230 * (.5 + F.mid) - 40,
                      1250 + Math.cos(u * Math.PI * 3 + t * .8) * 520);
    if (p) pts.push(p);
  }
  if (pts.length < 2) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = pass ? `rgba(255,120,150,${.5 * stringPower})` : `rgba(255,30,70,${.35 * stringPower})`;
    ctx.lineWidth = pass ? S(2) : S(9) * (1 + F.bass * .6);
    ctx.stroke();
  }
  const kp = pts[Math.floor(((t * .18) % 1) * (pts.length - 1))];
  const g = ctx.createRadialGradient(kp.x, kp.y, 0, kp.x, kp.y, S(60));
  g.addColorStop(0, `rgba(255,220,220,${.9 * stringPower})`);
  g.addColorStop(1, 'rgba(255,40,80,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(kp.x, kp.y, S(60), 0, TAU); ctx.fill();
  ctx.restore();
}

/* --------------------------- confetti burst ------------------------ */
const parts = [];
function emit(n) {
  const cap = QUAL === 2 ? 260 : QUAL === 1 ? 150 : 80;
  for (let i = 0; i < n && parts.length < cap; i++) parts.push({
    x: rnd(-1500, 1500), y: rnd(-900, -300), z: rnd(400, 2600),
    vx: rnd(-90, 90), vy: rnd(40, 170), vz: rnd(-60, 60),
    rot: rnd(0, TAU), vr: rnd(-3, 3), life: rnd(3.4, 7),
    g: TH.glyphs[(Math.random() * TH.glyphs.length) | 0],
    s: rnd(26, 62), c: Math.random() < .5
  });
}
const PBASE = 64;
function drawParts(dt) {
  ctx.save();
  font(PBASE, 800);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.vy += 120 * dt; p.rot += p.vr * dt;
    const pr = project(p.x, p.y, p.z);
    if (!pr) continue;
    const sz = p.s * pr.k;
    if (sz < 3) continue;
    const a = clamp(p.life / 2, 0, 1) * clamp(1 - pr.z / 3200, 0, 1);
    const k = sz / PBASE;
    ctx.save();
    ctx.translate(pr.x, pr.y); ctx.rotate(p.rot);
    ctx.scale(k * (Math.cos(p.rot * 1.7) * .5 + .8), k);   // fake 3D tumble
    ctx.fillStyle = rgb(p.c ? P.a2 : P.a1, a);
    ctx.fillText(p.g, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

/* ------------------------ background watermark --------------------- */
function drawWatermark(t, text, alpha) {
  if (alpha < .01 || !text) return;
  ctx.save();
  ctx.translate(CX + CAM.shx, CY + CAM.shy);
  ctx.rotate(Math.sin(t * .15) * .05);
  font(MIN * .42, 900);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.scale(1 + F.bass * .05, 1 + F.bass * .05);
  ctx.globalCompositeOperation = 'lighter';
  if (QUAL > 0) {
    ctx.strokeStyle = rgb(P.a1, alpha * .22);
    ctx.lineWidth = S(2.5);
    ctx.strokeText(text, 0, 0);
  }
  ctx.fillStyle = rgb(P.a1, alpha * (QUAL > 0 ? .05 : .16));
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/* ============================ TEXT ENGINE ========================== */
const KEY = ['鋒兄', '小塗', '塗哥', '牙妹', '魚妹', '喵布布', '五三九', '539', '頭獎', '結婚',
  '紅線', '甜蜜', '幸福', '最瞎', '財神爺', '喜酒', '水電', '進化', '爆紅', '傳奇', '總統',
  '榜首', '威力彩', '統一發票', '百年', '冠軍', '第一', '畢業'];
function keyMask(text) {
  const m = new Array(text.length).fill(0);
  for (const k of KEY) {
    let i = text.indexOf(k);
    while (i >= 0) { for (let j = 0; j < k.length; j++) m[i + j] = 1; i = text.indexOf(k, i + 1); }
  }
  return m;
}
const PRESETS = ['zoom', 'drop', 'slide', 'flip', 'burst', 'spin', 'wave', 'type'];

/* Row breaks for a wrapped line. The long narration lines separate their
   phrases with spaces, so break there when a space sits anywhere near the
   even split; only chop mid-phrase when there is none. Returns the end
   index of every row. */
function rowBreaks(all, rowCount) {
  const n = all.length;
  if (rowCount <= 1) return [n];
  const per = n / rowCount, ends = [];
  let start = 0;
  for (let r = 0; r < rowCount - 1; r++) {
    const ideal = Math.round(per * (r + 1));
    const win = Math.max(2, Math.round(per * .45));
    const lo = Math.max(start + 1, ideal - win);
    const hi = Math.min(n - (rowCount - r - 1), ideal + win);
    let cut = -1, best = 1e9;
    for (let i = lo; i <= hi; i++) {
      if (all[i - 1] !== ' ' || all[i] === ' ') continue;   // break just after a space
      const d = Math.abs(i - ideal);
      if (d < best) { best = d; cut = i; }
    }
    if (cut < 0) cut = clamp(ideal, start + 1, Math.max(start + 1, n - (rowCount - r - 1)));
    ends.push(cut); start = cut;
  }
  ends.push(n);
  return ends;
}

const layoutCache = new Map();
function layout(line, size, rowCount) {
  rowCount = rowCount || 1;
  const key = line.text + '|' + size + '|' + rowCount;
  let L = layoutCache.get(key);
  if (L) return L;
  font(size, 900);
  const all = [...line.text];
  const gap = size * .035;
  const ends = rowBreaks(all, rowCount);
  const chars = [], pos = [], row = [];
  let total = 0, from = 0;
  for (let r = 0; r < ends.length; r++) {
    const part = all.slice(from, ends[r]);
    from = ends[r];
    if (!part.length) continue;
    // a space that only marks the break adds no width at a row edge
    const ws = part.map((c, i) =>
      c === ' ' && (i === 0 || i === part.length - 1) ? 0 : ctx.measureText(c).width);
    const w = ws.reduce((a, b) => a + b, 0) + gap * (part.length - 1);
    total = Math.max(total, w);
    let x = -w / 2;
    for (let i = 0; i < part.length; i++) {
      chars.push(part[i]); pos.push(x + ws[i] / 2); row.push(r);
      x += ws[i] + gap;
    }
  }
  if (layoutCache.size > 400) layoutCache.clear();
  L = { chars: chars, pos: pos, row: row, rows: rowCount, total: total, mask: keyMask(line.text) };
  layoutCache.set(key, L);
  return L;
}

/* one glyph with fake-3D transform, extrusion, glow and RGB split */
function glyph(ch, x, y, size, o) {
  const sc = o.scale * (1000 / (1000 + (o.z || 0)));
  if (sc <= .002 || o.alpha <= .004) return;
  const cosY = Math.cos(o.ry || 0), cosX = Math.cos(o.rx || 0);
  const sinY = Math.sin(o.ry || 0), sinX = Math.sin(o.rx || 0);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(o.rz || 0);
  ctx.transform(cosY * sc, sinY * sinX * .32 * sc, -sinX * sinY * .32 * sc, cosX * sc, 0, 0);
  font(size, 900);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  const dx = (x - CX) / MIN, dy = (y - CY) / MIN;
  const steps = o.depth | 0;
  if (steps > 0) {                                  // extrusion to the vanishing point
    const ex = dx * size * .10, ey = dy * size * .10;
    for (let i = steps; i >= 1; i--) {
      const f = i / steps;
      ctx.fillStyle = `rgba(${o.dark[0]},${o.dark[1]},${o.dark[2]},${o.alpha * (.16 + .5 * (1 - f))})`;
      ctx.fillText(ch, ex * f, ey * f);
    }
  }
  if (o.trail > .01) {                              // motion blur
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i <= 3; i++) {
      ctx.fillStyle = rgb(o.col, o.alpha * .12 * o.trail / i);
      ctx.fillText(ch, o.tx * i * .5, o.ty * i * .5);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  if (o.split > .02) {                              // chromatic split on hits
    const s = o.split * size * .05;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,40,80,${o.alpha * .65})`; ctx.fillText(ch, -s, 0);
    ctx.fillStyle = `rgba(40,200,255,${o.alpha * .65})`; ctx.fillText(ch, s, 0);
    ctx.globalCompositeOperation = 'source-over';
  }
  // dark contour under the face: keeps type readable over bright scene light
  if (o.edge !== 0) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, size * .1);
    ctx.strokeStyle = `rgba(0,0,0,${o.alpha * (o.edge === undefined ? .6 : o.edge)})`;
    ctx.strokeText(ch, 0, 0);
  }
  const g = ctx.createLinearGradient(0, -size * .6, 0, size * .6);
  g.addColorStop(0, `rgba(255,255,255,${o.alpha})`);
  g.addColorStop(.52, rgb(o.col, o.alpha));
  g.addColorStop(1, rgb(o.col2, o.alpha * .92));
  if (QUAL > 0) {
    ctx.shadowColor = rgb(o.col, o.alpha * (.55 + o.glow * .45));
    ctx.shadowBlur = size * (.12 + o.glow * .32);
  }
  ctx.fillStyle = g;
  ctx.fillText(ch, 0, 0);
  ctx.shadowBlur = 0;
  if (o.stroke > .01) {
    ctx.lineWidth = Math.max(1, size * .016);
    ctx.strokeStyle = `rgba(255,255,255,${o.alpha * o.stroke})`;
    ctx.strokeText(ch, 0, 0);
  }
  ctx.restore();
}

/* The lyric list is a fixed 330px column on a wide screen, so centre the
   sung line in what is left of the stage instead of running under it.
   The title row and the transport are HTML on top of the canvas, so the
   band between them is all the room the type really has — on a small
   phone (iPhone SE) the transport alone eats a third of the screen. */
let LX = 0, LW = 0, SAFE_T = 0, SAFE_B = 0, safeAt = -1e9;
function lyricArea() {
  const el = $('#panel');
  const pw = (el && innerWidth > 820 && !el.classList.contains('hide')) ? 330 * DPR : 0;
  LX = CX - pw / 2; LW = W - pw;
  // measuring the chrome forces a layout, so do it a few times a second
  // instead of once a frame — it only moves when the window does
  const now = performance.now();
  if (now - safeAt < 250) return;
  safeAt = now;
  const top = $('#top'), bot = $('#bottom');
  SAFE_T = (top ? top.getBoundingClientRect().bottom : 0) * DPR + MIN * .03;
  SAFE_B = (bot ? bot.getBoundingClientRect().top : innerHeight) * DPR - MIN * .03;
  if (!(SAFE_B - SAFE_T > MIN * .18)) { SAFE_T = H * .3; SAFE_B = H * .78; }
}

/* Row spacing and the exact height of a rendered lyric block, so
   neighbouring lines can be placed without ever overlapping. */
const LH_KIN = 1.34, LH_SUB = 1.3;
function isDense(L) { return L.chars.length > 22 || L.rows >= 3; }
function blockH(L, size) {
  const dense = isDense(L);
  return ((L.rows - 1) * (dense ? LH_SUB : LH_KIN) + (dense ? 1.9 : 1.35)) * size;
}
function blockHalf(line) {
  const f = fitLine(line);
  return blockH(f.L, f.size) / 2;
}

/* Picks a readable size for a lyric line, wrapping it onto extra rows
   rather than shrinking it to nothing on a narrow (phone) screen. Extra
   rows cost height, which a short screen does not have, so the block is
   also kept inside the band left between the title row and the transport. */
function fitLine(line) {
  const chorus = line.kind === 'chorus';
  const maxW = (LW || W) * (chorus ? .86 : .82);
  const cap = chorus ? MIN * .088 : MIN * .072;
  const avail = Math.max(MIN * .12, SAFE_B - SAFE_T);
  let rows = 1;
  const probe = layout(line, 100, 1).total;
  if (!(probe > 0)) return { size: MIN * .05, rows: 1, L: layout(line, MIN * .05, 1) };
  let size = Math.min(cap, maxW / (probe / 100));
  while (rows < 6 && size < MIN * .062) {
    const next = rows + 1;
    const Ln = layout(line, 100, next);
    const s2 = Math.min(cap, maxW / (Ln.total / 100));
    if (s2 <= size || blockH(Ln, s2) > avail) break;
    rows = next; size = s2;
  }
  let L = layout(line, size, rows);
  const h = blockH(L, size);
  if (h > avail) { size *= avail / h; L = layout(line, size, rows); }
  return { size: size, rows: rows, L: L };
}

/* Readable subtitle block: dark plate + outlined text, no per-glyph FX. */
function drawSubtitle(line, t, yBase, L, size, ga, outP, age) {
  const lh = size * LH_SUB;
  const y0 = yBase - (L.rows - 1) * lh / 2;
  const p = clamp(age / .45, 0, 1);
  const a = ga * p * (1 - outP);
  if (a <= .01) return;
  const rise = (1 - easeOut(p)) * size * .35;

  // backing plate keeps white text off the bright background and stops the
  // bloom pass from blowing the whole block out
  const padX = size * .55, padY = size * .45;
  const w = L.total + padX * 2, h = (L.rows - 1) * lh + size + padY * 2;
  const x = LX - w / 2, y = y0 - size / 2 - padY + rise;
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, `rgba(3,4,10,${a * .30})`);
  g.addColorStop(.5, `rgba(3,4,10,${a * .52})`);
  g.addColorStop(1, `rgba(3,4,10,${a * .30})`);
  ctx.fillStyle = g;
  if (ctx.roundRect) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, size * .28); ctx.fill();
  } else {
    ctx.fillRect(x, y, w, h);
  }
  // accent hairline top and bottom
  ctx.fillStyle = rgb(P.a2, a * .45);
  ctx.fillRect(x + w * .12, y, w * .76, Math.max(1, S(1.2)));
  ctx.fillRect(x + w * .12, y + h - Math.max(1, S(1.2)), w * .76, Math.max(1, S(1.2)));

  font(size, 800);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, size * .16);
  ctx.strokeStyle = `rgba(0,0,0,${a * .75})`;
  const beat = 1 + F.beat * .012;
  for (let i = 0; i < L.chars.length; i++) {
    const ch = L.chars[i];
    if (ch === ' ') continue;
    const cx = LX + L.pos[i] * beat;
    const cy = y0 + L.row[i] * lh + rise;
    ctx.strokeText(ch, cx, cy);
  }
  for (let i = 0; i < L.chars.length; i++) {
    const ch = L.chars[i];
    if (ch === ' ') continue;
    const cx = LX + L.pos[i] * beat;
    const cy = y0 + L.row[i] * lh + rise;
    ctx.fillStyle = L.mask[i] ? rgb(P.a2, a) : `rgba(240,245,255,${a})`;
    ctx.fillText(ch, cx, cy);
  }
  ctx.restore();
}

function drawLine(line, t, yBase, opts) {
  const chorus = line.kind === 'chorus';
  const fitL = fitLine(line);
  const size = fitL.size, L = fitL.L;

  const age = t - line.t;
  const IN = .95, OUT = .5;
  const outAt = (opts && opts.outAt !== undefined) ? opts.outAt : line.t + line.d;
  const preset = PRESETS[(line.idx || 0) % PRESETS.length];
  const stagger = Math.min(.05, .55 / Math.max(1, L.chars.length));
  const ga = (opts && opts.alpha !== undefined) ? opts.alpha : 1;
  if (ga <= .01) return;
  const outP = t > outAt ? clamp((t - outAt) / OUT, 0, 1) : 0;

  // Kinetic typography is for short hook lines. These songs also carry long
  // spoken-dialogue lines (50-80 characters); extruding and glowing every
  // glyph of those just smears into a bright blur, so they get a plain,
  // outlined subtitle instead.
  if (isDense(L)) {
    drawSubtitle(line, t, yBase, L, size, ga, outP, age);
    return;
  }

  // soft scrim so the type stays legible over bright scene elements
  {
    const sa = ga * (1 - outP) * clamp(age / .5, 0, 1) * .55;
    if (sa > .01) {
      const r = Math.max(L.total * .72, size * 4);
      const sg = ctx.createRadialGradient(CX, yBase, 0, CX, yBase, r);
      sg.addColorStop(0, `rgba(3,4,10,${sa})`);
      sg.addColorStop(.6, `rgba(3,4,10,${sa * .5})`);
      sg.addColorStop(1, 'rgba(3,4,10,0)');
      ctx.save();
      ctx.translate(CX, yBase); ctx.scale(1, Math.max(.28, size * 2.2 / r));
      ctx.translate(-CX, -yBase);
      ctx.fillStyle = sg;
      ctx.fillRect(CX - r, yBase - r, r * 2, r * 2);
      ctx.restore();
    }
  }

  for (let i = 0; i < L.chars.length; i++) {
    const ch = L.chars[i];
    if (ch === ' ') continue;
    const a0 = age - i * stagger;
    const p = clamp(a0 / IN, 0, 1);
    if (p <= 0) continue;
    const e = easeOut(p), eb = easeBack(p);
    const o = {
      scale: 1, alpha: 1, z: 0, rz: 0, rx: 0, ry: 0, depth: chorus ? 9 : 6,
      col: P.ink, col2: P.a2, dark: [20, 6, 14], glow: .25, trail: 0, tx: 0, ty: 0,
      split: 0, stroke: 0
    };
    let x = L.pos[i];
    let y = (L.row[i] - (L.rows - 1) / 2) * size * LH_KIN;

    switch (preset) {
      case 'zoom':
        o.z = (1 - e) * 1700; o.ry = (1 - e) * .9; o.alpha = p;
        o.trail = 1 - p; o.tx = -L.pos[i] * .12 * (1 - p); break;
      case 'drop':
        y += -(1 - eb) * MIN * .32; o.rx = (1 - e) * 1.4; o.alpha = p;
        o.trail = (1 - p) * .8; o.ty = -size * .5 * (1 - p); break;
      case 'slide':
        x += -(1 - easeOutQ(p)) * MIN * .7; o.alpha = p;
        o.trail = 1 - p; o.tx = -size * (1 - p) * 1.4; break;
      case 'flip':
        o.ry = (1 - e) * Math.PI * .5 * (i % 2 ? 1 : -1); o.alpha = p; o.z = (1 - e) * 500; break;
      case 'burst':
        o.scale = lerp(2.1, 1, eb); o.alpha = p; o.glow = .25 + (1 - p) * .9;
        o.rz = (1 - e) * .5 * (i % 2 ? 1 : -1); break;
      case 'spin':
        o.rz = (1 - e) * 2.2; o.scale = lerp(.2, 1, eb); o.alpha = p; break;
      case 'wave':
        o.alpha = p; y += Math.sin(t * 3.4 - i * .45) * size * .12 * (.4 + F.mid);
        o.rz = Math.sin(t * 2.2 - i * .4) * .06; break;
      default:
        o.alpha = p; o.scale = lerp(1.4, 1, e); break;
    }

    const settled = clamp((a0 - IN) / .6, 0, 1);
    o.scale *= 1 + F.punch * (chorus ? .13 : .07) * (1 - settled * .35) + Math.sin(t * 1.6 + i) * .008;
    y += Math.sin(t * 1.25 + i * .5) * size * .022 * settled;
    o.glow += F.punch * .5;
    o.split = F.flash * (chorus ? .55 : .25) * MOTION;

    if (L.mask[i]) {                      // keyword accent
      o.col = P.a2; o.col2 = P.a1; o.glow += .55; o.stroke = .35;
      o.scale *= 1 + F.beat * .05; o.dark = [60, 10, 20];
    }
    if (outP > 0) {                       // exit: shatter past the camera
      const oe = easeOut(outP);
      o.alpha *= 1 - outP;
      o.z += oe * -420 - (chorus ? oe * (i % 3) * 60 : 0);
      o.scale *= 1 + oe * .45;
      o.rz += oe * .12 * (i % 2 ? 1 : -1);
      y -= oe * size * .35;
    }
    o.alpha *= ga;
    glyph(ch, LX + x + CAM.shx * .6, yBase + y + CAM.shy * .6, size, o);
  }

  if (chorus && outP === 0) {             // lower-third rule under chorus lines
    const p = clamp(age / .8, 0, 1);
    const w = L.total * easeOut(p) * .5;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(LX - w, 0, LX + w, 0);
    g.addColorStop(0, rgb(P.a2, 0)); g.addColorStop(.5, rgb(P.a2, .55 * ga)); g.addColorStop(1, rgb(P.a2, 0));
    ctx.fillStyle = g;
    ctx.fillRect(LX - w, yBase + (L.rows - 1) / 2 * size * 1.18 + size * .78,
                 w * 2, Math.max(1, S(2)));
    ctx.restore();
  }
}

/* ------------------------- title / credit cards -------------------- */
/* Fits a long title into the viewport: shrink first, then wrap onto up to
   `maxLines` balanced lines. Long Chinese titles otherwise run off screen,
   especially on a phone in portrait. */
function fitText(text, size, maxW, maxLines) {
  maxLines = maxLines || 1;
  font(size, 900);
  const one = ctx.measureText(text).width;
  if (one <= maxW) return { lines: [text], size: size };
  const chars = [...text];
  for (let n = 2; n <= maxLines && n <= chars.length; n++) {
    const per = Math.ceil(chars.length / n);
    const lines = [];
    for (let i = 0; i < chars.length; i += per) lines.push(chars.slice(i, i + per).join(''));
    let widest = 0;
    for (const l of lines) widest = Math.max(widest, ctx.measureText(l).width);
    if (widest <= maxW) return { lines: lines, size: size };
    if (maxW / widest >= .72) return { lines: lines, size: size * maxW / widest };
  }
  if (maxLines > 1) {                       // last resort: max lines, shrunk
    const per = Math.ceil(chars.length / maxLines);
    const lines = [];
    for (let i = 0; i < chars.length; i += per) lines.push(chars.slice(i, i + per).join(''));
    let widest = 0;
    for (const l of lines) widest = Math.max(widest, ctx.measureText(l).width);
    return { lines: lines, size: size * maxW / widest };
  }
  return { lines: [text], size: size * maxW / one };
}

function drawCard(text, cy, size, t, t0, t1, style) {
  if (!text || t < t0 - .05 || t > t1 + .05) return;
  const IN = style === 'logo' ? 1.1 : .8, OUT = .9;
  const fit = fitText(text, size, W * .88, style === 'num' ? 1 : 3);
  size = fit.size;
  const outP = clamp((t - (t1 - OUT)) / OUT, 0, 1);
  const lh = size * 1.12;
  const y0 = cy - (fit.lines.length - 1) * lh / 2;
  let ci = 0, widest = 0;
  font(size, 900);

  for (let li = 0; li < fit.lines.length; li++) {
    const chars = [...fit.lines[li]];
    const ws = chars.map(c => ctx.measureText(c).width);
    const gap = style === 'num' ? size * .3 : size * .02;
    const total = ws.reduce((s2, w) => s2 + w, 0) + gap * (chars.length - 1);
    widest = Math.max(widest, total);
    let x = CX - total / 2;
    const ly = y0 + li * lh;
    for (let i = 0; i < chars.length; i++, ci++) {
      const p = clamp((t - t0 - ci * (style === 'logo' ? .13 : .07)) / IN, 0, 1);
      const e = easeOut(p), oe = easeOut(outP);
      if (p > 0) glyph(chars[i], x + ws[i] / 2 + CAM.shx * .5, ly + CAM.shy * .5, size, {
        scale: lerp(style === 'logo' ? 1.45 : 1.2, 1, e) * (1 + oe * .5) * (1 + F.punch * .05),
        alpha: p * (1 - outP),
        z: (1 - e) * (style === 'logo' ? 900 : 500) - oe * 420,
        rz: 0, rx: (1 - e) * (style === 'logo' ? .8 : .4), ry: 0,
        depth: style === 'logo' ? 14 : 9,
        col: P.ink, col2: P.a2, dark: [70, 18, 8],
        glow: .45 + (1 - p) * .8 + F.punch * .4,
        trail: 1 - p, tx: 0, ty: -size * .3 * (1 - p),
        split: F.flash * .45, stroke: style === 'num' ? .4 : .18
      });
      x += ws[i] + gap;
    }
  }

  const a = clamp((t - t0) / IN, 0, 1) * (1 - outP);
  const sw = ((t - t0 - .4) % 3.4) / 1.2;
  if (sw > 0 && sw < 1 && a > .1) {         // light sweep
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gx = lerp(CX - widest * .75, CX + widest * .75, sw);
    const g = ctx.createLinearGradient(gx - MIN * .1, 0, gx + MIN * .1, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(.5, `rgba(255,255,255,${.14 * a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(CX - widest * .85, y0 - size * .8, widest * 1.7,
                 (fit.lines.length - 1) * lh + size * 1.6);
    ctx.restore();
  }
  return { size: size, bottom: y0 + (fit.lines.length - 1) * lh + size * .6 };
}

function caption(text, cy, size, alpha, col, cx, maxw) {
  if (alpha <= .01 || !text) return;
  ctx.save();
  font(size, 400);
  if (cx === undefined) cx = CX;
  const maxW = (maxw || W) * .9;
  let w = ctx.measureText(text).width;
  if (w > maxW) {
    // shrink a little, then clip — a 60-character narration line scaled to
    // fit on one row is unreadable mush, an ellipsis is not
    size *= Math.max(.75, maxW / w); font(size, 400);
    if (ctx.measureText(text).width > maxW) {
      const cs = [...text];
      while (cs.length > 2 && ctx.measureText(cs.join('') + '…').width > maxW) cs.pop();
      text = cs.join('') + '…';
    }
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = rgb(col || P.a1, alpha);
  ctx.shadowColor = rgb(col || P.a1, alpha * .6); ctx.shadowBlur = size * .5;
  ctx.fillText(text, cx + CAM.shx * .4, cy + CAM.shy * .4);
  ctx.restore();
}

/* The opening sequence adapts to however much room the song leaves
   before its first sung line. */
function buildIntro() {
  const end = clamp(FIRST_T - .4, 0, 22);
  const cards = [];
  if (end >= 14) {
    cards.push({ kind: 'logo', text: LY.title, t0: 1.0, t1: end * .5, y: -.035, size: .118 });
    cards.push({ kind: 'line', text: LY.tagline, t0: end * .52, t1: end * .8, y: 0, size: .058 });
    cards.push({ kind: 'num', text: TH.mark2, t0: end * .82, t1: end, y: -.01, size: .13 });
  } else if (end >= 7) {
    cards.push({ kind: 'logo', text: LY.title, t0: .8, t1: end * .62, y: -.035, size: .115 });
    cards.push({ kind: 'line', text: LY.tagline, t0: end * .64, t1: end, y: 0, size: .055 });
  } else {
    // little or no room: run the logo as an upper third so it never fights
    // with the first sung lines down at the lyric line
    cards.push({ kind: 'logo', text: LY.title, t0: .25, t1: Math.max(end, 6.5), y: -.25, size: .066 });
  }
  INTRO = { end: Math.max(end, 4), cards: cards };
}
function drawIntro(t) {
  const cards = INTRO.cards;
  if (!cards.length || t > cards[cards.length - 1].t1 + .2) return;
  for (const c of cards) {
    const r = drawCard(c.text, CY + MIN * c.y, MIN * c.size, t, c.t0, c.t1, c.kind);
    if (c.kind === 'logo' && r) {
      const w = c.t1 - c.t0;
      const s1 = clamp((t - c.t0 - w * .28) / .9, 0, 1) * clamp((c.t1 - .7 - t) / .8, 0, 1);
      caption(LY.cast, r.bottom + MIN * .035, MIN * .022, s1 * .55, P.ink);
    }
  }
}
function drawOutro(t) {
  const a = clamp((t - LAST_END - .6) / 1.4, 0, 1) * clamp((DUR - t) / 1.2, 0, 1);
  if (a <= .01) return;
  const fit = fitText(LY.title, MIN * .09, W * .88, 3);
  const size = fit.size, lh = size * 1.12;
  font(size, 900);
  const y0 = CY - MIN * .02 - (fit.lines.length - 1) * lh / 2;
  let ci = 0;
  for (let li = 0; li < fit.lines.length; li++) {
    const chars = [...fit.lines[li]];
    const ws = chars.map(c => ctx.measureText(c).width);
    const total = ws.reduce((s2, w) => s2 + w, 0);
    let x = CX - total / 2;
    for (let i = 0; i < chars.length; i++, ci++) {
      glyph(chars[i], x + ws[i] / 2, y0 + li * lh, size, {
        scale: 1, alpha: a, z: 0, rz: 0, rx: 0, ry: Math.sin(t * .6 + ci * .3) * .12,
        depth: 12, col: P.ink, col2: P.a2, dark: [70, 18, 8],
        glow: .5, trail: 0, tx: 0, ty: 0, split: 0, stroke: .2
      });
      x += ws[i];
    }
  }
  const bottom = y0 + (fit.lines.length - 1) * lh + size * .6;
  caption(LY.cast, bottom + MIN * .04, MIN * .022, a * .8);
  caption(LY.tagline, bottom + MIN * .085, MIN * .018, a * .45, P.ink);
}

/* ---------------------------- cartoon cast ------------------------- */
/* The hand-drawn troupe lives in js/toons.js so this file stays about the
   camera and the type. It cannot see anything in here, so it gets one
   object with everything it needs; the fields are refreshed in place so
   a frame never allocates. The cast plays in the band above the sung
   line — the floor it stands on rises and falls with the lyric block, so
   the drawing and the type never end up on the same pixels. */
const TOON = window.MV_TOONS || null;
let toonFloor = 0;
const TG = {
  ctx: ctx, font: font, rgb: rgb, S: S, P: P, TH: TH, F: F, MOTION: MOTION,
  t: 0, dt: 0, act: '', pw: 1, prog: 0,
  W: 0, H: 0, CX: 0, CY: 0, MIN: 0, QUAL: 2,
  top: 0, bot: 0, secIdx: 0, secAge: 0, lineIdx: -1, lineAge: 0, hot: false
};
function drawToons(t, dt, lt, act, floorTarget, secIdx, lineIdx, lineAge, hot) {
  if (!TOON || !SONG || !TOON.has(SONG.theme)) return;
  // the floor gives way to a new line at once but takes its time coming
  // back down, so the cast can never be caught standing on fresh type
  toonFloor = toonFloor > 0
    ? (floorTarget < toonFloor ? floorTarget : lerp(toonFloor, floorTarget, 1 - Math.pow(.05, dt)))
    : floorTarget;
  TG.t = t; TG.dt = dt; TG.act = act; TG.TH = TH;
  TG.prog = DUR > 0 ? clamp(lt / DUR, 0, 1) : 0;
  TG.W = W; TG.H = H; TG.CX = CX; TG.CY = CY; TG.MIN = MIN; TG.QUAL = QUAL;
  TG.top = SAFE_T + MIN * .02;
  TG.bot = toonFloor - MIN * .025;
  // a three-row sung line can leave almost nothing above it. Never push the
  // floor back down into the type to make room — let the cast shrink, and
  // fade it back as the stage closes in so it reads as a backdrop
  const room = TG.bot - TG.top;
  if (room < MIN * .05) return;
  TG.secIdx = secIdx; TG.secAge = lt - (SEC[secIdx] ? SEC[secIdx].start : 0);
  TG.lineIdx = lineIdx; TG.lineAge = lineAge; TG.hot = hot;
  // fade in with the opening and back out with the credits
  TG.pw = clamp(lt / 1.2, 0, 1) * clamp((DUR - lt) / 1.2, 0, 1)
        * (act === 'intro' ? .8 : 1)
        * clamp(.32 + (room / MIN - .08) / .08 * .68, .32, 1);
  TOON.draw(SONG.theme, TG);
}

/* --------------------------- post processing ----------------------- */
let grainPat = null;
function buildGrain() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), im = g.createImageData(128, 128);
  for (let i = 0; i < im.data.length; i += 4) {
    const v = 128 + (Math.random() * 90 - 45);
    im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  grainPat = ctx.createPattern(c, 'repeat');
}
/* Bloom runs BEFORE the lyrics are drawn. Squaring the frame and adding it
   back is what turned a block of white subtitle glyphs into one solid bar:
   dense CJK strokes plus their own halo saturate, and the bloom fills the
   gaps between the strokes. The scene still blooms; the text stays crisp. */
function bloom() {
  // downscale twice (bilinear filtering IS the blur) and multiply the
  // small buffer by itself so only highlights survive
  if (QUAL > 0) {
    actx.globalCompositeOperation = 'source-over';
    actx.drawImage(cvs, 0, 0, bA.width, bA.height);
    bctx.globalCompositeOperation = 'source-over';
    bctx.drawImage(bA, 0, 0, bB.width, bB.height);
    bctx.globalCompositeOperation = 'multiply';
    bctx.drawImage(bA, 0, 0, bB.width, bB.height);      // v -> v^2
    bctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = .85 + F.level * .25 + F.flash * .2;
    ctx.drawImage(bB, 0, 0, W, H);
    ctx.restore();
  }
}
function post() {
  if (F.flash > .02) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgb(P.a2, F.flash * .045 * MOTION);
    ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  const g = ctx.createRadialGradient(CX, CY, MIN * .25, CX, CY, MIN * .82);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${.62 - F.level * .12})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (QUAL > 0 && grainPat) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = .05;
    ctx.translate((Math.random() * 128) | 0, (Math.random() * 128) | 0);
    ctx.fillStyle = grainPat;
    ctx.fillRect(-128, -128, W + 256, H + 256);
    ctx.restore();
  }
  const bar = H * .045;                      // cinematic framing
  ctx.fillStyle = '#04050c';
  ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
}

/* ============================== PLAYBACK =========================== */
const audio = $('#audio');
let clock = 0, playing = false, last = performance.now() / 1000;
let OFFSET = 0, editing = false, editIdx = 0, lastIdx = -2, lastSec = -2;

const keyT = () => 'mv.times.' + (SONG ? SONG.id : '?');
const keyO = () => 'mv.offset.' + (SONG ? SONG.id : '?');

function recomputeDur() {
  for (let i = 0; i < LY.lines.length; i++) {
    const nx = LY.lines[i + 1];
    const cap = nx ? nx.t - .08 : LAST_END + 1.2;
    LY.lines[i].d = Math.max(.6, Math.min(cap - LY.lines[i].t, 6.4));
  }
}
function lineAt(t) {
  let cur = -1;
  for (let i = 0; i < LY.lines.length; i++) { if (LY.lines[i].t <= t) cur = i; else break; }
  return cur;
}
function actAt(t) {
  if (!SEC.length) return t < DUR * .5 ? 'intro' : 'outro';
  if (t < SEC[0].start - .8) return 'intro';
  if (t > LAST_END + 1.0) return 'outro';
  for (const s of SEC) if (t >= s.start - 1.4 && t <= s.end + 1.0) return s.kind;
  return 'brk';
}

/* ---------------------------- song loading ------------------------- */
function ensureData(id, cb) {
  const bag = window.MV_SONG_DATA;
  if (bag && bag[id]) return cb(bag[id]);
  const s = document.createElement('script');
  s.src = 'data/song/' + id + '.js?v=' + VERSION;
  s.onload = () => {
    const d = window.MV_SONG_DATA && window.MV_SONG_DATA[id];
    if (d) cb(d); else toast('資料格式有誤：' + id);
  };
  s.onerror = () => toast('載入失敗：data/song/' + id + '.js');
  document.head.appendChild(s);
}

function applySong(d, autoplay, startAt) {
  SONG = d;
  AA = d.analysis;
  TH = THEMES[d.theme] || THEMES.wed;
  BANDS = b64u8(AA.bands); RMSA = b64u8(AA.rms); NB = AA.bandCount;
  DUR = AA.duration; BEAT = 60 / AA.bpm;
  LY = {
    title: d.title, cast: d.cast, tagline: d.tagline,
    lines: d.lines.map(l => ({ t: l.t, d: l.d, text: l.text, sec: l.sec, kind: l.kind }))
  };
  LY.lines.forEach((l, i) => l.idx = i);
  SEC = d.sections || [];
  LAST_END = SEC.length
    ? Math.max(SEC[SEC.length - 1].end, LY.lines.length ? LY.lines[LY.lines.length - 1].t + 2 : 0)
    : DUR;
  FIRST_T = LY.lines.length ? LY.lines[0].t : DUR;

  OFFSET = parseFloat(store.get(keyO()) || '0') || 0;
  try {
    const saved = JSON.parse(store.get(keyT()) || 'null');
    if (saved && saved.length === LY.lines.length) saved.forEach((t, i) => LY.lines[i].t = t);
  } catch (e) { }
  recomputeDur();
  buildIntro();

  audio.src = d.audio;
  audio.load();
  setLoading(!!autoplay);
  clock = 0; resetOnsets(0);
  if (startAt > 0) {
    // currentTime can only be set once metadata is in
    const t0 = Math.min(startAt, DUR - 1);
    const go = () => { audio.currentTime = t0; clock = t0; resetOnsets(t0); lastIdx = -2; };
    if (audio.readyState >= 1) go(); else audio.addEventListener('loadedmetadata', go, { once: true });
  }
  PREF.set('song', d.id);
  updateMediaSession();
  parts.length = 0; waves.length = 0; pillars.length = 0;
  layoutCache.clear();
  lastIdx = -2; lastSec = -2; editIdx = 0;
  const p0 = palFor('intro');
  for (const k in p0) { P[k][0] = p0[k][0]; P[k][1] = p0[k][1]; P[k][2] = p0[k][2]; }
  $('#ttl').textContent = d.title;
  $('#cast').textContent = d.cast || '';
  document.title = d.title + ' · 3D MV';
  buildPanel(); drawWave(); paintCards();
  if (editing) paintEditor();
  if (autoplay) play(); else { playing = false; setPlayIcon(); }
  $('#scrub').setAttribute('aria-valuemax', String(Math.round(DUR)));
}

let loadTok = 0;
function loadSong(idx, autoplay, startAt) {
  if (!CAT.length) return;
  songIdx = (idx % CAT.length + CAT.length) % CAT.length;
  const entry = CAT[songIdx], tok = ++loadTok;
  paintCards();
  const bag = window.MV_SONG_DATA;
  if (!(bag && bag[entry.id])) { setLoading(true); toast('載入中 · ' + entry.title); }
  ensureData(entry.id, d => {
    if (tok !== loadTok) return;               // a newer pick won the race
    applySong(d, autoplay, startAt);
    toast((songIdx + 1) + ' / ' + CAT.length + ' · ' + entry.title);
  });
}

/* ================================ LOOP ============================= */
let fpsAcc = 0, fpsN = 0, fpsShow = 0;
let profOn = false, profMark = 0, profAcc = {}, profN = 0;
function PROF(name) {
  if (!profOn) return;
  const n = performance.now();
  profAcc[name] = (profAcc[name] || 0) + (n - profMark);
  profMark = n;
}

function syncClock(dt) {
  if (playing) {
    clock += dt;
    const real = audio.currentTime;
    if (Math.abs(real - clock) > .06) clock = lerp(clock, real, .35);
    if (Math.abs(real - clock) > .4) clock = real;
  } else {
    clock = audio.currentTime;
  }
  clock = clamp(clock, 0, DUR);
}

function frame(now) {
  requestAnimationFrame(frame);
  const nowS = now / 1000;
  let dt = nowS - last; last = nowS;
  if (dt > .1) dt = .1;
  if (dt <= 0) dt = .016;
  if (!SONG) return;
  // a WebView / background tab can report a 0×0 viewport before its first
  // layout; drawing (the bloom's drawImage) would throw every frame
  if (W < 2 || H < 2) { if (innerWidth > 1 && innerHeight > 1) resize(); return; }
  if (profOn) { profMark = performance.now(); profN++; }

  syncClock(dt);
  const t = clock, lt = t - OFFSET;
  sampleAudio(t, dt);

  const act = actAt(lt);
  mixPal(palFor(act), dt);

  /* ---- camera choreography ---- */
  CAM.tfov = 1000 + Math.sin(t * .27) * 60 - F.bass * 120;
  CAM.tyaw = Math.sin(t * .13) * .12;
  CAM.tpitch = Math.sin(t * .09 + 1.2) * .05;
  CAM.troll = Math.sin(t * .11) * .025;
  CAM.ty = Math.sin(t * .21) * 60;
  let speed = 320, wmAlpha = 0, wmText = TH.mark;
  let eqPower = 0, solidPower = 0, motifPower = .5;

  switch (act) {
    case 'intro':
      speed = 180 + F.level * 380 + clamp(lt / INTRO.end, 0, 1) * 520
              + clamp((lt - (INTRO.end - 1.4)) / 1.6, 0, 1) * 1400;
      CAM.tpitch = -.06 + Math.sin(lt * .25) * .04;
      CAM.troll = Math.sin(lt * .4) * .04;
      wmAlpha = .1 + clamp((lt - INTRO.end * .6) / 3, 0, 1) * .18;
      wmText = TH.mark2; solidPower = clamp((lt - 2) / 4, 0, 1) * .7; motifPower = .8;
      break;
    case 'hook':
      speed = 900 + F.bass * 1500; CAM.troll = Math.sin(t * .9) * .07;
      wmAlpha = .16; eqPower = .5; solidPower = .35;
      break;
    case 'verse':
      speed = 420 + F.bass * 900 + F.level * 300;
      CAM.tyaw = Math.sin(t * .17) * .22;
      wmAlpha = .08 + F.level * .12; motifPower = 1; solidPower = .25;
      break;
    case 'chorus':
      speed = 1050 + F.bass * 2100;
      CAM.troll = Math.sin(t * .8) * .06 + F.punch * .03;
      CAM.tpitch = -.03 + Math.sin(t * .5) * .05;
      wmAlpha = .18 + F.level * .2; eqPower = 1; solidPower = .5; motifPower = .7;
      break;
    case 'brk':
      speed = 200 + F.level * 300; CAM.tyaw = Math.sin(t * .2) * .3;
      wmAlpha = .2; wmText = TH.mark2; solidPower = .8; motifPower = 1; eqPower = .3;
      break;
    case 'outro':
      speed = 140 + F.level * 200; wmAlpha = .12; motifPower = .8; solidPower = .5;
      break;
  }
  travel += speed * dt;
  camUpdate(t, dt);

  /* ---- section change: whip pan + a burst ---- */
  let secIdx = -1;
  for (let i = 0; i < SEC.length; i++) if (lt >= SEC[i].start - .4) secIdx = i;
  if (secIdx !== lastSec) {
    if (lastSec !== -2 && secIdx >= 0) {
      CAM.whip = (Math.random() < .5 ? -1 : 1) * .34 * MOTION;
      waves.push({ age: 0, dur: 1.5, max: 2200, z: 1500, c: 1 });
      if (SEC[secIdx].kind === 'chorus') emit(QUAL === 2 ? 40 : 20);
    }
    lastSec = secIdx;
  }

  /* ---- motif power levels ---- */
  const curIdx = lineAt(lt);
  const curLine = curIdx >= 0 ? LY.lines[curIdx] : null;
  const hot = !!curLine && /五三九|539|頭獎|號碼|獎金|中獎|發票|威力彩/.test(curLine.text);
  const introDraw = act === 'intro' && INTRO.end >= 14 && lt > INTRO.end * .8;
  ballPower = lerp(ballPower,
    TH.balls ? ((hot || introDraw) ? 1 : (act === 'brk' ? .4 : .12)) : 0, 1 - Math.pow(.08, dt));
  const knot = !!curLine && /紅線|牽|結婚|喜|愛/.test(curLine.text);
  stringPower = lerp(stringPower,
    (TH.balls && (act === 'chorus' || knot)) ? 1 : .04, 1 - Math.pow(.15, dt));

  /* ---- beat driven spawns ---- */
  if (playing && F.flash > .88) {
    if (act === 'chorus' || act === 'hook') { spawnPillar(); emit(QUAL === 2 ? 7 : 4); }
    if (Math.random() < .35) {
      waves.push({ age: 0, dur: 1.1, max: 1700, z: 1600 + Math.random() * 900, c: Math.random() < .5 });
    }
  }

  /* ============================ RENDER ============================ */
  const g = ctx.createRadialGradient(CX, CY * .9, 0, CX, CY, MIN * 1.15);
  g.addColorStop(0, rgb(P.bg, 1));
  g.addColorStop(1, rgb(P.bg2, 1));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  PROF('bg');

  drawRays(t); PROF('rays');
  drawWatermark(t, wmText, wmAlpha); PROF('mark');
  drawGrid(t); PROF('grid');
  drawRings(t, travel * .0004); PROF('rings');
  drawStars(dt, speed); PROF('stars');
  drawMotifs(t, dt, motifPower); PROF('motifs');
  drawEQ(t, eqPower); PROF('eq');
  drawPillars(dt); PROF('pillars');
  drawSolid(t, solidPower); PROF('solid');
  drawWaves(dt); PROF('waves');
  drawBokeh(t); PROF('bokeh');
  drawString(t); PROF('string');
  drawBalls(t); PROF('balls');
  drawParts(dt); PROF('parts');

  bloom(); PROF('bloom');

  /* ---- lyrics ---- */
  lyricArea();
  // where the sung line lands has to be known before the cartoon cast
  // draws, because the cast uses it as its floor
  const cur = curIdx >= 0 ? LY.lines[curIdx] : null;
  const prev = curIdx > 0 ? LY.lines[curIdx - 1] : null;
  let yMain = CY + MIN * .1, half = 0, lyrTop = SAFE_B, pShow = null;
  if (cur) {
    // a tall wrapped block must not run under the waveform / transport,
    // which is where a landscape phone puts it otherwise
    half = blockHalf(cur);
    const hi = SAFE_B - half, lo = SAFE_T + half;
    yMain = hi < lo ? (SAFE_T + SAFE_B) / 2 : clamp(yMain, lo, hi);
    lyrTop = yMain - half;
    // the fading previous line only appears when it fits completely above
    // the current block — lyrics must never sit on top of each other
    if (prev && lt < prev.t + prev.d + .75) {
      const pHalf = blockHalf(prev);
      const py = yMain - half - pHalf - MIN * .022;
      if (py - pHalf > SAFE_T) { pShow = { y: py, half: pHalf }; lyrTop = py - pHalf; }
    }
  }
  // the cast plays above everything the lyrics are using, the ghost of the
  // previous line included
  drawToons(t, dt, lt, act, lyrTop, secIdx, curIdx, curLine ? lt - curLine.t : 0, hot);
  PROF('toons');
  drawIntro(lt);
  if (cur) {
    const outAt = cur.t + cur.d;

    if (pShow) {
      drawLine(prev, lt, pShow.y, {
        alpha: clamp(1 - (lt - (prev.t + prev.d)) / .7, 0, 1) * .28, outAt: prev.t + prev.d
      });
    }
    if (lt < outAt + .55) drawLine(cur, lt, yMain, { outAt: outAt });

    const nx = LY.lines[curIdx + 1];
    if (nx && nx.t - lt < 1.1 && lt > outAt - .2) {
      const ny = yMain + half + MIN * .045;
      if (ny + MIN * .02 < SAFE_B) {
        caption(nx.text, ny, MIN * .026,
                clamp(1 - (nx.t - lt) / 1.1, 0, 1) * .22, P.ink, LX, LW);
      }
    }
  }
  if (act === 'outro') drawOutro(lt);

  /* ---- section stinger ---- */
  for (let i = 0; i < SEC.length; i++) {
    const d = lt - SEC[i].start;
    if (d > -.5 && d < 2.2) {
      const p = clamp((d + .5) / .6, 0, 1), f = clamp((2.2 - d) / .6, 0, 1);
      ctx.save();
      ctx.translate(S(60), CY - MIN * .28);
      ctx.rotate(-Math.PI / 2);
      font(MIN * .018, 800);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = rgb(P.a2, p * f * .7);
      ctx.fillText(`${ACT_LABEL[SEC[i].kind]}　/　${String(i + 1).padStart(2, '0')}`, 0, 0);
      ctx.restore();
    }
  }
  PROF('text');
  post(); PROF('post');
  if (editing) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,210,74,.5)'; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2); ctx.restore();
  }

  fpsAcc += dt; fpsN++;
  if (fpsAcc > .5) {
    fpsShow = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0;
    elFps.textContent = fpsShow + ' FPS';
    autoQuality(fpsShow);
  }
  const actText = ACT_LABEL[act] || '';
  if (elAct.textContent !== actText) elAct.textContent = actText;
  updateTransport(t, curIdx);
}

/* If the scene cannot hold ~28 fps for a few seconds, step the quality
   down once per level instead of leaving a stuttering MV. Only while the
   viewer has not picked a quality by hand this session. */
let lowFps = 0, qualByHand = false;
function autoQuality(fps) {
  if (!playing || qualByHand || QUAL === 0 || document.hidden) { lowFps = 0; return; }
  lowFps = fps < 28 ? lowFps + 1 : Math.max(0, lowFps - 1);
  if (lowFps >= 8) {
    lowFps = 0;
    setQuality(QUAL - 1, false);
    toast('畫面較卡，已自動切到「' + QNAME[QUAL] + '」畫質（按 Q 可調回）');
  }
}

/* ============================ UI / TRANSPORT ======================= */
const elHead = $('#head'), elTime = $('#time'), elNow = $('#now'), elPlay = $('#play');
const elFps = $('#fps'), elAct = $('#actTag'), elPlayed = $('#played'), elBuf = $('#buf');
const elScrub = $('#scrub'), elStart = $('#start'), elPanel = $('#panel'), elHelp = $('#help');
const SKIP = 10, SKIP_BIG = 30;

elTime.style.cursor = 'pointer';
elTime.title = '點一下輸入時間跳轉';
elTime.onclick = () => { const g = $('#goto'); g.value = fmt(clock); g.focus(); };

let lastTimeText = '', lastPct = -1, lastAria = -1;
function updateTransport(t, idx) {
  const pct = clamp(t / DUR, 0, 1) * 100;
  if (Math.abs(pct - lastPct) > .02) {
    lastPct = pct;
    elHead.style.left = pct + '%';
    elPlayed.style.width = pct + '%';
  }
  const tt = `${fmt(t)} / ${fmt(DUR)}`;
  if (tt !== lastTimeText) {
    lastTimeText = tt; elTime.textContent = tt;
    const sec = Math.floor(t);
    if (sec !== lastAria) {
      lastAria = sec;
      elScrub.setAttribute('aria-valuenow', String(sec));
      elScrub.setAttribute('aria-valuetext', tt);
    }
  }
  if (idx !== lastIdx) {
    lastIdx = idx;
    elNow.textContent = idx >= 0 ? LY.lines[idx].text : '';
    paintPanel(idx);
    if (editing) paintEditor();
  }
}
function updateBuffered() {
  try {
    const b = audio.buffered;
    let end = 0;
    for (let i = 0; i < b.length; i++) if (b.start(i) <= audio.currentTime + 1) end = Math.max(end, b.end(i));
    elBuf.style.width = clamp(end / DUR, 0, 1) * 100 + '%';
  } catch (e) { }
}
audio.addEventListener('progress', updateBuffered);
audio.addEventListener('timeupdate', updateBuffered);

/* ----------------------------- lyric panel ------------------------- */
const wrap = $('#scrollwrap');
let rows = [];
function buildPanel() {
  wrap.innerHTML = ''; rows = [];
  let sec = -1;
  LY.lines.forEach(l => {
    if (l.sec !== sec) {
      sec = l.sec;
      const h = document.createElement('div');
      h.className = 'sec';
      h.textContent = `${ACT_LABEL[l.kind] || ''} · ${String(sec + 1).padStart(2, '0')}`;
      wrap.appendChild(h);
    }
    const d = document.createElement('div');
    d.className = 'l'; d.textContent = l.text;
    d.title = '跳到 ' + fmt(l.t + OFFSET);
    d.onclick = () => { seek(l.t + OFFSET); if (!playing) play(); };
    wrap.appendChild(d); rows.push(d);
  });
}
function paintPanel(idx) {
  rows.forEach((r, i) => { r.className = 'l' + (i === idx ? ' cur' : i < idx ? ' done' : ''); });
  if (idx >= 0 && rows[idx]) wrap.style.transform = `translateY(${-rows[idx].offsetTop + innerHeight * .34}px)`;
  else wrap.style.transform = `translateY(${innerHeight * .34}px)`;
}

/* ------------------------------ waveform --------------------------- */
function drawWave() {
  const c = $('#wave'), g = c.getContext('2d');
  const w = c.clientWidth || 800, h = c.clientHeight || 46, d = Math.min(devicePixelRatio || 1, 2);
  c.width = w * d; c.height = h * d;
  g.setTransform(d, 0, 0, d, 0, 0);
  g.clearRect(0, 0, w, h);
  if (!RMSA) return;
  const n = Math.floor(w);
  const c1 = rgb(TH.a1, .55), c2 = rgb(TH.a2, .5);
  for (let i = 0; i < n; i++) {
    const f0 = Math.floor(i / n * RMSA.length), f1 = Math.floor((i + 1) / n * RMSA.length);
    let mx = 0;
    for (let f = f0; f < f1; f++) mx = Math.max(mx, RMSA[f]);
    const v = Math.max(1, Math.pow(mx / 255, 1.25) * (h * .8));
    const grd = g.createLinearGradient(0, h / 2 - v / 2, 0, h / 2 + v / 2);
    grd.addColorStop(0, c1);
    grd.addColorStop(.5, 'rgba(255,255,255,.28)');
    grd.addColorStop(1, c2);
    g.fillStyle = grd;
    g.fillRect(i, h / 2 - v / 2, 1, v);
  }
  const M = $('#marks'); M.innerHTML = '';
  let lastLab = -99;
  SEC.forEach(sec => {
    const pct = sec.start / DUR * 100;
    const bar = document.createElement('i');
    bar.style.left = pct + '%'; M.appendChild(bar);
    // only label a section when there is room, otherwise they overlap
    if (pct - lastLab < 4200 / w) return;
    lastLab = pct;
    const lab = document.createElement('b');
    lab.style.left = pct + '%';
    lab.textContent = ACT_LABEL[sec.kind]; M.appendChild(lab);
  });
}

/* ------------------------------ playback --------------------------- */
function setPlayIcon() {
  elPlay.textContent = playing ? '❚❚' : '▶';
  elPlay.setAttribute('aria-label', playing ? '暫停' : '播放');
  try { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'; } catch (e) { }
}
function setLoading(on) { elPlay.classList.toggle('loading', !!on); }

function play() {
  const p = audio.play();
  if (!p || !p.then) { playing = true; setPlayIcon(); return; }
  p.then(() => { playing = true; setPlayIcon(); wake(); })
   .catch(err => {
     setLoading(false);
     if (err && err.name === 'NotAllowedError') toast('瀏覽器擋下自動播放 · 點 ▶ 開始');
     else if (err && err.name !== 'AbortError') toast('無法播放這首歌');
   });
}
function pause() { audio.pause(); playing = false; setPlayIcon(); setLoading(false); wake(); }
function toggle() { playing ? pause() : play(); }
function seek(t) {
  t = clamp(t, 0, DUR - .05);
  audio.currentTime = t; clock = t;
  resetOnsets(t); parts.length = 0; waves.length = 0; pillars.length = 0; lastIdx = -2;
  saveResume(true);
}
function seekBy(d) {
  seek(clock + d);
  pulse(d < 0 ? '⏪' : '⏩', (d < 0 ? '−' : '+') + Math.abs(d) + ' 秒', d < 0 ? 'l' : 'r');
}

// keep the UI honest when something else pauses the audio (headphones
// unplugged, a phone call, the OS media controls)
audio.addEventListener('pause', () => { if (playing && !audio.ended) { playing = false; setPlayIcon(); } });
audio.addEventListener('play', () => { if (!playing) { playing = true; setPlayIcon(); } });
audio.addEventListener('waiting', () => setLoading(true));
audio.addEventListener('stalled', () => { if (playing) setLoading(true); });
audio.addEventListener('playing', () => setLoading(false));
audio.addEventListener('canplay', () => { if (!playing) setLoading(false); });
audio.addEventListener('seeked', () => { if (!playing) setLoading(false); });
audio.addEventListener('error', () => {
  setLoading(false);
  if (audio.getAttribute('src')) toast('音檔載入失敗：' + (SONG ? SONG.audio : ''));
});

/* loop modes: whole album (default) → one song → stop at the end */
const LOOPS = ['all', 'one', 'off'];
const LOOP_ICON = { all: '🔁', one: '🔂', off: '➡' };
const LOOP_NAME = { all: '全部循環', one: '單曲循環', off: '播完停止' };
let loopMode = LOOPS.indexOf(PREF.str('loop', 'all')) >= 0 ? PREF.str('loop', 'all') : 'all';
function paintLoop() {
  const b = $('#bLoop');
  b.textContent = LOOP_ICON[loopMode];
  b.title = LOOP_NAME[loopMode] + '（R 切換）';
  b.classList.toggle('on', loopMode !== 'off');
}
function cycleLoop() {
  loopMode = LOOPS[(LOOPS.indexOf(loopMode) + 1) % LOOPS.length];
  PREF.set('loop', loopMode); paintLoop(); toast(LOOP_NAME[loopMode]);
}
$('#bLoop').onclick = cycleLoop;

audio.addEventListener('ended', () => {
  playing = false; setPlayIcon();
  saveResume(true, 0);
  if (loopMode === 'one') { seek(0); play(); }
  else if (loopMode === 'all') loadSong(songIdx + 1, true);    // auto-advance through the album
  else if (songIdx < CAT.length - 1) loadSong(songIdx + 1, true);
  else { toast('全部播完了 · 按 ▶ 從頭再來'); seek(0); }
});

elPlay.onclick = () => { if (!elStart.classList.contains('gone')) hideList(); toggle(); };
$('#bPrev').onclick = prevSong;
$('#bNext').onclick = () => loadSong(songIdx + 1, true);
$('#bBack10').onclick = () => seekBy(-SKIP);
$('#bFwd10').onclick = () => seekBy(SKIP);
// "previous" restarts the song first, like every music player
function prevSong() {
  if (clock > 4) { seek(0); toast('從頭播放'); if (!playing) play(); }
  else loadSong(songIdx - 1, true);
}

/* -------------------------------- volume --------------------------- */
const volEl = $('#vol'), muteEl = $('#bMute');
let volume = clamp(PREF.num('vol', 1), 0, 1), muted = PREF.str('muted', '0') === '1';
function applyVolume(show) {
  audio.volume = volume; audio.muted = muted;
  volEl.value = String(volume);
  volEl.style.setProperty('--v', (muted ? 0 : volume * 100) + '%');
  const icon = muted || volume === 0 ? '🔇' : volume < .5 ? '🔉' : '🔊';
  muteEl.textContent = icon;
  muteEl.setAttribute('aria-label', muted ? '取消靜音' : '靜音');
  muteEl.classList.toggle('on', muted);
  PREF.set('vol', volume.toFixed(2)); PREF.set('muted', muted ? '1' : '0');
  if (show) pulse(icon, muted ? '靜音' : Math.round(volume * 100) + '%');
}
function setVolume(v, show) { volume = clamp(v, 0, 1); if (volume > 0) muted = false; applyVolume(show); }
function toggleMute() { muted = !muted; if (!muted && volume === 0) volume = .6; applyVolume(true); }
volEl.addEventListener('input', () => setVolume(parseFloat(volEl.value), false));
volEl.addEventListener('keydown', e => e.stopPropagation());
muteEl.onclick = toggleMute;

/* ------------------------- centre feedback bubble ------------------ */
const pulseEl = $('#pulse');
function pulse(icon, label, side) {
  pulseEl.innerHTML = '';
  pulseEl.appendChild(document.createTextNode(icon));
  if (label) { const s = document.createElement('small'); s.textContent = label; pulseEl.appendChild(s); }
  pulseEl.className = side || '';
  void pulseEl.offsetWidth;                 // restart the animation
  pulseEl.className = (side || '') + ' go';
}

/* ------------------------------ goto box --------------------------- */
/* jump straight to a timestamp: "83", "1:23", "1:23.5" or "0:01:23" */
const gotoEl = $('#goto');
function parseTime(str) {
  const raw = String(str).trim().replace(/[：]/g, ':').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  if (!raw) return null;
  if (!/^[0-9:.]+$/.test(raw)) return null;
  const parts = raw.split(':');
  if (parts.length > 3) return null;
  let sec = 0;
  for (const part of parts) {
    if (part !== '' && isNaN(parseFloat(part))) return null;
    sec = sec * 60 + (parseFloat(part) || 0);
  }
  return isFinite(sec) ? sec : null;
}
function doGoto() {
  const sec = parseTime(gotoEl.value);
  if (sec === null) { toast('時間格式：1:23 或 83'); gotoEl.select(); return; }
  if (sec > DUR) toast('這首只有 ' + fmt(DUR) + '，跳到結尾前');
  else toast('跳到 ' + fmt(sec));
  seek(Math.min(sec, DUR - .05));
  gotoEl.value = '';
  gotoEl.blur();
}
gotoEl.addEventListener('keydown', e => {
  e.stopPropagation();                       // never let shortcuts eat typing
  if (e.key === 'Enter') { e.preventDefault(); doGoto(); }
  else if (e.key === 'Escape') { gotoEl.value = ''; gotoEl.blur(); }
});
gotoEl.addEventListener('focus', () => { gotoEl.select(); wake(); });

/* ------------------------------ scrubber --------------------------- */
const hov = $('#hov'), tipT = $('#tipT'), tipL = $('#tipL'), tipEl = $('#tip');
function scrubTime(clientX) {
  const r = elScrub.getBoundingClientRect();
  return clamp((clientX - r.left) / r.width, 0, 1) * DUR;
}
function showTip(clientX) {
  if (!LY) return;
  const r = elScrub.getBoundingClientRect();
  const x = clamp(clientX - r.left, 0, r.width);
  const t = x / r.width * DUR;
  hov.style.left = x + 'px';
  const i = lineAt(t - OFFSET);
  tipT.textContent = fmt(t);
  tipL.textContent = i >= 0 ? LY.lines[i].text : '';
  // keep the bubble inside the bar so it never runs off a phone screen
  const half = (tipEl.offsetWidth || 120) / 2;
  tipEl.style.left = clamp(x, half, r.width - half) + 'px';
  elScrub.classList.add('show');
}
let scrubbing = false;
elScrub.addEventListener('pointerdown', e => {
  if (e.button !== undefined && e.button !== 0) return;
  scrubbing = true;
  try { elScrub.setPointerCapture(e.pointerId); } catch (err) { }
  seek(scrubTime(e.clientX)); showTip(e.clientX);
});
elScrub.addEventListener('pointermove', e => {
  if (scrubbing) seek(scrubTime(e.clientX));
  if (scrubbing || e.pointerType === 'mouse') showTip(e.clientX);
});
const endScrub = () => {
  if (!scrubbing) return;
  scrubbing = false;
  setTimeout(() => { if (!scrubbing && !elScrub.matches(':hover')) elScrub.classList.remove('show'); }, 700);
};
elScrub.addEventListener('pointerup', endScrub);
elScrub.addEventListener('pointercancel', endScrub);
elScrub.addEventListener('pointerleave', () => { if (!scrubbing) elScrub.classList.remove('show'); });
elScrub.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault(); e.stopPropagation();
    seekBy((e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? SKIP_BIG : 5));
  }
});

/* --------------------- stage gestures (tap / double tap) ----------- */
/* Tap = play / pause (or just bring the controls back when they are
   hidden); double tap on the left / right third = −10 / +10 s, double
   tap in the middle = fullscreen. Same rules for mouse and touch. */
let tapT = 0, tapX = 0, tapTimer = null, idleAtDown = false;
// the canvas hears pointerdown before the window-level wake() clears .idle
cvs.addEventListener('pointerdown', () => { idleAtDown = document.body.classList.contains('idle'); });
cvs.addEventListener('pointerup', e => {
  if (e.button !== undefined && e.button !== 0) return;
  const now = performance.now();
  const wasIdle = idleAtDown;
  const zone = e.clientX < innerWidth / 3 ? -1 : e.clientX > innerWidth * 2 / 3 ? 1 : 0;
  if (now - tapT < 320 && Math.abs(e.clientX - tapX) < 80) {
    clearTimeout(tapTimer); tapTimer = null; tapT = 0;
    if (zone) seekBy(zone * SKIP);
    else toggleFull();
    return;
  }
  tapT = now; tapX = e.clientX;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => {
    tapTimer = null;
    if (wasIdle && e.pointerType !== 'mouse') return;     // first touch only reveals the UI
    toggle();
    pulse(playing ? '▶' : '❚❚');
  }, 260);
});
cvs.addEventListener('dblclick', e => e.preventDefault());

/* ----------------------------- song picker ------------------------- */
const grid = $('#grid');
function paintCards() {
  const kids = grid.children;
  for (let i = 0; i < kids.length; i++) {
    kids[i].classList.toggle('cur', i === songIdx);
    kids[i].setAttribute('aria-current', i === songIdx ? 'true' : 'false');
  }
}
function buildCards() {
  CAT.forEach((s, i) => {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'card';
    c.innerHTML = '<div class="bar"></div><div class="now">● 目前</div><div class="n"></div><div class="t"></div>' +
                  '<div class="c"></div><div class="m"></div>';
    c.querySelector('.n').textContent = String(i + 1).padStart(2, '0');
    c.querySelector('.t').textContent = s.title;
    c.querySelector('.c').textContent = s.cast || '';
    c.querySelector('.m').innerHTML =
      `<span>${fmt(s.dur)}</span><span>${s.lines} 句</span><span>${Math.round(s.bpm)} BPM</span>`;
    c.querySelector('.bar').style.background = rgb((THEMES[s.theme] || THEMES.wed).a1, .9);
    c.setAttribute('aria-label', `${i + 1}. ${s.title} · ${s.cast || ''} · ${fmt(s.dur)}`);
    c.onclick = () => {
      hideList();
      if (i === songIdx && SONG && SONG.id === s.id) { if (!playing) play(); }
      else loadSong(i, true);
    };
    grid.appendChild(c);
  });
}
// arrow keys walk the card grid
grid.addEventListener('keydown', e => {
  const cards = [...grid.children], i = cards.indexOf(document.activeElement);
  if (i < 0) return;
  const cols = Math.max(1, Math.round(grid.clientWidth / (cards[0].offsetWidth + 10)));
  const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
  if (d === undefined) return;
  e.preventDefault(); e.stopPropagation();
  const n = cards[clamp(i + d, 0, cards.length - 1)];
  n.focus(); n.scrollIntoView({ block: 'nearest' });
});
function listOpen() { return !elStart.classList.contains('gone'); }
function showList() {
  elStart.classList.remove('gone'); $('#bList').classList.add('on');
  paintResume();
  const c = grid.children[songIdx];
  if (c) setTimeout(() => { c.focus({ preventScroll: true }); c.scrollIntoView({ block: 'nearest' }); }, 60);
}
function hideList() {
  elStart.classList.add('gone'); $('#bList').classList.remove('on');
  if (elStart.contains(document.activeElement)) document.activeElement.blur();
  wake();
}
function toggleList() { listOpen() ? hideList() : showList(); }
$('#bList').onclick = toggleList;

/* ------------------------ resume where you left ------------------- */
let resumeAt = 0, resumeSaved = 0;
function saveResume(force, t) {
  if (!SONG) return;
  const now = performance.now();
  if (!force && now - resumeSaved < 2000) return;
  resumeSaved = now;
  PREF.set('song', SONG.id);
  PREF.set('pos', (t === undefined ? clock : t).toFixed(1));
}
setInterval(() => { if (playing) saveResume(false); }, 2500);
addEventListener('pagehide', () => saveResume(true));
document.addEventListener('visibilitychange', () => { if (document.hidden) saveResume(true); });

function paintResume() {
  const b = $('#resume');
  const entry = CAT[songIdx];
  const t = SONG ? clock : resumeAt;
  if (!entry || playing || !(t > 3)) { b.hidden = true; return; }
  b.hidden = false;
  $('#resumeName').textContent = '繼續播放 ' + entry.title;
  $('#resumeTime').textContent = fmt(t) + ' / ' + fmt(entry.dur);
}
$('#resume').onclick = () => { hideList(); play(); };

/* ------------------------------ panels ----------------------------- */
function setPanel(on) {
  elPanel.classList.toggle('hide', !on);
  $('#bLyr').classList.toggle('on', on);
  PREF.set('panel', on ? '1' : '0');
  safeAt = -1e9;
}
$('#bLyr').onclick = () => {
  const on = elPanel.classList.contains('hide');
  setPanel(on);
  if (innerWidth <= 820) toast('小螢幕不顯示側邊歌詞');
  else toast(on ? '顯示側邊歌詞' : '隱藏側邊歌詞');
};

function fsEl() { return document.fullscreenElement || document.webkitFullscreenElement; }
function toggleFull() {
  const de = document.documentElement;
  try {
    if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else {
      const req = de.requestFullscreen || de.webkitRequestFullscreen;
      if (!req) { toast('這個裝置不支援全螢幕'); return; }
      const p = req.call(de);
      if (p && p.catch) p.catch(() => toast('無法進入全螢幕'));
    }
  } catch (e) { toast('無法進入全螢幕'); }
}
function paintFull() { $('#bFull').classList.toggle('on', !!fsEl()); }
document.addEventListener('fullscreenchange', paintFull);
document.addEventListener('webkitfullscreenchange', paintFull);
$('#bFull').onclick = toggleFull;

function setQuality(q, byHand) {
  QUAL = clamp(q, 0, 2);
  if (byHand) qualByHand = true;
  lowFps = 0;
  $('#qName').textContent = QNAME[QUAL];
  PREF.set('qual', QUAL);
  resize();
}
$('#bQual').onclick = () => {
  setQuality((QUAL + 2) % 3, true);
  toast('畫質：' + QNAME[QUAL]);
};
$('#bEdit').onclick = () => toggleEditor();

function helpOpen() { return elHelp.classList.contains('on'); }
function toggleHelp(on) {
  on = on === undefined ? !helpOpen() : on;
  elHelp.classList.toggle('on', on);
  $('#bHelp').classList.toggle('on', on);
  if (on) $('#helpClose').focus(); else wake();
}
$('#bHelp').onclick = () => toggleHelp();
$('#helpClose').onclick = () => toggleHelp(false);
elHelp.addEventListener('click', e => { if (e.target === elHelp) toggleHelp(false); });

let toastT = null;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1900);
}

/* ------------------------- OS media controls ---------------------- */
/* lock screen / headset / keyboard media keys (Android app, desktop) */
function updateMediaSession() {
  if (!('mediaSession' in navigator) || !SONG) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: SONG.title, artist: SONG.cast || '鋒兄', album: '鋒兄宇宙 · 3D MV'
    });
  } catch (e) { }
}
(function initMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession;
  const on = (a, f) => { try { ms.setActionHandler(a, f); } catch (e) { } };
  on('play', () => play());
  on('pause', () => pause());
  on('previoustrack', prevSong);
  on('nexttrack', () => loadSong(songIdx + 1, true));
  on('seekbackward', d => seekBy(-((d && d.seekOffset) || SKIP)));
  on('seekforward', d => seekBy((d && d.seekOffset) || SKIP));
  on('seekto', d => { if (d && isFinite(d.seekTime)) seek(d.seekTime); });
})();

/* --------------------------- sync editor --------------------------- */
function toggleEditor() {
  editing = !editing;
  $('#editor').classList.toggle('on', editing);
  $('#bEdit').classList.toggle('on', editing);
  if (editing) {
    editIdx = Math.max(0, lineAt(clock - OFFSET));
    paintEditor(); toast('校時模式：用空白鍵敲每一句的開始');
  } else toast('離開校時模式');
}
function paintEditor() {
  if (!LY) return;
  const c = LY.lines[editIdx], n = LY.lines[editIdx + 1];
  $('#eCur').textContent = c
    ? `${String(editIdx + 1).padStart(2, '0')}. ${c.text}　[${c.t.toFixed(2)}s]` : '（已到結尾）';
  $('#eNx').textContent = n ? `下一句 → ${n.text}` : '—';
}
function persist() {
  store.set(keyT(), JSON.stringify(LY.lines.map(l => l.t)));
  store.set(keyO(), String(OFFSET));
}
function tapSync() {
  if (editIdx >= LY.lines.length) return;
  LY.lines[editIdx].t = Math.max(0, clock - OFFSET);
  recomputeDur(); persist();
  editIdx = Math.min(LY.lines.length, editIdx + 1);
  paintEditor(); lastIdx = -2;
}
function nudge(d) {
  const l = LY.lines[Math.min(editIdx, LY.lines.length - 1)];
  if (!l) return;
  l.t = Math.max(0, l.t + d);
  recomputeDur(); persist(); paintEditor(); lastIdx = -2;
}
function shiftAll(d) {
  OFFSET = Math.round((OFFSET + d) * 10) / 10;
  persist(); lastIdx = -2;
  toast('整體歌詞位移 ' + (OFFSET > 0 ? '+' : '') + OFFSET.toFixed(1) + 's');
}
function mmss(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}
function download(name, text) {
  const b = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
$('#eLrc').onclick = () => {
  const head = [`[ti:${LY.title}]`, `[ar:${LY.cast || ''}]`, '[al:]', '[by:]', '[offset:0]', ''];
  download(SONG.id + '.lrc',
    head.concat(LY.lines.map(l => `[${mmss(l.t + OFFSET)}]${l.text}`)).join('\n') + '\n');
  toast('已匯出 ' + SONG.id + '.lrc');
};
$('#eRst').onclick = () => {
  if (!confirm('確定要清除這首歌的校時與位移，還原成原始時間軸？')) return;
  store.del(keyT()); store.del(keyO());
  // restore in place instead of asking for a reload
  const t = clock, was = playing;
  applySong(SONG, false, t);
  if (was) play();
  toast('已還原原始時間軸');
};

/* drop an .lrc onto the page to apply your own timings */
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => {
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (!f) return;
  if (!/\.lrc$/i.test(f.name)) { toast('只接受 .lrc 歌詞檔'); return; }
  const r = new FileReader();
  r.onload = () => {
    const times = [];
    String(r.result).split(/\r?\n/).forEach(line => {
      const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
      if (m && m[3].trim()) times.push(+m[1] * 60 + parseFloat(m[2]));
    });
    if (!times.length) return toast('讀不到時間標籤');
    times.forEach((t, i) => { if (LY.lines[i]) LY.lines[i].t = t; });
    recomputeDur(); persist(); lastIdx = -2;
    toast(`已套用 ${Math.min(times.length, LY.lines.length)} 句時間軸`);
  };
  r.readAsText(f, 'utf-8');
});

/* ----------------------------- keyboard ---------------------------- */
addEventListener('keydown', e => {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;       // leave browser shortcuts alone
  // some IMEs / virtual keyboards report an empty key for the space bar
  const k = e.code === 'Space' ? ' ' : (e.key || '').toLowerCase();

  if (k === 'escape') {
    if (helpOpen()) toggleHelp(false);
    else if (listOpen()) { if (SONG) hideList(); }
    else if (editing) toggleEditor();
    return;
  }
  if (k === '?' || (k === '/' && e.shiftKey)) { toggleHelp(); return; }
  if (helpOpen()) return;

  // the picker is a grid of buttons: let Enter / Space click the focused card
  const onCard = listOpen() && e.target && e.target.classList && e.target.classList.contains('card');
  if (onCard && (k === ' ' || k === 'enter')) return;

  if (k === ' ' || k === 'k') {
    e.preventDefault();
    if (listOpen()) { hideList(); if (!playing) play(); return; }
    if (editing) tapSync(); else { toggle(); pulse(playing ? '❚❚' : '▶'); }
  }
  else if (k === 'arrowleft') { e.preventDefault(); editing ? nudge(-.1) : seekBy(-(e.shiftKey ? SKIP_BIG : SKIP)); }
  else if (k === 'arrowright') { e.preventDefault(); editing ? nudge(.1) : seekBy(e.shiftKey ? SKIP_BIG : SKIP); }
  else if (k === 'arrowup') { if (listOpen()) return; e.preventDefault(); setVolume(volume + .05, true); }
  else if (k === 'arrowdown') { if (listOpen()) return; e.preventDefault(); setVolume(volume - .05, true); }
  else if (k === 'home') { e.preventDefault(); seek(0); pulse('⏮', '0:00'); }
  else if (/^[0-9]$/.test(k)) { seek(DUR * (+k) / 10); pulse('⏩', k + '0%'); }
  else if (k === 'm') toggleMute();
  else if (k === 'r') cycleLoop();
  else if (k === 'z' && editing) { editIdx = Math.max(0, editIdx - 1); paintEditor(); }
  else if (k === '[') shiftAll(-.1);
  else if (k === ']') shiftAll(.1);
  else if (k === 'l') $('#bLyr').click();
  else if (k === 'f') toggleFull();
  else if (k === 'q') $('#bQual').click();
  else if (k === 'e') toggleEditor();
  else if (k === 's') toggleList();
  else if (k === 'n') loadSong(songIdx + 1, true);
  else if (k === 'p') prevSong();
});

/* idle chrome hiding */
let idleT = null;
function wake() {
  document.body.classList.remove('idle');
  clearTimeout(idleT);
  idleT = setTimeout(() => {
    if (playing && !editing && !listOpen() && !helpOpen() && !scrubbing
        && !$('#bottom').matches(':hover')
        && document.activeElement !== gotoEl && document.activeElement !== volEl) document.body.classList.add('idle');
  }, 2800);
}
addEventListener('mousemove', wake); addEventListener('keydown', wake);
addEventListener('pointerdown', wake); addEventListener('touchstart', wake, { passive: true });
wake();

/* ------------------------------ boot ------------------------------- */
window.__mv = {
  seek: seek, play: play, pause: pause, toggle: toggle,
  load: i => { hideList(); loadSong(i, true); },
  state: () => ({ song: SONG && SONG.id, t: clock, playing: playing, fps: fpsShow, qual: QUAL,
                  vol: volume, muted: muted, loop: loopMode }),
  prof: secs => new Promise(res => {
    profAcc = {}; profN = 0; profOn = true;
    setTimeout(() => {
      profOn = false;
      const out = { frames: profN, fps: fpsShow };
      for (const k in profAcc) out[k] = +(profAcc[k] / profN).toFixed(2);
      res(out);
    }, (secs || 2) * 1000);
  })
};

buildGrain();
buildCards();
resize();
$('#qName').textContent = QNAME[QUAL];
applyVolume(false);
paintLoop();
setPanel(PREF.str('panel', '1') === '1');
$('#bList').classList.add('on');
if (!document.documentElement.requestFullscreen && !document.documentElement.webkitRequestFullscreen) {
  $('#bFull').style.display = 'none';                     // iPhone Safari has no fullscreen API
}
if (CAT.length) {
  // come back to the song (and the spot in it) the viewer left
  const lastId = PREF.str('song', '');
  let startIdx = CAT.findIndex(s => s.id === lastId);
  resumeAt = 0;
  if (startIdx < 0) startIdx = 0;
  else {
    const pos = PREF.num('pos', 0);
    if (pos > 3 && pos < CAT[startIdx].dur - 5) resumeAt = pos;
  }
  songIdx = startIdx;
  paintResume();
  loadSong(startIdx, false, resumeAt);
}
requestAnimationFrame(frame);

})();
