/* =====================================================================
   鋒兄宇宙 · PIXEL MV
   90 年代 PC-98 / 賽璐璐風格的音樂錄影帶引擎。

   畫面全部畫進一塊短邊約 200 邏輯像素的緩衝區，再以整數倍、關閉平滑
   地放大，所以每一條邊都落在一顆方方正正的像素上。所有漸層都是兩色
   之間的 4×4 Bayer 網點 —— 那個年代的 16 色機器就是這樣做的，用 alpha
   漸層永遠做不出那個味道。

   分鏡由 STORY（js/story.js）決定，時間軸直接吃 data/song/*.js 裡already
   烘焙好的段落與歌詞，不需要 Web Audio API，file:// 也能跑。
   ===================================================================== */
(function () {
'use strict';

/* ------------------------------ utils ------------------------------ */
const CAT = window.MV_SONGS || [];
const VERSION = '2.0.0';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t * t;
const easeBack = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// darken / lighten a hex colour, for the second tone of an iris or a strand
function shade(hex, k) {
  if (!hex || hex[0] !== '#' || hex.length < 7) return hex;
  const c = [1, 3, 5].map(i => clamp(Math.round(parseInt(hex.substr(i, 2), 16) * k), 0, 255));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
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
const RM = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

/* ============================== buffer ============================= */
const cvs = $('#screen'), ctx = cvs.getContext('2d', { alpha: false });
const buf = document.createElement('canvas');
const b = buf.getContext('2d', { alpha: false });
let W = 0, H = 0, BW = 0, BH = 0, SC = 1, port = false;
let QUAL = clamp(Math.round(parseFloat(store.get('px.qual')) || 1), 0, 2);
const QNAME = ['粗', '中', '細'];
const BASE = [160, 224, 292];

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  W = Math.max(2, Math.floor(innerWidth * dpr));
  H = Math.max(2, Math.floor(innerHeight * dpr));
  cvs.width = W; cvs.height = H;
  const sc = Math.max(2, Math.round(Math.min(W, H) / BASE[QUAL]));
  const bw = Math.ceil(W / sc), bh = Math.ceil(H / sc);
  if (bw !== BW || bh !== BH || sc !== SC) {
    BW = bw; BH = bh; SC = sc; port = BW < BH * 1.15;
    buf.width = BW; buf.height = BH;
    patterns.clear();
  }
}
addEventListener('resize', resize);

/* ------------------------------ dither ----------------------------- */
/* 4×4 ordered Bayer. `level` 0..16 is how many of the sixteen cells take
   the front colour, so a run of levels reads as a ramp even though only
   two colours are ever on the screen. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const patterns = new Map();
function dit(back, front, level) {
  level = clamp(Math.round(level), 0, 16);
  if (level <= 0) return back;
  if (level >= 16) return front;
  const key = back + '|' + front + '|' + level;
  let p = patterns.get(key);
  if (p) return p;
  const c = document.createElement('canvas'); c.width = c.height = 4;
  const cx = c.getContext('2d');
  cx.fillStyle = back; cx.fillRect(0, 0, 4, 4);
  cx.fillStyle = front;
  for (let i = 0; i < 16; i++) if (BAYER[i] < level) cx.fillRect(i % 4, (i / 4) | 0, 1, 1);
  p = b.createPattern(c, 'repeat');
  patterns.set(key, p);
  return p;
}
function ramp(x, y, w, h, back, front, from, to, steps) {
  steps = steps || 8;
  const bh2 = h / steps;
  for (let i = 0; i < steps; i++) {
    b.fillStyle = dit(back, front, lerp(from, to, steps === 1 ? 0 : i / (steps - 1)));
    b.fillRect(x | 0, (y + i * bh2) | 0, Math.ceil(w), Math.ceil(bh2) + 1);
  }
}

/* ------------------------------ brushes ---------------------------- */
function fill(x, y, w, h, col) {
  b.fillStyle = col; b.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}
function frame(x, y, w, h, col, t) {
  t = t || 1; b.fillStyle = col;
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  b.fillRect(x, y, w, t); b.fillRect(x, y + h - t, w, t);
  b.fillRect(x, y, t, h); b.fillRect(x + w - t, y, t, h);
}
function tri(x1, y1, x2, y2, x3, y3, col) {
  b.fillStyle = col; b.beginPath();
  b.moveTo(x1 | 0, y1 | 0); b.lineTo(x2 | 0, y2 | 0); b.lineTo(x3 | 0, y3 | 0);
  b.closePath(); b.fill();
}
function disc(x, y, r, col) {
  b.fillStyle = col; b.beginPath(); b.arc(x | 0, y | 0, Math.max(1, r), 0, TAU); b.fill();
}
const FAM = '"Microsoft JhengHei UI","PingFang TC","Noto Sans TC","Hiragino Sans",monospace';
function setFont(px, w) { b.font = (w || 700) + ' ' + Math.max(5, Math.round(px)) + 'px ' + FAM; }
function text(str, x, y, px, col, align, w) {
  setFont(px, w); b.textAlign = align || 'left'; b.textBaseline = 'top';
  b.fillStyle = col; b.fillText(str, Math.round(x), Math.round(y));
}
function textOut(str, x, y, px, col, out, align, w) {
  setFont(px, w); b.textAlign = align || 'left'; b.textBaseline = 'top';
  x = Math.round(x); y = Math.round(y);
  b.fillStyle = out;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) b.fillText(str, x + dx, y + dy);
  b.fillStyle = col; b.fillText(str, x, y);
}
function measure(str, px, w) { setFont(px, w); return b.measureText(str).width; }
function fitText(str, px, max, w) {
  while (px > 5 && measure(str, px, w) > max) px--;
  return px;
}
function clipText(str, px, max) {
  if (measure(str, px) <= max) return str;
  const cs = [...str];
  while (cs.length > 1 && measure(cs.join('') + '…', px) > max) cs.pop();
  return cs.join('') + '…';
}

/* ---------------------------- cel figure --------------------------- */
/* A flat-painted person, drawn in a 100-unit box with the feet on the
   anchor and the head top near -100 — roughly four heads tall, which is
   where a 90s sprite sat between "chibi" and "full figure".

   Everything is layers, the way a cel is: back hair, tail, legs, skirt,
   torso, open jacket, arms, head, hair, face. Each character turns a few
   of them on. Colours come from the cast table in js/story.js. */
/* The cel figure is the fallback now: when WebGL2 and the T-pose art in
   data/cast.js are there, the character is the skinned picture puppet from
   js/puppet.js instead, and `pose` / `dance` pick one of its moves. */
const POSE_MOVE = { raise: 'raise', point: 'point2', walk: 'walk', lie: 'lie' };
let CEL = store.get('px.cel') === '1';
function figure(o) {
  if (!CEL && o.id && window.MV_PUPPET && MV_PUPPET.ready(o.id)) {
    const u = o.h / 100, x = Math.round(o.x), base = Math.round(o.y);
    b.fillStyle = dit(o.shadowBack || '#000000', o.shadowFront || '#222222', 7);
    b.fillRect(x - Math.round(16 * u), base - Math.round(2 * u), Math.round(32 * u), Math.round(4 * u));
    MV_PUPPET.draw(b, {
      id: o.id, x: o.x, y: o.y, h: o.h, t: o.t, flip: o.flip, outline: o.outline,
      move: o.dance || POSE_MOVE[o.pose] || 'idle',
      beat: g.beatN + (o.beatOff || 0),
      i: o.pose === 'lie' ? (o.awake ? 1 : 0) : o.di !== undefined ? o.di : Math.round((o.ph || 0) * 3)
    });
    return;
  }
  const h = o.h, u = h / 100, x = Math.round(o.x), base = Math.round(o.y);
  const U = v => Math.round(v * u);
  const t = o.t, OUT = '#140b0c';
  const skin = o.skin || '#f7d9bb', skin2 = o.skin2 || '#dcb191';
  const hair = o.hair || '#2a1a2e', hair2 = o.hair2 || '#150c18';
  const cloth = o.cloth || '#4f63b8', cloth2 = o.cloth2 || '#33407e';
  const pants = o.pants || cloth2, shoes = o.shoes || '#26222e';
  const bob = Math.sin(t * 1.9 + (o.ph || 0)) * u * .8 - (o.hop || 0) * u;
  const y = base + bob;
  const P = (dx, dy, w, hh, col) => fill(x + U(dx), y + U(dy), U(w), U(hh), col);
  const lie = o.pose === 'lie';

  // floor shadow
  b.fillStyle = dit(o.shadowBack || '#000000', o.shadowFront || '#222222', 7);
  b.fillRect(x + U(lie ? -26 : -14), base - U(2), U(lie ? 52 : 28), U(4));

  if (lie) {
    // the loaf: the cat spends a whole song refusing to stand up
    const tw = Math.sin(t * 2.1) * u * 4;
    fill(x + U(22), y + U(-14) + tw, U(22), U(3), o.tailCol || hair);
    fill(x + U(40), y + U(-16) + tw, U(5), U(5), o.tailTip || hair2);
    P(-26, -24, 52, 24, hair);
    P(-26, -24, 52, 5, hair2);
    P(6, -24, 20, 24, hair2);
    P(-34, -40, 24, 22, hair);
    P(-34, -40, 24, 3, hair2);
    if (o.patch) P(-32, -40, 9, 7, o.patch);
    for (const sd of [0, 1]) {
      const ex = sd ? -16 : -34;
      fill(x + U(ex), y + U(-50), U(8), U(11), hair);
      fill(x + U(ex + 2), y + U(-47), U(4), U(6), o.earIn || '#ffb4d6');
    }
    for (const sd of [0, 1]) {
      const ex = sd ? -19 : -31;
      if (o.awake) { fill(x + U(ex), y + U(-34), U(6), U(6), '#ffffff');
                     fill(x + U(ex + 1), y + U(-33), U(4), U(4), o.eye || '#c44a7a'); }
      else fill(x + U(ex), y + U(-31), U(6), 1, '#2a1020');
    }
    P(-26, -27, 8, 5, o.muzzle || '#fff6f0');
    P(-23, -27, 3, 2, '#d8566a');
    return;
  }

  /* ---- behind the body: long hair and tails ---- */
  const sway = Math.sin(t * 1.5 + (o.ph || 0)) * 2;
  if (o.tailKind === 'whale') {
    const tc = o.tailCol || hair;
    P(10, -34, 14, 8, tc);
    P(20, -52 + sway, 13, 24, tc);
    P(16, -60 + sway, 22, 9, tc);
    P(30, -56 + sway, 8, 16, hair2);
  } else if (o.tailKind === 'cat') {
    const tc = o.tailCol || hair;
    P(12, -30, 9, 5, tc);
    P(19, -44 + sway, 7, 16, tc);
    P(21, -58 + sway, 8, 15, o.tailTip || tc);
  }
  if (o.long) {                         // the fall of long hair, behind
    P(-17, -94, 34, 30, hair);
    P(-17, -64, 34, 26, o.hair3 || hair);
    P(-18, -92, 5, 54, hair2);
    P(13, -92, 5, 54, hair2);
  }

  /* ---- build: a man is broad in the shoulder, a woman is not ---- */
  const male = !!o.male, fem = !!o.fem;
  const TW = male ? 16 : fem ? 11 : 13;          // half-width at the shoulder
  const WW = male ? 13 : fem ? 9 : 11;           // half-width at the waist
  const LW = male ? 8 : 6;                       // leg width
  const LG = male ? 2 : 1;                       // gap between the legs

  /* ---- legs ---- */
  const stride = o.pose === 'walk' ? Math.sin(t * 5) * 3 : 0;
  if (o.skirt) {
    P(-LG - LW + stride, -26, LW, 26, skin);
    P(LG - stride, -26, LW, 26, skin);
    if (o.socks) {
      P(-LG - LW + stride, -15, LW, 15, o.socks);
      P(LG - stride, -15, LW, 15, o.socks);
    }
  } else {
    P(-LG - LW + stride, -36, LW, 36, pants);
    P(LG - stride, -36, LW, 36, pants);
    P(LG + LW - 3 - stride, -36, 3, 36, cloth2);
  }
  P(-LG - LW - 1 + stride, -5, LW + 2, 5, shoes);
  P(LG - 1 - stride, -5, LW + 2, 5, shoes);

  /* ---- torso ---- */
  P(-TW, -66, TW * 2, 8, cloth);                 // shoulders
  P(-WW, -58, WW * 2, 24, cloth);                // waist
  if (o.inner) {
    P(-4, -66, 8, 30, o.inner);
    P(-5, -66, 1, 30, cloth2); P(4, -66, 1, 30, cloth2);
  } else {
    P(WW - 5, -58, 5, 24, cloth2);
    P(TW - 5, -66, 5, 8, cloth2);
  }
  P(-TW, -66, TW * 2, 1, OUT);
  if (o.skirt) {                                  // a flared skirt, unmistakably
    P(-WW - 1, -40, WW * 2 + 2, 5, o.skirt);
    P(-WW - 5, -35, WW * 2 + 10, 6, o.skirt);
    P(-WW - 9, -29, WW * 2 + 18, 6, o.skirt);
    P(-WW - 9, -25, WW * 2 + 18, 2, o.skirtTrim || o.skirt);
    for (let i = -2; i <= 2; i++) P(i * 5, -35, 1, 10, o.skirtFold || cloth2);
  }
  if (o.apron) {
    P(-9, -58, 18, 24, o.apronCol || '#ffffff');
    P(-9, -58, 18, 1, '#d8d4dc');
    if (o.apronMark) { P(-4, -46, 8, 5, o.apronMark); P(-6, -44, 2, 2, o.apronMark); }
  }
  if (o.pouch) { P(-8, -46, 16, 8, cloth2); P(-8, -46, 16, 1, OUT); }
  if (o.logo) { P(-8, -56, 16, 5, '#ffffff'); P(-6, -55, 12, 3, cloth2); }
  if (o.sailor) {
    P(-TW, -66, TW * 2, 8, o.sailorCol || '#1e2a4e');
    P(-4, -66, 8, 12, o.sailorCol || '#1e2a4e');
    P(-3, -60, 6, 9, o.tieCol || '#1e2a4e');
    P(-TW, -66, TW * 2, 1, '#ffffff');
  }
  P(-6, -68, 12, 3, o.collar || '#f2f2f2');
  if (o.bowtie) { P(-5, -68, 10, 4, o.bowtie); P(-1, -67, 3, 2, '#ffffff'); }

  /* ---- arms ---- */
  const swing = Math.sin(t * 2.1 + (o.ph || 0)) * 1.4;
  const raise = o.pose === 'raise', point = o.pose === 'point';
  const AW = male ? 6 : 5, AX = TW;
  P(-AX - AW, -64 + swing, AW, 20, cloth);
  P(-AX - AW, -45 + swing, AW, 5, skin);
  if (raise) { P(AX, -86, AW, 24, cloth); P(AX, -90, AW + 1, 6, skin); }
  else if (point) { P(AX, -58, 15, AW, cloth); P(AX + 15, -59, 6, 6, skin); }
  else { P(AX, -64 - swing, AW, 20, cloth); P(AX, -45 - swing, AW, 5, skin); }

  /* ---- head ---- */
  if (o.cat) {
    // a round skull, big triangular ears, a proper muzzle and whiskers
    P(-9, -97, 18, 2, hair);
    P(-12, -95, 24, 20, hair);
    P(-9, -75, 18, 3, hair);
    P(-6, -72, 12, 2, hair);
    P(6, -95, 6, 20, hair2);
    if (o.patch) { P(-10, -95, 9, 8, o.patch); P(-3, -94, 5, 5, o.patch2 || o.patch); }
    for (const sd of [-1, 1]) {                   // proper triangular ears
      const ex = sd < 0 ? -13 : 4;
      tri(x + U(ex), y + U(-93), x + U(ex + 9), y + U(-93), x + U(ex + (sd < 0 ? 2 : 7)), y + U(-108), hair);
      tri(x + U(ex + 2), y + U(-95), x + U(ex + 7), y + U(-95), x + U(ex + (sd < 0 ? 3 : 6)), y + U(-104),
          o.earIn || '#ffb4d6');
    }
    // muzzle: two cheeks, a nose, a mouth
    P(-7, -82, 14, 8, o.muzzle || '#fff6f0');
    P(-6, -74, 12, 2, o.muzzle || '#fff6f0');
    P(-2, -82, 4, 3, o.nose || '#e0788e');
    P(-1, -79, 2, 2, hair2);
    P(-5, -78, 4, 1, hair2); P(1, -78, 4, 1, hair2);
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++)
      P(sd < 0 ? -13 : 6, -82 + i * 3, 8 * sd, 1, o.whisker || hair2);
  } else {
    P(-3, -74, 6, 5, skin2);                     // neck
    if (male) {
      // square jaw, straight sides, a hint of stubble along the line
      P(-10, -96, 20, 22, skin);
      P(6, -96, 4, 22, skin2);
      P(-9, -74, 18, 2, skin);
      P(-10, -86, 3, 11, skin2);                 // sideburn shadow
      P(7, -86, 3, 11, skin2);
    } else {
      // a narrower skull and a chin that tapers in two steps
      P(-9, -97, 18, 2, skin);
      P(-10, -95, 20, 18, skin);
      P(-9, -77, 18, 2, skin);
      P(-7, -75, 14, 2, skin);
      P(-4, -73, 8, 1, skin);
      P(5, -95, 5, 18, skin2);
    }
    if (o.hood) {
      const hc = o.hood, hc2 = o.hood2 || hair2;
      P(-14, -106, 28, 24, hc);
      P(-14, -106, 28, 3, hc2);
      P(9, -106, 5, 24, hc2);
      P(-11, -84, 22, 3, hc2);
      if (o.beak) { P(-3, -92, 8, 5, o.beak); P(-3, -92, 8, 1, '#b8860b'); }
      for (const sd of [-1, 1]) {
        P(sd < 0 ? -11 : 5, -101, 6, 6, '#ffffff');
        P(sd < 0 ? -9 : 7, -99, 2, 2, hc);
      }
      P(-8, -88, 16, 5, hair);
    } else {
      // fringe, cut into strands so it does not read as a helmet
      P(-11, -101, 22, 3, hair);
      P(-12, -98, 24, 12, hair);
      const tip = shade(hair, 1.25);
      for (let i = -2; i <= 2; i++) P(i * 5 - 1, -86, 2, 3 + (i % 2 ? 2 : 0), hair);
      P(-12, -98, 3, 22, hair2);
      P(9, -98, 3, 22, hair2);
      P(-10, -96, 7, 2, o.shine || '#ffffff');
      P(-1, -95, 5, 2, o.shine || '#ffffff');
      P(-13, -88, 3, 2, tip); P(10, -88, 3, 2, tip);
      if (o.band) P(-13, -100, 26, 3, o.band);     // a maid headband
      if (o.twin) {
        const sw3 = Math.sin(t * 1.6 + (o.ph || 0)) * 1.4;
        for (const sd of [-1, 1]) {
          const tx = sd < 0 ? -21 : 14;
          P(tx, -97, 7, 8, hair);
          fill(x + U(tx), y + U(-90) + sw3 * sd, U(7), U(26), hair);
          fill(x + U(tx + (sd < 0 ? 0 : 5)), y + U(-90) + sw3 * sd, U(2), U(26), hair2);
          if (o.ribbon) P(tx, -99, 7, 4, o.ribbon);
        }
      }
      if (o.ahoge) {
        const aw = Math.sin(t * 2.4) * 1.4;
        P(-1 + aw, -111, 3, 9, hair);
        P(-3 + aw, -113, 7, 3, hair);
      }
      if (o.ears === 'cat') for (const sd of [-1, 1]) {
        const ex = sd < 0 ? -14 : 6;
        tri(x + U(ex), y + U(-97), x + U(ex + 8), y + U(-97), x + U(ex + (sd < 0 ? 1 : 7)), y + U(-111), hair);
        tri(x + U(ex + 2), y + U(-99), x + U(ex + 6), y + U(-99), x + U(ex + (sd < 0 ? 2 : 6)), y + U(-107),
            o.earIn || '#ffb4d6');
      }
      if (o.ears === 'fin') for (const sd of [-1, 1]) {
        const ex = sd < 0 ? -22 : 12;
        P(ex, -92, 10, 6, o.finCol || hair);
        P(ex + (sd < 0 ? 0 : 6), -90, 4, 3, hair2);
      }
    }
  }

  /* ---- face ---- */
  /* Big two-tone eyes with a lash line and a hard highlight: this is the
     one part a viewer actually reads, so it gets the most pixels.
     A man's eyes are narrower, a cat's pupil is a vertical slit. */
  const blink = ((t * .7 + (o.ph || 0)) % 1) > .94;
  const ey = o.cat ? -93 : -91;
  const iris = o.eye || '#3a6ad8', iris2 = shade(iris, .6);
  const EW = male ? 6 : 7, EH = male ? 7 : 9;
  for (const sd of [-1, 1]) {
    const ex = sd < 0 ? -(EW + 2) : 2;
    if (blink) { P(ex, ey + EH / 2, EW, 1, OUT); continue; }
    P(ex, ey, EW, EH, '#ffffff');                       // sclera
    P(ex, ey + 1, EW, EH - 2, iris);                    // iris
    P(ex, ey + EH - 4, EW, 3, iris2);                   // shaded lower half
    if (o.cat) P(ex + Math.floor(EW / 2) - 1, ey + 1, 2, EH - 2, OUT);   // slit
    else P(ex + 1, ey + 3, EW - 2, EH - 5, OUT);        // pupil
    P(ex, ey, EW, 2, OUT);                              // lash line
    P(ex + (sd < 0 ? 1 : EW - 3), ey + 2, 2, 2, '#ffffff');   // highlight
    P(ex + (sd < 0 ? EW - 2 : 0), ey + EH - 3, 1, 1, '#ffffff');
  }
  if (!o.cat) {
    const brow = male ? 2 : 1;
    P(-(EW + 2), ey - 3, EW, brow, hair2);
    P(2, ey - 3, EW, brow, hair2);
    P(1, -82, 1, 1, skin2);                             // nose
    if (o.sing > .2) { P(-3, -80, 6, 4, '#7a2030'); P(-2, -79, 4, 2, '#d8566a'); }
    else P(-2, -80, 4, 1, OUT);
  }
  if (o.glasses) {
    const gc = o.glasses === true ? '#3a3a44' : o.glasses;
    P(-10, ey - 1, 9, 1, gc); P(-10, ey + 8, 9, 1, gc);
    P(-10, ey - 1, 1, 9, gc); P(-2, ey - 1, 1, 9, gc);
    P(2, ey - 1, 9, 1, gc);   P(2, ey + 8, 9, 1, gc);
    P(2, ey - 1, 1, 9, gc);   P(10, ey - 1, 1, 9, gc);
    P(-1, ey + 3, 3, 1, gc);
  }
  if (o.beard) {
    const bc = o.beard === true ? hair2 : o.beard;
    P(-4, -77, 8, 3, bc); P(-2, -82, 4, 2, bc);
  }
  if (o.blush) {
    b.fillStyle = dit(skin, '#ff8fa4', 8);
    b.fillRect(x + U(-10), y + U(-83), U(4), U(3));
    b.fillRect(x + U(6), y + U(-83), U(4), U(3));
  }
}

