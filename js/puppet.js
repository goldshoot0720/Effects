/* =====================================================================
   鋒兄宇宙 · PIXEL MV — 圖像人偶與舞步
   參考 INSIDE IDENTITY（github.com/goldshoot0720/INSIDEIDENTITY）：
   八位班底的 T-pose 設定圖先由 tools/build_cast.py 切成「身體」與
   「手臂」兩層（data/cast.js），這裡做成網格、綁到 12 根骨骼，用 WebGL
   做 2D 蒙皮變形，再整塊貼回像素緩衝區。

   為了留在 PC-98 的畫風裡，人偶直接以緩衝區的解析度渲染：透明度一刀
   切成硬邊、顏色以 4×4 Bayer 網點量化、外面再描一圈黑邊 —— 看起來就
   是一張會動的像素立繪，而不是貼上去的照片。

   舞步（MOVES / ROUTINE）照 INSIDE IDENTITY 的編舞：彈跳、頭頂拍手、
   指天、中二病 pose、波浪手、踏步、跳躍、比心，含鏡像與輪唱錯拍。
   沒有 WebGL2 或素材還沒解碼完時，px.js 會退回手繪的賽璐璐人物。
   ===================================================================== */
window.MV_PUPPET = (function () {
'use strict';

/* ------------------------------ 2D affine -------------------------- */
/* [a, b, c, d, e, f] (canvas convention): x' = a·x + c·y + e, y' = b·x + d·y + f */
const I = () => [1, 0, 0, 1, 0, 0];
function mul(m, n) {
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
          m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
          m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}
const T = (x, y) => [1, 0, 0, 1, x, y];
const Sc = (sx, sy) => [sx, 0, 0, sy === undefined ? sx : sy, 0, 0];
const R = a => { const c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; };
const apply = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
const chain = (...ms) => ms.reduce((a, m) => mul(a, m));
const scaleAlong = (d, k) => k === 1 ? I() : chain(R(d), Sc(k, 1), R(-d));
function toGL(m, out, o) {
  out[o] = m[0]; out[o + 1] = m[1]; out[o + 2] = 0;
  out[o + 3] = m[2]; out[o + 4] = m[3]; out[o + 5] = 0;
  out[o + 6] = m[4]; out[o + 7] = m[5]; out[o + 8] = 1;
}
const dir = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle = (a, b, t) => a + wrap(b - a) * t;
function smoothstep(e0, e1, x) { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
const DEG = Math.PI / 180;
const lerp2 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];

/* ------------------------------- WebGL ------------------------------ */
const B = { pelvis: 0, chest: 1, head: 2, lu: 3, lf: 4, ru: 5, rf: 6, lt: 7, ls: 8, rt: 9, rs: 10, tail: 11 };
const NB = 12;

const VS = `#version 300 es
in vec2 aPos; in vec2 aUV; in vec4 aBone; in vec4 aW;
uniform mat3 uBones[${NB}];
uniform vec2 uOffset, uSize;
out vec2 vUV;
void main() {
  vec3 p = vec3(aPos, 1.0);
  vec2 s = (uBones[int(aBone.x)] * p).xy * aW.x + (uBones[int(aBone.y)] * p).xy * aW.y
         + (uBones[int(aBone.z)] * p).xy * aW.z + (uBones[int(aBone.w)] * p).xy * aW.w;
  s += uOffset;
  gl_Position = vec4(s.x / uSize.x * 2.0 - 1.0, 1.0 - s.y / uSize.y * 2.0, 0.0, 1.0);
  vUV = aUV;
}`;

/* hard alpha, Bayer-dithered colour steps, or a flat tint for the outline */
const FS = `#version 300 es
precision mediump float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec4 uTint;
uniform float uLevels, uSmooth;
out vec4 o;
const float BY[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
void main() {
  vec4 c = texture(uTex, vUV);
  // smooth: soft edges and full colour (the anime PV), premultiplied out
  if (uSmooth > 0.5) {
    if (c.a < 0.004) discard;
    o = uTint.a > 0.0 ? vec4(uTint.rgb, 1.0) * c.a : c;
    return;
  }
  if (c.a < 0.5) discard;
  if (uTint.a > 0.0) { o = vec4(uTint.rgb, 1.0); return; }
  vec3 rgb = c.rgb / c.a;
  ivec2 q = ivec2(mod(gl_FragCoord.xy, 4.0));
  float th = (BY[q.y * 4 + q.x] + 0.5) / 16.0 - 0.5;
  rgb = clamp(floor(rgb * uLevels + 0.5 + th * 0.9) / uLevels, 0.0, 1.0);
  o = vec4(rgb, 1.0);
}`;

let gl = null, glc = null, prog = null, loc = {}, broken = false;
function initGL() {
  if (gl || broken) return !!gl;
  try {
    glc = document.createElement('canvas');
    glc.width = glc.height = 4;
    gl = glc.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false,
                                     preserveDrawingBuffer: true, depth: false });
    if (!gl) throw new Error('no webgl2');
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    for (const n of ['aPos', 'aUV', 'aBone', 'aW']) loc[n] = gl.getAttribLocation(prog, n);
    for (const n of ['uBones', 'uOffset', 'uSize', 'uTex', 'uTint', 'uLevels', 'uSmooth']) loc[n] = gl.getUniformLocation(prog, n);
    gl.disable(gl.BLEND);
    return true;
  } catch (e) {
    broken = true; gl = null;
    console.warn('[puppet] 退回手繪人物：', e.message);
    return false;
  }
}

