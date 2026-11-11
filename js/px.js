/* =====================================================================
   鋒兄宇宙 · PIXEL MV
   90 年代 PC-98 / 賽璐璐風格的音樂錄影帶引擎。

   角色、場景和字幕都畫進低解析度緩衝區，再以整數倍、不平滑地放大。
   js/pixel-scenes.js 用各語言版的實際歌詞時間切換分鏡。
   ===================================================================== */
(function () {
'use strict';

/* ------------------------------ utils ------------------------------ */
const CAT = window.MV_SONGS || [];
const VERSION = '2.7.1';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
// darken / lighten a hex colour, for the second tone of an iris or a strand
function shade(hex, k) {
  if (!hex || hex[0] !== '#' || hex.length < 7) return hex;
  const c = [1, 3, 5].map(i => clamp(Math.round(parseInt(hex.substr(i, 2), 16) * k), 0, 255));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
function shadeTowardWhite(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const channels = [16, 8, 0].map(bits => Math.min(255, ((value >> bits) & 255) + amount));
  return '#' + channels.map(n => n.toString(16).padStart(2, '0')).join('');
}
const $ = s => document.querySelector(s);
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
};
function b64u8(s) {
  const bin = atob(s), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

/* ============================== buffer ============================= */
const cvs = $('#screen'), ctx = cvs.getContext('2d', { alpha: false });
const buf = document.createElement('canvas');
const b = window.MV_STORY.__cleanCanvas(buf.getContext('2d', { alpha: false }));
let W = 0, H = 0, BW = 0, BH = 0, SC = 1, port = false;
let QUAL = clamp(Math.round(parseFloat(store.get('px.qual')) || 1), 0, 2);
const QNAME = ['粗', '中', '細'];
const BASE = [160, 224, 292];
let INSET = { t: 0, r: 0, b: 0, l: 0 };
let coverDirty = true, coverTarget = 0, coverNow = 0;

function readInsets() {
  const probe = $('#safe');
  const cs = probe ? getComputedStyle(probe) : null;
  const cssW = parseFloat(cvs.style.width) || innerWidth || 1;
  const cssH = parseFloat(cvs.style.height) || innerHeight || 1;
  const n = v => { const x = parseFloat(v); return Number.isFinite(x) ? x : 0; };
  if (!cs || BH < 2) { INSET = { t: 0, r: 0, b: 0, l: 0 }; return; }
  INSET = {
    t: Math.round(n(cs.borderTopWidth) * BH / cssH),
    r: Math.round(n(cs.borderRightWidth) * BW / cssW),
    b: Math.round(n(cs.borderBottomWidth) * BH / cssH),
    l: Math.round(n(cs.borderLeftWidth) * BW / cssW)
  };
}

/* How many buffer pixels the HTML chrome (or the home indicator, once
   the chrome has faded) occupies. Subtitles sit above that. */
function chromeCoverTarget() {
  if (document.body.classList.contains('chrome-off')) return INSET.b;
  const bar = $('#bottom');
  const cssH = bar ? bar.getBoundingClientRect().height : 0;
  const cssView = parseFloat(cvs.style.height) || innerHeight || 1;
  return Math.max(INSET.b, Math.round(cssH * BH / Math.max(1, cssView)));
}
function chromeCover() {
  if (coverDirty) { coverDirty = false; coverTarget = chromeCoverTarget(); }
  coverNow += (coverTarget - coverNow) * .22;
  if (Math.abs(coverTarget - coverNow) < .6) coverNow = coverTarget;
  return coverNow;
}

function pinBox(el, x, y, w, h) {
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.width = w + 'px';
  el.style.height = h + 'px';
  el.style.right = 'auto';
  el.style.bottom = 'auto';
}
function resize() {
  const vv = window.visualViewport;
  const vw = Math.max(2, vv ? vv.width : innerWidth);
  const vh = Math.max(2, vv ? vv.height : innerHeight);
  const ox = vv ? vv.offsetLeft : 0;
  const oy = vv ? vv.offsetTop : 0;
  const gap = Math.max(0, innerHeight - vh - oy);
  pinBox(cvs, ox, oy, vw, vh);
  const bottom = $('#bottom');
  if (bottom) {
    bottom.style.left = ox + 'px';
    bottom.style.width = vw + 'px';
    bottom.style.right = 'auto';
    bottom.style.bottom = gap + 'px';
  }
  const start = $('#start');
  if (start) pinBox(start, ox, oy, vw, vh);

  const dpr = Math.min(devicePixelRatio || 1, 2);
  W = Math.max(2, Math.floor(vw * dpr));
  H = Math.max(2, Math.floor(vh * dpr));
  cvs.width = W; cvs.height = H;
  const sc = Math.max(2, Math.round(Math.min(W, H) / BASE[QUAL]));
  const bw = Math.ceil(W / sc), bh = Math.ceil(H / sc);
  if (bw !== BW || bh !== BH || sc !== SC) {
    BW = bw; BH = bh; SC = sc; port = BW < BH * 1.15;
    buf.width = BW; buf.height = BH;
  }
  readInsets();
  coverDirty = true;
}
addEventListener('resize', resize);
if (window.visualViewport) {
  visualViewport.addEventListener('resize', resize);
  visualViewport.addEventListener('scroll', resize);
}

/* ------------------------------ brushes ---------------------------- */
function fill(x, y, w, h, col) {
  b.fillStyle = col; b.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}
// Rasterize polygon spans at pixel centres so diagonals keep hard edges.
function polygon(points, color) {
  const top = Math.max(0, Math.ceil(Math.min(...points.map(p => p[1])) - .5));
  const bottom = Math.min(BH, Math.ceil(Math.max(...points.map(p => p[1])) - .5));
  b.fillStyle = color;
  const crossings = [];
  for (let y = top; y < bottom; y++) {
    crossings.length = 0;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [ax, ay] = points[j], [bx, by] = points[i];
      if ((ay > y + .5) !== (by > y + .5))
        crossings.push(ax + (bx - ax) * (y + .5 - ay) / (by - ay));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i < crossings.length; i += 2) {
      const left = Math.ceil(crossings[i] - .5), right = Math.ceil(crossings[i + 1] - .5);
      b.fillRect(left, y, right - left, 1);
    }
  }
}
function tri(x1, y1, x2, y2, x3, y3, col) {
  polygon([[x1, y1], [x2, y2], [x3, y3]], col);
}
const FAM = '"Microsoft JhengHei UI","PingFang TC","Noto Sans TC","Hiragino Sans",monospace';
function setFont(px, w) { b.font = (w || 700) + ' ' + Math.max(5, Math.round(px)) + 'px ' + FAM; }
function text(str, x, y, px, col, align, w) {
  setFont(px, w); b.textAlign = align || 'left'; b.textBaseline = 'top';
  b.fillStyle = col; b.fillText(str, Math.round(x), Math.round(y));
}
function measure(str, px, w) { setFont(px, w); return b.measureText(str).width; }
function fitText(str, px, max, w) {
  while (px > 5 && measure(str, px, w) > max) px--;
  return px;
}
/* Hand-drawn pixel figures use the same choreography as the illustrated rigs. */
const POSE_MOVE = { raise: 'raise', point: 'point2', walk: 'walk', lie: 'lie' };
let CEL = store.get('px.characterArt') !== 'portrait';
function figure(o) {
  const move = o.dance || POSE_MOVE[o.pose] || 'idle';
  const beat = g.beatN + (o.beatOff || 0);
  const i = o.pose === 'lie' ? Number(!!o.awake) : o.di ?? Math.round((o.ph || 0) * 3);
  const u = o.h / 100, x = Math.round(o.x), base = Math.round(o.y);
  fill(x - 21 * u, base - 1, 42 * u, 3 * u, o.shadowBack || '#111420');
  if (!CEL && o.id && window.MV_PUPPET.draw(b, { ...o, move, beat, i })) return;
  const rig = window.MV_PUPPET;
  let pose = rig.dancePose(move, beat, i, o.t);
  if (o.flip) pose = rig.mirror(pose);
  const cx = x + Math.round(pose.x * o.h), y = base + Math.round(pose.y * o.h);
  const outline = '#181222', skin = o.skin || '#f8d7b3', skinShadow = o.skin2 || '#c88d72';
  const cloth = o.cloth || '#6979bb', clothShadow = o.cloth2 || '#394579';
  const pants = o.pants || clothShadow, shoes = o.shoes || '#faf5ed';
  const sleeve = o.logo || o.sailor ? skin : cloth;
  const lighter = (color, amount = 26) => shadeTowardWhite(color, amount);
  const rect = (dx, dy, w, h, color) => fill(cx + dx * u, y + dy * u, w * u, h * u, color);
  const shape = (points, color) => polygon(points.map(([dx, dy]) => [cx + dx * u, y + dy * u]), color);
  const end = ([dx, dy], a, n) => [dx + Math.cos(a) * n, dy + Math.sin(a) * n];
  const bar = (start, tip, width, color) => {
    const [sx, sy] = start, [tx, ty] = tip;
    const a = Math.atan2(ty - sy, tx - sx), k = width / 2;
    const dx = -Math.sin(a) * k, dy = Math.cos(a) * k;
    shape([[sx + dx, sy + dy], [tx + dx, ty + dy], [tx - dx, ty - dy], [sx - dx, sy - dy]], color);
  };
  const head = (dx, dy, w) => face({ ...o, x: cx + (dx - w / 2) * u, y: y + dy * u,
                                     w: w * u });

  if (o.pose === 'lie') {
    const flick = Math.sin(o.t * 4) * 4;
    shape([[20, -19], [37, -21], [46, -35 + flick], [55, -32 + flick], [51, -17],
      [42, -10], [22, -9]], o.tailCol || '#c47943');
    rect(43, -34 + flick, 10, 7, o.tailTip || '#fff5e7');
    shape([[-45, -2], [-49, -10], [-31, -15], [-15, -24], [19, -25],
      [34, -18], [43, -8], [39, -2]], outline);
    rect(-15, -21, 36, 14, cloth);
    rect(-8, -20, 20, 12, o.inner || clothShadow);
    rect(18, -17, 17, 11, pants);
    rect(34, -11, 8, 6, shoes);
    head(-26, -39, 46);
    rect(-45, -5, 23, 5, skinShadow);
    rect(-43, -7, 17, 4, o.muzzle || skin);
    return;
  }

  const wide = o.male ? 18 : o.cat ? 17 : 15;
  const lean = Math.sin(pose.chest) * 14;
  if (o.id === 'gpt') {
    for (const side of [-1, 1]) {
      const wing = [[10, -54], [18, -60], [28, -53], [32, -42], [27, -44], [22, -38], [19, -47]];
      shape(wing.map(([a, b]) => [side * a, b]), '#a89dcc');
      shape(wing.slice(1, 6).map(([a, b]) => [side * (a - 2), b + 2]), '#d4caed');
    }
  }
  if (o.tailKind) {
    const wag = Math.sin(pose.tail) * 10;
    const tip = o.tailKind === 'whale'
      ? [[26, -35 + wag], [26, -52 + wag], [35, -46 + wag], [44, -50 + wag], [43, -37 + wag]]
      : [[26, -31 + wag], [27, -40 + wag], [35, -44 + wag], [40, -39 + wag], [37, -30 + wag]];
    shape([[11, -30], ...tip, [27, -23], [13, -22]], o.tailCol || cloth);
    rect(29, -39 + wag, 7, 5, o.tailTip || lighter(o.tailCol || cloth));
  }

  const feet = [];
  for (const [sign, thigh, shin] of [[-1, pose.lt, pose.ls], [1, pose.rt, pose.rs]]) {
    const hip = [sign * 7, -35], knee = end(hip, thigh, 16), ankle = end(knee, shin, 16);
    const leg = o.skirt ? (o.socks || skin) : pants;
    bar(hip, knee, 14, outline);
    bar(knee, ankle, 13, outline);
    bar(hip, knee, 10, leg);
    bar(knee, ankle, 9, leg);
    bar([knee[0] - 2, knee[1]], [ankle[0] - 2, ankle[1]], 2, lighter(leg));
    feet.push([ankle[0] - 5 + sign, ankle[1]]);
  }
  for (const [fx, fy] of feet) {
    rect(fx - 1, fy - 3, 13, 7, outline);
    rect(fx, fy - 3, 11, 5, shoes);
    rect(fx, fy + 1, 11, 2, lighter(shoes));
  }

  const hands = [];
  for (const [sign, upper, lower, ul, ll] of [
    [-1, pose.lu, pose.lf, pose.lul, pose.lfl], [1, pose.ru, pose.rf, pose.rul, pose.rfl]
  ]) {
    const shoulder = [sign * (wide - 2) + lean, -62];
    const elbow = end(shoulder, upper, 14 * ul), wrist = end(elbow, lower, 13 * ll);
    const glove = o.cat ? o.hair : skin;
    bar(shoulder, elbow, 12, outline);
    rect(elbow[0] - 4, elbow[1] - 4, 8, 8, outline);
    bar(elbow, wrist, 11, outline);
    bar(shoulder, elbow, 9, cloth);
    bar(elbow, wrist, 8, sleeve);
    if (sleeve === cloth) bar(end(elbow, lower, 9 * ll), wrist, 8, clothShadow);
    hands.push([wrist, glove]);
  }

  shape([[-wide + lean, -65], [wide + lean, -65], [wide - 3, -55], [wide - 5, -34],
    [-wide + 5, -34], [-wide + 3, -55]], outline);
  shape([[-wide + 2 + lean, -63], [wide - 2 + lean, -63], [wide - 6, -37], [-wide + 6, -37]], cloth);
  shape([[wide - 7 + lean, -63], [wide - 2 + lean, -63], [wide - 6, -37], [wide - 10, -37]], clothShadow);
  rect(-wide + 5, -59, 2, 15, lighter(cloth));
  if (o.inner) {
    shape([[-7 + lean, -63], [7 + lean, -63], [5, -37], [-5, -37]], o.inner);
    rect(-6, -54, 2, 15, lighter(o.inner));
  }
  if (o.logo) {
    rect(-9, -54, 18, 5, '#f9f3ec');
    for (let j = -7; j < 8; j += 3) rect(j, -53, 1, 2, '#4a4650');
  }
  if (o.pouch) {
    rect(-7, -45, 14, 5, o.inner ? '#d3c4ad' : clothShadow);
    rect(-4, -58, 1, 9, clothShadow);
    rect(3, -58, 1, 9, clothShadow);
  }
  if (o.sailor) {
    shape([[-wide + 2, -63], [wide - 2, -63], [0, -47]], o.sailorCol);
    shape([[-wide + 4, -62], [0, -52], [wide - 4, -62], [0, -49]], '#c7e2ff');
  }
  if (o.skirt) {
    shape([[-10, -38], [10, -38], [18, -22], [-18, -22]], outline);
    shape([[-9, -37], [9, -37], [16, -24], [-16, -24]], o.skirt);
    for (const x of [-8, 0, 8]) bar([x * .75, -36], [x, -24], 2, lighter(o.skirt));
    rect(-15, -25, 30, 2, o.skirtTrim || clothShadow);
  }
  if (o.apron) {
    rect(-7, -59, 14, 24, o.apronCol);
    rect(-4, -46, 9, 4, o.apronMark);
    rect(3, -49, 3, 3, o.apronMark);
  }
  rect(-5 + lean, -67, 10, 6, o.cat ? o.hair2 : skinShadow);
  if (o.collar) rect(-8 + lean, -63, 16, 2, o.collar);
  if (o.bowtie) {
    rect(-6 + lean, -62, 12, 4, o.bowtie);
    rect(-1 + lean, -61, 2, 2, lighter(o.bowtie));
  }
  for (const [[hx, hy], color] of hands) {
    rect(hx - 4, hy - 3, 8, 8, outline);
    rect(hx - 3, hy - 3, 6, 6, color);
    rect(hx - 2, hy - 2, 2, 2, lighter(color));
  }
  head(lean + Math.sin(pose.head) * 5, -103, o.cat ? 52 : 48);
}

/* Faces are drawn on a separate grid from limbs so their features stay crisp. */
function face(o) {
  const w = o.w, u = w / 100, x = Math.round(o.x), yTop = Math.round(o.y);
  const U = v => Math.round(v * u);
  const t = o.t, OUT = '#140b0c';
  const skin = o.skin || '#f7d9bb', skin2 = o.skin2 || '#dcb191';
  const skin3 = shade(skin, .86);
  const hair = o.hair || '#2a1a2e', hair2 = o.hair2 || '#150c18';
  const hair3 = o.hair3 || shade(hair, 1.3);
  const y = yTop;
  const P = (dx, dy, ww, hh, col) => fill(x + U(dx), y + U(dy), U(ww), U(hh), col);
  const male = !!o.male, cat = !!o.cat;
  const S = (points, color) => polygon(points.map(([px, py]) => [x + px * u, y + py * u]), color);
  const hairEnd = 107;

  /* ---- behind: the long fall of hair ---- */
  if (o.long && !o.hood) {
    P(8, 18, 84, 66, hair);
    P(8, 74, 84, hairEnd - 74, hair3);
    P(8, 18, 9, hairEnd - 18, hair2);
    P(83, 18, 9, hairEnd - 18, hair2);
  }
  if (o.twin) {
    const sw = Math.sin(t * 1.5 + (o.ph || 0)) * 2;
    for (const sd of [-1, 1]) {
      const tx = sd < 0 ? 2 : 80;
      P(tx, 22, 18, 20, hair);
      fill(x + U(tx), y + U(40) + sw * sd, U(18), U(74), hair);
      fill(x + U(tx + (sd < 0 ? 0 : 13)), y + U(40) + sw * sd, U(5), U(74), hair2);
      if (o.ribbon) { P(tx, 18, 18, 9, o.ribbon); P(tx + 6, 15, 6, 6, o.ribbon); }
    }
  }

  /* ---- head ---- */
  if (cat) {
    for (const sd of [-1, 1]) {                  // ears first, behind the skull
      const ex = sd < 0 ? 12 : 60;
      tri(x + U(ex), y + U(26), x + U(ex + 28), y + U(26), x + U(ex + (sd < 0 ? 4 : 24)), y + U(-12), hair);
      tri(x + U(ex + 6), y + U(22), x + U(ex + 22), y + U(22), x + U(ex + (sd < 0 ? 9 : 19)), y + U(-2),
          o.earIn || '#ffb4d6');
    }
    S([[15, 11], [26, 7], [74, 7], [85, 14], [88, 64], [76, 75],
       [65, 79], [35, 79], [20, 74], [12, 64]], OUT);
    P(20, 12, 60, 6, hair);
    P(16, 18, 68, 50, hair);
    P(20, 68, 60, 6, hair);
    P(64, 18, 20, 50, hair2);
    if (o.patch) {
      const patch = o.patch2
        ? [[19, 15], [49, 12], [39, 19], [40, 24], [27, 32], [17, 28]]
        : [[32, 13], [60, 12], [69, 20], [58, 26], [47, 32], [43, 24], [31, 22]];
      S(patch, o.patch);
      if (o.patch2) S([[46, 12], [67, 12], [64, 19], [60, 25], [48, 31], [48, 20], [41, 18]], o.patch2);
    }
    P(34, 56, 32, 16, o.muzzle || '#fff6f0');
    P(38, 70, 24, 4, o.muzzle || '#fff6f0');
    P(44, 54, 12, 8, o.nose || '#e0788e');
    P(47, 62, 6, 5, hair2);
    P(36, 66, 12, 2, hair2); P(52, 66, 12, 2, hair2);
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++)
      P(sd < 0 ? 9 : 71, 55 + i * 6, 20, 2, o.whisker || '#aaa09b');
  } else if (o.hood) {
    P(14, 6, 72, 12, o.hood);
    P(8, 16, 84, 62, o.hood);
    P(8, 16, 84, 5, o.hood2 || hair2);
    P(70, 16, 22, 62, o.hood2 || hair2);
    P(20, 72, 60, 8, o.hood2 || hair2);
    if (o.beak) { P(40, 46, 22, 12, o.beak); P(40, 46, 22, 3, '#b8860b'); }
    for (const sd of [-1, 1]) {
      P(sd < 0 ? 18 : 62, 22, 20, 20, '#ffffff');
      P(sd < 0 ? 23 : 67, 27, 10, 10, o.hood);
    }
    P(23, 50, 54, 25, skin2);
    P(29, 47, 42, 28, skin);
    P(26, 46, 48, 9, hair);
    P(22, 45, 10, 26, hair2); P(68, 45, 10, 26, hair2);
    P(40, 39, 22, 9, o.beak);
  } else {
    S([[17, 10], [25, 0], [74, 0], [83, 9], [87, 56], [78, 74], [65, 83],
       [35, 83], [21, 74], [13, 56]], OUT);
    P(24, 6, 52, 5, skin);
    P(19, 11, 62, 60, skin);
    P(24, 71, 52, 5, skin);
    P(31, 76, 38, 4, skin);
    P(64, 11, 17, 65, skin3);                    // cel shadow down one side
    if (male) { P(19, 40, 5, 32, skin3); P(76, 40, 5, 32, skin3); }
    // Feng combs his fringe back. Tu has a rounded, side-swept fringe.
    if (o.glasses) {
      S([[17, 24], [19, 10], [26, 8], [30, 1], [59, -3], [78, 4], [85, 15],
         [82, 37], [75, 26], [72, 14], [53, 11], [37, 19], [28, 20], [24, 33]], hair);
      S([[29, 12], [42, 3], [64, 2], [73, 6], [49, 7], [34, 15]], o.shine);
    } else if (male) {
      S([[15, 14], [27, 4], [42, -2], [65, 0], [80, 7], [86, 18], [84, 43],
         [75, 34], [68, 23], [60, 17], [47, 25], [33, 30], [27, 23], [17, 41]], hair);
      S([[27, 11], [43, 3], [64, 4], [77, 10], [53, 8], [37, 16]], o.shine);
    } else {
      S([[17, 27], [17, 9], [27, 0], [73, 0], [83, 10], [83, 34], [71, 28],
         [65, 22], [57, 35], [50, 26], [41, 34], [33, 24], [24, 31]], hair);
      S([[23, 16], [30, 7], [44, 4], [69, 7], [76, 14], [60, 11], [39, 11]], o.shine || hair3);
    }
    P(16, 23, 6, 37, hair2);
    P(78, 23, 6, 37, hair2);
    P(16, 60, 6, 8, hair3); P(78, 60, 6, 8, hair3);
    if (o.band) { P(18, 6, 64, 7, o.band); P(18, 6, 64, 2, shade(o.band, .85)); }
    if (o.ahoge) {
      const aw = Math.sin(t * 2.3) * 3;
      P(46 + aw, -12, 6, 16, hair);
      P(40 + aw, -16, 14, 6, hair);
    }
    if (o.ears === 'cat') for (const sd of [-1, 1]) {
      const ex = sd < 0 ? 10 : 62;
      tri(x + U(ex), y + U(20), x + U(ex + 26), y + U(20), x + U(ex + (sd < 0 ? 3 : 23)), y + U(-14), hair);
      tri(x + U(ex + 6), y + U(16), x + U(ex + 20), y + U(16), x + U(ex + (sd < 0 ? 8 : 18)), y + U(-4),
          o.earIn || '#ffb4d6');
    }
    if (o.id === 'gpt') for (const sign of [-1, 1]) {
      const horn = [[22, 21], [15, 15], [10, 2], [10, -8], [15, -14], [15, -2], [22, 7], [30, 11]];
      S(horn.map(([hx, hy]) => [sign < 0 ? hx : 100 - hx, hy]), hair2);
      S(horn.slice(1, -1).map(([hx, hy]) => [sign < 0 ? hx + 2 : 98 - hx, hy + 2]), '#e7e0f4');
    }
    if (o.id === 'claude') {
      P(72, 17, 15, 4, '#f5b656'); P(77, 12, 5, 15, '#f5b656'); P(77, 17, 5, 4, '#ffe6ad');
      P(80, 25, 5, 14, '#593030');
    }
    if (o.ears === 'fin') for (const sd of [-1, 1]) {
      const ex = sd < 0 ? -6 : 76;
      P(ex, 34, 30, 14, o.finCol || hair);
      P(ex + (sd < 0 ? 0 : 20), 38, 10, 7, hair2);
      P(ex, 34, 30, 3, hair3);
    }
  }

  /* ---- the face, where all the pixels go ---- */
  const blink = o.pose === 'lie' ? !o.awake : ((t * .62 + (o.ph || 0)) % 1) > .97;
  const iris = o.eye || '#3a6ad8';
  const irisD = shade(iris, .5), irisL = shade(iris, 1.45);
  const EW = 17, EH = male || o.hood ? 12 : 19;
  const ey = cat ? 34 : o.hood ? 53 : male && !o.glasses ? 40 : 37;
  for (const sd of [-1, 1]) {
    const ex = sd < 0 ? 50 - 8 - EW : 50 + 8;
    if (blink) { P(ex, ey + EH / 2, EW, 3, OUT); continue; }
    P(ex, ey, EW, EH, '#ffffff');
    P(ex, ey, EW, 4, shade('#ffffff', .82));        // shadow under the lid
    if (cat) {
      P(ex + 1, ey + 2, EW - 2, EH - 4, iris);
      P(ex + 1, ey + EH - 9, EW - 2, 7, irisD);
      P(ex + Math.floor(EW / 2) - 2, ey + 2, 4, EH - 4, OUT);   // slit pupil
    } else {
      P(ex + 1, ey + 3, EW - 2, EH - 6, iris);
      P(ex + 1, ey + EH - 9, EW - 2, 6, irisD);
      P(ex + 2, ey + EH - 6, EW - 4, 3, irisL);
      P(ex + 4, ey + 6, EW - 8, Math.max(3, EH - 11), OUT);       // pupil
    }
    P(ex, ey, EW, 4, OUT);                           // lash line
    P(ex - 1, ey - 1, 4, 4, OUT);
    P(ex + EW - 3, ey - 1, 4, 4, OUT);
    if (!male) P(ex, ey + EH - 2, EW, 2, shade(iris, .35));   // lower lash
    P(ex + (sd < 0 ? 2 : EW - 8), ey + 5, 6, 6, '#ffffff');   // highlight
    P(ex + (sd < 0 ? EW - 5 : 2), ey + EH - 8, 3, 3, '#ffffff');
  }
  if (!cat) {
    const bw2 = male ? 5 : 3;
    P(50 - 8 - EW, ey - 9, EW, bw2, hair2);
    P(50 + 8, ey - 9, EW, bw2, hair2);
    P(48, o.hood ? 65 : 59, 4, 3, skin3);                          // nose
    if (o.sing > .2) {
      P(44, 68, 12, 7, '#7a2030');
      P(46, 70, 8, 4, '#d8566a');
    } else { P(45, 69, 10, 2, shade('#7a2030', .9)); P(47, 71, 6, 1, shade(skin, .8)); }
  }
  if (o.glasses) {
    const gc = o.glasses === true ? '#3a3a44' : o.glasses;
    const gx = 50 - 10 - EW, gw = EW + 6;
    for (const sd of [0, 1]) {
      const bx = sd ? 50 + 4 : gx;
      P(bx, ey - 3, gw, 2, gc); P(bx, ey + EH + 2, gw, 2, gc);
      P(bx, ey - 3, 2, EH + 7, gc); P(bx + gw - 2, ey - 3, 2, EH + 7, gc);
    }
    P(50 - 4, ey + 6, 8, 2, gc);
  }
  if (o.beard) {
    const bc = o.beard === true ? hair2 : o.beard;
    P(38, 73, 24, 7, bc); P(44, 63, 12, 3, bc);
  }
  if (o.blush) {
    const cheek = o.hood ? 64 : 57;
    P(25, cheek, 10, 4, '#e9a29b');
    P(65, cheek, 10, 4, '#e9a29b');
  }
}

/* ============================== engine ============================= */
let SONG = null, AA = null, LY = [], RMSA = null, SHOTS = [];
let DUR = 1, BEAT = .7;
let clock = 0, playing = false, songIdx = 0;
const F = { level: 0 };
const audio = $('#audio');
window.MV_VOLUME(audio);
window.MV_SPEED(audio);
new ResizeObserver(() => { coverDirty = true; }).observe($('#bottom'));

function rmsAt(t) {
  return RMSA[clamp(Math.round(t * AA.rmsFps), 0, RMSA.length - 1)] / 255;
}

function shotAt(t) {
  const S = SHOTS;
  let r = 0;
  for (let i = 0; i < S.length; i++) if (t >= S[i].t) r = i;
  return r;
}

/* ------------------------------ render ----------------------------- */
const g = { t: 0, prog: 0, F, shot: null, shotIdx: 0, shotP: 0, lyric: '',
            port: false, BW: 0, BH: 0, beatN: 0 };
let lastErr = null, SHEET = false;
const brushes = { fill, polygon, text, measure, fitText, figure };

function subtitle(line, maxWidth) {
  const target = Math.max(10, Math.min(22, Math.round(BH * .085)));
  const minSize = Math.max(9, Math.min(target, Math.round(target * .68)));
  const units = /\s/.test(line) ? line.match(/\S+\s*/gu) : [...line];
  if (measure(line, target, 900) <= maxWidth) return { rows: [line], size: target };
  const rows = [];
  let row = '';
  for (const unit of units) {
    if (row && measure(row + unit, minSize, 900) > maxWidth) {
      rows.push(row.trim());
      row = '';
    }
    row += unit;
  }
  if (row) rows.push(row.trim());
  return { rows, size: Math.min(...rows.map(r => fitText(r, target, maxWidth, 900))) };
}

function paint() {
  const width = Math.max(24, BW - INSET.l - INSET.r - 16);
  const top = INSET.t + 7;
  const reserve = Math.max(BH * .07, chromeCover() + 4);
  const bandY = Math.round(BH - reserve);
  // Reserve enough room for the current subtitle before composing the shot.
  const sub = g.lyric && !SHEET ? subtitle(g.lyric, width) : null;
  const lineHeight = sub ? sub.size + 3 : 0;
  const subTop = bandY - (sub ? sub.rows.length * lineHeight + 9 : 4);
  const area = { x: INSET.l + 8, y: top, w: width, h: Math.max(32, subTop - top) };
  window.MV_PIXEL_SCENES.draw(g, brushes, area, SHEET ? window.MV_STORY.__cast() : null);
  if (sub) {
    fill(0, subTop, BW, bandY - subTop, '#121120');
    fill(0, subTop, BW, 1, '#b1877b');
    for (const [i, row] of sub.rows.entries())
      text(row, area.x + width / 2, subTop + 5 + i * lineHeight, sub.size, '#fff4e2', 'center', 900);
  }
}

function frameLoop() {
  requestAnimationFrame(frameLoop);
  if (!SONG || W < 2) return;
  const t = clock = clamp(audio.currentTime, 0, DUR);
  F.level = rmsAt(t);
  const si = shotAt(t), shot = SHOTS[si];
  const next = SHOTS[si + 1]?.t ?? DUR;
  g.t = t;
  g.prog = t / DUR;
  g.port = port;
  g.BW = BW;
  g.BH = BH;
  g.shot = shot;
  g.shotIdx = si;
  g.beatN = (t - AA.beat0) / BEAT;
  g.shotP = clamp((t - shot.t) / Math.max(.4, next - shot.t), 0, 1);
  const { line, gap } = window.MV_STORY.__lyricCue(LY, t, DUR, SONG.lang);
  g.lyric = line?.text || gap;
  try {
    paint();
    lastErr = null;
  } catch (error) {
    if (lastErr !== error.message) console.error(error);
    lastErr = error.message;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buf, 0, 0, BW * SC, BH * SC);
  updateHud(t);
}

/* ============================== player ============================= */
let lastTime = '', lastPct = -1;
function updateHud(t) {
  const pct = clamp(t / DUR, 0, 1) * 100;
  if (Math.abs(pct - lastPct) > .05) { lastPct = pct; $('#played').style.width = pct + '%'; }
  const tt = fmt(t) + ' / ' + fmt(DUR);
  if (tt !== lastTime) { lastTime = tt; $('#time').textContent = tt; }
}

function applySong(d, autoplay) {
  window.MV_STORY.__setLanguage(d);
  d = window.MV_STORY.__displaySong(d);
  SONG = d; AA = d.analysis;
  RMSA = b64u8(AA.rms);
  DUR = AA.duration; BEAT = 60 / AA.bpm;
  LY = d.lines;
  SHOTS = window.MV_PIXEL_SCENES.cues(d, CAT.find(song => song.id === d.id));
  const sameTake = autoplay && !audio.paused && audio.currentTime < 1.2 &&
    (audio.src.endsWith('/' + d.audio) || audio.src.endsWith(d.audio));
  if (!sameTake) { audio.src = d.audio; audio.load(); }
  clock = 0;
  document.title = d.title + ' 第二版本 像素 MV';
  $('#ttl').textContent = d.title;
  $('#cast').textContent = d.cast;
  store.set('px.song', d.id);
  if (autoplay) play(); else { playing = false; $('#play').textContent = '▶'; }
}
const songWaiters = {};
const songLoading = new Set();
function ensureData(id, cb) {
  const bag = window.MV_SONG_DATA;
  if (bag && bag[id]) return cb(bag[id]);
  (songWaiters[id] || (songWaiters[id] = [])).push(cb);
  if (songLoading.has(id)) return;
  songLoading.add(id);
  const s = document.createElement('script');
  s.src = 'data/song/' + id + '.js?v=' + VERSION;
  s.onload = () => {
    songLoading.delete(id);
    const d = window.MV_SONG_DATA && window.MV_SONG_DATA[id];
    const list = songWaiters[id] || [];
    songWaiters[id] = [];
    if (d) list.forEach(fn => fn(d));
  };
  document.head.appendChild(s);
}
function loadSong(i, autoplay) {
  if (!CAT.length) return;
  songIdx = ((i % CAT.length) + CAT.length) % CAT.length;
  const meta = CAT[songIdx];
  [...document.querySelectorAll('.card')].forEach((c, k) => c.classList.toggle('cur', k === songIdx));
  ensureData(meta.id, d => applySong(d, autoplay));
}
function play() {
  const p = audio.play();
  if (p && p.then) p.then(() => { playing = true; $('#play').textContent = '❚❚'; $('#play').setAttribute('aria-label', '暫停'); armChrome(); }).catch(() => { });
  else { playing = true; $('#play').textContent = '❚❚'; armChrome(); }
}
function pause() {
  audio.pause(); playing = false; $('#play').textContent = '▶'; $('#play').setAttribute('aria-label', '播放'); armChrome();
}
function toggle() { playing ? pause() : play(); }
function seek(t) { t = clamp(t, 0, DUR - .05); audio.currentTime = t; clock = t; }
audio.addEventListener('ended', () => loadSong(songIdx + 1, true));

/* song picker */
function buildCards() {
  if ($('#songCount')) $('#songCount').textContent = CAT.length;
  const grid = $('#grid');
  grid.innerHTML = '';
  CAT.forEach((s, i) => {
    const d = document.createElement('button');
    d.className = 'card';
    d.innerHTML = '<span class="n"></span>' +
                  '<span class="t"></span><span class="c"></span>';
    d.querySelector('.n').textContent = 'PV ' + String(s.pv || i + 1).padStart(2, '0') + ' ' + ({zh:'中文',en:'英文',ja:'日文',yue:'粵文'}[s.lang] || '中文');
    d.querySelector('.t').textContent = window.MV_STORY.__text(s.title);
    d.querySelector('.c').textContent = window.MV_STORY.__text(s.cast) + '　' + fmt(s.dur);
    d.onclick = () => {
      hideList();
      const ready = window.MV_SONG_DATA && window.MV_SONG_DATA[s.id];
      if (!ready && s.audio) {
        audio.src = s.audio;
        const p = audio.play();
        if (p && p.catch) p.catch(() => { });
      }
      loadSong(i, true);
    };
    grid.appendChild(d);
  });
}
function listOpen() { return !$('#start').classList.contains('gone'); }
function showList() { $('#start').classList.remove('gone'); armChrome(); }
function hideList() { $('#start').classList.add('gone'); armChrome(); }

/* Phones hide the transport while a song is playing so the subtitles
   stay readable. A tap on the picture brings it back. */
function chromeMQ() { return matchMedia('(hover: none) and (pointer: coarse)').matches; }
let chromeTimer = 0, chromeHold = 0;
function armChrome() {
  document.body.classList.remove('chrome-off');
  clearTimeout(chromeTimer);
  coverDirty = true;
  if (!chromeMQ() || !playing || listOpen() || chromeHold > 0) return;
  chromeTimer = setTimeout(() => {
    if (chromeHold > 0) { armChrome(); return; }
    if (playing && !listOpen() && chromeMQ()) {
      document.body.classList.add('chrome-off');
      coverDirty = true;
    }
  }, 3200);
}
function toggleChrome() {
  if (!chromeMQ()) return;
  if (document.body.classList.contains('chrome-off')) armChrome();
  else {
    clearTimeout(chromeTimer);
    document.body.classList.add('chrome-off');
    coverDirty = true;
  }
}

/* transport */
$('#play').onclick = toggle;
$('#bPrev').onclick = () => loadSong(songIdx - 1, true);
$('#bNext').onclick = () => loadSong(songIdx + 1, true);
$('#bList').onclick = () => listOpen() ? hideList() : showList();
$('#bQual').onclick = () => {
  QUAL = (QUAL + 1) % 3;
  store.set('px.qual', QUAL);
  $('#qName').textContent = QNAME[QUAL];
  resize();
};
$('#bCel').onclick = () => {
  CEL = !CEL;
  store.set('px.characterArt', CEL ? 'pixel' : 'portrait');
  $('#celName').textContent = CEL ? '像素' : '立繪';
  if (!CEL) window.MV_PUPPET.preload();
};
$('#bFull').onclick = () => {
  const el = document.documentElement;
  const on = document.fullscreenElement || document.webkitFullscreenElement;
  if (on) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) exit.call(document);
    return;
  }
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return;
  try {
    const p = req.call(el);
    if (p && p.catch) p.catch(() => { });
  } catch (e) { }
};
const scrub = $('#scrub');
function scrubTo(clientX) {
  const r = scrub.getBoundingClientRect();
  seek(DUR * clamp((clientX - r.left) / r.width, 0, 1));
}
scrub.addEventListener('pointerdown', e => { scrub.setPointerCapture(e.pointerId); scrubTo(e.clientX); });
scrub.addEventListener('pointermove', e => { if (e.buttons) scrubTo(e.clientX); });