/* --------------------------- bust portrait ------------------------- */
/* The close-up: head and shoulders in a framed window, the way a PC-98
   adventure game put a character beside the text. It gets about three
   times the pixels the stage figure does, so this is where the face
   actually gets drawn — layered fringe, a four-tone iris, an eyelid
   crease, a lower lash. Drawn in a 100×125 box, head at the top. */
function bust(o) {
  const w = o.w, u = w / 100, x = Math.round(o.x), yTop = Math.round(o.y);
  const U = v => Math.round(v * u);
  const t = o.t, OUT = '#140b0c';
  const skin = o.skin || '#f7d9bb', skin2 = o.skin2 || '#dcb191';
  const skin3 = shade(skin, .86);
  const hair = o.hair || '#2a1a2e', hair2 = o.hair2 || '#150c18';
  const hair3 = o.hair3 || shade(hair, 1.3);
  const cloth = o.cloth || '#4f63b8', cloth2 = o.cloth2 || '#33407e';
  const breathe = Math.sin(t * 1.7 + (o.ph || 0)) * u * 1.2;
  const y = yTop + breathe;
  const P = (dx, dy, ww, hh, col) => fill(x + U(dx), y + U(dy), U(ww), U(hh), col);
  const male = !!o.male, cat = !!o.cat;

  /* ---- behind: the long fall of hair ---- */
  if (o.long && !o.hood) {
    P(8, 18, 84, 66, hair);
    P(8, 74, 84, 51, hair3);
    P(8, 18, 9, 107, hair2);
    P(83, 18, 9, 107, hair2);
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

  /* ---- shoulders and clothing ---- */
  P(4, 82, 92, 43, cloth);
  P(4, 82, 92, 3, OUT);
  if (o.inner) { P(36, 82, 28, 43, o.inner); P(34, 82, 2, 43, cloth2); P(64, 82, 2, 43, cloth2); }
  else P(66, 82, 30, 43, cloth2);
  if (o.sailor) {
    P(4, 82, 92, 20, o.sailorCol || '#1e2a4e');
    P(38, 82, 24, 34, o.sailorCol || '#1e2a4e');
    P(44, 96, 12, 24, o.tieCol || '#1e2a4e');
    P(4, 82, 92, 2, '#ffffff');
  }
  if (o.apron) { P(30, 92, 40, 33, o.apronCol || '#ffffff'); P(30, 92, 40, 2, '#d8d4dc'); }
  P(38, 76, 24, 10, skin2);                      // neck
  P(38, 76, 24, 3, skin3);
  P(32, 80, 36, 6, o.collar || '#f2f2f2');
  if (o.bowtie) { P(40, 78, 20, 9, o.bowtie); P(47, 80, 6, 5, '#ffffff'); }

  /* ---- head ---- */
  if (cat) {
    for (const sd of [-1, 1]) {                  // ears first, behind the skull
      const ex = sd < 0 ? 12 : 60;
      tri(x + U(ex), y + U(26), x + U(ex + 28), y + U(26), x + U(ex + (sd < 0 ? 4 : 24)), y + U(-12), hair);
      tri(x + U(ex + 6), y + U(22), x + U(ex + 22), y + U(22), x + U(ex + (sd < 0 ? 9 : 19)), y + U(-2),
          o.earIn || '#ffb4d6');
    }
    P(20, 12, 60, 6, hair);
    P(16, 18, 68, 50, hair);
    P(20, 68, 60, 6, hair);
    P(64, 18, 20, 50, hair2);
    if (o.patch) { P(18, 14, 26, 22, o.patch); P(40, 12, 14, 14, o.patch2 || o.patch); }
    P(34, 56, 32, 16, o.muzzle || '#fff6f0');
    P(38, 70, 24, 4, o.muzzle || '#fff6f0');
    P(44, 54, 12, 8, o.nose || '#e0788e');
    P(47, 62, 6, 5, hair2);
    P(36, 66, 12, 2, hair2); P(52, 66, 12, 2, hair2);
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++)
      P(sd < 0 ? 4 : 66, 54 + i * 7, 30 * sd, 2, o.whisker || hair2);
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
    P(26, 60, 48, 14, hair);                     // the fringe under the hood
  } else {
    P(24, 6, 52, 5, skin);
    P(19, 11, 62, 60, skin);
    P(24, 71, 52, 5, skin);
    P(31, 76, 38, 4, skin);
    P(64, 11, 17, 65, skin3);                    // cel shadow down one side
    if (male) { P(19, 40, 5, 32, skin3); P(76, 40, 5, 32, skin3); }
    // fringe in separate locks, with a highlight band across it
    P(22, -2, 56, 8, hair);
    P(16, 6, 68, 22, hair);
    P(16, 6, 6, 62, hair2);
    P(78, 6, 6, 62, hair2);
    for (let i = 0; i < 5; i++) {
      const lx = 20 + i * 13;
      P(lx, 26, 10, 5 + (i % 2 ? 7 : 0), hair);
      P(lx, 26, 3, 4 + (i % 2 ? 5 : 0), hair2);
    }
    P(26, 11, 22, 5, o.shine || '#ffffff');
    P(54, 13, 15, 4, o.shine || '#ffffff');
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
    if (o.ears === 'fin') for (const sd of [-1, 1]) {
      const ex = sd < 0 ? -6 : 76;
      P(ex, 34, 30, 14, o.finCol || hair);
      P(ex + (sd < 0 ? 0 : 20), 38, 10, 7, hair2);
      P(ex, 34, 30, 3, hair3);
    }
  }

  /* ---- the face, where all the pixels go ---- */
  const blink = ((t * .62 + (o.ph || 0)) % 1) > .95;
  const iris = o.eye || '#3a6ad8';
  const irisD = shade(iris, .5), irisL = shade(iris, 1.45);
  const EW = male ? 14 : 17, EH = male ? 15 : 22;
  const ey = cat ? 28 : 34;
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
      P(ex + 4, ey + 6, EW - 8, EH - 12, OUT);       // pupil
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
    P(48, 60, 4, 3, skin3);                          // nose
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
    P(40, 74, 20, 6, bc); P(46, 62, 8, 5, bc);
  }
  if (o.blush) {
    b.fillStyle = dit(skin, '#ff8fa4', 9);
    b.fillRect(x + U(24), y + U(56), U(12), U(8));
    b.fillRect(x + U(64), y + U(56), U(12), U(8));
  }
}

