/* =====================================================================
   最瞎結婚理由 — 3D motion-graphics music video engine
   Pure canvas 2D + a hand-rolled perspective camera. No dependencies,
   runs straight from file:// (audio spectrum is pre-baked in data/).
   ===================================================================== */
(function () {
'use strict';

/* ------------------------------ utils ------------------------------ */
const AA = window.AUDIO_ANALYSIS;
const LY = window.LYRICS;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, t) => a + (b - a) * (1 - Math.pow(1 - t, 3));
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeOutQ = t => 1 - Math.pow(1 - t, 5);
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeBack = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const rnd = (a, b) => a + Math.random() * (b - a);
const $ = s => document.querySelector(s);

function b64u8(s) {
  const bin = atob(s), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
const BANDS = b64u8(AA.bands), RMSA = b64u8(AA.rms), NB = AA.bandCount;
const DUR = AA.duration;
const BEAT = 60 / AA.bpm;              // ~0.733s
const BAR = BEAT * 4;

/* --------------------------- audio features ------------------------ */
const F = { bass: 0, low: 0, mid: 0, high: 0, level: 0, flash: 0, beat: 0, punch: 0, energy: 0 };
let onsetIdx = 0;

function bandRange(f, a, b) {
  let s = 0;
  for (let i = a; i <= b; i++) s += BANDS[f * NB + i];
  return s / ((b - a + 1) * 255);
}
function resetOnsets(t) {
  onsetIdx = 0;
  const O = AA.onsets;
  while (onsetIdx < O.length && O[onsetIdx] < t) onsetIdx++;
}
function sampleAudio(t, dt) {
  const f = clamp(Math.round(t * AA.fps), 0, AA.frames - 1);
  const tg = {
    bass: bandRange(f, 0, 2), low: bandRange(f, 3, 5),
    mid: bandRange(f, 6, 10), high: bandRange(f, 11, 15),
    level: RMSA[f] / 255
  };
  for (const k in tg) {
    const up = tg[k] > F[k];
    const r = 1 - Math.pow(1 - (up ? .55 : .12), dt * 60);
    F[k] += (tg[k] - F[k]) * r;
  }
  F.energy = F.level * .6 + F.bass * .4;

  // beat grid pulse
  const ph = ((t - AA.beat0) / BEAT) % 1;
  F.beat = Math.pow(1 - (ph < 0 ? ph + 1 : ph), 4);

  // onset driven flash
  const O = AA.onsets;
  let hit = false;
  while (onsetIdx < O.length && O[onsetIdx] <= t) { onsetIdx++; hit = true; }
  if (hit && F.flash < .55) F.flash = 1;
  F.flash *= Math.pow(.0025, dt);
  F.punch = Math.max(F.flash * .55, F.beat * F.energy);
}

/* ------------------------------ canvas ----------------------------- */
const cvs = $('#stage'), ctx = cvs.getContext('2d', { alpha: false });
// two-step downscale buffers for the bloom (much cheaper than ctx.filter blur)
const bA = document.createElement('canvas'), actx = bA.getContext('2d', { alpha: false });
const bB = document.createElement('canvas'), bctx = bB.getContext('2d', { alpha: false });
let W = 0, H = 0, CX = 0, CY = 0, DPR = 1, MIN = 800;
let QUAL = 2;                                     // 2 high / 1 medium / 0 low
const QNAME = ['低', '中', '高'];

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, QUAL === 2 ? 1.6 : 1.15);
  W = Math.floor(innerWidth * DPR); H = Math.floor(innerHeight * DPR);
  cvs.width = W; cvs.height = H;
  CX = W / 2; CY = H / 2; MIN = Math.min(W, H);
  // keep both buffers large enough that Chrome keeps them GPU-backed
  bA.width = Math.max(256, Math.floor(W * .5)); bA.height = Math.max(256, Math.floor(H * .5));
  const bs = QUAL === 2 ? .25 : .18;
  bB.width = Math.max(256, Math.floor(W * bs)); bB.height = Math.max(256, Math.floor(H * bs));
  buildStars(); drawWave();
}
addEventListener('resize', resize);

const S = v => v * (MIN / 900);                  // size helper, resolution independent
const FONT = w => `${w} ${'"Microsoft JhengHei UI","Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif'}`;
function font(px, weight) { ctx.font = `${weight || 900} ${px}px "Microsoft JhengHei UI","Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif`; }

