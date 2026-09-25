/* =====================================================================
   鋒兄宇宙 · 3D MV — cartoon cast
   One hand-drawn troupe per song, painted with canvas paths on top of the
   3D scene. The engine owns the camera, the spectrum and the type; this
   file only knows how to draw and how to move to the beat, so it takes
   everything it needs through the `g` object the engine hands it.

   Everything is drawn inside a 100×100 cel centred on the origin, so a
   figure can be dropped anywhere with a single pixel-height number and
   the line weights come out right at every screen size.
   ===================================================================== */
window.MV_TOONS = (function () {
'use strict';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeBack = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
// deterministic scatter: the cast has to land in the same place every
// replay, so nothing here uses Math.random()
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const INK = 'rgba(10,7,20,.92)';

/* ----------------------------- brushes ----------------------------- */
function cel(g, x, y, px, rot, fn) {
  const c = g.ctx, k = px / 100;
  c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(k, k);
  fn(c); c.restore();
}
function line(c, w, col) {
  c.lineWidth = w; c.strokeStyle = col || INK; c.lineJoin = 'round'; c.lineCap = 'round';
}
/* flat fill + dark contour: the cartoon look, and it keeps the cast
   readable over whatever the 3D scene is doing behind it */
function paint(c, col, w) {
  c.fillStyle = col; c.fill();
  if (w !== 0) { line(c, w || 4); c.stroke(); }
}
function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
function oval(c, x, y, rx, ry, rot) {
  c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, TAU);
}
function rr(c, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}
function poly(c, pts) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
}
function star(c, x, y, r, n, inner) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * TAU - Math.PI / 2, rr2 = i % 2 ? r * (inner || .45) : r;
    const px = x + Math.cos(a) * rr2, py = y + Math.sin(a) * rr2;
    i ? c.lineTo(px, py) : c.moveTo(px, py);
  }
  c.closePath();
}
function label(g, c, text, px, col, y) {
  g.font(px, 900);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  line(c, px * .34); c.strokeText(text, 0, y || 0);
  c.fillStyle = col; c.fillText(text, 0, y || 0);
}

/* ------------------------------ faces ------------------------------ */
/* One blink cycle per figure, offset by `seed` so a pair never blinks in
   unison — that is what makes two identical chibis read as two people. */
function blinkAt(t, seed) {
  const p = (t * .55 + seed) % 1;
  return p > .93 ? 1 : 0;
}
function face(c, o) {
  const shut = o.blink || (o.eye === 'happy' ? 1 : 0);
  const ex = o.ex || 8, ey = o.ey || -2;
  c.fillStyle = INK;
  for (const s of [-1, 1]) {
    if (shut) {
      c.beginPath(); line(c, 3.2);
      c.moveTo(s * ex - 4, ey); c.quadraticCurveTo(s * ex, ey - (o.eye === 'happy' ? 5 : 0) - 2, s * ex + 4, ey);
      c.stroke();
    } else if (o.eye === 'wow') {
      circ(c, s * ex, ey, 5); paint(c, '#fff', 2.6);
      circ(c, s * ex + 1, ey, 2.4); c.fillStyle = INK; c.fill();
    } else {
      circ(c, s * ex, ey, 3.4); c.fillStyle = INK; c.fill();
      circ(c, s * ex + 1.3, ey - 1.3, 1.2); c.fillStyle = 'rgba(255,255,255,.9)'; c.fill();
    }
  }
  const m = o.mouth || 'smile';
  c.beginPath(); line(c, 3.2);
  if (m === 'o') { circ(c, 0, 10, 4.5); paint(c, INK, 0); }
  else if (m === 'grin') {
    c.beginPath(); c.moveTo(-8, 7); c.quadraticCurveTo(0, 18, 8, 7); c.closePath();
    paint(c, '#2a1020', 2.6);
  } else { c.moveTo(-6, 8); c.quadraticCurveTo(0, 14, 6, 8); c.stroke(); }
  if (o.blush) {
    c.globalAlpha = .55;
    for (const s of [-1, 1]) { oval(c, s * 15, 6, 5, 3); c.fillStyle = '#ff7a9c'; c.fill(); }
    c.globalAlpha = 1;
  }
}

/* A chibi in a 100-unit cel: feet at y=50, head top around y=-46.
   `o.swing` waves the arms, `o.hop` lifts the whole body. */