/* the framed portrait: window chrome, name plate, slide-in */
function portrait(g, who, p) {
  if (!who) return;
  const P = g.P;
  const bh2 = Math.round(BH * (port ? .36 : .58));
  const bw2 = Math.round(bh2 * .8);
  const slide = (1 - easeOut(clamp(p, 0, 1))) * bw2 * .5;
  const bx = Math.round(4 - slide), by = Math.round(g.fy - bh2 + BH * .04);
  b.save();
  b.globalAlpha = clamp(p * 1.6, 0, 1);
  fill(bx + 2, by + 2, bw2, bh2, '#000');
  fill(bx, by, bw2, bh2, P.sky);
  // a dithered backdrop so the portrait does not float in a void
  ramp(bx + 2, by + 11, bw2 - 4, bh2 - 13, P.sky, P.bg2, 2, 9, 5);
  frame(bx, by, bw2, bh2, P.lit, 1);
  fill(bx + 1, by + 1, bw2 - 2, 9, P.bg2);
  text(who.name || '', bx + 3, by + 2, 7, P.ink, 'left', 700);
  b.save();
  b.beginPath(); b.rect(bx + 2, by + 11, bw2 - 4, bh2 - 13); b.clip();
  const box = { x: bx + 2, y: by + 11, w: bw2 - 4, h: bh2 - 13 };
  if (CEL || !who.id || !window.MV_PUPPET ||
      !MV_PUPPET.draw(b, { id: who.id, box, t: g.t, beat: g.beatN, i: 1, move: g.F.level > .35 ? 'bounce' : 'idle' }))
    bust({ ...who, x: bx + bw2 * .03, y: by + 13, w: bw2 * .94, t: g.t, sing: g.F.level });
  b.restore();
  b.restore();
}