function texture(img) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

function uploadMesh(d) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = (arr, l, size) => {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(l);
    gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0);
  };
  buf(d.pos, loc.aPos, 2); buf(d.uv, loc.aUV, 2); buf(d.bone, loc.aBone, 4); buf(d.w, loc.aW, 4);
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, d.idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, count: d.idx.length };
}

function alphaOf(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const a = new Uint8Array(c.width * c.height);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
  return { a, w: c.width, h: c.height };
}

/* grid mesh over the opaque part of an image, weights from weightFn(x, y) */
function buildMesh(alpha, cell, weightFn) {
  const { a, w, h } = alpha;
  const gx = Math.ceil(w / cell), gy = Math.ceil(h / cell);
  const keep = new Uint8Array(gx * gy);
  for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
    let any = 0;
    for (let y = j * cell - 1; y < (j + 1) * cell + 1 && !any; y++) {
      if (y < 0 || y >= h) continue;
      for (let x = i * cell - 1; x < (i + 1) * cell + 1; x++) {
        if (x >= 0 && x < w && a[y * w + x] > 4) { any = 1; break; }
      }
    }
    keep[j * gx + i] = any;
  }
  const vid = new Int32Array((gx + 1) * (gy + 1)).fill(-1);
  const pos = [], uv = [], bone = [], wt = [], idx = [];
  const vert = (i, j) => {
    const k = j * (gx + 1) + i;
    if (vid[k] >= 0) return vid[k];
    const x = i * cell, y = j * cell;
    vid[k] = pos.length / 2;
    pos.push(x, y); uv.push(x / w, y / h);
    const ws = weightFn(x, y).filter(e => e[1] > 1e-4).sort((p, q) => q[1] - p[1]).slice(0, 4);
    const sum = ws.reduce((s, e) => s + e[1], 0) || 1;
    for (let n = 0; n < 4; n++) { bone.push(ws[n] ? ws[n][0] : 0); wt.push(ws[n] ? ws[n][1] / sum : 0); }
    return vid[k];
  };
  for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
    if (!keep[j * gx + i]) continue;
    const v00 = vert(i, j), v10 = vert(i + 1, j), v01 = vert(i, j + 1), v11 = vert(i + 1, j + 1);
    idx.push(v00, v10, v11, v00, v11, v01);
  }
  return { pos: new Float32Array(pos), uv: new Float32Array(uv), bone: new Float32Array(bone),
           w: new Float32Array(wt), idx: new Uint32Array(idx) };
}