function chibi(c, o) {
  const skin = o.skin || '#ffd9b8', body = o.body || '#4a6cff', hair = o.hair || '#2a1a2e';
  const sw = o.swing || 0, hop = o.hop || 0;
  c.save(); c.translate(0, -hop);
  // legs
  line(c, 4); c.strokeStyle = INK;
  for (const s of [-1, 1]) {
    c.beginPath(); c.moveTo(s * 8, 24); c.lineTo(s * 8 + Math.sin(sw) * s * 3, 46); c.stroke();
    oval(c, s * 8 + Math.sin(sw) * s * 3, 48, 7, 4); paint(c, '#22203a', 3);
  }
  // body
  rr(c, -17, -12, 34, 38, 13); paint(c, body, 4);
  // arms
  for (const s of [-1, 1]) {
    const a = sw * s + (o.armUp ? -s * 1.1 : 0);
    const hx = s * 17 + Math.cos(a - Math.PI / 2) * 4, hy = -4;
    const ex2 = hx + s * 9 + Math.sin(a) * 9, ey2 = hy + 16 - Math.cos(a) * 9;
    c.beginPath(); line(c, 7); c.strokeStyle = body; c.moveTo(hx, hy); c.lineTo(ex2, ey2); c.stroke();
    c.beginPath(); line(c, 3.4); c.strokeStyle = INK; c.moveTo(hx, hy); c.lineTo(ex2, ey2); c.stroke();
    circ(c, ex2, ey2, 5.5); paint(c, skin, 3);
    if (o.hand) o.hand(c, s, ex2, ey2);
  }
  // head
  circ(c, 0, -32, 23); paint(c, skin, 4);
  // hair: a simple cap so each cast can recolour one thing and look new
  c.beginPath();
  c.moveTo(-23, -34); c.quadraticCurveTo(-20, -60, 0, -56);
  c.quadraticCurveTo(20, -60, 23, -34);
  c.quadraticCurveTo(12, -44, 0, -42); c.quadraticCurveTo(-12, -44, -23, -34);
  paint(c, hair, 3.4);
  c.save(); c.translate(0, -32); face(c, o); c.restore();
  if (o.hat) o.hat(c);
  c.restore();
}

/* comic speech balloon — the 圖文 half of the show */
function bubble(g, x, y, px, text, a, col) {
  if (a <= .02) return;
  const c = g.ctx;
  cel(g, x, y, px, 0, cc => {
    cc.globalAlpha = a;
    const w = Math.max(44, text.length * 26 + 18);
    rr(cc, -w / 2, -34, w, 46, 16); paint(cc, '#fffaf0', 4);
    poly(cc, [[-9, 10], [3, 10], [-2, 26]]); paint(cc, '#fffaf0', 4);
    label(g, cc, text, 26, col || '#2a1020', -11);
    cc.globalAlpha = 1;
  });
}
/* starburst onomatopoeia for the big moments */
function boom(g, x, y, px, text, a, col, rot) {
  if (a <= .02) return;
  cel(g, x, y, px, rot || 0, cc => {
    cc.globalAlpha = a;
    star(cc, 0, 0, 52, 11, .66); paint(cc, col || '#ffd24a', 4);
    label(g, cc, text, 27, '#2a1020', 1);
    cc.globalAlpha = 1;
  });
}

/* ----------------------------- the sky ----------------------------- */
/* Props drifting through the cartoon band. Deterministic positions, so
   they never strobe, and half the count when quality is turned down. */
function sky(g, n, paintProp) {
  const N = g.QUAL === 2 ? n : Math.ceil(n * .5);
  const band = Math.max(g.MIN * .1, g.bot - g.top);
  for (let i = 0; i < N; i++) {
    const h1 = hash(i), h2 = hash(i + 91), h3 = hash(i + 277);
    const sp = (.018 + h2 * .03) * g.MOTION;
    const x = (((h1 + g.t * sp) % 1.16) - .08) * g.W;
    const y = g.top + (((h3 + g.t * sp * .42) % 1.02)) * band * .74;
    const px = g.MIN * (.026 + h2 * .03);
    const a = (.3 + h3 * .38) * g.pw;
    cel(g, x, y + Math.sin(g.t * .8 + i * 1.7) * g.MIN * .012, px,
        Math.sin(g.t * .35 + i) * .45, cc => { cc.globalAlpha = a; paintProp(cc, i, g); cc.globalAlpha = 1; });
  }
}