/* ------------------------------ camera ----------------------------- */
const CAM = {
  x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, fov: 1000,
  tx: 0, ty: 0, tz: 0, tyaw: 0, tpitch: 0, troll: 0, tfov: 1000,
  shx: 0, shy: 0
};
function camUpdate(t, dt) {
  const k = 1 - Math.pow(.0001, dt);
  CAM.x = lerp(CAM.x, CAM.tx, k); CAM.y = lerp(CAM.y, CAM.ty, k);
  CAM.z = lerp(CAM.z, CAM.tz, k);
  CAM.yaw = lerp(CAM.yaw, CAM.tyaw, k); CAM.pitch = lerp(CAM.pitch, CAM.tpitch, k);
  CAM.roll = lerp(CAM.roll, CAM.troll, k); CAM.fov = lerp(CAM.fov, CAM.tfov, k);
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

/* ----------------------------- palettes ---------------------------- */
const PAL = {
  intro:  { bg: [10, 12, 32], bg2: [2, 3, 9],  a1: [53, 232, 255], a2: [255, 210, 74], ink: [255, 255, 255] },
  hook:   { bg: [14, 10, 40], bg2: [3, 3, 12], a1: [120, 150, 255], a2: [255, 210, 74], ink: [255, 255, 255] },
  verse:  { bg: [28, 10, 52], bg2: [5, 3, 14], a1: [183, 108, 255], a2: [255, 90, 170], ink: [255, 255, 255] },
  chorus: { bg: [54, 10, 24], bg2: [10, 3, 8], a1: [255, 210, 74], a2: [255, 59, 107], ink: [255, 255, 255] },
  brk:    { bg: [12, 10, 38], bg2: [3, 3, 10], a1: [255, 47, 109], a2: [255, 160, 90], ink: [255, 255, 255] },
  outro:  { bg: [18, 12, 38], bg2: [2, 3, 9],  a1: [255, 210, 74], a2: [53, 232, 255], ink: [255, 255, 255] }
};
const P = { bg: [10, 12, 32], bg2: [2, 3, 9], a1: [53, 232, 255], a2: [255, 210, 74], ink: [255, 255, 255] };
function mixPal(target, dt) {
  const k = 1 - Math.pow(.02, dt);
  for (const key in P) for (let i = 0; i < 3; i++) P[key][i] = lerp(P[key][i], target[key][i], k);
}
const rgb = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a === undefined ? 1 : a})`;

/* ------------------------------- acts ------------------------------ */
// Derive the visual "act" from the lyric section map.
const SEC = LY.sections;
const LAST_END = SEC[SEC.length - 1].end;
function actAt(t) {
  if (t < SEC[0].start - .8) return 'intro';
  if (t > LAST_END + 1.2) return 'outro';
  for (let i = 0; i < SEC.length; i++) {
    const s = SEC[i];
    if (t >= s.start - 1.6 && t <= s.end + 1.2) return s.kind;
  }
  return 'brk';
}
const ACT_LABEL = { intro: 'INTRO', hook: 'HOOK', verse: 'VERSE', chorus: 'CHORUS', brk: 'BREAK', outro: 'OUTRO' };

/* ---------------------------- star field --------------------------- */
let stars = [];
function buildStars() {
  const n = QUAL === 2 ? 560 : QUAL === 1 ? 330 : 180;
  stars = new Array(n);
  for (let i = 0; i < n; i++) stars[i] = {
    x: rnd(-2800, 2800), y: rnd(-1900, 1900), z: rnd(60, 5400),
    r: rnd(.7, 3.1), c: Math.random() < .25 ? 1 : 0
  };
}
let travel = 0;
function drawStars(t, dt, speed) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    s.z -= speed * dt;
    if (s.z < 60) { s.z += 5340; s.x = rnd(-2800, 2800); s.y = rnd(-1900, 1900); }
    const p = project(s.x, s.y, s.z);
    if (!p) continue;
    const fade = clamp(1 - s.z / 5400, 0, 1);
    const r = Math.max(.4, s.r * p.k * 1.5);
    const col = s.c ? P.a2 : P.a1;
    const a = fade * (.35 + F.level * .5);
    if (speed > 800 && r > .9) {                // motion streaks at warp speed
      const p2 = project(s.x, s.y, s.z + speed * .055);
      if (p2) {
        ctx.strokeStyle = rgb(col, a * .55);
        ctx.lineWidth = r * .8;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      }
    }
    ctx.fillStyle = s.c ? rgb(P.a2, a) : `rgba(255,255,255,${a})`;
    if (r < 1.6) { ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2); }   // cheap for specks
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
function drawGrid(t) {
  const Y = 560, FAR = 6200, STEP = 300;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = Math.max(1, S(1.4));
  const wob = (x, z) => Math.sin(z * .0035 + t * 2.2) * 40 * F.bass + Math.cos(x * .002 + t) * 18 * F.low;
  const off = (travel * .55) % STEP;
  for (let z = STEP - off; z < FAR; z += STEP) {
    const fade = Math.pow(1 - z / FAR, 1.6) * (.22 + F.low * .5);
    if (fade < .015) continue;
    ctx.beginPath(); let started = false;
    for (let x = -4200; x <= 4200; x += 700) {
      const p = project(x, Y + wob(x, z), z);
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = rgb(P.a1, fade); ctx.stroke();
  }
  for (let x = -4200; x <= 4200; x += 700) {
    ctx.beginPath(); let started = false;
    for (let z = 240; z < FAR; z += 320) {
      const p = project(x, Y + wob(x, z), z);
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
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(CX + CAM.shx * .4, CY + CAM.shy * .4);
  ctx.rotate(t * .06);
  const L = MIN * (.75 + F.level * .55);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + Math.sin(t * .3 + i) * .06;
    const w = (.010 + (i % 3 === 0 ? .022 : .006)) * (1 + F.mid * 1.8);
    const g = ctx.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L);
    const col = i % 2 ? P.a1 : P.a2;
    g.addColorStop(0, rgb(col, 0));            // keep the hot centre clean
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
for (let i = 0; i < 46; i++) bokeh.push({
  x: rnd(-1800, 1800), y: rnd(-1100, 1100), z: rnd(220, 2600),
  r: rnd(30, 150), sp: rnd(.05, .35), ph: rnd(0, TAU), c: Math.random() < .5
});
function drawBokeh(t) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const lim = QUAL === 2 ? 28 : QUAL === 1 ? 16 : 9;
  for (let i = 0; i < lim; i++) {
    const b = bokeh[i];
    const x = b.x + Math.sin(t * b.sp + b.ph) * 260;
    const y = b.y + Math.cos(t * b.sp * .8 + b.ph) * 180;
    const p = project(x, y, b.z);
    if (!p) continue;
    const r = b.r * p.k;
    if (r < 1 || r > MIN * .5) continue;      // skip screen-filling blobs
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    const col = b.c ? P.a1 : P.a2;
    g.addColorStop(0, rgb(col, .07 + F.level * .07));
    g.addColorStop(.55, rgb(col, .02));
    g.addColorStop(1, rgb(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/* --------------------------- lottery balls ------------------------- */
const BALLNUM = ['05', '03', '09', '13', '19', '23', '29', '33', '39'];
const balls = BALLNUM.map((n, i) => ({ n, a: (i / BALLNUM.length) * TAU, ph: rnd(0, TAU) }));
let ballPower = 0;                       // 0..1, ramps up when 539 is sung
function drawBalls(t) {
  if (ballPower < .01) return;
  const R = 1050, sorted = [];
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    const a = b.a + t * .22;
    const x = Math.cos(a) * R * (1 + F.bass * .12);
    const z = 2150 + Math.sin(a) * R;
    const y = 150 + Math.sin(t * 1.1 + b.ph) * 150 - ballPower * 60;
    const p = project(x, y, z);
    if (p) sorted.push({ p, b });
  }
  sorted.sort((u, v) => v.p.z - u.p.z);
  ctx.save();
  for (const it of sorted) {
    const { p, b } = it;
    const r = 56 * p.k;
    if (r < 2) continue;
    // fade balls that drift too close so they never block the lyric
    const near = clamp((p.z - 900) / 500, 0, 1);
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
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(60,10,20,${a})`;
    ctx.fillText(b.n, p.x, p.y + r * .04);
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
    const x = lerp(-1900, 1900, u);
    const y = Math.sin(u * Math.PI * 2.2 + t * 1.3) * 230 * (.5 + F.mid) - 40;
    const z = 1250 + Math.cos(u * Math.PI * 3 + t * .8) * 520;
    const p = project(x, y, z);
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
  // glowing knot travelling along the thread
  const idx = Math.floor(((t * .18) % 1) * (pts.length - 1));
  const kp = pts[idx];
  const g = ctx.createRadialGradient(kp.x, kp.y, 0, kp.x, kp.y, S(60));
  g.addColorStop(0, `rgba(255,220,220,${.9 * stringPower})`);
  g.addColorStop(1, 'rgba(255,40,80,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(kp.x, kp.y, S(60), 0, TAU); ctx.fill();
  ctx.restore();
}