const bottomBar = $('#bottom');
bottomBar.addEventListener('pointerdown', () => { chromeHold++; armChrome(); });
bottomBar.addEventListener('pointerup', () => { chromeHold = Math.max(0, chromeHold - 1); armChrome(); });
bottomBar.addEventListener('pointercancel', () => { chromeHold = Math.max(0, chromeHold - 1); armChrome(); });
let tap = null;
cvs.addEventListener('pointerdown', e => { tap = { x: e.clientX, y: e.clientY, t: performance.now() }; });
cvs.addEventListener('pointerup', e => {
  if (!tap || !chromeMQ() || listOpen()) { tap = null; return; }
  const dt = performance.now() - tap.t;
  const dist = Math.hypot(e.clientX - tap.x, e.clientY - tap.y);
  tap = null;
  if (dt < 350 && dist < 14) toggleChrome();
});

addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const k = e.code === 'Space' ? ' ' : (e.key || '').toLowerCase();
  if (k === ' ') { e.preventDefault(); if (listOpen()) { hideList(); play(); } else toggle(); }
  else if (k === 'arrowleft') { e.preventDefault(); seek(clock - 10); }
  else if (k === 'arrowright') { e.preventDefault(); seek(clock + 10); }
  else if (k === 's') listOpen() ? hideList() : showList();
  else if (k === 'n') loadSong(songIdx + 1, true);
  else if (k === 'p') loadSong(songIdx - 1, true);
  else if (k === 'q') $('#bQual').click();
  else if (k === 'f') $('#bFull').click();
  else if (k === 'c') $('#bCel').click();
  else if (k === 'l') SHEET = !SHEET;
  else if (k === 'escape' && listOpen() && SONG) hideList();
  else if (/^[0-9]$/.test(k)) seek(DUR * (+k) / 10);
});

/* ------------------------------ boot ------------------------------- */
window.__px = {
  state: () => ({ song: SONG && SONG.id, t: clock, playing, qual: QUAL, shot: g.shotIdx, err: lastErr,
                  bw: BW, bh: BH, sc: SC }),
  load: (i, t) => { loadSong(i, false); if (t !== undefined) setTimeout(() => seek(t), 400); },
  sheet: on => { SHEET = !!on; },
  cel: on => { CEL = !!on; },
  seek, play, pause, shots: () => SHOTS.map(s => s.t)
};

buildCards();
resize();
$('#qName').textContent = QNAME[QUAL];
$('#celName').textContent = CEL ? '像素' : '立繪';
if (!CEL) window.MV_PUPPET.preload();
const wanted = CAT.findIndex(s => s.id === store.get('px.song'));
loadSong(wanted >= 0 ? wanted : 0, false);
let prefetchI = 0;
function prefetchNext() {
  if (prefetchI >= CAT.length) return;
  ensureData(CAT[prefetchI++].id, prefetchNext);
}
setTimeout(prefetchNext, 500);
requestAnimationFrame(frameLoop);
})();