/* --------------------------- shared props -------------------------- */
const prop = {
  heart(c, col) { c.beginPath();
    c.moveTo(0, 26); c.bezierCurveTo(-34, 2, -22, -26, 0, -10);
    c.bezierCurveTo(22, -26, 34, 2, 0, 26); paint(c, col || '#ff3b6b', 4); },
  spark(c, col) { star(c, 0, 0, 30, 4, .3); paint(c, col || '#ffd24a', 3.4); },
  drop(c, col) { c.beginPath();
    c.moveTo(0, -30); c.bezierCurveTo(20, -4, 22, 12, 0, 26);
    c.bezierCurveTo(-22, 12, -20, -4, 0, -30); paint(c, col || '#35e8ff', 4); },
  bolt(c, col) { poly(c, [[6, -32], [-16, 4], [-1, 4], [-7, 32], [17, -6], [1, -6]]);
    paint(c, col || '#ffe14a', 3.4); },
  flame(c, col) { c.beginPath();
    c.moveTo(0, 30); c.bezierCurveTo(-26, 12, -14, -6, -4, -30);
    c.bezierCurveTo(2, -12, 14, -20, 12, -6); c.bezierCurveTo(24, 2, 20, 20, 0, 30);
    paint(c, col || '#ff9238', 3.6); },
  paw(c, col) { circ(c, 0, 8, 13); paint(c, col || '#ffb4d6', 3.2);
    for (let i = 0; i < 4; i++) { const a = -Math.PI * .82 + i * .55;
      circ(c, Math.cos(a) * 17, Math.sin(a) * 17 + 2, 5.4); paint(c, col || '#ffb4d6', 2.6); } },
  note(c, col) { c.beginPath(); line(c, 5); c.strokeStyle = col || '#8cffbe';
    c.moveTo(10, 24); c.lineTo(10, -24); c.lineTo(28, -30); c.stroke();
    oval(c, 2, 24, 11, 8, -.3); paint(c, col || '#8cffbe', 3.2); },
  coin(c, col) { circ(c, 0, 0, 24); paint(c, col || '#ffd24a', 4);
    circ(c, 0, 0, 16); paint(c, 'rgba(255,255,255,.35)', 0); },
  page(c, col) { rr(c, -20, -26, 40, 52, 5); paint(c, col || '#fff6e0', 3.4);
    line(c, 3); c.strokeStyle = 'rgba(40,30,60,.4)';
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-13, -12 + i * 12); c.lineTo(13, -12 + i * 12); c.stroke(); } },
  plane(c, col) { poly(c, [[-30, -14], [30, 0], [-30, 18], [-20, 2]]); paint(c, col || '#dfe6ff', 3.4);
    c.beginPath(); line(c, 2.6); c.moveTo(-30, -14); c.lineTo(-20, 2); c.lineTo(-30, 18); c.stroke(); },
  bulb(c, col) { circ(c, 0, -6, 20); paint(c, col || '#ffe9a8', 3.6);
    rr(c, -8, 12, 16, 12, 4); paint(c, '#c9c2d8', 3); },
  gear(c, col) { c.beginPath();
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU;
      const r1 = 26, r2 = 17;
      c.lineTo(Math.cos(a - .12) * r2, Math.sin(a - .12) * r2);
      c.lineTo(Math.cos(a - .05) * r1, Math.sin(a - .05) * r1);
      c.lineTo(Math.cos(a + .05) * r1, Math.sin(a + .05) * r1);
      c.lineTo(Math.cos(a + .12) * r2, Math.sin(a + .12) * r2); }
    c.closePath(); paint(c, col || '#9fd8ff', 3.2);
    circ(c, 0, 0, 7); paint(c, 'rgba(20,14,34,.6)', 0); },
  crown(c, col) { poly(c, [[-26, 18], [-30, -20], [-13, -4], [0, -26], [13, -4], [30, -20], [26, 18]]);
    paint(c, col || '#ffd24a', 4); },
  bill(c, col) { rr(c, -30, -17, 60, 34, 5); paint(c, col || '#9ff0bd', 3.6);
    circ(c, 0, 0, 10); paint(c, 'rgba(255,255,255,.5)', 2.4); },
  fur(c, col) { c.beginPath();
    c.moveTo(-24, 6); c.quadraticCurveTo(-8, -22, 4, -4); c.quadraticCurveTo(16, -24, 24, 2);
    c.quadraticCurveTo(4, 16, -24, 6); paint(c, col || '#ffe1ef', 3); },
  pixel(c, col) { rr(c, -18, -18, 36, 36, 4); paint(c, col || '#8cff82', 3.4); },
  pencil(c, col) { poly(c, [[-6, -30], [6, -30], [6, 18], [0, 30], [-6, 18]]);
    paint(c, col || '#ffc978', 3.4);
    poly(c, [[-6, 18], [6, 18], [0, 30]]); paint(c, '#3a2a20', 2.6); }
};

/* ---------------------------- the casts ---------------------------- */
/* Every song gets its own troupe. `g.bot` is the floor the cast stands
   on: it rises to meet the sung line so the drawing and the type never
   fight for the same pixels. */

function figSize(g) { return clamp((g.bot - g.top) * .52, g.MIN * .058, g.MIN * .2); }
/* a cel is 100 tall with the feet at +50, so a figure standing on the
   floor line has its centre half a cel above it */
function stand(g, x, floor, px, fn) { cel(g, x, floor - px * .5, px, 0, fn); }
function beatHop(g, ph) { return (g.F.punch * .5 + g.F.beat * .5) * (g.MIN * .016) * (1 + Math.sin(ph)); }
/* a gag pops on the first beat of every sung line and fades out fast */
function gag(g, words) {
  if (g.lineIdx < 0 || !words.length) return null;
  const a = clamp(1 - (g.lineAge - .15) / 1.15, 0, 1) * clamp(g.lineAge / .18, 0, 1);
  if (a <= .02) return null;
  return { text: words[g.lineIdx % words.length], a: a, pop: easeBack(clamp(g.lineAge / .3, 0, 1)) };
}