/* --------------------------- PC-98 window -------------------------- */
function win(P, x, y, w, h, title) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  fill(x + 2, y + 2, w, h, '#000000');
  fill(x, y, w, h, P.sky);
  frame(x, y, w, h, P.lit, 1);
  fill(x + 1, y + 1, w - 2, 9, P.bg2);
  text(title, x + 3, y + 2, 7, P.ink, 'left', 700);
  fill(x + w - 8, y + 3, 5, 5, P.ink);
  frame(x + w - 8, y + 3, 5, 5, P.sky, 1);
}
function gauge(P, x, y, w, label, v, col) {
  text(label, x, y, 7, P.lit, 'left', 700);
  const lw = Math.min(46, w * .4), bx = x + lw, bw = w - lw - 24;
  frame(bx, y, bw, 7, P.bg2, 1);
  const f = Math.max(0, Math.round((bw - 2) * clamp(v, 0, 1)));
  b.fillStyle = dit(P.sky, col, 16);
  b.fillRect(bx + 1, y + 1, f, 5);
  text(Math.round(clamp(v, 0, 1) * 100) + '%', x + w, y, 7, P.ink, 'right', 700);
}

/* ------------------------------- CRT ------------------------------- */
function crt(g) {
  b.fillStyle = 'rgba(0,0,0,.20)';
  for (let y = 0; y < BH; y += 2) b.fillRect(0, y, BW, 1);
  for (let i = 0; i < 4; i++) {
    b.fillStyle = 'rgba(0,0,0,.09)';
    b.fillRect(0, i, BW, 1); b.fillRect(0, BH - 1 - i, BW, 1);
    b.fillRect(i, 0, 1, BH); b.fillRect(BW - 1 - i, 0, 1, BH);
  }
  if (g.F.flash > .5) {
    const y = ((g.t * 240) % (BH + 40)) - 20;
    b.fillStyle = 'rgba(255,255,255,' + (g.F.flash * .06).toFixed(3) + ')';
    b.fillRect(0, y | 0, BW, 5);
  }
}