/* ------------------------------- puppet ----------------------------- */
class Puppet {
  constructor(rig, bodyImg, armsImg) {
    this.rig = rig;
    this.k = rig.size[1] / (rig.size[1] > 740 ? 1536 : 1448);   // rig px per sheet px
    const L = rig.l, Rr = rig.r;
    this.rest = {
      lu: dir(L.sh, L.el), lf: dir(L.el, L.wr), ru: dir(Rr.sh, Rr.el), rf: dir(Rr.el, Rr.wr),
      lt: dir(L.hip, L.knee), ls: dir(L.knee, L.ank), rt: dir(Rr.hip, Rr.knee), rs: dir(Rr.knee, Rr.ank)
    };
    this.waistPt = [rig.pelvis[0], rig.waist];
    this.torsoLen = rig.pelvis[1] - rig.neck[1];
    const bodyA = alphaOf(bodyImg);
    // lowest opaque row = sole of the shoes, highest = top of the head / ears
    let foot = bodyA.h - 1, top = 0;
    outer: for (; foot > 0; foot--) for (let x = 0; x < bodyA.w; x += 2) if (bodyA.a[foot * bodyA.w + x] > 128) break outer;
    outer2: for (; top < bodyA.h; top++) for (let x = 0; x < bodyA.w; x += 2) if (bodyA.a[top * bodyA.w + x] > 128) break outer2;
    this.foot = foot; this.top = top;
    this.ankleY = Math.max(L.ank[1], Rr.ank[1]);
    const cell = 7;
    this.body = uploadMesh(buildMesh(bodyA, cell, (x, y) => this.bodyWeights(x, y)));
    this.arms = uploadMesh(buildMesh(alphaOf(armsImg), cell, (x, y) => this.armWeights(x, y)));
    this.texBody = texture(bodyImg);
    this.texArms = texture(armsImg);
    this.bones = new Float32Array(NB * 9);
    this.joints = {};
  }

  bodyWeights(x, y) {
    const g = this.rig, k = this.k, tl = g.tail;
    if (tl && x > tl.root[0] - 15 * k && y > tl.top && (x > tl.minx || y > tl.miny)) {
      const w = smoothstep(10 * k, 90 * k, Math.hypot(x - tl.root[0], y - tl.root[1]));
      return [[B.tail, w], [B.pelvis, 1 - w]];
    }
    const cx = g.pelvis[0];
    if (y > g.hem - 30 * k) {
      const side = x < cx ? g.l : g.r;
      let c;
      if (y < side.knee[1]) c = lerp2(side.hip, side.knee, (y - side.hip[1]) / (side.knee[1] - side.hip[1]))[0];
      else c = lerp2(side.knee, side.ank, Math.min(1.6, (y - side.knee[1]) / (side.ank[1] - side.knee[1])))[0];
      const inLeg = 1 - smoothstep(70 * k, 95 * k, Math.abs(x - c));
      const wl = smoothstep(g.hem - 30 * k, g.hem + 30 * k, y) * inLeg;
      const ws = smoothstep(side.knee[1] - 28 * k, side.knee[1] + 28 * k, y);
      const tb = x < cx ? B.lt : B.rt, sb = x < cx ? B.ls : B.rs;
      return [[tb, wl * (1 - ws)], [sb, wl * ws], [B.pelvis, 1 - wl]];
    }
    const wh = smoothstep(g.neck[1] + 30 * k, g.neck[1] - 40 * k, y);
    const wc = smoothstep(g.waist + 50 * k, g.waist - 50 * k, y);
    return [[B.head, wh], [B.chest, (1 - wh) * wc], [B.pelvis, (1 - wh) * (1 - wc)]];
  }

  armWeights(x, y) {
    const g = this.rig, k = this.k;
    const left = x < g.pelvis[0];
    const s = left ? g.l : g.r;
    const d = Math.abs(x - s.sh[0]), de = Math.abs(s.el[0] - s.sh[0]);
    const wf = smoothstep(de - 20 * k, de + 20 * k, d);
    const cut = left ? g.armCut : 2 * ((g.l.sh[0] + g.r.sh[0]) / 2) - g.armCut;
    const wc = 1 - smoothstep(0, 26 * k, Math.abs(x - cut));
    const u = left ? B.lu : B.ru, f = left ? B.lf : B.rf;
    return [[u, (1 - wf) * (1 - wc)], [f, wf * (1 - wc)], [B.chest, wc]];
  }