const CASTS = {

  /* 鋒塗力百年夢 — two founders at the drafting table, the tower they are
     drawing grows a floor on every section */
  dream: {
    words: ['百年！', '蓋起來', '一枝筆', '衝！'],
    draw(g) {
      const c = g.ctx, s = figSize(g), y = g.bot;
      sky(g, 12, (cc, i) => (i % 3 === 0 ? prop.plane(cc) : i % 3 === 1 ? prop.bulb(cc) : prop.spark(cc, '#a8b8ff')));
      // the tower: one block per section, the top one still dropping in
      const floors = 2 + (g.secIdx + 1);
      const bw = s * .46, bh = s * .17, bx = g.CX + s * 1.25;
      for (let i = 0; i < floors; i++) {
        const drop = i === floors - 1 ? (1 - easeBack(clamp(g.secAge / .9, 0, 1))) * -s * 1.6 : 0;
        const w = bw * (1 - i * .07);
        cel(g, bx, y - bh * (i + .5) * 1.06 + drop, s, 0, cc => {
          rr(cc, -w / s * 50, -bh / s * 50, (w / s) * 100, (bh / s) * 100, 8);
          paint(cc, i % 2 ? '#3a4a8c' : '#4f63b8', 4);
          cc.fillStyle = 'rgba(255,240,180,.75)';
          for (let k = -1; k <= 1; k++) cc.fillRect(k * 22 - 6, -8, 12, 16);
        });
      }
      // drafting table
      cel(g, g.CX, y - s * .1, s, 0, cc => {
        rr(cc, -78, -12, 156, 14, 5); paint(cc, '#6b4a34', 4);
        line(cc, 6); cc.strokeStyle = '#5a3c28';
        cc.beginPath(); cc.moveTo(-60, 2); cc.lineTo(-66, 42); cc.moveTo(60, 2); cc.lineTo(66, 42); cc.stroke();
        rr(cc, -46, -30, 92, 20, 3); paint(cc, '#e8f0ff', 3.4);
        line(cc, 2.6); cc.strokeStyle = 'rgba(60,80,160,.6)';
        cc.beginPath(); cc.moveTo(-34, -24); cc.lineTo(34, -24); cc.moveTo(-34, -17); cc.lineTo(14, -17); cc.stroke();
      });
      const write = Math.sin(g.t * 6.5) * .35;
      stand(g, g.CX - s * .72, y, s, cc => chibi(cc, {
        body: '#4f63b8', hair: '#22163a', swing: write, hop: beatHop(g, 0),
        blink: blinkAt(g.t, .1), eye: 'open', mouth: 'smile'
      }));
      stand(g, g.CX + s * .28, y, s, cc => chibi(cc, {
        body: '#c8863c', hair: '#3a2018', swing: -write * .6, hop: beatHop(g, 1.7),
        blink: blinkAt(g.t, .62), mouth: 'grin', armUp: g.act === 'chorus'
      }));
      const gg = gag(g, this.words);
      if (gg) bubble(g, g.CX + s * .95, y - s * .95, s * .5 * gg.pop, gg.text, gg.a, '#2a2060');
    }
  },

  /* 水電進化 Show — the plumber turns a valve, the band member answers on
     the guitar, and the pipe spits a drop on every onset */
  volt: {
    words: ['叮！', '通了', 'SHOW TIME', '轉！'],
    draw(g) {
      const s = figSize(g), y = g.bot;
      sky(g, 12, (cc, i) => (i % 3 === 0 ? prop.bolt(cc) : i % 3 === 1 ? prop.drop(cc) : prop.gear(cc)));
      // pipework along the floor
      cel(g, g.CX, y - s * .02, s, 0, cc => {
        line(cc, 13); cc.strokeStyle = '#6d7f95';
        cc.beginPath(); cc.moveTo(-150, 6); cc.lineTo(-40, 6); cc.lineTo(-40, -26); cc.lineTo(40, -26); cc.stroke();
        line(cc, 5); cc.strokeStyle = 'rgba(10,7,20,.6)'; cc.stroke();
        circ(cc, -40, -26, 11); paint(cc, '#9fd8ff', 3.4);
      });
      const spin = g.t * 3 + g.F.punch * 2;
      cel(g, g.CX + s * .4, y - s * .28, s * .34, spin, cc => prop.gear(cc, '#ffd24a'));
      // a drop every onset, falling from the joint
      const dp = (g.t * 1.6) % 1;
      cel(g, g.CX - s * .4, y - s * .28 + dp * s * .3, s * .12 * (1 - dp * .3), 0,
          cc => { cc.globalAlpha = (1 - dp) * .9 * g.pw; prop.drop(cc); cc.globalAlpha = 1; });
      stand(g, g.CX - s * .95, y, s, cc => chibi(cc, {
        body: '#2f7fa8', hair: '#1c2a38', swing: Math.sin(g.t * 4.2) * .8, hop: beatHop(g, .4),
        blink: blinkAt(g.t, .2), mouth: 'grin'
      }));
      // band half: guitar strummed on the beat
      stand(g, g.CX + s * 1.05, y, s, cc => {
        chibi(cc, { body: '#8cffbe', hair: '#2a1a2e', swing: .35 + g.F.beat * .5,
                    hop: beatHop(g, 2.2), blink: blinkAt(g.t, .77), mouth: 'o', eye: 'happy' });
        cc.save(); cc.rotate(-.35);
        oval(cc, 4, 8, 22, 15); paint(cc, '#c8632e', 4);
        line(cc, 6); cc.strokeStyle = '#3a2418';
        cc.beginPath(); cc.moveTo(14, 2); cc.lineTo(48, -18); cc.stroke();
        circ(cc, 2, 8, 6); paint(cc, '#3a2418', 0);
        cc.restore();
      });
      const gg = gag(g, this.words);
      if (gg) bubble(g, g.CX - s * .35, y - s * 1.02, s * .5 * gg.pop, gg.text, gg.a, '#0d3a4a');
    }
  },

  /* 喵布布本喵掉的毛 — the cat lies there, and every beat puffs another
     tuft of fur off it */
  meow: {
    words: ['喵～', '掉毛中', '本喵的', '再一根'],
    draw(g) {
      const s = figSize(g) * 1.15, y = g.bot;
      sky(g, 13, (cc, i) => (i % 3 === 0 ? prop.fur(cc) : i % 3 === 1 ? prop.paw(cc) : prop.heart(cc, '#ff9ec7')));
      // yarn ball rolling along the floor
      const rx = ((g.t * .12) % 1.3 - .15) * g.W;
      cel(g, rx, y - s * .12, s * .3, -g.t * 2.2, cc => {
        circ(cc, 0, 0, 40); paint(cc, '#ff8fb8', 4);
        line(cc, 3.4); cc.strokeStyle = 'rgba(120,30,70,.55)';
        for (let i = -1; i <= 1; i++) { cc.beginPath(); cc.ellipse(0, 0, 38, 16 + i * 12, i * .8, 0, TAU); cc.stroke(); }
      });
      // the cat
      const breathe = 1 + Math.sin(g.t * 1.6) * .03 + g.F.punch * .05;
      stand(g, g.CX, y, s, cc => {
        cc.save(); cc.scale(breathe, 1 / breathe);
        // tail
        line(cc, 11); cc.strokeStyle = '#f7d9e8';
        cc.beginPath(); cc.moveTo(38, 26);
        cc.quadraticCurveTo(70 + Math.sin(g.t * 2.4) * 14, 10 + Math.cos(g.t * 2.1) * 16, 56, -18 + Math.sin(g.t * 2.4) * 10);
        cc.stroke();
        line(cc, 3.6); cc.strokeStyle = INK; cc.stroke();
        oval(cc, 0, 18, 46, 28); paint(cc, '#ffeaf4', 4);          // body
        circ(cc, -22, -18, 27); paint(cc, '#ffeaf4', 4);            // head
        for (const sd of [-1, 1]) {                                  // ears
          poly(cc, [[-22 + sd * 17, -36], [-22 + sd * 24, -56], [-22 + sd * 2, -44]]);
          paint(cc, '#ffeaf4', 3.6);
        }
        cc.save(); cc.translate(-22, -18); cc.scale(.9, .9);
        face(cc, { blink: blinkAt(g.t, .35), eye: g.act === 'chorus' ? 'happy' : 'open',
                   mouth: 'smile', blush: true, ex: 9 });
        line(cc, 2.6); cc.strokeStyle = 'rgba(40,20,40,.7)';
        for (const sd of [-1, 1]) for (let i = 0; i < 2; i++) {
          cc.beginPath(); cc.moveTo(sd * 13, 4 + i * 5); cc.lineTo(sd * 30, -1 + i * 8); cc.stroke();
        }
        cc.restore();
        cc.restore();
      });
      // tufts leaving the cat on the beat
      for (let i = 0; i < (g.QUAL === 2 ? 7 : 4); i++) {
        const ph = ((g.t * .5 + hash(i + 5)) % 1);
        const a = (1 - ph) * .75 * g.pw;
        cel(g, g.CX + (hash(i) - .5) * s * 1.4, y - s * .3 - ph * s * 1.1, s * .17, ph * 3,
            cc => { cc.globalAlpha = a; prop.fur(cc); cc.globalAlpha = 1; });
      }
      const gg = gag(g, this.words);
      if (gg) bubble(g, g.CX + s * .62, y - s * .78, s * .46 * gg.pop, gg.text, gg.a, '#7a1f4a');
    }
  },

  /* 鋒兄的傳奇人生 — he climbs one more podium step every section, and the
     crown drops on the chorus */
  crown: {
    words: ['頭獎！', '榜首！', '再上一階', '當選'],
    draw(g) {
      const s = figSize(g), y = g.bot;
      sky(g, 12, (cc, i) => (i % 3 === 0 ? prop.crown(cc) : i % 3 === 1 ? prop.spark(cc) : prop.coin(cc, '#b76cff')));
      const steps = 4, sw = s * .46, sh = s * .19;
      const step = clamp(g.secIdx, 0, steps - 1);
      for (let i = 0; i < steps; i++) {
        cel(g, g.CX + (i - 1.5) * sw, y - sh * (i + 1) / 2, s, 0, cc => {
          rr(cc, -sw / s * 50, -(sh * (i + 1)) / s * 50, (sw / s) * 100, (sh * (i + 1)) / s * 100, 6);
          paint(cc, i <= step ? '#ffd24a' : '#3a2f56', 4);
        });
      }
      const sy = y - sh * (step + 1);
      stand(g, g.CX + (step - 1.5) * sw, sy, s, cc => chibi(cc, {
        body: '#b76cff', hair: '#2a1a2e', swing: Math.sin(g.t * 2.4) * .3,
        hop: beatHop(g, .2), blink: blinkAt(g.t, .44), mouth: 'grin',
        armUp: g.act === 'chorus',
        hat: c2 => { // the crown comes down as the section settles
          const d = 1 - easeOut(clamp(g.secAge / 1.1, 0, 1));
          c2.save(); c2.translate(0, -60 - d * 70); c2.scale(.5, .5); prop.crown(c2); c2.restore();
        }
      }));
      // trophy on the top step
      cel(g, g.CX + (steps - 1.5) * sw, y - sh * steps, s * .42, 0, cc => {
        rr(cc, -14, 22, 28, 12, 4); paint(cc, '#8a6a2a', 3.4);
        cc.beginPath(); cc.moveTo(-22, -28); cc.lineTo(22, -28); cc.lineTo(14, 8);
        cc.lineTo(-14, 8); cc.closePath(); paint(cc, '#ffd24a', 4);
        line(cc, 4.4); cc.strokeStyle = '#ffd24a';
        cc.beginPath(); cc.arc(-26, -14, 10, -1.2, 1.9); cc.stroke();
        cc.beginPath(); cc.arc(26, -14, 10, 1.2, 4.3, true); cc.stroke();
      });
      const gg = gag(g, this.words);
      if (gg) boom(g, g.CX + (step - 1.5) * sw + s * .7, sy - s * .9, s * .48 * gg.pop, gg.text, gg.a, '#ffd24a');
    }
  },

  /* 塗哥水電王子爆紅 — he is live inside a phone, the like counter runs up
     and the flames get taller with the chorus */
  blaze: {
    words: ['爆紅！', '+1', '開直播', '讚啦'],
    draw(g) {
      const s = figSize(g), y = g.bot;
      sky(g, 12, (cc, i) => (i % 3 === 0 ? prop.flame(cc) : i % 3 === 1 ? prop.heart(cc, '#ff5a7a') : prop.spark(cc, '#ff9238')));
      // phone frame with the live badge
      const pw = s * .92, ph = s * 1.32;
      cel(g, g.CX, y - ph / 2, s, 0, cc => {
        rr(cc, -pw / s * 50, -ph / s * 50, (pw / s) * 100, (ph / s) * 100, 14);
        paint(cc, 'rgba(14,10,26,.82)', 5);
        rr(cc, -pw / s * 44, -ph / s * 42, (pw / s) * 88, 16, 8); paint(cc, '#ff3b6b', 0);
        label(g, cc, 'LIVE', 12, '#fff', -ph / s * 42 + 8);
      });
      stand(g, g.CX, y - s * .1, s * .86, cc => chibi(cc, {
        body: '#ff9238', hair: '#2a1a2e', swing: Math.sin(g.t * 3.1) * .55,
        hop: beatHop(g, 1.1), blink: blinkAt(g.t, .28), mouth: 'grin', eye: 'wow',
        armUp: g.F.punch > .4
      }));
      // flames licking the base, taller on the chorus
      const heat = (g.act === 'chorus' ? 1 : .55) + g.F.bass * .5;
      for (let i = -2; i <= 2; i++) {
        const fh = s * .3 * heat * (1 + Math.sin(g.t * 6 + i) * .18);
        cel(g, g.CX + i * s * .21, y - fh * .3, fh, 0, cc => prop.flame(cc, i % 2 ? '#ffd24a' : '#ff6a2a'));
      }
      // hearts rising past the frame
      for (let i = 0; i < (g.QUAL === 2 ? 6 : 3); i++) {
        const ph2 = ((g.t * .45 + hash(i + 31)) % 1);
        cel(g, g.CX + pw * .5 + (hash(i) - .2) * s * .3, y - ph2 * ph * 1.3, s * .16,
            Math.sin(g.t * 3 + i) * .3,
            cc => { cc.globalAlpha = (1 - ph2) * .8 * g.pw; prop.heart(cc, '#ff5a7a'); cc.globalAlpha = 1; });
      }
      // the counter — 圖文, it really counts up with the song
      cel(g, g.CX, y - ph - s * .16, s * .3, 0, cc => {
        const n = 1000 + Math.floor(g.t * 137);
        label(g, cc, '♥ ' + n.toLocaleString('en-US'), 34, '#ffd24a', 0);
      });
      const gg = gag(g, this.words);
      if (gg) boom(g, g.CX - s * .82, y - ph * .92, s * .46 * gg.pop, gg.text, gg.a, '#ff9238', -.2);
    }
  },

  /* 最瞎結婚理由 — two couples under the arch, joined by the red thread,
     and the 囍 lantern swings on the beat */
  wed: {
    words: ['囍', '539', '就這樣結了', '恭喜'],
    draw(g) {
      const s = figSize(g) * .92, y = g.bot;
      sky(g, 13, (cc, i) => (i % 3 === 0 ? prop.heart(cc) : i % 3 === 1 ? prop.spark(cc, '#ffd24a') : prop.coin(cc, '#ff6a8a')));
      // arch
      cel(g, g.CX, y, s, 0, cc => {
        line(cc, 9); cc.strokeStyle = '#ff3b6b';
        cc.beginPath(); cc.arc(0, 18, 128, Math.PI, 0); cc.stroke();
        line(cc, 3.4); cc.strokeStyle = INK; cc.stroke();
      });
      const pairs = [[-1.05, '#ff6a8a', '#ffd24a'], [1.05, '#7ab8ff', '#ff9ec7']];
      for (const [px, ca, cb] of pairs) {
        stand(g, g.CX + px * s * .8 - s * .22, y, s * .82, cc => chibi(cc, {
          body: ca, hair: '#2a1a2e', swing: Math.sin(g.t * 2.2 + px) * .3,
          hop: beatHop(g, px), blink: blinkAt(g.t, .2 + px * .1), mouth: 'smile', blush: true
        }));
        stand(g, g.CX + px * s * .8 + s * .22, y, s * .82, cc => chibi(cc, {
          body: cb, hair: '#3a2430', swing: -Math.sin(g.t * 2.2 + px) * .3,
          hop: beatHop(g, px + 1.4), blink: blinkAt(g.t, .5 + px * .1), mouth: 'grin', blush: true
        }));
      }
      // the red thread tying the two couples together
      const c = g.ctx;
      c.save();
      c.beginPath(); line(c, Math.max(1, g.S(3)), 'rgba(255,60,90,.85)');
      const x0 = g.CX - s * .8, x1 = g.CX + s * .8, ym = y - s * .35;
      c.moveTo(x0, ym);
      c.quadraticCurveTo(g.CX, ym + Math.sin(g.t * 1.6) * s * .18 + s * .2, x1, ym);
      c.stroke(); c.restore();
      // 囍 lantern
      const sw = Math.sin(g.t * 1.9) * .18 * g.MOTION;
      cel(g, g.CX, g.top + s * .34, s * .44, sw, cc => {
        oval(cc, 0, 0, 34, 40); paint(cc, '#ff2f5e', 4);
        label(g, cc, '囍', 40, '#ffd24a', 2);
        line(cc, 5); cc.strokeStyle = '#ffd24a';
        cc.beginPath(); cc.moveTo(0, -40); cc.lineTo(0, -58); cc.stroke();
      });
      const gg = gag(g, this.words);
      if (gg) bubble(g, g.CX, y - s * 1.12, s * .5 * gg.pop, gg.text, gg.a, '#8a0f2e');
    }
  },

  /* 鋒兄進化 Show！ — the level bar fills across the song and he changes
     form every section, with a flash on the swap */
  neon: {
    words: ['進化！', 'LEVEL UP', '再一階', '超進化'],
    draw(g) {
      const s = figSize(g), y = g.bot;
      sky(g, 12, (cc, i) => (i % 3 === 0 ? prop.pixel(cc, i % 2 ? '#8cff82' : '#ff3cc8') : i % 3 === 1 ? prop.bolt(cc) : prop.spark(cc, '#8cff82')));
      const stage = g.secIdx % 3;
      const pop = easeBack(clamp(g.secAge / .7, 0, 1));
      const flash = 1 - clamp(g.secAge / .45, 0, 1);
      stand(g, g.CX, y, s * (.78 + stage * .13) * (.7 + pop * .3), cc => chibi(cc, {
        body: ['#8cff82', '#35e8ff', '#ff3cc8'][stage], hair: '#12301e',
        swing: Math.sin(g.t * 3.4) * .5, hop: beatHop(g, .8),
        blink: blinkAt(g.t, .33), mouth: stage === 2 ? 'o' : 'grin',
        eye: stage === 2 ? 'wow' : 'open', armUp: stage === 2
      }));
      if (flash > .01) {
        cel(g, g.CX, y - s * .45, s * 1.6 * (1.2 - flash), 0, cc => {
          cc.globalAlpha = flash * .8; star(cc, 0, 0, 50, 12, .5);
          paint(cc, 'rgba(255,255,255,.9)', 0); cc.globalAlpha = 1;
        });
      }
      // the level bar — 圖文 progress across the whole song
      const p = clamp(g.prog, 0, 1), bw = Math.min(g.W * .52, g.MIN * .62);
      cel(g, g.CX, g.top + s * .22, bw, 0, cc => {
        rr(cc, -50, -6, 100, 12, 6); paint(cc, 'rgba(12,20,16,.8)', 2.4);
        rr(cc, -49, -5, Math.max(2, 98 * p), 10, 5); paint(cc, '#8cff82', 0);
        label(g, cc, 'LV ' + (1 + Math.floor(p * 9)), 9, '#dfffd8', -14);
      });
      const gg = gag(g, this.words);
      if (gg) boom(g, g.CX + s * .78, y - s * .96, s * .48 * gg.pop, gg.text, gg.a, '#8cff82', .15);
    }
  },

  /* 我與國中畢業紀念冊的對話 — the yearbook lies open, a page turns on
     every section and the pencil keeps signing */
  memo: {
    words: ['簽一下', '那一頁', '還記得嗎', '畢業快樂'],
    draw(g) {
      const s = figSize(g), y = g.bot;
      sky(g, 11, (cc, i) => (i % 3 === 0 ? prop.page(cc) : i % 3 === 1 ? prop.pencil(cc) : prop.spark(cc, '#82e1d2')));
      // desk
      cel(g, g.CX, y - s * .02, s, 0, cc => {
        rr(cc, -110, -10, 220, 13, 5); paint(cc, '#7a5a3c', 4);
        line(cc, 6); cc.strokeStyle = '#5a3f28';
        cc.beginPath(); cc.moveTo(-86, 3); cc.lineTo(-92, 44); cc.moveTo(86, 3); cc.lineTo(92, 44); cc.stroke();
      });
      // the open book, with one page mid-turn
      const turn = easeOut(clamp(g.secAge / 1.2, 0, 1));
      cel(g, g.CX, y - s * .12, s, 0, cc => {
        for (const sd of [-1, 1]) {
          cc.save(); cc.transform(1, 0, sd * .12, 1, 0, 0);
          rr(cc, sd > 0 ? 2 : -74, -56, 72, 56, 4); paint(cc, '#fff6e0', 3.6);
          line(cc, 2.4); cc.strokeStyle = 'rgba(60,50,40,.35)';
          for (let i = 0; i < 4; i++) {
            cc.beginPath(); cc.moveTo(sd > 0 ? 12 : -64, -46 + i * 11);
            cc.lineTo(sd > 0 ? 64 : -12, -46 + i * 11); cc.stroke();
          }
          cc.restore();
        }
        // the turning leaf
        cc.save();
        cc.transform(Math.cos(turn * Math.PI) || .001, 0, 0, 1, 0, 0);
        rr(cc, 2, -56, 72, 56, 4); paint(cc, '#fffdf4', 3.4);
        cc.restore();
        line(cc, 4); cc.strokeStyle = INK;
        cc.beginPath(); cc.moveTo(0, -56); cc.lineTo(0, 0); cc.stroke();
      });
      // pencil signing a wobbly line
      const wob = Math.sin(g.t * 7) * s * .05;
      cel(g, g.CX + s * .3 + wob, y - s * .46, s * .34, .7 + Math.sin(g.t * 7) * .1,
          cc => prop.pencil(cc));
      stand(g, g.CX - s * 1.05, y, s * .9, cc => chibi(cc, {
        body: '#82e1d2', hair: '#2a2436', swing: Math.sin(g.t * 1.8) * .22,
        hop: beatHop(g, 1.9), blink: blinkAt(g.t, .52), mouth: 'smile', eye: 'open'
      }));
      const gg = gag(g, this.words);
      if (gg) bubble(g, g.CX - s * .55, y - s * 1.0, s * .5 * gg.pop, gg.text, gg.a, '#20493f');
    }
  },

  /* 統一發票頭獎 — the receipt unrolls, notes rain, and the drum spits a
     ball whenever a winning word comes up */
  money: {
    words: ['中了！', '頭獎', '對獎囉', '又中'],
    draw(g) {
      const s = figSize(g), y = g.bot;
      sky(g, 13, (cc, i) => (i % 3 === 0 ? prop.bill(cc) : i % 3 === 1 ? prop.coin(cc) : prop.spark(cc, '#9ff0bd')));
      // the receipt, unrolling with the song
      const rl = s * (.3 + clamp(g.prog, 0, 1) * .8);
      cel(g, g.CX - s * 1.65, y, s, 0, cc => {
        const w = 44, h = (rl / s) * 100;
        rr(cc, -w / 2, -h, w, h, 3); paint(cc, '#fff8ec', 3.4);
        line(cc, 2.4); cc.strokeStyle = 'rgba(60,50,40,.45)';
        for (let i = 1; i < Math.floor(h / 16); i++) {
          cc.beginPath(); cc.moveTo(-13, -h + i * 16); cc.lineTo(13, -h + i * 16); cc.stroke();
        }
      });
      stand(g, g.CX - s * .95, y, s * .9, cc => chibi(cc, {
        body: '#9ff0bd', hair: '#22301e', swing: -.9, armUp: true,
        hop: beatHop(g, .3), blink: blinkAt(g.t, .4), mouth: 'grin', eye: 'wow'
      }));
      // lottery drum
      const dspin = g.t * 1.2;
      cel(g, g.CX + s * .85, y - s * .52, s * .82, 0, cc => {
        circ(cc, 0, 0, 44); paint(cc, 'rgba(255,255,255,.14)', 4.4);
        for (let i = 0; i < 5; i++) {
          const a = dspin * (1 + i * .1) + i * 1.25, r = 12 + (i % 3) * 9;
          circ(cc, Math.cos(a) * r, Math.sin(a * 1.1) * r, 8);
          paint(cc, ['#ffd24a', '#ff6a8a', '#9ff0bd', '#7ab8ff', '#ffffff'][i], 2.6);
        }
        rr(cc, -12, 40, 24, 16, 5); paint(cc, '#6b5a2a', 3.4);
      });
      // notes raining on the winning lines
      const rain = g.hot ? 1 : .25;
      for (let i = 0; i < (g.QUAL === 2 ? 8 : 4); i++) {
        const ph = ((g.t * (.3 + hash(i) * .25) + hash(i + 17)) % 1);
        cel(g, (hash(i + 63) * .9 + .05) * g.W, g.top + ph * (y - g.top), s * .2,
            Math.sin(g.t * 2 + i) * .6,
            cc => { cc.globalAlpha = rain * .7 * g.pw * (1 - ph * .3); prop.bill(cc); cc.globalAlpha = 1; });
      }
      const gg = gag(g, this.words);
      if (gg) boom(g, g.CX, y - s * 1.1, s * .5 * gg.pop, gg.text, gg.a, '#ffd24a');
    }
  }
};

/* the engine only ever calls this */
let lastErr = null;
return {
  has(theme) { return !!CASTS[theme]; },
  // a broken cast must never take the whole frame down with it, but the
  // error still has to be findable
  err() { return lastErr; },
  draw(theme, g) {
    const cast = CASTS[theme];
    if (!cast || g.pw <= .02) return;
    const c = g.ctx;
    c.save();
    c.globalAlpha = g.pw;
    try { cast.draw(g); } catch (e) { lastErr = theme + ': ' + (e && e.message); }
    c.restore();
  }
};
})();
