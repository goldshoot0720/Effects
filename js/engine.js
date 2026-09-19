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
let QUAL = 2;
const QNAME = ['低', '中', '高'];

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, QUAL === 2 ? 1.6 : 1.15);
  W = Math.floor(innerWidth * DPR); H = Math.floor(innerHeight * DPR);
  cvs.width = W; cvs.height = H;
  CX = W / 2; CY = H / 2; MIN = Math.min(W, H);
  bA.width = Math.max(256, Math.floor(W * .5)); bA.height = Math.max(256, Math.floor(H * .5));
  const bs = QUAL === 2 ? .25 : .18;
  bB.width = Math.max(256, Math.floor(W * bs)); bB.height = Math.max(256, Math.floor(H * bs));
  buildStars(); layoutCache.clear(); drawWave();
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
  const amp = S(10) * (F.punch * 1.4 + F.bass * .5);
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
  const k = (CAM.fov * DPR) / Z;
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
const layoutCache = new Map();
function layout(line, size) {
  const key = line.text + '|' + size;
  let L = layoutCache.get(key);
  if (L) return L;
  font(size, 900);
  const chars = [...line.text];
  const ws = chars.map(c => ctx.measureText(c).width);
  const gap = size * .02;
  const total = ws.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
  let x = -total / 2;
  const pos = ws.map(w => { const c = x + w / 2; x += w + gap; return c; });
  if (layoutCache.size > 400) layoutCache.clear();
  L = { chars: chars, pos: pos, total: total, mask: keyMask(line.text) };
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

function drawLine(line, t, yBase, opts) {
  const chorus = line.kind === 'chorus';
  const probe = layout(line, 100);
  const size = Math.min(chorus ? MIN * .088 : MIN * .072,
                        W * (chorus ? .86 : .82) / (probe.total / 100));
  const L = layout(line, size);

  const age = t - line.t;
  const IN = .95, OUT = .5;
  const outAt = (opts && opts.outAt !== undefined) ? opts.outAt : line.t + line.d;
  const preset = PRESETS[(line.idx || 0) % PRESETS.length];
  const stagger = Math.min(.05, .55 / Math.max(1, L.chars.length));
  const ga = (opts && opts.alpha !== undefined) ? opts.alpha : 1;
  if (ga <= .01) return;
  const outP = t > outAt ? clamp((t - outAt) / OUT, 0, 1) : 0;

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
    let x = L.pos[i], y = 0;

    switch (preset) {
      case 'zoom':
        o.z = (1 - e) * 1700; o.ry = (1 - e) * .9; o.alpha = p;
        o.trail = 1 - p; o.tx = -L.pos[i] * .12 * (1 - p); break;
      case 'drop':
        y = -(1 - eb) * MIN * .32; o.rx = (1 - e) * 1.4; o.alpha = p;
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
        o.alpha = p; y = Math.sin(t * 3.4 - i * .45) * size * .12 * (.4 + F.mid);
        o.rz = Math.sin(t * 2.2 - i * .4) * .06; break;
      default:
        o.alpha = p; o.scale = lerp(1.4, 1, e); break;
    }

    const settled = clamp((a0 - IN) / .6, 0, 1);
    o.scale *= 1 + F.punch * (chorus ? .13 : .07) * (1 - settled * .35) + Math.sin(t * 1.6 + i) * .008;
    y += Math.sin(t * 1.25 + i * .5) * size * .022 * settled;
    o.glow += F.punch * .5;
    o.split = F.flash * (chorus ? .55 : .25);

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
    glyph(ch, CX + x + CAM.shx * .6, yBase + y + CAM.shy * .6, size, o);
  }

  if (chorus && outP === 0) {             // lower-third rule under chorus lines
    const p = clamp(age / .8, 0, 1);
    const w = L.total * easeOut(p) * .5;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(CX - w, 0, CX + w, 0);
    g.addColorStop(0, rgb(P.a2, 0)); g.addColorStop(.5, rgb(P.a2, .55 * ga)); g.addColorStop(1, rgb(P.a2, 0));
    ctx.fillStyle = g;
    ctx.fillRect(CX - w, yBase + size * .78, w * 2, Math.max(1, S(2)));
    ctx.restore();
  }
}