  /* pose: world angles (radians, y down); model: rig px -> buffer px */
  solve(pose, model) {
    const g = this.rig, rest = this.rest, L = g.l, Rr = g.r;
    const tl = this.torsoLen;
    const off = [pose.x * tl, pose.y * tl];
    const pelvis = chain(T(g.pelvis[0] + off[0], g.pelvis[1] + off[1]), R(pose.pelvis), T(-g.pelvis[0], -g.pelvis[1]));
    const bone = (parent, pivot, rot, restDir, k) => {
      const wp = apply(parent, pivot);
      return chain(T(wp[0], wp[1]), R(rot), k != null && k !== 1 ? scaleAlong(restDir, k) : I(), T(-pivot[0], -pivot[1]));
    };
    const chest = bone(pelvis, this.waistPt, pose.chest);
    const head = bone(chest, g.neck, pose.head);
    const lu = bone(chest, L.sh, pose.lu - rest.lu, rest.lu, pose.lul);
    const lf = bone(lu, L.el, pose.lf - rest.lf, rest.lf, pose.lfl);
    const ru = bone(chest, Rr.sh, pose.ru - rest.ru, rest.ru, pose.rul);
    const rf = bone(ru, Rr.el, pose.rf - rest.rf, rest.rf, pose.rfl);
    const lt = bone(pelvis, L.hip, pose.lt - rest.lt);
    const ls = bone(lt, L.knee, pose.ls - rest.ls);
    const rt = bone(pelvis, Rr.hip, pose.rt - rest.rt);
    const rs = bone(rt, Rr.knee, pose.rs - rest.rs);
    const tail = g.tail ? bone(pelvis, g.tail.root, pose.pelvis + (pose.tail || 0)) : I();
    // keep the lower foot on the floor: bent knees make the whole body sink
    const la = apply(ls, L.ank), ra = apply(rs, Rr.ank);
    const ground = this.ankleY - Math.max(la[1], ra[1]) + off[1];
    const M = mul(model, T(0, pose.grounded === false ? 0 : ground));
    const list = [pelvis, chest, head, lu, lf, ru, rf, lt, ls, rt, rs, tail];
    for (let i = 0; i < NB; i++) toGL(mul(M, list[i]), this.bones, i * 9);
    const J = this.joints, W = (m, p) => apply(M, apply(m, p));
    J.face = W(head, g.face); J.neck = W(chest, g.neck); J.pelvis = W(pelvis, g.pelvis);
    J.lwr = W(lf, L.wr); J.rwr = W(rf, Rr.wr); J.ltip = W(lf, L.tip); J.rtip = W(rf, Rr.tip);
    J.lank = W(ls, L.ank); J.rank = W(rs, Rr.ank);
  }

  draw(offset, tint, levels) {
    gl.uniformMatrix3fv(loc.uBones, false, this.bones);
    gl.uniform2f(loc.uOffset, offset[0], offset[1]);
    gl.uniform4f(loc.uTint, tint[0], tint[1], tint[2], tint[3]);
    gl.uniform1f(loc.uLevels, levels);
    for (const [mesh, tex] of [[this.body, this.texBody], [this.arms, this.texArms]]) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(loc.uTex, 0);
      gl.bindVertexArray(mesh.vao);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);
  }
}

/* ----------------------------- loading ------------------------------ */
const PUP = {}, PENDING = {};
function load(id) {
  if (PUP[id] || PENDING[id] || broken) return;
  const art = window.MV_CAST_ART && window.MV_CAST_ART[id];
  if (!art || !initGL()) return;
  PENDING[id] = 1;
  const img = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  Promise.all([img(art.body), img(art.arms)]).then(([b, a]) => {
    try { PUP[id] = new Puppet(art, b, a); } catch (e) { console.warn('[puppet]', id, e.message); }
  }).catch(e => console.warn('[puppet] 素材載入失敗', id, e));
}
function preload() { if (window.MV_CAST_ART) for (const id in window.MV_CAST_ART) load(id); }
function ready(id) { if (!PUP[id]) load(id); return !!PUP[id]; }