/* ====================== the shared scene library ==================== */
/* The story file composes these. Each one paints a whole background into
   the buffer and leaves the foreground to the shot. */
const SCENE = {
  /* an interior: back wall, window onto a skyline that can grow, a lamp,
     a floor running to a vanishing point */
  room(g, o) {
    const P = g.P;
    ramp(0, 0, BW, BH * .82, P.bg0, P.bg1, 3, 12, 9);
    const wx = Math.round(BW * (port ? .28 : .24)), wy = Math.round(BH * (port ? .3 : .16));
    const ww = Math.round(BW * (port ? .44 : .26)), wh = Math.round(BH * .34);
    // window: sky, then a skyline whose height is the story's to set
    ramp(wx, wy, ww, wh, P.sky, P.bg2, 14, 2, 6);
    const grow = clamp(o.city === undefined ? 0 : o.city, 0, 1);
    for (let i = 0; i < 14; i++) {
      const h1 = hash(i * 5.3), h2 = hash(i * 9.1);
      const bw2 = ww / 14;
      const hh = wh * (.12 + h1 * .62) * grow;
      if (hh < 2) continue;
      const bx = wx + i * bw2, by = wy + wh - hh;
      fill(bx, by, bw2 - 1, hh, h2 > .5 ? P.bg2 : P.bg1);
      b.fillStyle = P.lamp;
      for (let k = 0; k < hh / 5; k++) if (hash(i * 31 + k) > .55) b.fillRect(Math.round(bx + 1), Math.round(by + 2 + k * 5), 1, 2);
    }
    frame(wx, wy, ww, wh, P.bg2, 2);
    fill(wx, wy + wh / 2, ww, 1, P.bg2);
    fill(wx + ww / 2, wy, 1, wh, P.bg2);
    // lamp
    const lx = Math.round(BW * (port ? .18 : .13)), ly = Math.round(BH * .07);
    const glow = 10 + g.F.punch * 5;
    for (let i = 6; i >= 1; i--) {
      const r = BH * (.14 + i * .08);
      b.fillStyle = dit(P.bg1, P.bg2, glow - i * 1.6);
      b.beginPath(); b.moveTo(lx, ly); b.lineTo(lx - r * .7, ly + r); b.lineTo(lx + r * .7, ly + r); b.closePath(); b.fill();
    }
    fill(lx - 1, 0, 2, ly, P.bg2);
    tri(lx - 7, ly + 6, lx + 7, ly + 6, lx, ly - 3, P.lamp);
    // floor
    const fy = g.fy;
    ramp(0, fy, BW, BH - fy, P.bg0, P.bg1, 9, 2, 5);
    fill(0, fy, BW, 1, P.bg2);
    b.fillStyle = P.bg0;
    for (let i = -6; i <= 6; i++) {
      const x0 = lx + i * BW * .09, x1 = lx + i * BW * .3;
      b.beginPath(); b.moveTo(x0 | 0, fy); b.lineTo(x1 | 0, BH); b.lineTo((x1 + 2) | 0, BH); b.lineTo((x0 + 1) | 0, fy);
      b.closePath(); b.fill();
    }
    // desk
    if (o.desk !== false) {
      const dy = Math.round(g.fy - BH * .07), dw = Math.round(BW * (port ? .62 : .46)), dx = Math.round(BW * .06);
      fill(dx, dy, dw, 4, P.warm);
      fill(dx, dy + 4, dw, 2, P.bg0);
      fill(dx + 4, dy + 6, 3, BH * .12, P.bg2);
      fill(dx + dw - 7, dy + 6, 3, BH * .12, P.bg2);
      o.deskY = dy; o.deskX = dx; o.deskW = dw;
    }
  },

  /* a live stage: truss, beams that sweep, a crowd of silhouettes */
  stage(g, o) {
    const P = g.P;
    ramp(0, 0, BW, BH, P.sky, P.bg0, 2, 9, 8);
    // moving beams
    const n = QUAL === 0 ? 3 : 5;
    for (let i = 0; i < n; i++) {
      const a = Math.sin(g.t * (.4 + i * .12) + i) * .5;
      const x0 = BW * (.15 + i * .18), y0 = BH * .06;
      const x1 = x0 + Math.sin(a) * BW * .3, y1 = BH * .8;
      b.fillStyle = dit(P.bg0, P.bg2, 4 + g.F.level * 7);
      b.beginPath(); b.moveTo(x0 - 3, y0); b.lineTo(x0 + 3, y0);
      b.lineTo(x1 + BW * .07, y1); b.lineTo(x1 - BW * .07, y1); b.closePath(); b.fill();
      fill(x0 - 3, y0 - 4, 7, 4, g.F.punch > .4 ? P.ink : P.warm);
    }
    // truss
    fill(0, BH * .05, BW, 3, P.bg2);
    for (let i = 0; i < BW; i += 8) fill(i, BH * .05, 1, 3, P.bg1);
    // stage floor
    const fy = g.fy;
    fill(0, fy, BW, BH - fy, P.bg0);
    fill(0, fy, BW, 1, P.lit);
    ramp(0, fy + 1, BW, BH * .08, P.bg0, P.bg1, 6, 0, 4);
    // crowd
    const cy = Math.round(BH * .86);
    for (let i = 0; i < BW; i += 5) {
      const h1 = hash(i * 1.7);
      const hh = BH * (.05 + h1 * .05) * (1 + g.F.level * .5);
      disc(i + 2, cy - hh, 2.2, '#000000');
      fill(i, cy - hh + 2, 5, hh, '#000000');
    }
  },

  /* a temple / auction hall: pillars, steps, a shaft of light */
  temple(g, o) {
    const P = g.P;
    ramp(0, 0, BW, BH, P.sky, P.bg1, 3, 11, 9);
    const cx = BW * .5;
    b.fillStyle = dit(P.bg1, P.lamp, 5 + g.F.level * 5);
    b.beginPath(); b.moveTo(cx - BW * .1, 0); b.lineTo(cx + BW * .1, 0);
    b.lineTo(cx + BW * .3, BH * .8); b.lineTo(cx - BW * .3, BH * .8); b.closePath(); b.fill();
    for (const s of [-1, 1]) {
      const px = cx + s * BW * .38;
      fill(px - 7, BH * .1, 14, BH * .68, P.bg2);
      fill(px - 9, BH * .1, 18, 5, P.lit);
      fill(px - 9, BH * .74, 18, 5, P.lit);
      fill(px + 2, BH * .1, 3, BH * .68, P.bg1);
    }
    // steps up to the dais
    for (let i = 0; i < 4; i++) {
      const w = BW * (.5 - i * .06), h = BH * .04;
      fill(cx - w / 2, g.fy - i * h, w, h, i % 2 ? P.bg1 : P.bg2);
      fill(cx - w / 2, g.fy - i * h, w, 1, P.lit);
    }
  },

  /* a pure screen: the RPG sheet / the terminal. No room at all. */
  screen(g, o) {
    const P = g.P;
    ramp(0, 0, BW, BH, P.sky, P.bg0, 2, 8, 6);
    b.fillStyle = P.bg1;
    for (let y = 0; y < BH; y += 6) b.fillRect(0, y, BW, 1);
    for (let x = 0; x < BW; x += 6) b.fillRect(x, 0, 1, BH);
    frame(3, 3, BW - 6, BH - 6, P.bg2, 1);
  },

  /* an old television, with whatever the shot wants inside the tube */
  tv(g, o) {
    const P = g.P;
    ramp(0, 0, BW, BH, '#0b0704', P.bg0, 3, 8, 6);
    const w = Math.round(port ? BW - 10 : Math.min(g.sw - 8, BH * .9));
    const h = Math.round(BH * .62);
    const x = Math.round(g.cx - w / 2), y = Math.round(BH * .1);
    fill(x - 5, y - 5, w + 10, h + 22, P.bg1);      // cabinet
    frame(x - 5, y - 5, w + 10, h + 22, P.bg2, 2);
    ramp(x, y, w, h, P.sky, P.bg0, 10, 3, 5);       // tube
    frame(x, y, w, h, '#000000', 2);
    o.tube = { x: x + 3, y: y + 3, w: w - 6, h: h - 6 };
    // knobs
    disc(x + w - 12, y + h + 10, 4, P.warm);
    disc(x + w - 26, y + h + 10, 4, P.bg2);
    fill(x + 8, y + h + 8, w * .5, 5, P.bg2);
  },

  /* a banquet: long table, lanterns, coins coming down */
  table(g, o) {
    const P = g.P;
    ramp(0, 0, BW, BH, P.sky, P.bg1, 4, 12, 8);
    for (let i = 0; i < 5; i++) {
      const lx = BW * (.12 + i * .19);
      fill(lx - 1, 0, 2, BH * .12, P.bg2);
      disc(lx, BH * .14, BH * .035, P.acc);
      disc(lx, BH * .14, BH * .02, P.warm);
    }
    const ty = Math.round(g.fy);
    fill(0, ty, BW, BH * .06, P.acc);
    fill(0, ty, BW, 2, P.warm);
    ramp(0, ty + BH * .06, BW, BH * .24, P.bg0, P.bg1, 8, 2, 4);
    o.tableY = ty;
  }
};