/* ------------------------- confetti / 囍 particles ------------------ */
const GLYPHS = ['囍', '💍', '❤', '＄', '5', '3', '9', '✦'];
const parts = [];
function emit(n, kind) {
  const cap = QUAL === 2 ? 260 : QUAL === 1 ? 150 : 80;
  for (let i = 0; i < n && parts.length < cap; i++) {
    parts.push({
      x: rnd(-1500, 1500), y: rnd(-900, -300), z: rnd(400, 2600),
      vx: rnd(-90, 90), vy: rnd(40, 170), vz: rnd(-60, 60),
      rot: rnd(0, TAU), vr: rnd(-3, 3), life: rnd(3.4, 7),
      g: kind === 'num' ? GLYPHS[4 + ((Math.random() * 3) | 0)] : GLYPHS[(Math.random() * 4) | 0],
      s: rnd(26, 62), c: Math.random() < .5
    });
  }
}
const PBASE = 64;                       // particles share one parsed font and scale
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
    // no per-particle shadow: the bloom pass already gives these their glow
    ctx.fillStyle = rgb(p.c ? P.a2 : P.a1, a);
    ctx.fillText(p.g, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

/* ------------------------ background watermark --------------------- */
function drawWatermark(t, text, alpha) {
  if (alpha < .01) return;
  ctx.save();
  ctx.translate(CX + CAM.shx, CY + CAM.shy);
  ctx.rotate(Math.sin(t * .15) * .05);
  const sz = MIN * .42;
  font(sz, 900);
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
/* Keywords get the accent treatment (colour + extra glow + pulse).     */
const KEY = ['鋒兄', '小塗', '牙妹', '魚妹', '五三九', '539', '頭獎', '結婚', '紅線', '甜蜜', '幸福', '最瞎', '禮堂', '財神爺', '喜酒'];
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
  L = { chars, pos, total, mask: keyMask(line.text) };
  layoutCache.set(key, L);
  return L;
}

/* One glyph, drawn with fake-3D transform, extrusion, glow and RGB split */
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

  // ---- extrusion toward the vanishing point
  const dx = (x - CX) / MIN, dy = (y - CY) / MIN;
  const steps = o.depth | 0;
  if (steps > 0) {
    const ex = dx * size * .10, ey = dy * size * .10;
    for (let i = steps; i >= 1; i--) {
      const f = i / steps;
      ctx.fillStyle = `rgba(${o.dark[0]},${o.dark[1]},${o.dark[2]},${o.alpha * (.16 + .5 * (1 - f))})`;
      ctx.fillText(ch, ex * f, ey * f);
    }
  }
  // ---- motion trail
  if (o.trail > .01) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i <= 3; i++) {
      ctx.fillStyle = rgb(o.col, o.alpha * .12 * o.trail / i);
      ctx.fillText(ch, o.tx * i * .5, o.ty * i * .5);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  // ---- chromatic split on hits
  if (o.split > .02) {
    const s = o.split * size * .05;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,40,80,${o.alpha * .65})`; ctx.fillText(ch, -s, 0);
    ctx.fillStyle = `rgba(40,200,255,${o.alpha * .65})`; ctx.fillText(ch, s, 0);
    ctx.globalCompositeOperation = 'source-over';
  }
  // ---- face
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

/* Draw one lyric line at a given progress */
function drawLine(line, t, yBase, opts) {
  const chorus = line.kind === 'chorus';
  const base = chorus ? MIN * .088 : MIN * .072;
  let size = base;
  // fit to the viewport
  const probe = layout(line, 100);
  const maxW = W * (chorus ? .86 : .82);
  size = Math.min(base, maxW / (probe.total / 100));
  const L = layout(line, size);

  const age = t - line.t;
  const IN = .95, OUT = .5;
  const outT = (opts && opts.outAt !== undefined) ? opts.outAt : line.t + line.d;
  const preset = (opts && opts.preset) || PRESETS[(line.idx || 0) % PRESETS.length];
  const stagger = Math.min(.05, .55 / Math.max(1, L.chars.length));
  const globalAlpha = (opts && opts.alpha !== undefined) ? opts.alpha : 1;
  if (globalAlpha <= .01) return;

  const dying = t > outT;
  const outP = dying ? clamp((t - outT) / OUT, 0, 1) : 0;

  for (let i = 0; i < L.chars.length; i++) {
    const ch = L.chars[i];
    if (ch === ' ') continue;
    const a0 = age - i * stagger;
    let p = clamp(a0 / IN, 0, 1);
    if (p <= 0) continue;
    const e = easeOut(p), eb = easeBack(clamp(p, 0, 1));
    const o = {
      scale: 1, alpha: 1, z: 0, rz: 0, rx: 0, ry: 0, depth: chorus ? 9 : 6,
      col: P.ink, col2: P.a2, dark: [20, 6, 14], glow: .25, trail: 0, tx: 0, ty: 0,
      split: 0, stroke: 0
    };
    let x = L.pos[i], y = 0;

    switch (preset) {
      case 'zoom':
        o.z = (1 - e) * 1700; o.ry = (1 - e) * .9; o.alpha = p;
        o.trail = 1 - p; o.tx = -L.pos[i] * .12 * (1 - p); o.ty = 0; break;
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
      case 'type':
        o.alpha = p; o.scale = lerp(1.4, 1, e); break;
    }

    // idle life after landing: breathing + beat kick
    const settled = clamp((a0 - IN) / .6, 0, 1);
    const kick = F.punch * (chorus ? .13 : .07);
    o.scale *= 1 + kick * (1 - settled * .35) + Math.sin(t * 1.6 + i) * .008;
    y += Math.sin(t * 1.25 + i * .5) * size * .022 * settled;
    o.glow += F.punch * .5;
    o.split = F.flash * (chorus ? .55 : .25);

    // keyword accent
    if (L.mask[i]) {
      o.col = P.a2; o.col2 = P.a1; o.glow += .55; o.stroke = .35;
      o.scale *= 1 + F.beat * .05;
      o.dark = [60, 10, 20];
    }

    // exit
    if (outP > 0) {
      const oe = easeOut(outP);
      o.alpha *= 1 - outP;
      o.z += oe * -420;                 // pushes past the camera
      o.scale *= 1 + oe * .45;
      o.rz += oe * .12 * (i % 2 ? 1 : -1);
      y -= oe * size * .35;
    }
    o.alpha *= globalAlpha;
    glyph(ch, CX + x + CAM.shx * .6, yBase + y + CAM.shy * .6, size, o);
  }

  // lower-third rule under chorus lines
  if (chorus && !dying) {
    const p = clamp(age / .8, 0, 1);
    const w = L.total * easeOut(p) * .5;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(CX - w, 0, CX + w, 0);
    g.addColorStop(0, rgb(P.a2, 0)); g.addColorStop(.5, rgb(P.a2, .55 * globalAlpha)); g.addColorStop(1, rgb(P.a2, 0));
    ctx.fillStyle = g;
    ctx.fillRect(CX - w, yBase + size * .78, w * 2, Math.max(1, S(2)));
    ctx.restore();
  }
}

/* ------------------------- title / credit cards -------------------- */
/* A generic build-in / hold / blow-out title card */
function drawCard(text, cy, size, t, t0, t1, style) {
  const IN = style === 'logo' ? 1.1 : .8, OUT = .9;
  if (t < t0 - .05 || t > t1 + .05) return;
  const chars = [...text];
  font(size, 900);
  const ws = chars.map(c => ctx.measureText(c).width);
  const gap = style === 'num' ? size * .34 : size * .02;
  const total = ws.reduce((s, w) => s + w, 0) + gap * (chars.length - 1);
  const outP = clamp((t - (t1 - OUT)) / OUT, 0, 1);
  let x = CX - total / 2;
  for (let i = 0; i < chars.length; i++) {
    const stg = style === 'logo' ? .13 : .07;
    const p = clamp((t - t0 - i * stg) / IN, 0, 1);
    const e = easeOut(p), oe = easeOut(outP);
    if (p > 0) glyph(chars[i], x + ws[i] / 2 + CAM.shx * .5, cy + CAM.shy * .5, size, {
      scale: lerp(style === 'logo' ? 1.45 : 1.2, 1, e) * (1 + oe * .5) * (1 + F.punch * .05),
      alpha: p * (1 - outP),
      z: (1 - e) * (style === 'logo' ? 900 : 500) - oe * 420,
      rz: 0, rx: (1 - e) * (style === 'logo' ? .8 : .4), ry: 0,
      depth: style === 'logo' ? 14 : 9,
      col: P.ink, col2: style === 'num' ? P.a2 : P.a2, dark: [70, 18, 8],
      glow: .45 + (1 - p) * .8 + F.punch * .4,
      trail: 1 - p, tx: 0, ty: -size * .3 * (1 - p),
      split: F.flash * .45, stroke: style === 'num' ? .4 : .18
    });
    x += ws[i] + gap;
  }
  // light sweep across the card
  const a = clamp((t - t0) / IN, 0, 1) * (1 - outP);
  const sw = ((t - t0 - .4) % 3.4) / 1.2;
  if (sw > 0 && sw < 1 && a > .1) {
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
  return total;
}

/* Small centred caption line */
function caption(text, cy, size, alpha, col) {
  if (alpha <= .01) return;
  ctx.save();
  font(size, 400);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = rgb(col || P.a1, alpha);
  ctx.shadowColor = rgb(col || P.a1, alpha * .6); ctx.shadowBlur = size * .5;
  ctx.fillText(text, CX + CAM.shx * .4, cy + CAM.shy * .4);
  ctx.restore();
}

/* 0 .. 20s opening sequence, three cards */
function drawTitleCard(t) {
  const fadeIn = clamp(t / 1.2, 0, 1);
  // card 1 — the logo
  drawCard(LY.title, CY - MIN * .035, MIN * .13, t, 1.2, 9.8, 'logo');
  const s1 = clamp((t - 3.2) / .9, 0, 1) * clamp((9.0 - t) / .8, 0, 1) * fadeIn;
  caption(LY.subtitle || '', CY + MIN * .085, MIN * .028, s1 * .9);
  const s2 = clamp((t - 4.6) / .9, 0, 1) * clamp((9.0 - t) / .8, 0, 1) * fadeIn;
  caption(LY.cast || '', CY + MIN * .135, MIN * .022, s2 * .5, P.ink);
  // card 2 — the tagline
  drawCard(LY.tagline || '一個號碼　兩場婚禮', CY, MIN * .062, t, 10.4, 15.2, 'line');
  const s3 = clamp((t - 11.6) / .8, 0, 1) * clamp((14.6 - t) / .7, 0, 1);
  caption('真 人 真 事 · 號 碼 是 牙 妹 給 的', CY + MIN * .07, MIN * .02, s3 * .45, P.ink);
  // card 3 — the numbers lock in
  drawCard('539', CY - MIN * .01, MIN * .17, t, 15.8, 20.0, 'num');
  const s4 = clamp((t - 16.8) / .8, 0, 1) * clamp((19.4 - t) / .7, 0, 1);
  caption('今 彩 5 3 9 · 頭 獎', CY + MIN * .105, MIN * .022, s4 * .7);
}

function drawOutro(t) {
  const a = clamp((t - LAST_END - .8) / 1.4, 0, 1);
  if (a <= .01) return;
  const size = MIN * .1;
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
  font(MIN * .022, 400);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = rgb(P.a1, a * .8);
  ctx.fillText('鋒兄 × 牙妹　·　小塗 × 魚妹　·　今彩 539 頭獎牽紅線', CX, CY + MIN * .085);
  ctx.fillStyle = rgb(P.ink, a * .4);
  font(MIN * .018, 400);
  ctx.fillText('那我明天也去買一張', CX, CY + MIN * .13);
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
function post(t) {
  // bloom: downscale twice (the bilinear filtering IS the blur), and
  // multiply the small buffer by itself so only highlights survive
  if (QUAL > 0) {
    const aw = bA.width, ah = bA.height, bw = bB.width, bh = bB.height;
    actx.globalCompositeOperation = 'source-over';
    actx.drawImage(cvs, 0, 0, aw, ah);
    PROF('p.cap');
    bctx.globalCompositeOperation = 'source-over';
    bctx.drawImage(bA, 0, 0, bw, bh);
    bctx.globalCompositeOperation = 'multiply';
    bctx.drawImage(bA, 0, 0, bw, bh);          // v -> v²  (highlight threshold)
    bctx.globalCompositeOperation = 'source-over';
    PROF('p.down');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = .85 + F.level * .25 + F.flash * .2;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bB, 0, 0, W, H);
    ctx.restore();
  }
  PROF('p.bloom');
  // beat strobe
  if (F.flash > .02) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgb(P.a2, F.flash * .045);
    ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  // vignette
  const g = ctx.createRadialGradient(CX, CY, MIN * .25, CX, CY, MIN * .82);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${.62 - F.level * .12})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  PROF('p.vign');
  // grain
  if (QUAL > 0 && grainPat) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = .05;
    ctx.translate((Math.random() * 128) | 0, (Math.random() * 128) | 0);
    ctx.fillStyle = grainPat;
    ctx.fillRect(-128, -128, W + 256, H + 256);
    ctx.restore();
  }
  PROF('p.grain');
  // letterbox — cinematic framing
  const bar = H * .045;
  ctx.fillStyle = '#04050c';
  ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
}

/* ============================== TIMELINE =========================== */
LY.lines.forEach((l, i) => l.idx = i);
// storage keys carry the data version so a lyrics.js update always wins
const VER = LY.ver || 1;
const OFFKEY = 'xiaLyricOffset.v' + VER, TKEY = 'xiaLyricTimes.v' + VER;
// file:// and private windows can throw on storage access — never fatal
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } }
};
let OFFSET = parseFloat(store.get(OFFKEY) || '0') || 0;
try {
  const saved = JSON.parse(store.get(TKEY) || 'null');
  if (saved && saved.length === LY.lines.length) {
    saved.forEach((t, i) => LY.lines[i].t = t);
    recomputeDur();
  }
} catch (e) { }
function recomputeDur() {
  for (let i = 0; i < LY.lines.length; i++) {
    const nx = LY.lines[i + 1];
    const cap = nx ? nx.t - .08 : LAST_END + 1.2;
    LY.lines[i].d = Math.max(.6, Math.min(cap - LY.lines[i].t, 6.5));
  }
}
recomputeDur();

function lineAt(t) {
  let cur = -1;
  for (let i = 0; i < LY.lines.length; i++) {
    if (LY.lines[i].t <= t) cur = i; else break;
  }
  return cur;
}

/* ============================== PLAYBACK =========================== */
const audio = $('#audio');
let clock = 0, playing = false, last = performance.now() / 1000, started = false;

function syncClock(dt) {
  if (playing) {
    clock += dt;
    const real = audio.currentTime;
    if (Math.abs(real - clock) > .06) clock = lerp(clock, real, .35);
    if (Math.abs(real - clock) > .4) clock = real;
  } else {
    clock = audio.currentTime;
  }
  clock = clamp(clock + OFFSET * 0, 0, DUR);
}

/* ================================ LOOP ============================= */
let fpsAcc = 0, fpsN = 0, fpsShow = 0;

/* opt-in per-layer profiler: __mv.prof(2) collects 2s of timings */
let profOn = false, profMark = 0, profAcc = {}, profN = 0;
function PROF(name) {
  if (!profOn) return;
  const n = performance.now();
  profAcc[name] = (profAcc[name] || 0) + (n - profMark);
  profMark = n;
}

function frame(now) {
  requestAnimationFrame(frame);
  const nowS = now / 1000;
  let dt = nowS - last; last = nowS;
  if (dt > .1) dt = .1;
  if (dt <= 0) dt = .016;

  if (profOn) { profMark = performance.now(); profN++; }
  syncClock(dt);
  const t = clock;
  const lt = t - OFFSET;                     // lyric time (user offset)
  sampleAudio(t, dt);

  const act = actAt(lt);
  mixPal(PAL[act] || PAL.verse, dt);

  /* ---- camera choreography per act ---- */
  const bar = ((t - AA.beat0) / BAR) % 1;
  CAM.tfov = 1000 + Math.sin(t * .27) * 60 - F.bass * 120;
  CAM.tyaw = Math.sin(t * .13) * .12;
  CAM.tpitch = Math.sin(t * .09 + 1.2) * .05;
  CAM.troll = Math.sin(t * .11) * .025;
  CAM.ty = Math.sin(t * .21) * 60;
  let speed = 320;
  let wmAlpha = 0, wmText = '539';

  switch (act) {
    case 'intro':
      // slowly accelerate through the 20s opening, then punch into the song
      speed = 180 + F.level * 380 + clamp(lt / 20, 0, 1) * 520 + clamp((lt - 18.6) / 1.6, 0, 1) * 1400;
      CAM.tpitch = -.06 + Math.sin(lt * .25) * .04;
      CAM.troll = Math.sin(lt * .4) * .04;
      wmAlpha = .1 + clamp((lt - 15) / 3, 0, 1) * .2; wmText = '539';
      break;
    case 'hook':
      speed = 900 + F.bass * 1500; CAM.troll = Math.sin(t * .9) * .07;
      wmAlpha = .18; wmText = '最瞎';
      break;
    case 'verse':
      speed = 420 + F.bass * 900 + F.level * 300;
      CAM.tyaw = Math.sin(t * .17) * .22;
      wmAlpha = .1 + F.level * .12; wmText = '539';
      break;
    case 'chorus':
      speed = 1050 + F.bass * 2100;
      CAM.troll = Math.sin(t * .8) * .06 + F.punch * .03;
      CAM.tpitch = -.03 + Math.sin(t * .5) * .05;
      wmAlpha = .2 + F.level * .2; wmText = '囍';
      break;
    case 'brk':
      speed = 180; CAM.tyaw = Math.sin(t * .2) * .3; wmAlpha = .22; wmText = '紅線';
      break;
    case 'outro':
      speed = 140 + F.level * 200; wmAlpha = .12; wmText = '囍';
      break;
  }
  travel += speed * dt;
  camUpdate(t, dt);

  /* ---- motif power levels ---- */
  const curIdx = lineAt(lt);
  const curLine = curIdx >= 0 ? LY.lines[curIdx] : null;
  const wants539 = curLine && (curLine.text.includes('五三九') || curLine.text.includes('539') || curLine.text.includes('頭獎') || curLine.text.includes('號碼'));
  const wantsString = act === 'chorus' || act === 'brk' || (curLine && (curLine.text.includes('紅線') || curLine.text.includes('牽')));
  const introDraw = act === 'intro' && lt > 15.2 && lt < 20.4;   // the 539 card
  const ballTarget = (wants539 || introDraw) ? 1 : (act === 'intro' || act === 'brk' ? .3 : .08);
  ballPower = lerp(ballPower, ballTarget, 1 - Math.pow(.08, dt));
  stringPower = lerp(stringPower, wantsString ? 1 : .05, 1 - Math.pow(.15, dt));

  /* ---- confetti on chorus beats ---- */
  if (playing && (act === 'chorus' || act === 'outro') && F.flash > .85) emit(QUAL === 2 ? 9 : 5, 'glyph');
  if (playing && wants539 && F.flash > .9) emit(4, 'num');

  /* ============================ RENDER ============================ */
  // background
  const g = ctx.createRadialGradient(CX, CY * .9, 0, CX, CY, MIN * 1.15);
  g.addColorStop(0, rgb(P.bg, 1));
  g.addColorStop(1, rgb(P.bg2, 1));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  PROF('bg');
  drawRays(t); PROF('rays');
  drawWatermark(t, wmText, wmAlpha); PROF('mark');
  drawGrid(t); PROF('grid');
  drawRings(t, travel * .0004); PROF('rings');
  drawStars(t, dt, speed); PROF('stars');
  drawBokeh(t); PROF('bokeh');
  drawString(t); PROF('string');
  drawBalls(t); PROF('balls');
  drawParts(dt); PROF('parts');

  /* ---- lyrics ---- */
  if (lt < SEC[0].start - .4) drawTitleCard(lt);
  const yMain = CY + MIN * .1;
  if (curIdx >= 0) {
    const cur = LY.lines[curIdx];
    const prev = LY.lines[curIdx - 1];
    const outAt = cur.t + cur.d;
    // previous line drifts up and fades (AE style stack)
    if (prev && lt < prev.t + prev.d + .75) {
      drawLine(prev, lt, yMain - MIN * .12, {
        alpha: clamp(1 - (lt - (prev.t + prev.d)) / .7, 0, 1) * .35,
        outAt: prev.t + prev.d
      });
    }
    if (lt < outAt + .55) drawLine(cur, lt, yMain, { outAt: outAt });
    // upcoming whisper
    const nx = LY.lines[curIdx + 1];
    if (nx && nx.t - lt < 1.1 && lt > outAt - .2) {
      const a = clamp(1 - (nx.t - lt) / 1.1, 0, 1) * .22;
      ctx.save();
      font(MIN * .026, 400);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = rgb(P.ink, a);
      ctx.fillText(nx.text, CX, yMain + MIN * .11);
      ctx.restore();
    }
  }
  if (act === 'outro') drawOutro(lt);

  // section stinger — a rotating tag when a section starts
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
      ctx.fillText(`${ACT_LABEL[SEC[i].kind]}　/　0${i + 1}`, -easeOut(p) * 0, 0);
      ctx.restore();
    }
  }

  PROF('text');
  post(t); PROF('post');
  if (editing) drawEditorOverlay(lt);

  /* ---- hud ---- */
  fpsAcc += dt; fpsN++;
  if (fpsAcc > .5) { fpsShow = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; $('#fps').textContent = fpsShow + ' FPS'; }
  $('#actTag').textContent = ACT_LABEL[act] || '';
  updateTransport(t, curIdx);
}

/* ============================ UI / TRANSPORT ======================= */
const elHead = $('#head'), elTime = $('#time'), elNow = $('#now'), elPlay = $('#play');
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
let lastIdx = -2;

function updateTransport(t, idx) {
  const pct = clamp(t / DUR, 0, 1);
  elHead.style.left = (pct * 100) + '%';
  elTime.textContent = `${fmt(t)} / ${fmt(DUR)}`;
  if (idx !== lastIdx) {
    lastIdx = idx;
    elNow.textContent = idx >= 0 ? LY.lines[idx].text : '';
    paintPanel(idx);
    if (editing) paintEditor();
  }
}

/* lyric side panel */
const wrap = $('#scrollwrap');
const rows = [];
(function buildPanel() {
  let lastSec = -1;
  LY.lines.forEach((l, i) => {
    if (l.sec !== lastSec) {
      lastSec = l.sec;
      const h = document.createElement('div');
      h.className = 'sec';
      h.textContent = `${ACT_LABEL[l.kind] || ''} · 0${l.sec + 1}`;
      wrap.appendChild(h);
    }
    const d = document.createElement('div');
    d.className = 'l'; d.textContent = l.text;
    d.onclick = () => seek(l.t + OFFSET);
    wrap.appendChild(d); rows.push(d);
  });
})();
function paintPanel(idx) {
  rows.forEach((r, i) => {
    r.className = 'l' + (i === idx ? ' cur' : i < idx ? ' done' : '');
  });
  if (idx >= 0 && rows[idx]) {
    const y = rows[idx].offsetTop;
    wrap.style.transform = `translateY(${-y + innerHeight * .34}px)`;
  }
}

/* mini waveform on the scrubber */
function drawWave() {
  const c = $('#wave'), g = c.getContext('2d');
  const w = c.clientWidth || 800, h = c.clientHeight || 46, d = Math.min(devicePixelRatio || 1, 2);
  c.width = w * d; c.height = h * d; g.scale(d, d);
  g.clearRect(0, 0, w, h);
  const n = Math.floor(w);
  for (let i = 0; i < n; i++) {
    const f0 = Math.floor(i / n * AA.frames), f1 = Math.floor((i + 1) / n * AA.frames);
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
  // section markers
  const M = $('#marks'); M.innerHTML = '';
  SEC.forEach((s, i) => {
    const bar = document.createElement('i');
    bar.style.left = (s.start / DUR * 100) + '%';
    M.appendChild(bar);
    const lab = document.createElement('b');
    lab.style.left = (s.start / DUR * 100) + '%';
    lab.textContent = ACT_LABEL[s.kind];
    M.appendChild(lab);
  });
}

/* transport controls */
function play() {
  audio.play().then(() => { playing = true; elPlay.textContent = '❚❚'; }).catch(() => { });
}
function pause() { audio.pause(); playing = false; elPlay.textContent = '▶'; }
function toggle() { playing ? pause() : play(); }
function seek(t) {
  t = clamp(t, 0, DUR - .05);
  audio.currentTime = t; clock = t;
  resetOnsets(t); parts.length = 0; lastIdx = -2;
}
audio.addEventListener('ended', () => { playing = false; elPlay.textContent = '▶'; });
elPlay.onclick = toggle;

const scrub = $('#scrub'), hov = $('#hov');
scrub.addEventListener('pointerdown', e => {
  const r = scrub.getBoundingClientRect();
  seek((e.clientX - r.left) / r.width * DUR);
  const mv = ev => { seek((ev.clientX - r.left) / r.width * DUR); };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
});
scrub.addEventListener('pointermove', e => {
  const r = scrub.getBoundingClientRect();
  hov.style.left = (e.clientX - r.left) + 'px';
});

$('#bLyr').onclick = () => { $('#panel').classList.toggle('hide'); $('#bLyr').classList.toggle('on', !$('#panel').classList.contains('hide')); };
$('#bFull').onclick = () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); };
$('#bQual').onclick = () => { QUAL = (QUAL + 2) % 3; $('#bQual').textContent = '畫質 Q · ' + QNAME[QUAL]; resize(); };
$('#bEdit').onclick = () => toggleEditor();

/* toast */
let toastT = null;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1600);
}

/* --------------------------- sync editor --------------------------- */
let editing = false, editIdx = 0;
function toggleEditor() {
  editing = !editing;
  $('#editor').classList.toggle('on', editing);
  $('#bEdit').classList.toggle('on', editing);
  if (editing) { editIdx = Math.max(0, lineAt(clock - OFFSET)); paintEditor(); toast('校時模式：空白鍵敲點每句開始'); }
}
function paintEditor() {
  const c = LY.lines[editIdx], n = LY.lines[editIdx + 1];
  $('#eCur').textContent = c ? `${(editIdx + 1).toString().padStart(2, '0')}. ${c.text}  [${c.t.toFixed(2)}s]` : '（已到結尾）';
  $('#eNx').textContent = n ? `下一句 → ${n.text}` : '—';
}
function drawEditorOverlay(lt) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,210,74,.5)'; ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  ctx.restore();
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
  l.t = Math.max(0, l.t + d); recomputeDur(); persist(); paintEditor(); lastIdx = -2;
}
function persist() {
  store.set(TKEY, JSON.stringify(LY.lines.map(l => l.t)));
  store.set(OFFKEY, String(OFFSET));
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
  const body = LY.lines.map(l => `[${mmss(l.t + OFFSET)}]${l.text}`);
  download('lyrics.lrc', head.concat(body).join('\n') + '\n');
  toast('已匯出 lyrics.lrc');
};
$('#eJs').onclick = () => {
  const out = JSON.parse(JSON.stringify({
    title: LY.title, subtitle: LY.subtitle, cast: LY.cast,
    sections: LY.sections,
    lines: LY.lines.map(l => ({ t: +(l.t + OFFSET).toFixed(2), d: +l.d.toFixed(2), text: l.text, sec: l.sec, kind: l.kind }))
  }));
  download('lyrics.js', 'window.LYRICS=' + JSON.stringify(out) + ';\n');
  toast('已匯出 lyrics.js（覆蓋 data/lyrics.js 即可永久套用）');
};
$('#eRst').onclick = () => {
  store.del(TKEY); store.del(OFFKEY);
  toast('已清除校時，重新整理後還原');
};

/* drop an .lrc onto the page to load your own timings */
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => {
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (!f || !/\.lrc$/i.test(f.name)) return;
  const r = new FileReader();
  r.onload = () => {
    const times = [];
    r.result.split(/\r?\n/).forEach(line => {
      const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
      if (m && m[3].trim()) times.push({ t: +m[1] * 60 + parseFloat(m[2]), text: m[3].trim() });
    });
    if (!times.length) return toast('讀不到時間標籤');
    times.forEach((x, i) => { if (LY.lines[i]) LY.lines[i].t = x.t; });
    recomputeDur(); persist(); lastIdx = -2;
    toast(`已套用 ${times.length} 句時間軸`);
  };
  r.readAsText(f, 'utf-8');
});

/* ----------------------------- keyboard ---------------------------- */
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === ' ') {
    e.preventDefault();
    if (editing) tapSync(); else toggle();
  } else if (k === 'arrowleft') {
    e.preventDefault();
    if (editing) nudge(-.1); else seek(clock - 5);
  } else if (k === 'arrowright') {
    e.preventDefault();
    if (editing) nudge(.1); else seek(clock + 5);
  } else if (k === 'z' && editing) { editIdx = Math.max(0, editIdx - 1); paintEditor(); }
  else if (k === '[') { OFFSET -= .1; persist(); toast('整體位移 ' + OFFSET.toFixed(1) + 's'); lastIdx = -2; }
  else if (k === ']') { OFFSET += .1; persist(); toast('整體位移 ' + OFFSET.toFixed(1) + 's'); lastIdx = -2; }
  else if (k === 'l') $('#bLyr').click();
  else if (k === 'f') $('#bFull').click();
  else if (k === 'q') $('#bQual').click();
  else if (k === 'e') toggleEditor();
});

/* idle chrome hiding */
let idleT = null;
function wake() {
  document.body.classList.remove('idle');
  clearTimeout(idleT);
  idleT = setTimeout(() => { if (playing && !editing) document.body.classList.add('idle'); }, 2600);
}
addEventListener('mousemove', wake); addEventListener('keydown', wake); wake();

/* ------------------------------ boot ------------------------------- */
$('#go').onclick = () => {
  $('#start').classList.add('gone');
  started = true;
  seek(0); play();
};
addEventListener('click', e => {
  if (!started && e.target.id !== 'go') return;
});

// small debug/automation hook
window.__mv = {
  seek: seek, play: play, pause: pause, toggle: toggle,
  start: () => $('#go').click(),
  state: () => ({ t: clock, playing: playing, fps: fpsShow, qual: QUAL, F: F }),
  prof: (secs) => new Promise(res => {
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
resize();
$('#ttl').textContent = LY.title;
$('#cast').textContent = LY.cast || '';
$('#bQual').textContent = '畫質 Q · ' + QNAME[QUAL];
$('#bLyr').classList.add('on');
resetOnsets(0);
requestAnimationFrame(frame);

})();