/* ------------------------------ poses ------------------------------- */
/* Degrees: 0 = pointing screen-right, 90 = straight down (y down). */
function neutralPose() {
  return { x: 0, y: 0, pelvis: 0, chest: 0, head: 0, tail: 0,
           lu: 100 * DEG, lf: 96 * DEG, ru: 80 * DEG, rf: 84 * DEG, lul: 1, lfl: 1, rul: 1, rfl: 1,
           lt: 92 * DEG, ls: 90 * DEG, rt: 88 * DEG, rs: 90 * DEG };
}
const RAW = ['x', 'y', 'lul', 'lfl', 'rul', 'rfl', 'grounded'];
function P(o) {
  const p = neutralPose();
  for (const k in o) p[k] = RAW.indexOf(k) >= 0 ? o[k] : o[k] * DEG;
  return p;
}
function mirror(p) {
  const m = { ...p }, flip = a => Math.PI - a;
  m.lu = flip(p.ru); m.ru = flip(p.lu); m.lf = flip(p.rf); m.rf = flip(p.lf);
  m.lul = p.rul; m.rul = p.lul; m.lfl = p.rfl; m.rfl = p.lfl;
  m.lt = flip(p.rt); m.rt = flip(p.lt); m.ls = flip(p.rs); m.rs = flip(p.ls);
  m.pelvis = -p.pelvis; m.chest = -p.chest; m.head = -p.head; m.x = -p.x; m.tail = -p.tail;
  return m;
}
function blendPose(a, b, t) {
  const o = {};
  for (const k in a) {
    if (typeof a[k] !== 'number') { o[k] = t < .5 ? a[k] : b[k]; continue; }
    o[k] = RAW.indexOf(k) >= 0 ? lerp(a[k], b[k], t) : lerpAngle(a[k], b[k], t);
  }
  return o;
}

const ease = t => t * t * (3 - 2 * t);
const pulse = b => Math.pow(1 - (((b % 1) + 1) % 1), 3);
const swing = (b, period) => Math.sin((b / (period || 2)) * Math.PI * 2);