/* ------------------------- title / credit cards -------------------- */
function drawCard(text, cy, size, t, t0, t1, style) {
  if (!text || t < t0 - .05 || t > t1 + .05) return;
  const IN = style === 'logo' ? 1.1 : .8, OUT = .9;
  const chars = [...text];
  font(size, 900);
  const ws = chars.map(c => ctx.measureText(c).width);
  const gap = style === 'num' ? size * .3 : size * .02;
  const total = ws.reduce((s, w) => s + w, 0) + gap * (chars.length - 1);
  const outP = clamp((t - (t1 - OUT)) / OUT, 0, 1);
  let x = CX - total / 2;
  for (let i = 0; i < chars.length; i++) {
    const p = clamp((t - t0 - i * (style === 'logo' ? .13 : .07)) / IN, 0, 1);
    const e = easeOut(p), oe = easeOut(outP);
    if (p > 0) glyph(chars[i], x + ws[i] / 2 + CAM.shx * .5, cy + CAM.shy * .5, size, {
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
  const a = clamp((t - t0) / IN, 0, 1) * (1 - outP);
  const sw = ((t - t0 - .4) % 3.4) / 1.2;
  if (sw > 0 && sw < 1 && a > .1) {         // light sweep
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gx = lerp(CX - total * .75, CX + total * .75, sw);
    const g = ctx.createLinearGradient(gx - MIN * .1, 0, gx + MIN * .1, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(.5, `rgba(255,255,255,${.14 * a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(CX - total * .85, cy - size * .8, total * 1.7, size * 1.6);
    ctx.restore();
  }
}
function caption(text, cy, size, alpha, col) {
  if (alpha <= .01 || !text) return;
  ctx.save();
  font(size, 400);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = rgb(col || P.a1, alpha);
  ctx.shadowColor = rgb(col || P.a1, alpha * .6); ctx.shadowBlur = size * .5;
  ctx.fillText(text, CX + CAM.shx * .4, cy + CAM.shy * .4);
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
  } else if (end >= 3) {
    cards.push({ kind: 'logo', text: LY.title, t0: .35, t1: end, y: -.02, size: .105 });
  } else {
    // no room at all: run the logo as an upper third over the first lines
    cards.push({ kind: 'logo', text: LY.title, t0: .2, t1: 6.5, y: -.25, size: .062 });
  }
  INTRO = { end: Math.max(end, 4), cards: cards };
}
function drawIntro(t) {
  const cards = INTRO.cards;
  if (!cards.length || t > cards[cards.length - 1].t1 + .2) return;
  for (const c of cards) {
    const size = MIN * c.size * (c.text && c.text.length > 10 ? .68 : 1);
    drawCard(c.text, CY + MIN * c.y, size, t, c.t0, c.t1, c.kind);
    if (c.kind === 'logo') {
      const w = c.t1 - c.t0;
      const s1 = clamp((t - c.t0 - w * .28) / .9, 0, 1) * clamp((c.t1 - .7 - t) / .8, 0, 1);
      caption(LY.cast, CY + MIN * (c.y + .1), MIN * .022, s1 * .55, P.ink);
    }
  }
}
function drawOutro(t) {
  const a = clamp((t - LAST_END - .6) / 1.4, 0, 1) * clamp((DUR - t) / 1.2, 0, 1);
  if (a <= .01) return;
  const size = MIN * .09 * (LY.title.length > 10 ? .68 : 1);
  const title = [...LY.title];
  font(size, 900);
  const ws = title.map(c => ctx.measureText(c).width);
  const total = ws.reduce((s, w) => s + w, 0);
  let x = CX - total / 2;
  for (let i = 0; i < title.length; i++) {
    glyph(title[i], x + ws[i] / 2, CY - MIN * .02, size, {
      scale: 1, alpha: a, z: 0, rz: 0, rx: 0, ry: Math.sin(t * .6 + i * .3) * .12,
      depth: 12, col: P.ink, col2: P.a2, dark: [70, 18, 8],
      glow: .5, trail: 0, tx: 0, ty: 0, split: 0, stroke: .2
    });
    x += ws[i];
  }
  caption(LY.cast, CY + MIN * .075, MIN * .022, a * .8);
  caption(LY.tagline, CY + MIN * .12, MIN * .018, a * .45, P.ink);
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
function post() {
  // bloom: downscale twice (bilinear filtering IS the blur) and multiply the
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
  if (F.flash > .02) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgb(P.a2, F.flash * .045);
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
  s.src = 'data/song/' + id + '.js';
  s.onload = () => {
    const d = window.MV_SONG_DATA && window.MV_SONG_DATA[id];
    if (d) cb(d); else toast('資料格式有誤：' + id);
  };
  s.onerror = () => toast('載入失敗：data/song/' + id + '.js');
  document.head.appendChild(s);
}

function applySong(d, autoplay) {
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
  clock = 0; resetOnsets(0);
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
  if (autoplay) play(); else { playing = false; $('#play').textContent = '▶'; }
}

function loadSong(idx, autoplay) {
  if (!CAT.length) return;
  songIdx = (idx % CAT.length + CAT.length) % CAT.length;
  const entry = CAT[songIdx];
  ensureData(entry.id, d => { applySong(d, autoplay); toast(entry.title); });
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
      CAM.whip = (Math.random() < .5 ? -1 : 1) * .34;
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

  /* ---- lyrics ---- */
  drawIntro(lt);
  const yMain = CY + MIN * .1;
  if (curIdx >= 0) {
    const cur = LY.lines[curIdx], prev = LY.lines[curIdx - 1];
    const outAt = cur.t + cur.d;
    if (prev && lt < prev.t + prev.d + .75) {
      drawLine(prev, lt, yMain - MIN * .12, {
        alpha: clamp(1 - (lt - (prev.t + prev.d)) / .7, 0, 1) * .35, outAt: prev.t + prev.d
      });
    }
    if (lt < outAt + .55) drawLine(cur, lt, yMain, { outAt: outAt });
    const nx = LY.lines[curIdx + 1];
    if (nx && nx.t - lt < 1.1 && lt > outAt - .2) {
      caption(nx.text, yMain + MIN * .11, MIN * .026,
              clamp(1 - (nx.t - lt) / 1.1, 0, 1) * .22, P.ink);
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
    $('#fps').textContent = fpsShow + ' FPS';
  }
  $('#actTag').textContent = ACT_LABEL[act] || '';
  updateTransport(t, curIdx);
}

/* ============================ UI / TRANSPORT ======================= */
const elHead = $('#head'), elTime = $('#time'), elNow = $('#now'), elPlay = $('#play');
function updateTransport(t, idx) {
  elHead.style.left = (clamp(t / DUR, 0, 1) * 100) + '%';
  elTime.textContent = `${fmt(t)} / ${fmt(DUR)}`;
  if (idx !== lastIdx) {
    lastIdx = idx;
    elNow.textContent = idx >= 0 ? LY.lines[idx].text : '';
    paintPanel(idx);
    if (editing) paintEditor();
  }
}

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
    d.onclick = () => seek(l.t + OFFSET);
    wrap.appendChild(d); rows.push(d);
  });
}
function paintPanel(idx) {
  rows.forEach((r, i) => { r.className = 'l' + (i === idx ? ' cur' : i < idx ? ' done' : ''); });
  if (idx >= 0 && rows[idx]) wrap.style.transform = `translateY(${-rows[idx].offsetTop + innerHeight * .34}px)`;
}

function drawWave() {
  const c = $('#wave'), g = c.getContext('2d');
  const w = c.clientWidth || 800, h = c.clientHeight || 46, d = Math.min(devicePixelRatio || 1, 2);
  c.width = w * d; c.height = h * d;
  g.setTransform(d, 0, 0, d, 0, 0);
  g.clearRect(0, 0, w, h);
  if (!RMSA) return;
  const n = Math.floor(w);
  for (let i = 0; i < n; i++) {
    const f0 = Math.floor(i / n * RMSA.length), f1 = Math.floor((i + 1) / n * RMSA.length);
    let mx = 0;
    for (let f = f0; f < f1; f++) mx = Math.max(mx, RMSA[f]);
    const v = Math.pow(mx / 255, 1.25) * (h * .8);
    const grd = g.createLinearGradient(0, h / 2 - v / 2, 0, h / 2 + v / 2);
    grd.addColorStop(0, 'rgba(255,210,74,.55)');
    grd.addColorStop(.5, 'rgba(255,255,255,.28)');
    grd.addColorStop(1, 'rgba(255,59,107,.5)');
    g.fillStyle = grd;
    g.fillRect(i, h / 2 - v / 2, 1, v);
  }
  const M = $('#marks'); M.innerHTML = '';
  SEC.forEach(s => {
    const bar = document.createElement('i');
    bar.style.left = (s.start / DUR * 100) + '%'; M.appendChild(bar);
    const lab = document.createElement('b');
    lab.style.left = (s.start / DUR * 100) + '%';
    lab.textContent = ACT_LABEL[s.kind]; M.appendChild(lab);
  });
}

function play() { audio.play().then(() => { playing = true; elPlay.textContent = '❚❚'; }).catch(() => { }); }
function pause() { audio.pause(); playing = false; elPlay.textContent = '▶'; }
function toggle() { playing ? pause() : play(); }
function seek(t) {
  t = clamp(t, 0, DUR - .05);
  audio.currentTime = t; clock = t;
  resetOnsets(t); parts.length = 0; waves.length = 0; pillars.length = 0; lastIdx = -2;
}
audio.addEventListener('ended', () => {
  playing = false; elPlay.textContent = '▶';
  loadSong(songIdx + 1, true);                  // auto-advance through the album
});
elPlay.onclick = toggle;
$('#bPrev').onclick = () => loadSong(songIdx - 1, true);
$('#bNext').onclick = () => loadSong(songIdx + 1, true);

const scrub = $('#scrub'), hov = $('#hov');
scrub.addEventListener('pointerdown', e => {
  const r = scrub.getBoundingClientRect();
  seek((e.clientX - r.left) / r.width * DUR);
  const mv = ev => seek((ev.clientX - r.left) / r.width * DUR);
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
});
scrub.addEventListener('pointermove', e => {
  const r = scrub.getBoundingClientRect();
  hov.style.left = (e.clientX - r.left) + 'px';
});

/* ----------------------------- song picker ------------------------- */
const grid = $('#grid');
function paintCards() {
  const kids = grid.children;
  for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('cur', i === songIdx);
}
function buildCards() {
  CAT.forEach((s, i) => {
    const c = document.createElement('div');
    c.className = 'card';
    c.innerHTML = '<div class="bar"></div><div class="n"></div><div class="t"></div>' +
                  '<div class="c"></div><div class="m"></div>';
    c.querySelector('.n').textContent = String(i + 1).padStart(2, '0');
    c.querySelector('.t').textContent = s.title;
    c.querySelector('.c').textContent = s.cast || '';
    c.querySelector('.m').innerHTML =
      `<span>${fmt(s.dur)}</span><span>${s.lines} 句</span><span>${Math.round(s.bpm)} BPM</span>`;
    c.querySelector('.bar').style.background = rgb((THEMES[s.theme] || THEMES.wed).a1, .9);
    c.onclick = () => { hideList(); loadSong(i, true); };
    grid.appendChild(c);
  });
}
function showList() { $('#start').classList.remove('gone'); $('#bList').classList.add('on'); }
function hideList() { $('#start').classList.add('gone'); $('#bList').classList.remove('on'); }
function toggleList() { $('#start').classList.contains('gone') ? showList() : hideList(); }
$('#bList').onclick = toggleList;

$('#bLyr').onclick = () => {
  $('#panel').classList.toggle('hide');
  $('#bLyr').classList.toggle('on', !$('#panel').classList.contains('hide'));
};
$('#bFull').onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
};
$('#bQual').onclick = () => {
  QUAL = (QUAL + 2) % 3;
  $('#bQual').textContent = '畫質 Q · ' + QNAME[QUAL];
  resize();
};
$('#bEdit').onclick = () => toggleEditor();

let toastT = null;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1700);
}

/* --------------------------- sync editor --------------------------- */
function toggleEditor() {
  editing = !editing;
  $('#editor').classList.toggle('on', editing);
  $('#bEdit').classList.toggle('on', editing);
  if (editing) {
    editIdx = Math.max(0, lineAt(clock - OFFSET));
    paintEditor(); toast('校時模式：用空白鍵敲每一句的開始');
  }
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
  store.del(keyT()); store.del(keyO());
  toast('已清除此首的校時，重新整理後還原');
};

/* drop an .lrc onto the page to apply your own timings */
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => {
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (!f || !/\.lrc$/i.test(f.name)) return;
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
    toast(`已套用 ${times.length} 句時間軸`);
  };
  r.readAsText(f, 'utf-8');
});

/* ----------------------------- keyboard ---------------------------- */
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); editing ? tapSync() : toggle(); }
  else if (k === 'arrowleft') { e.preventDefault(); editing ? nudge(-.1) : seek(clock - 5); }
  else if (k === 'arrowright') { e.preventDefault(); editing ? nudge(.1) : seek(clock + 5); }
  else if (k === 'z' && editing) { editIdx = Math.max(0, editIdx - 1); paintEditor(); }
  else if (k === '[') { OFFSET -= .1; persist(); toast('整體位移 ' + OFFSET.toFixed(1) + 's'); lastIdx = -2; }
  else if (k === ']') { OFFSET += .1; persist(); toast('整體位移 ' + OFFSET.toFixed(1) + 's'); lastIdx = -2; }
  else if (k === 'l') $('#bLyr').click();
  else if (k === 'f') $('#bFull').click();
  else if (k === 'q') $('#bQual').click();
  else if (k === 'e') toggleEditor();
  else if (k === 's') toggleList();
  else if (k === 'escape') hideList();
  else if (k === 'n') loadSong(songIdx + 1, true);
  else if (k === 'p') loadSong(songIdx - 1, true);
});

/* idle chrome hiding */
let idleT = null;
function wake() {
  document.body.classList.remove('idle');
  clearTimeout(idleT);
  idleT = setTimeout(() => {
    if (playing && !editing && $('#start').classList.contains('gone')) document.body.classList.add('idle');
  }, 2600);
}
addEventListener('mousemove', wake); addEventListener('keydown', wake); wake();

/* ------------------------------ boot ------------------------------- */
window.__mv = {
  seek: seek, play: play, pause: pause, toggle: toggle,
  load: i => { hideList(); loadSong(i, true); },
  state: () => ({ song: SONG && SONG.id, t: clock, playing: playing, fps: fpsShow, qual: QUAL }),
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
$('#bQual').textContent = '畫質 Q · ' + QNAME[QUAL];
$('#bLyr').classList.add('on');
$('#bList').classList.add('on');
if (CAT.length) loadSong(0, false);
requestAnimationFrame(frame);

})();