/* ------------------------- foreground pieces ----------------------- */
/* Number slams in, holds, and shrinks away — the workhorse of every
   "37 歲" / "20 萬" / "333 億" beat in these songs. */
function bigNum(g, str, p, col) {
  const P = g.P;
  const grow = p < .2 ? easeBack(p / .2) : 1;
  const a = p > .85 ? 1 - (p - .85) / .15 : 1;
  if (a <= .02) return;
  let size = Math.round(BH * .17 * grow);
  size = fitText(str, size, g.sw - 14, 900);
  const y = BH * .22, cx = g.cx;
  b.save(); b.globalAlpha = a;
  const w = measure(str, size, 900);
  fill(cx - w / 2 - 6, y - 4, w + 12, size + 8, '#07060c');
  frame(cx - w / 2 - 6, y - 4, w + 12, size + 8, P.warm, 1);
  text(str, cx, y, size, col || P.warm, 'center', 900);
  b.restore();
}
/* number cards laid out on a table, each one able to light up */
function cards(g, list, lit, y, size) {
  const P = g.P;
  // in landscape the right half belongs to the dialog, so the row wraps
  // into the half that is left instead of running under the window
  const perRow = port ? list.length : 3;
  const room = (port ? BW - 12 : BW * .5);
  const cw = Math.min(Math.round(BW * (port ? .15 : .1)),
                      Math.floor((room - (perRow - 1) * 5) / perRow));
  const ch = Math.round(cw * 1.28), gap = Math.round(cw * .2);
  const rows = Math.ceil(list.length / perRow);
  for (let r = 0; r < rows; r++) {
    const row = list.slice(r * perRow, (r + 1) * perRow);
    const total = row.length * cw + (row.length - 1) * gap;
    let x = Math.round((port ? BW / 2 : BW * .28) - total / 2);
    const cy = Math.round(y + r * (ch + gap));
    for (let i = 0; i < row.length; i++) {
      const k = r * perRow + i, on = lit & (1 << k);
      fill(x + 2, cy + 2, cw, ch, '#000');
      fill(x, cy, cw, ch, on ? P.warm : P.bg1);
      frame(x, cy, cw, ch, on ? P.ink : P.bg2, 1);
      text(row[i], x + cw / 2, cy + ch * .32, size || Math.round(cw * .34),
           on ? '#1a1008' : P.lit, 'center', 900);
      x += cw + gap;
    }
  }
}

/* three spinning reels that stop one at a time */
function slot(g, reels, p) {
  const P = g.P;
  const rw = Math.round(Math.min(BW * .16, g.sw * .25)), rh = Math.round(BH * .17);
  const gap = Math.round(rw * .16);
  let x = Math.round(g.cx - (rw * 3 + gap * 2) / 2);
  const y = Math.round(BH * .24);
  for (let i = 0; i < 3; i++) {
    const stopAt = .3 + i * .18;
    const spinning = p < stopAt;
    fill(x, y, rw, rh, P.sky);
    frame(x, y, rw, rh, P.warm, 2);
    const ch = spinning ? '0123456789'[(g.t * 26 + i * 3 | 0) % 10] : reels[i];
    text(ch, x + rw / 2, y + rh * .22, Math.round(rh * .56),
         spinning ? P.lit : P.ink, 'center', 900);
    if (!spinning && p - stopAt < .12) frame(x - 2, y - 2, rw + 4, rh + 4, P.ink, 1);
    x += rw + gap;
  }
}
/* lottery balls rolling out one by one */
function balls(g, nums, p) {
  const P = g.P;
  const r = Math.round(BH * .045);
  const total = nums.length;
  const y = Math.round(BH * .3);
  for (let i = 0; i < total; i++) {
    const out = clamp((p - i * .12) / .25, 0, 1);
    if (out <= 0) continue;
    const x = g.cx + (i - (total - 1) / 2) * r * 2.6;
    const dy = (1 - easeOut(out)) * -BH * .2;
    disc(x, y + dy, r, '#ffffff');
    disc(x - r * .3, y + dy - r * .3, r * .3, '#ffffff');
    frame(x - r, y + dy - r, r * 2, r * 2, P.bg2, 1);
    text(nums[i], x, y + dy - r * .5, Math.round(r * 1.1), '#1a1008', 'center', 900);
  }
}
/* confetti / coins / fur — one particle system, three costumes */
function fallers(g, kind, power) {
  const P = g.P;
  const n = (QUAL === 2 ? 26 : QUAL === 1 ? 16 : 9) * clamp(power, 0, 1);
  for (let i = 0; i < n; i++) {
    const sp = .1 + hash(i * 3.7) * .18;
    const x = hash(i) * BW;
    const y = ((hash(i + 41) + g.t * sp) % 1.1) * BH;
    const s = Math.round(BH * (.012 + hash(i + 7) * .014));
    const sway = Math.sin(g.t * 2 + i) * 3;
    if (kind === 'coin') {
      disc(x + sway, y, s, P.warm);
      fill(x + sway - s * .3, y - s * .4, s * .6, 1, '#fff6c0');
    } else if (kind === 'fur') {
      b.fillStyle = P.ink;
      b.beginPath(); b.ellipse(x + sway, y, s * 1.4, s * .6, Math.sin(g.t + i), 0, TAU); b.fill();
    } else {
      fill(x + sway, y, s, s * 1.6, i % 3 === 0 ? P.acc : i % 3 === 1 ? P.warm : P.acc2);
    }
  }
}
/* a full-width band of type that slams in — LEVEL UP, evolution, 囍 */
function slam(g, str, p, col) {
  const a = p < .12 ? p / .12 : p > .8 ? (1 - p) / .2 : 1;
  if (a <= .02) return;
  const P = g.P;
  const y = Math.round(BH * .42);
  const size = fitText(str, Math.round(BH * .16), BW - 12, 900);
  b.save(); b.globalAlpha = a;
  fill(0, y - 5, BW, size + 10, P.acc);
  fill(0, y - 6, BW, 1, P.ink); fill(0, y + size + 5, BW, 1, P.ink);
  textOut(str, BW / 2, y, size, col || P.ink, '#000', 'center', 900);
  b.restore();
}
/* a poster / book page / certificate pinned in the middle */
function plate(g, title, lines, p) {
  const P = g.P;
  const w = Math.round(BW * (port ? .8 : .52)), h = Math.round(BH * .46);
  const x = Math.round(BW / 2 - w / 2), y = Math.round(BH * .22 - (1 - easeOut(clamp(p * 3, 0, 1))) * BH * .3);
  fill(x + 3, y + 3, w, h, '#000');
  fill(x, y, w, h, P.ink);
  frame(x, y, w, h, P.bg0, 2);
  fill(x + 4, y + 4, w - 8, Math.round(h * .3), P.acc);
  text(clipText(title, 10, w - 12), x + w / 2, y + h * .1, 10, '#fff', 'center', 900);
  for (let i = 0; i < lines.length; i++)
    text(clipText(lines[i], 8, w - 14), x + 7, y + h * .4 + i * 11, 8, P.bg0, 'left', 700);
}

/* ============================== engine ============================= */
let SONG = null, AA = null, LY = null, SEC = [], BANDS = null, RMSA = null, NB = 12;
let DUR = 1, BEAT = .7, STORY = null;
let clock = 0, playing = false, songIdx = 0, last = 0, onsetIdx = 0;
const F = { bass: 0, low: 0, mid: 0, high: 0, level: 0, flash: 0, beat: 0, punch: 0 };
const audio = $('#audio');