/* the INSIDE IDENTITY choreography: (b = beat inside the 8-beat bar, i = dancer) */
const MOVES = {
  bounce(b) {
    const s = swing(b, 2), h = pulse(b);
    return P({ y: -.05 * Math.abs(Math.sin(b * Math.PI)), x: .03 * s,
               lu: 104 + 8 * s, lf: 110 + 10 * s, ru: 76 + 8 * s, rf: 70 + 10 * s,
               chest: 4 * s, head: -7 * s, pelvis: -3 * s, lt: 94 - 3 * h, rt: 86 + 3 * h, tail: 12 * s });
  },
  clap(b) {
    const open = .5 + .5 * Math.cos(b * Math.PI), s = swing(b, 4);
    return P({ y: -.04 * pulse(b), x: .02 * s,
               lu: 228 + 22 * open, lf: 300 - 30 * open, ru: 312 - 22 * open, rf: 240 + 30 * open,
               chest: 5 * s, head: 8 * s, tail: 15 * s, lt: 95, rt: 85 });
  },
  point(b) {
    const k = ease(clamp((b % 4) * 2, 0, 1)), h = pulse(b);
    const p = P({ x: .05 * k, y: -.02 * h, ru: lerp(80, 318, k), rf: lerp(84, 312 - 6 * h, k),
                  lu: 128, lf: 42, chest: 8 * k, head: -10 * k, pelvis: -4 * k, lt: 100, rt: 80, tail: 20 * k });
    return Math.floor(b / 4) % 2 ? mirror(p) : p;
  },
  chuuni(b) {
    const k = ease(clamp(b / 1.2, 0, 1)), shake = b > 1.2 ? Math.sin(b * 22) * 1.2 : 0;
    return P({ x: -.04 * k, y: .02 * k,
               lu: lerp(100, 196, k), lf: lerp(96, 200 + shake, k), ru: lerp(80, 150, k), rf: lerp(84, 236, k),
               chest: -9 * k, head: 14 * k + shake, pelvis: 5 * k,
               lt: lerp(92, 104, k), rt: lerp(88, 80, k), tail: -18 * k });
  },
  wave(b, i) {
    const s = swing(b - i * .35, 2);
    return P({ x: .06 * s, y: -.03 * Math.abs(s),
               lu: 222 + 18 * s, lf: 222 + 30 * s, ru: 318 + 18 * s, rf: 318 + 30 * s,
               chest: 10 * s, head: 12 * s, pelvis: -7 * s, lt: 95 + 5 * s, rt: 85 + 5 * s, tail: 25 * s });
  },
  step(b) {
    const side = Math.floor(b) % 2 ? 1 : -1, ph = ((b % 1) + 1) % 1;
    const lift = Math.sin(Math.PI * clamp(ph * 1.6, 0, 1));
    const p = P({ x: .07 * side * ease(ph), y: -.05 * lift,
                  lu: 190 - 70 * lift, lf: 250 - 150 * lift, ru: 70, rf: 115,
                  lt: 92 - 42 * lift, ls: 92 + 50 * lift, rt: 88, rs: 90,
                  chest: -6 * side, head: 8 * side, tail: 18 * side });
    return side > 0 ? mirror(p) : p;
  },
  jump(b) {
    const ph = b % 4;
    const air = ph > 2 && ph < 3.2 ? Math.sin(((ph - 2) / 1.2) * Math.PI) : 0;
    const crouch = ph > 1.2 && ph <= 2 ? Math.sin(((ph - 1.2) / .8) * Math.PI)
                 : (ph >= 3.2 && ph < 3.8 ? Math.sin(((ph - 3.2) / .6) * Math.PI) * .7 : 0);
    const up = clamp(air * 1.5, 0, 1);
    return P({ y: -.32 * air,
               lu: lerp(120, 240, up), lf: lerp(70, 250, up), ru: lerp(60, 300, up), rf: lerp(110, 290, up),
               lt: 92 + 22 * crouch - 14 * air, ls: 92 - 28 * crouch + 20 * air,
               rt: 88 - 22 * crouch + 14 * air, rs: 88 + 28 * crouch - 20 * air,
               head: -6 * crouch + 6 * air, tail: 30 * air });
  },
  heart(b) {
    const s = swing(b, 4);
    return P({ x: .03 * s, lu: 245, lf: 325, ru: 295, rf: 215,
               chest: 6 * s, head: 10 * s, pelvis: -3 * s, lt: 96, rt: 84, tail: 14 * s });
  },
  /* the story's own everyday poses, so a scene can ask for them by name */
  idle(b, i, t) {
    const s = Math.sin(t * 1.9 + i), s2 = Math.sin(t * 1.3 + i * 2);
    return P({ y: -.012 * Math.abs(Math.sin(t * 3.8 + i)), x: .01 * s2,
               lu: 102 + 3 * s, lf: 99 + 4 * s, ru: 78 - 3 * s, rf: 81 - 4 * s,
               chest: 1.5 * s2, head: -3 * s2 + 2 * s, pelvis: -s2, tail: 14 * s });
  },
  raise(b, i, t) {
    const w = Math.sin(t * 7 + i);
    return P({ y: -.02 * pulse(b), x: .01 * w,
               lu: 106, lf: 102, ru: 296 + 6 * w, rf: 282 + 16 * w,
               chest: 3, head: -6 + 2 * w, tail: 16 * w });
  },
  point2(b, i, t) {
    const k = Math.sin(t * 2 + i);
    return P({ x: .02, lu: 118, lf: 60 + 4 * k, ru: 346, rf: 340 + 3 * k,
               chest: 5, head: -6, pelvis: -3, lt: 96, rt: 84, tail: 10 * k });
  },
  walk(b, i, t) {
    const s = Math.sin(t * 5 + i);
    return P({ y: -.02 * Math.abs(s), lu: 100 - 16 * s, lf: 96 - 22 * s, ru: 80 - 16 * s, rf: 84 - 22 * s,
               lt: 92 + 12 * s, ls: 92 + 18 * Math.max(0, s), rt: 88 + 12 * s, rs: 88 + 18 * Math.max(0, -s),
               chest: 2 * s, head: -2 * s, tail: 18 * s });
  },
  cheer(b, i) {
    const h = pulse(b), up = Math.floor(b) % 2;
    return P({ y: -.06 * h, lu: up ? 236 : 200, lf: up ? 250 : 210, ru: up ? 304 : 340, rf: up ? 290 : 330,
               chest: up ? 4 : -4, head: up ? 6 : -6, lt: 96 - 6 * h, rt: 84 + 6 * h, tail: up ? 20 : -20 });
  },
  /* the loaf: drawn turned onto its side (see draw), so these angles are
     in the body's own frame — the left arm is the pillow under the head,
     the knees are drawn up, and the tail never stops. `i` > 0 = awake. */
  lie(b, i, t) {
    const s = Math.sin(t * 2.2), awake = i > 0 ? 1 : 0, h = pulse(b) * awake;
    return P({ grounded: false, lu: 262, lf: 330, ru: 96 + 3 * s, rf: 70 + 4 * s,
               lt: 70, ls: 104, rt: 76, rs: 110, chest: -4 + 2 * s, pelvis: 0,
               head: -10 - 14 * awake - 6 * h, tail: 30 * s + 25 * awake * Math.sin(t * 6) });
  },
  bow(b, i, t) {
    const k = ease(clamp((b % 8) / 1.5, 0, 1)) * (1 - ease(clamp(((b % 8) - 5) / 1.5, 0, 1)));
    return P({ y: .04 * k, chest: 0, pelvis: 0, head: 26 * k,
               lu: 96, lf: 88 + 30 * k, ru: 84, rf: 92 - 30 * k, tail: 10 * Math.sin(t * 2) });
  }
};

/* 8-beat bars; `mirror` flips the odd dancers, `canon` delays each dancer a little */
const ROUTINE = [
  { move: 'bounce' }, { move: 'bounce', mirror: true },
  { move: 'clap' }, { move: 'clap', canon: .5 },
  { move: 'point', mirror: true }, { move: 'wave' },
  { move: 'chuuni', mirror: true }, { move: 'jump', canon: .25 },
  { move: 'step' }, { move: 'step', mirror: true },
  { move: 'wave' }, { move: 'wave', mirror: true },
  { move: 'clap', canon: .25 }, { move: 'point' },
  { move: 'chuuni' }, { move: 'heart', canon: .5 }
];

/* beat (float) -> pose. `move` is a MOVES name, 'routine' for the full
   sixteen-bar chorus, or an array of names to cycle bar by bar. */
function dancePose(move, beat, i, t) {
  i = i || 0;
  const one = (name, lb) => (MOVES[name] || MOVES.idle)(lb, i, t);
  if (move !== 'routine' && !Array.isArray(move)) {
    const b = ((beat % 8) + 8) % 8;
    return one(move, b);
  }
  const list = Array.isArray(move) ? move.map(m => ({ move: m })) : ROUTINE;
  const at = bt => {
    const n = Math.floor(bt / 8), e = list[((n % list.length) + list.length) % list.length];
    const local = bt - n * 8;
    let p = one(e.move, Math.max(0, local - (e.canon || 0) * i));
    if (e.mirror && i % 2 === 1) p = mirror(p);
    return p;
  };
  const cur = at(beat), local = ((beat % 8) + 8) % 8;
  // cross-fade into the next bar over the last half beat
  if (local > 7.5) return blendPose(cur, at(Math.ceil(beat / 8) * 8 + .001), ease((local - 7.5) / .5));
  return cur;
}

/* --------------------------- draw into 2D --------------------------- */
const hex = c => {
  const n = parseInt((c || '#140b0c').slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, 1];
};

/* o: { id, x, y (feet), h, move, beat, i, t, flip, levels, outline, crop,
        smooth, rim, tint }
   ctx: the 2D pixel buffer. Returns false when the puppet is not ready.
   smooth: soft alpha and true colour instead of the pixel look, blended;
   rim: outline thickness in px (smooth only); tint: paint the figure flat. */