function bandAt(t, a, c) {
  if (!BANDS) return 0;
  const ff = t * AA.bandFps, f0 = clamp(Math.floor(ff), 0, AA.frames - 1);
  const f1 = Math.min(f0 + 1, AA.frames - 1), fr = clamp(ff - f0, 0, 1);
  let s = 0;
  for (let i = a; i <= c; i++) s += lerp(BANDS[f0 * NB + i], BANDS[f1 * NB + i], fr);
  return s / ((c - a + 1) * 255);
}
function rmsAt(t) { return RMSA ? RMSA[clamp(Math.round(t * AA.rmsFps), 0, RMSA.length - 1)] / 255 : 0; }
function sampleAudio(t, dt) {
  const tg = { bass: bandAt(t, 0, 1), low: bandAt(t, 2, 3), mid: bandAt(t, 4, 7), high: bandAt(t, 8, 11), level: rmsAt(t) };
  for (const k in tg) {
    const up = tg[k] > F[k];
    F[k] += (tg[k] - F[k]) * (1 - Math.pow(1 - (up ? .55 : .12), dt * 60));
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
function resetOnsets(t) { onsetIdx = 0; const O = AA ? AA.onsets : []; while (onsetIdx < O.length && O[onsetIdx] < t) onsetIdx++; }

function lineAt(t) {
  const L = LY.lines;
  let lo = 0, hi = L.length - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (L[m].t <= t) { r = m; lo = m + 1; } else hi = m - 1; }
  if (r >= 0 && t > L[r].t + L[r].d + 1.2) return -1;
  return r;
}
function shotAt(t) {
  const S = STORY.shots;
  let r = 0;
  for (let i = 0; i < S.length; i++) if (t >= S[i].t) r = i;
  return r;
}

/* ------------------------------ render ----------------------------- */
const g = {
  ctx: b, t: 0, dt: 0, lt: 0, prog: 0, F: F, P: null, W: 0, H: 0, QUAL: 2,
  shot: null, shotIdx: 0, shotAge: 0, shotP: 0, line: null, prev: null, cx: 0, sw: 0, fy: 0,
  lineAge: 0, lineP: 0, port: false, BW: 0, BH: 0, beatN: 0
};
let lastErr = null, SHEET = false;

function paint() {
  const P = g.P, S = STORY;

  // the story paints the scene
  try { S.scene(g, SCENE); } catch (e) { lastErr = 'scene: ' + e.message; }

  /* ---- the shot's own foreground, under the chrome so the window and
         the gauges are never covered by the set pieces ---- */
  try { if (STORY.front) STORY.front(g, FRONT); } catch (e) { lastErr = 'front: ' + e.message; }

  /* ---- the close-up, when the shot calls for one ---- */
  if (g.shot && g.shot.bust && window.MV_STORY.__who) {
    const who = window.MV_STORY.__who(g.shot.bust);
    if (who) portrait(g, who, clamp(g.shotAge / .55, 0, 1));
  }

  /* ---- chrome: the loading bar ---- */
  const hw = Math.round(port ? BW * .5 : BW * .26), hx = 4, hy = 4;
  fill(hx, hy, hw, 11, P.sky);
  frame(hx, hy, hw, 11, P.lit, 1);
  text('P (' + S.tag + ')', hx + 3, hy + 2, 7, P.ink, 'left', 700);
  text(Math.round(g.prog * 100) + '%', hx + hw - 3, hy + 2, 7, P.warm, 'right', 700);
  fill(hx, hy + 12, hw, 5, P.sky);
  frame(hx, hy + 12, hw, 5, P.bg2, 1);
  b.fillStyle = P.acc;
  const seg = Math.floor((hw - 2) * g.prog);
  for (let i = 0; i < seg; i += 3) b.fillRect(hx + 1 + i, hy + 13, 2, 3);

  /* ---- the vertical shop banner ---- */
  const bw2 = Math.max(13, Math.round(BW * .062)), bx = BW - bw2 - 4;
  const by = Math.round(BH * (port ? .38 : .07));
  const chars = [...S.banner];
  const fs = Math.max(7, Math.min(bw2 - 3, 11));
  const bh2 = chars.length * (fs + 2) + 6;
  fill(bx, by, bw2, bh2, P.acc);
  frame(bx, by, bw2, bh2, P.warm, 1);
  for (let i = 0; i < chars.length; i++)
    text(chars[i], bx + bw2 / 2, by + 4 + i * (fs + 2), fs, P.ink, 'center', 800);

  /* ---- the terminal window: IN / OUT ---- */
  // portrait has no room for a tall window beside the stage, so it sits
  // under the loading bar and drops the IN line to keep the gauges clear
  const ww = Math.round(port ? BW - 10 : BW * .4);
  const wx = port ? 5 : Math.round(BW - ww - bw2 - 9);
  const wy = Math.round(port ? BH * .13 : BH * .14);
  const wh = Math.round(port ? BH * .21 : BH * .42);
  win(P, wx, wy, ww, wh, S.exe);
  const pad = 5, tx = wx + pad, tw = ww - pad * 2;
  let ty = wy + 13;
  const fsz = Math.max(7, Math.min(10, Math.round(BW * .024)));
  if (g.prev && !port) {
    text('IN ：', tx, ty, fsz, P.lit, 'left', 700);
    text(clipText(g.prev.text, fsz, tw - 24), tx + 24, ty, fsz, P.lit, 'left', 700);
    ty += fsz + 4;
  }
  if (g.line) {
    text('OUT：', tx, ty, fsz, P.warm, 'left', 700);
    const all = [...g.line.text];
    const shown = all.slice(0, Math.max(1, Math.ceil(all.length * clamp(g.lineP * 1.4, 0, 1)))).join('');
    const cut = clipText(shown, fsz, tw - 24);
    text(cut, tx + 24, ty, fsz, P.ink, 'left', 700);
    if ((g.t * 3 | 0) % 2) fill(tx + 24 + measure(cut, fsz), ty + 1, 3, fsz, P.warm);
  }
  const gy = wy + wh - 21;
  gauge(P, tx, gy, tw, S.gauges[0], S.gaugeA ? S.gaugeA(g) : clamp(F.level * 1.6, 0, 1), P.warm);
  gauge(P, tx, gy + 10, tw, S.gauges[1], S.gaugeB ? S.gaugeB(g) : g.prog, P.acc2);

  /* ---- the big subtitle ---- */
  if (g.line) {
    // Long spoken lines are the reason this wraps: shrinking a 60-character
    // narration to one row makes it unreadable, which is worse than two rows.
    const sub = g.line.text;
    const maxW = BW - 14, big = Math.min(Math.round(BW * .072), 24);
    let rows = [sub], fs2 = fitText(sub, big, maxW, 900);
    if (fs2 < big * .62) {
      const cs = [...sub];
      let cut = -1, best = 1e9;
      for (let i = 1; i < cs.length; i++) {
        if (cs[i - 1] !== ' ' && cs[i - 1] !== '　') continue;
        const d = Math.abs(i - cs.length / 2);
        if (d < best) { best = d; cut = i; }
      }
      if (cut < 0) cut = Math.round(cs.length / 2);
      rows = [cs.slice(0, cut).join('').trim(), cs.slice(cut).join('').trim()];
      fs2 = Math.min(big, ...rows.map(r => fitText(r, big, maxW, 900)));
    }
    const lh = fs2 + 3, blockH = rows.length * lh;
    const sy = BH - blockH - Math.round(BH * (port ? .09 : .11));
    // a solid plate, not a dithered one: a screen door behind the strokes
    // is what makes pixel type unreadable. Flat colour, no outline.
    fill(0, sy - 4, BW, blockH + 8, '#07060c');
    fill(0, sy - 5, BW, 1, P.warm);
    for (let i = 0; i < rows.length; i++)
      text(rows[i], BW / 2, sy + i * lh, fs2, P.ink, 'center', 900);
  }

  /* ---- section stinger ---- */
  if (g.secAge < 1.4 && ((g.t * 8 | 0) % 2 || g.secAge < .4)) {
    textOut('SCENE ' + String(g.shotIdx + 1).padStart(2, '0'),
            port ? BW - bw2 - 8 : BW * .5, Math.round(BH * .045), 8, P.warm, '#000',
            port ? 'right' : 'center', 800);
  }

  if (SHEET && window.MV_STORY && window.MV_STORY.__cast) {
    const roster = window.MV_STORY.__cast();
    fill(0, 0, BW, BH, '#101018');
    const n = roster.length, fh = Math.round(BH * .44), gap = BW / n;
    for (let i = 0; i < n; i++) {
      const cx = Math.round(gap * (i + .5));
      fill(cx - gap / 2 + 1, BH * .2, gap - 2, BH * .52, i % 2 ? '#181824' : '#14141e');
      figure({ x: cx, y: Math.round(BH * .72), h: fh, t: g.t, sing: .4, ph: i * .7,
               ...roster[i], dance: 'routine', di: i, shadowBack: '#101018', shadowFront: '#20202c' });
      text(roster[i].name, cx, BH * .78, 8, '#f4f7ff', 'center', 800);
    }
    text('CAST SHEET', BW / 2, BH * .08, 11, '#ffd24a', 'center', 900);
  }

  crt(g);
}

const FRONT = { bigNum, cards, slot, balls, fallers, slam, plate, figure, bust, portrait, fill, frame, text, textOut,
                dit, ramp, tri, disc, measure, fitText, clipText, win, gauge, hash, clamp, lerp,
                easeOut, easeIn, easeBack };

function frameLoop(now) {
  requestAnimationFrame(frameLoop);
  const nowS = now / 1000;
  let dt = nowS - last; last = nowS;
  if (dt > .1) dt = .1; if (dt <= 0) dt = .016;
  if (!SONG || W < 2) return;

  if (playing) {
    clock += dt;
    const real = audio.currentTime;
    if (Math.abs(real - clock) > .06) clock = lerp(clock, real, .35);
    if (Math.abs(real - clock) > .4) clock = real;
  } else clock = audio.currentTime;
  clock = clamp(clock, 0, DUR);

  const t = clock;
  sampleAudio(t, dt);

  const si = shotAt(t), shot = STORY.shots[si];
  const idx = lineAt(t);
  g.t = t; g.dt = dt; g.lt = t; g.prog = clamp(t / DUR, 0, 1);
  g.P = STORY.pal; g.QUAL = QUAL; g.port = port; g.BW = BW; g.BH = BH; g.W = W; g.H = H;
  // the dialog owns the right-hand column in landscape, so the stage has
  // its own centre. Derived from the dialog's real left edge rather than
  // guessed, or set pieces end up half a window too wide.
  const bnW = Math.max(13, Math.round(BW * .062));
  const dlgL = Math.round(BW - BW * .4 - bnW - 9);
  // a close-up takes the lower left, so the stage slides right to clear it
  const pw = shot.bust ? Math.round(BH * (port ? .36 : .58) * .8) + 10 : 0;
  g.sw = port ? BW : Math.max(40, dlgL - 6 - pw);
  g.cx = port ? Math.round(BW * .5) : Math.round(pw + g.sw / 2);
  // the floor everything stands on, kept clear of the subtitle band
  g.fy = Math.round(BH * (port ? .7 : .74));
  g.shot = shot; g.shotIdx = si;
  g.beatN = (t - AA.beat0) / BEAT;
  g.shotAge = t - shot.t;
  const nextT = STORY.shots[si + 1] ? STORY.shots[si + 1].t : DUR;
  g.shotP = clamp((t - shot.t) / Math.max(.4, nextT - shot.t), 0, 1);
  g.secAge = g.shotAge;
  g.line = idx >= 0 ? LY.lines[idx] : null;
  g.prev = idx > 0 ? LY.lines[idx - 1] : null;
  g.lineAge = g.line ? t - g.line.t : 0;
  g.lineP = g.line ? clamp(g.lineAge / Math.max(.5, g.line.d), 0, 1) : 0;

  paint();

  // blit: integer scale, no smoothing, whole-pixel shake on the big hits
  ctx.imageSmoothingEnabled = false;
  let dx = 0, dy = 0;
  if (!RM && F.punch > .4) {
    dx = Math.round(Math.sin(t * 61) * F.punch * 2) * SC;
    dy = Math.round(Math.cos(t * 47) * F.punch * 1.5) * SC;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  }
  ctx.drawImage(buf, dx, dy, BW * SC, BH * SC);

  updateHud(t, idx);
}

/* ============================== player ============================= */
let lastTime = '', lastPct = -1;
function updateHud(t, idx) {
  const pct = clamp(t / DUR, 0, 1) * 100;
  if (Math.abs(pct - lastPct) > .05) { lastPct = pct; $('#played').style.width = pct + '%'; }
  const tt = fmt(t) + ' / ' + fmt(DUR);
  if (tt !== lastTime) { lastTime = tt; $('#time').textContent = tt; }
}

function applySong(d, autoplay) {
  SONG = d; AA = d.analysis;
  BANDS = b64u8(AA.bands); RMSA = b64u8(AA.rms); NB = AA.bandCount;
  DUR = AA.duration; BEAT = 60 / AA.bpm;
  LY = { title: d.title, cast: d.cast, tagline: d.tagline, lines: d.lines.map((l, i) => ({ ...l, idx: i })) };
  SEC = d.sections || [];
  STORY = (window.MV_STORY && window.MV_STORY[d.id]) || window.MV_STORY.__default(d);
  STORY.shots.sort((a, c) => a.t - c.t);
  audio.src = d.audio; audio.load();
  clock = 0; resetOnsets(0);
  document.title = d.title + ' · PIXEL MV';
  $('#ttl').textContent = d.title;
  $('#cast').textContent = d.cast;
  store.set('px.song', d.id);
  if (autoplay) play(); else { playing = false; $('#play').textContent = '▶'; }
}
function ensureData(id, cb) {
  const bag = window.MV_SONG_DATA;
  if (bag && bag[id]) return cb(bag[id]);
  const s = document.createElement('script');
  s.src = 'data/song/' + id + '.js?v=' + VERSION;
  s.onload = () => { const d = window.MV_SONG_DATA && window.MV_SONG_DATA[id]; if (d) cb(d); };
  document.head.appendChild(s);
}
function loadSong(i, autoplay) {
  if (!CAT.length) return;
  songIdx = ((i % CAT.length) + CAT.length) % CAT.length;
  const meta = CAT[songIdx];
  [...document.querySelectorAll('.card')].forEach((c, k) => c.classList.toggle('cur', k === songIdx));
  ensureData(meta.id, d => applySong(d, autoplay));
}
function play() { audio.play().then(() => { playing = true; $('#play').textContent = '❚❚'; }).catch(() => { }); }
function pause() { audio.pause(); playing = false; $('#play').textContent = '▶'; }
function toggle() { playing ? pause() : play(); }
function seek(t) { t = clamp(t, 0, DUR - .05); audio.currentTime = t; clock = t; resetOnsets(t); }
audio.addEventListener('ended', () => loadSong(songIdx + 1, true));

/* song picker */
function buildCards() {
  const grid = $('#grid');
  grid.innerHTML = '';
  CAT.forEach((s, i) => {
    const d = document.createElement('button');
    d.className = 'card';
    d.innerHTML = '<span class="n">' + String(i + 1).padStart(2, '0') + '</span>' +
                  '<span class="t"></span><span class="c"></span>';
    d.querySelector('.t').textContent = s.title;
    d.querySelector('.c').textContent = s.cast + '　·　' + fmt(s.dur);
    d.onclick = () => { hideList(); loadSong(i, true); };
    grid.appendChild(d);
  });
}
function listOpen() { return !$('#start').classList.contains('gone'); }
function showList() { $('#start').classList.remove('gone'); }
function hideList() { $('#start').classList.add('gone'); }

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
  store.set('px.cel', CEL ? '1' : '0');
  $('#celName').textContent = CEL ? '手繪' : '立繪';
};
$('#bFull').onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => { });
};
const scrub = $('#scrub');
function scrubTo(clientX) {
  const r = scrub.getBoundingClientRect();
  seek(DUR * clamp((clientX - r.left) / r.width, 0, 1));
}
scrub.addEventListener('pointerdown', e => { scrub.setPointerCapture(e.pointerId); scrubTo(e.clientX); });
scrub.addEventListener('pointermove', e => { if (e.buttons) scrubTo(e.clientX); });

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
  seek, play, pause, shots: () => STORY && STORY.shots.map(s => s.t)
};

buildCards();
resize();
$('#qName').textContent = QNAME[QUAL];
$('#celName').textContent = CEL ? '手繪' : '立繪';
if (window.MV_PUPPET) MV_PUPPET.preload();
const wanted = CAT.findIndex(s => s.id === store.get('px.song'));
loadSong(wanted >= 0 ? wanted : 0, false);
requestAnimationFrame(t => { last = t / 1000; requestAnimationFrame(frameLoop); });
})();