function draw(ctx, o) {
  const pp = ready(o.id) && PUP[o.id];
  if (!pp) return false;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  if (glc.width !== W || glc.height !== H) { glc.width = W; glc.height = H; }
  const rig = pp.rig;
  const pose = o.pose ? { ...o.pose } : dancePose(o.move || 'idle', o.beat || 0, o.i || 0, o.t || 0);
  let model, bx, by, bw2, bh2;
  if (o.box) {
    // the close-up: head and shoulders filling a portrait window
    const bb = o.box, chest = rig.waist + (rig.pelvis[1] - rig.waist) * .2;
    const s = bb.h * .98 / (chest - pp.top);
    model = chain(T(Math.round(bb.x + bb.w / 2), Math.round(bb.y + 2)), Sc(s, s), T(-rig.face[0], -pp.top));
    pose.grounded = false;
    bx = Math.floor(bb.x); by = Math.floor(bb.y); bw2 = Math.ceil(bb.w); bh2 = Math.ceil(bb.h);
  } else if (o.move === 'lie') {
    // lying on its side, head to the left: body-down becomes screen-right,
    // and the figure's left flank rests on the floor
    const s = o.h * (rig.h || 1) / (pp.foot - pp.top);
    const flank = (rig.pelvis[0] - Math.min(rig.l.hip[0], rig.l.sh[0])) * 1.25;
    model = chain(T(Math.round(o.x), Math.round(o.y)), Sc(o.flip ? -1 : 1, 1), R(-Math.PI / 2), Sc(s, s),
                  T(flank - rig.pelvis[0], -(pp.top + pp.foot) / 2));
    const bw = Math.ceil((pp.foot - pp.top) * s * 1.35) + 8, bh = Math.ceil(rig.size[0] * s * .9) + 8;
    bx = Math.floor(o.x - bw / 2); by = Math.floor(o.y - bh + 4);
    bw2 = bw; bh2 = bh + 4;
  } else {
    const s = o.h * (rig.h || 1) / (pp.foot - pp.top);
    model = chain(T(Math.round(o.x), Math.round(o.y)), Sc(o.flip ? -s : s, s), T(-rig.pelvis[0], -pp.foot));
    // bounding box, to clear and copy only what the figure covers
    const bw = Math.ceil(rig.size[0] * s * 1.3) + 6, bh = Math.ceil((pp.foot - pp.top) * s * 1.55) + 6;
    bx = Math.floor(o.x - bw / 2); by = Math.floor(o.y - bh + 6);
    bw2 = bw; bh2 = bh + 4;
  }
  pp.solve(pose, model);
  if (bx < 0) { bw2 += bx; bx = 0; }
  if (by < 0) { bh2 += by; by = 0; }
  bw2 = Math.min(bw2, W - bx); bh2 = Math.min(bh2, H - by);
  if (bw2 < 1 || bh2 < 1) return true;

  gl.viewport(0, 0, W, H);
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(bx, H - by - bh2, bw2, bh2);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(prog);
  gl.uniform2f(loc.uSize, W, H);
  const levels = o.levels || 6;
  gl.uniform1f(loc.uSmooth, o.smooth ? 1 : 0);
  if (o.smooth) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }
  if (o.outline !== false) {
    const oc = hex(o.outline || '#140b0c');
    const r = o.smooth ? (o.rim || 2) : 1;
    const ring = o.smooth ? [] : [[-1, 0], [1, 0], [0, -1], [0, 1]];
    if (o.smooth) for (let k = 0; k < 16; k++) ring.push([Math.cos(k / 16 * Math.PI * 2) * r, Math.sin(k / 16 * Math.PI * 2) * r]);
    for (const d of ring) pp.draw(d, oc, levels);
  }
  pp.draw([0, 0], o.tint ? hex(o.tint) : [0, 0, 0, 0], levels);
  gl.disable(gl.BLEND);
  gl.disable(gl.SCISSOR_TEST);
  ctx.drawImage(glc, bx, by, bw2, bh2, bx, by, bw2, bh2);
  return true;
}

return { draw, ready, preload, dancePose, mirror, blendPose, MOVES, ROUTINE,
         moves: Object.keys(MOVES), joints: id => PUP[id] && PUP[id].joints,
         ok: () => !broken };
})();
