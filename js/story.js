/* =====================================================================
   鋒兄宇宙 · PIXEL MV — 故事分鏡
   每一首歌一組世界觀、色盤與分鏡，內容對應 STORY.md。
   `shots` 的時間直接對著歌詞與段落，所以分鏡是跟著故事走的，不是
   隨機循環的特效。scene() 畫背景，front() 畫那一鏡的主戲。
   ===================================================================== */
window.MV_STORY = (function () {
'use strict';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);

/* ------------------------------ palettes --------------------------- */
const PAL = {
  dream: { sky:'#0b0d26', bg0:'#141a3c', bg1:'#26305e', bg2:'#3c4a86', lit:'#6d7fc4',
           ink:'#e6e9ff', warm:'#f0c674', acc:'#d8455f', acc2:'#7fa8ff', lamp:'#ffe9a8' },
  volt:  { sky:'#021418', bg0:'#06222c', bg1:'#0d3c48', bg2:'#176272', lit:'#3fa0ad',
           ink:'#dcfbff', warm:'#8cffbe', acc:'#ffd24a', acc2:'#35e8ff', lamp:'#bafff0' },
  meow:  { sky:'#1b0a18', bg0:'#2e1128', bg1:'#4d2143', bg2:'#7a3a64', lit:'#b8708f',
           ink:'#ffeaf4', warm:'#ffd0e4', acc:'#ff5f95', acc2:'#ffe9a8', lamp:'#ffd9ec' },
  crown: { sky:'#130a22', bg0:'#1f1036', bg1:'#362057', bg2:'#573683', lit:'#8f6ac0',
           ink:'#fbeeff', warm:'#ffd24a', acc:'#ff4a7d', acc2:'#b76cff', lamp:'#ffeab4' },
  blaze: { sky:'#1a0c04', bg0:'#2a1a0e', bg1:'#4d2f14', bg2:'#7d5120', lit:'#b98a44',
           ink:'#f4dfb0', warm:'#ffb45e', acc:'#d63a2a', acc2:'#35e8ff', lamp:'#ffdfa0' },
  wed:   { sky:'#1d0512', bg0:'#320a1e', bg1:'#551232', bg2:'#87204c', lit:'#c05077',
           ink:'#ffe6ee', warm:'#ffd24a', acc:'#ff2f5e', acc2:'#ffb0c6', lamp:'#ffd9a8' },
  neon:  { sky:'#04140c', bg0:'#082215', bg1:'#0e3c26', bg2:'#166043', lit:'#37a072',
           ink:'#e2ffe8', warm:'#8cff82', acc:'#ff3cc8', acc2:'#35e8ff', lamp:'#c6ffd0' },
  memo:  { sky:'#07161a', bg0:'#0d2429', bg1:'#174046', bg2:'#22656b', lit:'#4ba3a2',
           ink:'#f2fbf2', warm:'#ffc978', acc:'#ff8a5e', acc2:'#82e1d2', lamp:'#dff6e8' },
  money: { sky:'#04130c', bg0:'#0a2116', bg1:'#103c25', bg2:'#1a6238', lit:'#3fa060',
           ink:'#eaffe8', warm:'#ffd24a', acc:'#ff6a4a', acc2:'#9ff0bd', lamp:'#fff0b8' }
};

/* ------------------------------- 角色表 ---------------------------- */
/* 八位固定班底，順序照設定：鯨魚娘、咕咕嘎嘎、鋒兄、塗哥、喵布布、
   喵白白、牙妹、魚妹。每位一組賽璐璐配色（底色 + 一階陰影），要換成
   正式設定圖時只要改這張表，所有歌都會跟著換。 */
const CAST = {
  // 鯨魚娘：靛藍→水藍漸層長髮、呆毛、鰭耳、白色女僕頭飾、海軍藍洋裝配白圍裙
  //（圍裙上有鯨魚）、白褶襪、海軍藍鞋、身後一條鯨魚尾
  whale:  { name:'鯨魚娘', fem:1, hair:'#2b3a8e', hair2:'#1a2460', hair3:'#5aa8e0', long:1, ahoge:1,
            band:'#ffffff', ears:'fin', finCol:'#2b3a8e',
            cloth:'#1e2a5e', cloth2:'#141d42', inner:'#f4f2f8',
            skirt:'#1e2a5e', skirtTrim:'#c8a04a', socks:'#f4f2f8', shoes:'#1a2450',
            collar:'#ffffff', bowtie:'#16204a', apron:1, apronCol:'#ffffff', apronMark:'#2a5aa8',
            tailKind:'whale', tailCol:'#1e2a6e', eye:'#2a7ad8', shine:'#dff0ff', blush:1,
            eyeType:'round', fringe:'wave' },
  // 咕咕嘎嘎：企鵝連帽外套（黃喙、白眼圈）、奶油色前襟、深褐妹妹頭、黑短褲長襪
  gugu:   { name:'咕咕嘎嘎', fem:1, hood:'#1b1b20', hood2:'#0e0e12', beak:'#f5b400',
            hair:'#3a2a22', hair2:'#241810', cloth:'#1b1b20', cloth2:'#101014',
            inner:'#f2ece0', pouch:1, pants:'#1b1b20', shoes:'#1b1b20',
            collar:'#f2ece0', eye:'#8a8f9a', shine:'#6a6a74', blush:1,
            eyeType:'bead', fringe:'bob' },
  // 鋒兄：黑短髮、眼鏡、鬍子、卡其飛行外套內搭黑T、牛仔褲、白鞋
  feng:   { name:'鋒兄', male:1, hair:'#171318', hair2:'#0b090d', cloth:'#c9a978', cloth2:'#9c8055',
            inner:'#24242a', collar:'#3a4460', glasses:'#2a2a30', beard:'#171318',
            pants:'#4f79ad', shoes:'#f2f2f4', eye:'#3a2a20', shine:'#4a4450',
            eyeType:'narrow', fringe:'split' },
  // 塗哥：黑髮、灰T恤有白色字塊、牛仔褲、白鞋
  tu:     { name:'塗哥', male:1, hair:'#141018', hair2:'#080610', cloth:'#8a8a8e', cloth2:'#63636a',
            collar:'#8a8a8e', logo:1, pants:'#4f79ad', shoes:'#f2f2f4',
            eye:'#3a2a20', shine:'#4a4450', eyeType:'keen', fringe:'spike' },
  // 喵布布：三花貓，白底橘黑斑、綠眼、黑飛行外套內搭奶油帽T、黑工裝褲、橘白尾巴
  bubu:   { name:'喵布布', cat:1, hair:'#f4efe8', hair2:'#d8cfc4', patch:'#e08a3c', patch2:'#2a2228',
            earIn:'#ffb4c8', muzzle:'#fffaf6', cloth:'#1c1c20', cloth2:'#111114',
            inner:'#efe6d8', pouch:1, pants:'#1c1c20', shoes:'#f0f0f2',
            collar:'#efe6d8', tailKind:'cat', tailCol:'#e08a3c', tailTip:'#f4efe8', eye:'#7ac44a',
            eyeType:'slit' },
  // 喵白白：白貓，頭上一塊灰黑、黃綠眼、奶油刷毛帽T、黑工裝褲、白灰尾巴
  baibai: { name:'喵白白', cat:1, hair:'#f6f4f2', hair2:'#dad6d2', patch:'#4a4a50',
            earIn:'#ffc4d2', muzzle:'#ffffff', cloth:'#efe8dc', cloth2:'#cfc6b8',
            pouch:1, pants:'#26262c', shoes:'#f0f0f2', collar:'#efe8dc',
            nose:'#e8a0b0', whisker:'#a8a4a0',
            tailKind:'cat', tailCol:'#f6f4f2', tailTip:'#8a8a92', eye:'#b8c44a',
            eyeType:'slitL' },
  // 牙妹：紅髮雙馬尾＋貓耳、黑緞帶、黑洋裝配紅蝴蝶結、紅線黑褶裙、黑長襪、咖啡樂福鞋
  ya:     { name:'牙妹', fem:1, hair:'#a8342a', hair2:'#7a2018', twin:1, ribbon:'#1a1418',
            ears:'cat', earIn:'#f0d8c0', cloth:'#1e1a20', cloth2:'#120f14',
            skirt:'#1e1a20', skirtTrim:'#c02a2a', socks:'#1a1620', shoes:'#4a3428',
            collar:'#ffffff', bowtie:'#d02a2a', eye:'#c8702a', shine:'#d86a52', blush:1,
            eyeType:'sharp', fringe:'puff' },
  // 魚妹：深褐長髮、水藍水手服、海軍藍領巾與百褶裙、海軍藍長襪、咖啡樂福鞋
  yu:     { name:'魚妹', fem:1, hair:'#3a2a26', hair2:'#241816', long:1, hair3:'#4a352e',
            cloth:'#a8c8e8', cloth2:'#7fa4c8', sailor:1, sailorCol:'#1e2a4e', tieCol:'#1e2a4e',
            skirt:'#1e2a4e', socks:'#1e2a4e', shoes:'#4a3428',
            collar:'#ffffff', eye:'#3a7ad8', shine:'#6a5a50', blush:1,
            eyeType:'droop', fringe:'blunt' }
};
const FENG = CAST.feng, TU = CAST.tu;

const S = {};   /* the nine stories */

/* ============================ s023 百年夢 ========================== */
/* 1994 年的小工務所，一張圖紙長成一座城市。鏡頭沒離開過那張桌子。 */
S.s023 = {
  pal: PAL.dream, exe: 'HYAKUNEN.EXE', tag: '百年', banner: '百年の夢',
  gauges: ['DREAM', 'YEARS'],
  gaugeB: g => clamp(g.prog, 0, 1),
  shots: [
    { t: 0,     id: 'empty',  year: 1994, city: .05 },
    { t: 10.46, id: 'sit',    year: 1994, city: .1,  bust:'feng' },
    { t: 20.22, id: 'lines',  year: 2001, city: .25, bust:'tu' },
    { t: 26.25, id: 'rise',   year: 2018, city: .5 },
    { t: 39.37, id: 'detail', year: 2030, city: .6,  bust:'feng' },
    { t: 55.60, id: 'rise',   year: 2048, city: .75 },
    { t: 67.70, id: 'map',    year: 2066, city: .85, bust:'tu' },
    { t: 78.01, id: 'final',  year: 2094, city: 1 }
  ],
  scene(g, SC) {
    const s = g.shot;
    const grow = lerp(s.city, g.shotIdx < 7 ? s.city + .1 : 1, easeOut(g.shotP));
    SC.room(g, { city: grow });
    this._room = { city: grow };
  },
  front(g, F) {
    const P = g.P, s = g.shot, BW = g.BW, BH = g.BH;
    const fy = g.fy, fh = Math.round(BH * .46);
    // the year plate, always on the wall
    const yr = Math.round(lerp(s.year, g.shot.year, 1));
    F.fill(6, BH * .2, 34, 13, P.sky);
    F.frame(6, BH * .2, 34, 13, P.warm, 1);
    F.text(String(yr), 23, BH * .2 + 3, 9, P.warm, 'center', 900);

    // the pair at the desk
    const sing = g.F.level;
    if (s.id !== 'empty') {
      F.figure({ x: g.cx - fh * .42, y: fy, h: fh, t: g.t, sing, ...FENG,
                 pose: s.id === 'lines' ? 'point' : 'idle', shadowBack: P.bg0, shadowFront: P.bg1 });
      F.figure({ x: g.cx + fh * .42, y: fy, h: fh, t: g.t, sing, ph: 1.7, ...TU,
                 pose: s.id === 'final' ? 'raise' : 'idle', shadowBack: P.bg0, shadowFront: P.bg1 });
    }
    // the blueprint on the desk, with lines crawling out of it
    const dy = Math.round(g.fy - BH * .08);
    F.fill(BW * .1, dy - 9, BW * .2, 9, P.ink);
    F.fill(BW * .1, dy - 9, BW * .2, 1, P.acc2);
    if (s.id === 'lines' || s.id === 'detail') {
      const n = 6, p = easeOut(clamp(g.shotP * 1.4, 0, 1));
      for (let i = 0; i < n; i++) {
        const x = BW * (.12 + i * .03);
        F.fill(x, dy - 9 - i * 2 - p * BH * .12, 1, p * BH * .12, P.acc2);
      }
    }
    // the three beams of light: 資訊 / 文化 / 水電
    if (s.id === 'lines' || s.id === 'rise' || s.id === 'final') {
      const cols = [P.acc2, P.warm, '#8cffbe'];
      for (let i = 0; i < 3; i++) {
        const a = clamp(g.shotP * 2 - i * .2, 0, 1);
        if (a <= 0) continue;
        const y0 = dy - 6, y1 = BH * (.2 + i * .06);
        F.fill(BW * .2, y0 - (y0 - y1) * a, 1, (y0 - y1) * a, cols[i]);
        F.fill(BW * .2, y0 - (y0 - y1) * a, (BW * .38) * a, 1, cols[i]);
      }
    }
    if (s.id === 'map') {
      // names lighting up across a map
      for (let i = 0; i < 10; i++) {
        const on = g.shotP * 12 > i;
        const x = BW * (.55 + (F.hash(i) - .5) * .3), y = BH * (.25 + F.hash(i + 9) * .3);
        if (on) { F.disc(x, y, 2, P.warm); F.disc(x, y, 1, P.ink); }
      }
    }
    if (s.id === 'final' && g.shotP > .5) {
      const p = clamp((g.shotP - .5) * 3, 0, 1);
      F.slam(g, '鋒 塗 力', p * .8, P.ink);
    }
  }
};

/* ========================= s024 水電進化 Show ====================== */
/* 直播節目「進化展示會」。工具變樂器，年表像新聞跑馬燈壓過畫面。 */
S.s024 = {
  pal: PAL.volt, exe: 'SUIDEN.EXE', tag: '進化', banner: '水電進化',
  gauges: ['VOLT', 'CROWD'],
  gaugeA: g => clamp(g.F.level * 1.7, 0, 1),
  gaugeB: g => clamp(.2 + g.prog * .8, 0, 1),
  shots: [
    { t: 0,      id: 'empty' },
    { t: 17.10,  id: 'tools', bust:'tu' },
    { t: 32.07,  id: 'ticker', tick: '三十七歲　高考三級　資訊處理榜首' },
    { t: 49.74,  id: 'ticker', tick: '五十二歲　副市長　代理市長上陣忙' },
    { t: 56.79,  id: 'band', bust:'whale' },
    { t: 75.27,  id: 'lights' },
    { t: 88.83,  id: 'neon', bust:'gugu' },
    { t: 107.53, id: 'chorus', bust:'feng' },
    { t: 133.46, id: 'outro' }
  ],
  scene(g, SC) { SC.stage(g, {}); },
  front(g, F) {
    const P = g.P, s = g.shot, BW = g.BW, BH = g.BH;
    const fy = g.fy, fh = Math.round(BH * .46);
    const sing = g.F.level;
    if (s.id !== 'empty') {
      F.figure({ x: g.cx - fh * .4, y: fy, h: fh, t: g.t, sing, ...FENG,
                 pose: s.id === 'chorus' || s.id === 'lights' ? 'raise' : 'idle',
                 shadowBack: P.bg0, shadowFront: P.bg1 });
      F.figure({ x: g.cx, y: fy, h: fh * .96, t: g.t, sing, ph: 1.2, ...TU,
                 shadowBack: P.bg0, shadowFront: P.bg1 });
      // the guitar, strummed on the beat
      const gx = g.cx + fh * .16, gy = fy - fh * .38;
      F.disc(gx, gy, fh * .1, '#c8632e');
      F.fill(gx + fh * .06, gy - fh * .2, fh * .03, fh * .2, '#3a2418');
      F.disc(gx, gy, fh * .03, '#3a2418');
      if (g.F.beat > .5) F.fill(gx - fh * .12, gy - fh * .02, fh * .24, 1, P.ink);
    } else {
      // just a mic stand waiting
      F.fill(BW * .4, BH * .4, 1, BH * .36, P.lit);
      F.disc(BW * .4, BH * .4, 3, P.ink);
    }
    if (s.id === 'tools') {
      // wrench turning into a guitar, one frame at a time
      const p = clamp(g.shotP * 2, 0, 1);
      const x = BW * .7, y = BH * .42;
      F.fill(x - 2, y, 4, BH * .16 * (1 - p * .3), P.lit);
      F.fill(x - 6, y - 5, 12, 6, P.lit);
      if (p > .5) { F.disc(x, y + BH * .14, BH * .05 * (p - .5) * 2, '#c8632e'); }
    }
    if (s.id === 'ticker') {
      // a news ticker sliding across the stage
      const ty = Math.round(BH * .24);
      F.fill(0, ty, BW, 13, P.acc);
      F.fill(0, ty, BW, 1, P.ink);
      const w = F.measure(s.tick, 9, 800);
      const x = BW - ((g.t * 40) % (BW + w));
      F.text(s.tick, x, ty + 2, 9, '#1a1008', 'left', 800);
    }
    if (s.id === 'neon') {
      for (let i = 0; i < 8; i++) {
        const on = ((g.t * 3 + i) | 0) % 3;
        const x = BW * (.08 + i * .11), h = BH * (.1 + F.hash(i) * .16);
        F.fill(x, BH * .12, 2, h, on ? P.acc2 : P.bg2);
        if (on) F.fill(x - 1, BH * .12, 4, 2, P.ink);
      }
      F.text('２０４０', g.cx, BH * .06, 11, P.acc2, 'center', 900);
    }
    if (s.id === 'lights' || s.id === 'chorus') F.fallers(g, 'confetti', .5 + g.F.level);
    if (s.id === 'outro' && g.shotP > .6) F.slam(g, '水電進化 Show', clamp((g.shotP - .6) * 2.5, 0, 1), P.ink);
  }
};

/* ========================= s026 本喵掉的毛 ========================= */
/* 貓神殿改成的拍賣會場。人類跪著，本喵躺著，每掉一根毛價格就跳一次。 */
S.s026 = {
  pal: PAL.meow, exe: 'NYANBUBU.EXE', tag: '掉毛', banner: '本喵掉毛',
  gauges: ['FLUFF', 'PRICE'],
  gaugeA: g => clamp(.3 + g.F.level * 1.4, 0, 1),
  gaugeB: g => clamp(.1 + g.prog, 0, 1),
  shots: [
    { t: 0,      id: 'dark' },
    { t: 6.08,   id: 'kneel', bust:'bubu' },
    { t: 13.59,  id: 'shed' },
    { t: 27.50,  id: 'price', price: 8800 },
    { t: 59.58,  id: 'stamp', bust:'bubu' },
    { t: 68.20,  id: 'price', price: 888 },
    { t: 77.46,  id: 'shed' },
    { t: 107.48, id: 'recall' },
    { t: 122.72, id: 'pilgrim', bust:'baibai' }
  ],
  scene(g, SC) { SC.temple(g, {}); },
  front(g, F) {
    const P = g.P, s = g.shot, BW = g.BW, BH = g.BH;
    const dy = Math.round(g.fy - BH * .12);
    // 喵布布 on the dais, lying down, tail flicking, refusing to move
    if (s.id !== 'dark') {
      F.figure({ x: g.cx, y: dy, h: BH * .44, t: g.t, sing: 0, ...CAST.bubu,
                 pose: 'lie', awake: s.id === 'price' || s.id === 'stamp' ? 1 : 0,
                 shadowBack: P.bg0, shadowFront: P.bg1 });
      // 喵白白 sits behind, smaller, as the silent second cat
      if (s.id === 'pilgrim' || s.id === 'shed')
        F.figure({ x: g.cx + BH * .3, y: dy + BH * .05, h: BH * .3, t: g.t, sing: 0, ...CAST.baibai,
                   ph: 2.1, shadowBack: P.bg0, shadowFront: P.bg1 });
    }
    // kneeling humans
    if (s.id === 'kneel' || s.id === 'pilgrim' || s.id === 'price') {
      const n = g.port ? 3 : 5;
      for (let i = 0; i < n; i++) {
        const x = BW * (.12 + i * (.76 / (n - 1)));
        const bow = Math.sin(g.t * 1.4 + i) * 2;
        F.fill(x - 5, BH * .88 + bow, 10, BH * .06, '#000');
        F.disc(x, BH * .88 + bow, 4, '#000');
      }
    }
    // fur coming off on the beat
    if (s.id === 'shed' || s.id === 'recall') F.fallers(g, 'fur', s.id === 'recall' ? .4 : 1);
    if (s.id === 'price') {
      const p = clamp(g.shotP * 3, 0, 1);
      const shown = Math.round(s.price * easeOut(p) + Math.sin(g.t * 20) * 7 * (1 - p));
      F.bigNum(g, '$ ' + shown, clamp(g.shotP * 1.6, 0, 1), P.warm);
    }
    if (s.id === 'stamp' && g.shotP < .5) {
      const p = clamp(g.shotP * 4, 0, 1);
      const sz = lerp(BH * .3, BH * .14, easeOut(p));
      F.frame(g.cx - sz / 2, BH * .3 - sz / 2, sz, sz, P.acc, 3);
      F.text('本喵原廠', g.cx, BH * .3 - sz * .16, Math.round(sz * .22), P.acc, 'center', 900);
    }
    if (s.id === 'recall') {
      // the fur being taken back: the particles run upward instead
      F.text('收 回 去 珍 藏', g.cx, BH * .26, 12, P.acc2, 'center', 900);
    }
  }
};

/* ========================= s027 傳奇人生 =========================== */
/* RPG 的角色養成畫面。每個年齡是一關，每個頭銜是一個解鎖的稱號。 */
S.s027 = {
  pal: PAL.crown, exe: 'DENSETSU.EXE', tag: '傳奇', banner: '傳奇人生',
  gauges: ['LUCK', 'RANK'],
  gaugeA: g => clamp(.4 + g.F.level, 0, 1),
  gaugeB: g => clamp(g.prog, 0, 1),
  shots: [
    { t: 0,     id: 'title' },
    { t: 17.28, id: 'slot', reels: ['7', '7', '7'], label: '統一發票 特別獎' },
    { t: 29.08, id: 'slot', reels: ['3', '9', '5'], label: '威力彩 頭獎' },
    { t: 34.53, id: 'slot', reels: ['1', '0', '8'], label: '大樂透 頭獎' },
    { t: 40.26, id: 'choice', bust:'feng' },
    { t: 49.79, id: 'found' },
    { t: 61.47, id: 'tower', floors: 2, title: '台北市資訊局長' },
    { t: 72.18, id: 'tower', floors: 4, title: '台北市副秘書長' },
    { t: 83.89, id: 'tower', floors: 6, title: '台北市長候選人' },
    { t: 99.75, id: 'tower', floors: 9, title: '總統候選人', bust:'feng' },
    { t: 115.67, id: 'title' }
  ],
  scene(g, SC) { SC.screen(g, {}); },
  front(g, F) {
    const P = g.P, s = g.shot, BW = g.BW, BH = g.BH;
    const fy = g.fy, fh = Math.round(BH * .5);
    const stage = clamp(g.shotIdx - 4, 0, 4);
    const suits = [
      { cloth: '#6b6f8c', cloth2: '#494d64' },
      { cloth: '#2a2a44', cloth2: '#1a1a2e' },
      { cloth: '#573683', cloth2: '#3b2259' },
      { cloth: '#b76cff', cloth2: '#8548c4' },
      { cloth: '#ffd24a', cloth2: '#c49a22' }
    ][stage];
    if (s.id !== 'title') {
      F.figure({ x: g.cx, y: fy, h: fh, t: g.t, sing: g.F.level,
                 ...FENG, ...suits, pose: stage >= 3 ? 'raise' : 'idle',
                 shadowBack: P.sky, shadowFront: P.bg1 });
    }
    if (s.id === 'title') {
      const p = clamp(g.shotP * 2, 0, 1);
      F.textOut('鋒兄の傳奇人生', g.cx, BH * .3, Math.round(BH * .1), P.warm, '#000', 'center', 900);
      if ((g.t * 2 | 0) % 2) F.text('PUSH  START', g.cx, BH * .52, 10, P.ink, 'center', 800);
      // every unlocked title, lit on the way back
      const names = ['頭獎', '榜首', '創業', '局長', '副秘書長', '市長候選', '總統候選'];
      for (let i = 0; i < names.length; i++) {
        const on = g.prog > .5;
        F.text(names[i], g.cx, BH * .62 + i * 9, 7, on ? P.warm : P.bg2, 'center', 700);
      }
    }
    if (s.id === 'slot') {
      F.slot(g, s.reels, clamp(g.shotP * 1.6, 0, 1));
      if (g.shotP > .55) F.text(s.label, g.cx, BH * .44, 10, P.warm, 'center', 900);
      if (g.shotP > .6) F.fallers(g, 'coin', 1);
    }
    if (s.id === 'choice') {
      const w = Math.round(g.sw * .72), x = Math.round(g.cx - w / 2), y = Math.round(BH * .3);
      F.win(P, x, y, w, 46, 'SELECT');
      const pick = g.shotP > .55 ? 1 : 0;
      F.text('報到', x + 18, y + 16, 9, pick ? P.lit : P.ink, 'left', 800);
      F.text('放棄報到', x + 18, y + 28, 9, pick ? P.ink : P.lit, 'left', 800);
      if ((g.t * 4 | 0) % 2 || g.shotP > .55) F.text('▶', x + 8, y + 16 + pick * 12, 9, P.warm, 'left', 800);
    }
    if (s.id === 'found') {
      F.plate(g, '鋒兄塗哥公關資訊', ['創業', '等級條 MAX'], g.shotP);
    }
    if (s.id === 'tower') {
      // the city hall, one lit floor per rank
      const tw = Math.round(BW * .16), tx = Math.round(BW * (g.port ? .5 : .68) - tw / 2);
      const fl = 10, fhh = Math.round(BH * .05);
      for (let i = 0; i < fl; i++) {
        const on = i < s.floors * (.4 + easeOut(clamp(g.shotP * 2, 0, 1)) * .6);
        const y = BH * .74 - i * fhh;
        F.fill(tx, y - fhh, tw, fhh - 1, on ? P.bg2 : P.bg0);
        if (on) for (let k = 0; k < 3; k++) F.fill(tx + 3 + k * (tw / 3), y - fhh + 2, 2, 3, P.warm);
      }
      F.text(s.title, g.cx, BH * .2, Math.round(BH * .055), P.warm, 'center', 900);
    }
  }
};

/* ======================== s028 水電王子爆紅 ======================== */
/* 一台老電視的轉台史。塗哥沒變，是外面的世界越滾越大。 */
S.s028 = {
  pal: PAL.blaze, exe: 'BAKUHATU.EXE', tag: '爆紅', banner: '水電王子',
  gauges: ['HEAT', 'FAME'],
  gaugeA: g => clamp(.2 + g.F.level * 1.5, 0, 1),
  gaugeB: g => clamp(Math.pow(g.prog, .6), 0, 1),
  shots: [
    { t: 0,      id: 'off' },
    { t: 11.43,  id: 'book' },
    { t: 23.23,  id: 'shop',  ch: 'CH 03　地方新聞', bust:'tu' },
    { t: 42.97,  id: 'farm',  ch: 'CH 07　向日葵農場' },
    { t: 56.15,  id: 'class', ch: 'CH 11　鋒兄歷史小學堂' },
    { t: 75.67,  id: 'robot', ch: 'CH 21　AI 專題' },
    { t: 86.00,  id: 'mixup', ch: 'CH 24　人物誤認', bust:'feng' },
    { t: 112.38, id: 'drama', ch: 'CH 31　水電情' },
    { t: 153.46, id: 'book2', ch: 'CH 44　人物專訪', bust:'tu' },
    { t: 175.47, id: 'paper', ch: 'CH 55　學術引用' },
    { t: 197.50, id: 'money' }
  ],
  scene(g, SC) { this._o = {}; SC.tv(g, this._o); },
  front(g, F) {
    const P = g.P, s = g.shot, BW = g.BW, BH = g.BH;
    const T = this._o.tube;
    if (!T) return;
    F.text(s.ch || '', T.x + 3, T.y + 3, 7, P.acc2, 'left', 700);
    const fy = T.y + T.h - 3, fh = T.h * .62;
    const sing = g.F.level;
    if (s.id === 'off') {
      // a dead channel: noise bars
      for (let i = 0; i < 40; i++) {
        const y = T.y + (F.hash(i + (g.t * 8 | 0)) * T.h);
        F.fill(T.x, y, T.w, 1, F.hash(i * 3) > .5 ? P.bg2 : P.bg0);
      }
      return;
    }
    if (s.id === 'book' || s.id === 'book2') {
      F.plate(g, s.id === 'book' ? '2004 畢業紀念冊' : '塗神 水電王子',
              s.id === 'book' ? ['六月十五日', '留下紀念簽名'] : ['現象級水電工', '人物專訪'],
              clamp(g.shotP * 2, 0, 1));
      return;
    }
    if (s.id === 'paper') {
      // theses stacking up
      const n = 1 + Math.floor(clamp(g.shotP * 3, 0, 1) * 3);
      for (let i = 0; i < n; i++) {
        const x = T.x + T.w * .22 + i * 6, y = T.y + T.h * .3 + i * 7;
        F.fill(x, y, T.w * .5, T.h * .34, P.ink);
        F.frame(x, y, T.w * .5, T.h * .34, P.bg0, 1);
        F.text(i % 2 ? '博士論文 引用' : '碩士論文 引用', x + 4, y + 4, 7, P.bg0, 'left', 700);
      }
      return;
    }
    if (s.id === 'money') {
      F.fallers(g, 'coin', 1);
      F.bigNum(g, '333 億 / 3 億', clamp(g.shotP * 1.5, 0, 1), P.warm);
      return;
    }
    // everything else: 塗哥 inside the tube plus one prop
    F.figure({ x: T.x + T.w * .3, y: fy, h: fh, t: g.t, sing, ...TU,
               pose: s.id === 'mixup' ? 'point' : 'idle',
               shadowBack: P.bg0, shadowFront: P.bg1 });
    if (s.id === 'shop') {
      F.fill(T.x + T.w * .62, T.y + T.h * .3, T.w * .3, T.h * .28, P.bg1);
      F.frame(T.x + T.w * .62, T.y + T.h * .3, T.w * .3, T.h * .28, P.bg2, 1);
      F.text('太陽餅', T.x + T.w * .77, T.y + T.h * .38, 8, P.warm, 'center', 800);
    }
    if (s.id === 'farm') {
      for (let i = 0; i < 6; i++) {
        const x = T.x + T.w * (.55 + i * .07), y = fy - T.h * .2 - F.hash(i) * T.h * .1;
        F.fill(x, y, 1, fy - y, '#4f7a2a');
        F.disc(x, y, 3.5, P.warm);
        F.disc(x, y, 1.6, '#5a3a10');
      }
    }
    if (s.id === 'class') {
      F.fill(T.x + T.w * .52, T.y + T.h * .2, T.w * .4, T.h * .42, '#1d3326');
      F.frame(T.x + T.w * .52, T.y + T.h * .2, T.w * .4, T.h * .42, '#7a5a2a', 2);
      F.text('歷史小學堂', T.x + T.w * .72, T.y + T.h * .28, 8, P.ink, 'center', 800);
    }
    if (s.id === 'robot') {
      const x = T.x + T.w * .66, y = fy - fh * .7;
      F.fill(x - 8, y, 16, fh * .4, P.bg2);
      F.fill(x - 6, y - 10, 12, 10, P.lit);
      F.fill(x - 3, y - 7, 2, 2, P.acc); F.fill(x + 1, y - 7, 2, 2, P.acc);
      F.fill(x - 1, y - 14, 2, 4, P.acc2);
    }
    if (s.id === 'mixup') {
      F.fill(T.x + T.w * .52, T.y + 10, 1, T.h - 20, P.bg2);
      F.text('鋒兄？', T.x + T.w * .76, T.y + T.h * .3, 9, P.ink, 'center', 800);
      F.text('黃馨鋒', T.x + T.w * .76, T.y + T.h * .45, 9, P.acc, 'center', 800);
    }
    if (s.id === 'drama') {
      F.plate(g, '電視劇 水電情', ['原型人物 塗偉傑', '我叫塗三傑'], clamp(g.shotP * 3, 0, 1));
    }
  }
};

/* ========================= s029 最瞎結婚理由 ======================= */
/* 像素戀愛遊戲。兩條線左右鏡像平行推進，最後合流成一場喜宴。 */
S.s029 = {
  pal: PAL.wed, exe: 'KEKKON.EXE', tag: '結婚', banner: '最瞎婚禮',
  gauges: ['LOVE', '539'],
  gaugeA: g => clamp(.3 + g.prog * .7, 0, 1),
  gaugeB: g => clamp(g.F.level * 1.8, 0, 1),
  shots: [
    { t: 0,      id: 'ask' },
    { t: 19.22,  id: 'ask', bust:'feng' },
    { t: 36.42,  id: 'draw',  nums: ['05', '13', '23', '31', '39'] },
    { t: 41.90,  id: 'prize', amount: '頭獎' },
    { t: 47.82,  id: 'thread', side: -1, bust:'ya' },
    { t: 56.56,  id: 'split' },
    { t: 97.24,  id: 'draw',  nums: ['02', '11', '19', '28', '35'] },
    { t: 108.76, id: 'thread', side: 1, bust:'yu' },
    { t: 123.50, id: 'aisle' },
    { t: 132.00, id: 'feast' }
  ],
  scene(g, SC) { SC.temple(g, {}); },
  front(g, F) {
    const P = g.P, s = g.shot, BW = g.BW, BH = g.BH;
    const fy = g.fy, fh = Math.round(BH * .42);
    const sing = g.F.level;
    const BRIDE1 = CAST.ya, BRIDE2 = CAST.yu;
    if (s.id === 'ask') {
      F.figure({ x: g.cx - fh * .4, y: fy, h: fh, t: g.t, sing, ...FENG, shadowBack: P.bg0, shadowFront: P.bg1 });
      F.figure({ x: g.cx + fh * .4, y: fy, h: fh, t: g.t, sing, ph: 1.4, ...TU, pose: 'point',
                 shadowBack: P.bg0, shadowFront: P.bg1 });
    }
    if (s.id === 'draw') { F.balls(g, s.nums, clamp(g.shotP * 1.6, 0, 1)); }
    if (s.id === 'prize') F.bigNum(g, s.amount, clamp(g.shotP * 1.5, 0, 1), P.warm);
    if (s.id === 'thread') {
      const a = s.side < 0 ? FENG : TU, bpal = s.side < 0 ? BRIDE1 : BRIDE2;
      F.figure({ x: g.cx - fh * .45, y: fy, h: fh, t: g.t, sing, ...a, blush: 1, shadowBack: P.bg0, shadowFront: P.bg1 });
      F.figure({ x: g.cx + fh * .45, y: fy, h: fh, t: g.t, sing, ph: .9, ...bpal, tail: 1, blush: 1,
                 shadowBack: P.bg0, shadowFront: P.bg1 });
      const p = easeOut(clamp(g.shotP * 2, 0, 1));
      const y = fy - fh * .45;
      F.fill(BW * .36, y, (BW * .22) * p, 1, P.acc);
      F.fill(BW * .36, y - 1, (BW * .22) * p, 1, '#ff7a9c');
    }
    if (s.id === 'split') {
      // the split shot is the one that wants the whole width: the two lanes
      // run under the dialog, which sits well above the cast
      F.fill(BW * .5, BH * .58, 1, BH * .24, P.bg2);
      for (const sd of [-1, 1]) {
        const cx = BW * (sd < 0 ? .25 : .75);
        const sy = BH * .83;
        F.figure({ x: cx - fh * .2, y: sy, h: fh * .95, t: g.t, sing, ...(sd < 0 ? FENG : TU),
                   ph: sd, blush: 1, shadowBack: P.bg0, shadowFront: P.bg1 });
        F.figure({ x: cx + fh * .2, y: sy, h: fh * .95, t: g.t, sing, ph: sd + 1,
                   ...(sd < 0 ? BRIDE1 : BRIDE2), tail: 1, blush: 1,
                   shadowBack: P.bg0, shadowFront: P.bg1 });
        F.text(sd < 0 ? '鋒兄 × 牙妹' : '小塗 × 魚妹', cx, BH * .55, 8, P.warm, 'center', 900);
      }
    }
    if (s.id === 'aisle' || s.id === 'feast') {
      const n = 4;
      for (let i = 0; i < n; i++) {
        const cols = [FENG, BRIDE1, TU, BRIDE2][i];
        F.figure({ x: BW * (.22 + i * .19), y: fy, h: fh * .88, t: g.t, sing, ph: i, ...cols,
                   blush: 1, tail: i % 2, shadowBack: P.bg0, shadowFront: P.bg1 });
      }
      if (s.id === 'feast') {
        F.fallers(g, 'confetti', 1);
        // the banquet tables, seen from above
        for (let i = 0; i < 8; i++) {
          const x = BW * (.1 + (i % 4) * .27), y = BH * (.2 + ((i / 4) | 0) * .12);
          F.disc(x, y, BH * .028, P.acc);
          F.disc(x, y, BH * .016, P.warm);
        }
      }
    }
    if (g.shotIdx >= 8 && g.shotP > .7) F.slam(g, '囍', clamp((g.shotP - .7) * 3, 0, 1), P.warm);
  }
};

/* ========================= s062 鋒兄進化 Show ====================== */
/* 格鬥遊戲的進化畫面。每一段觸發一次 LEVEL UP，形態改變。 */
S.s062 = {
  pal: PAL.neon, exe: 'SHINKA.EXE', tag: '進化', banner: '進化ショー',
  gauges: ['LEVEL', 'POWER'],
  gaugeA: g => clamp(g.prog, 0, 1),
  gaugeB: g => clamp(g.F.level * 1.8, 0, 1),
  shots: [
    { t: 0,     id: 'vs',    stage: 0 },
    { t: 11.27, id: 'level', stage: 0, label: '榜首' },
    { t: 26.40, id: 'level', stage: 1, label: '副市長', bust:'feng' },
    { t: 45.00, id: 'combo', stage: 1 },
    { t: 56.99, id: 'neon',  stage: 2 },
    { t: 61.99, id: 'level', stage: 2, label: 'evolution' },
    { t: 77.52, id: 'final', stage: 2, bust:'feng' }
  ],
  scene(g, SC) { SC.stage(g, {}); },
  front(g, F) {
    const P = g.P, s = g.shot, BW = g.BW, BH = g.BH;
    const fy = g.fy, fh = Math.round(BH * (.44 + s.stage * .05));
    const suits = [
      { cloth: '#6b6f8c', cloth2: '#494d64' },
      { cloth: '#2a2a44', cloth2: '#1a1a2e' },
      { cloth: '#8cff82', cloth2: '#4fbc4a' }
    ][s.stage];
    F.figure({ x: g.cx, y: fy, h: fh, t: g.t, sing: g.F.level, ...FENG, ...suits,
               pose: s.id === 'final' ? 'raise' : 'idle',
               shine: s.stage === 2 ? P.warm : '#ffffff',
               shadowBack: P.bg0, shadowFront: P.bg1 });
    // the level bar, right across the top
    const bw = Math.round(g.sw * .8), bx = Math.round(g.cx - g.sw * .4), by = Math.round(BH * .2);
    F.frame(bx, by, bw, 8, P.bg2, 1);
    F.fill(bx + 1, by + 1, (bw - 2) * clamp(g.prog, 0, 1), 6, P.warm);
    F.text('LV ' + (1 + Math.floor(g.prog * 9)), bx, by - 10, 8, P.warm, 'left', 800);
    if (s.id === 'vs') {
      F.textOut('VS', g.cx, BH * .34, Math.round(BH * .14), P.acc, '#000', 'center', 900);
    }
    if (s.id === 'level' && g.shotP < .4) {
      F.slam(g, 'LEVEL UP　' + s.label, clamp(g.shotP / .4, 0, 1), P.ink);
    }
    if (s.id === 'combo') {
      const hits = Math.floor(g.shotP * 12);
      F.text(hits + ' HIT', BW * .82, BH * .3, 12, P.acc, 'center', 900);
    }
    if (s.id === 'neon') {
      for (let i = 0; i < 10; i++) {
        const on = ((g.t * 4 + i) | 0) % 2;
        F.fill(BW * (.05 + i * .095), BH * .1, 2, BH * (.06 + F.hash(i) * .1), on ? P.acc : P.bg2);
      }
    }
    if (s.id === 'final') {
      const flash = (g.t * 3 | 0) % 2;
      if (flash && g.F.punch > .3) { F.fill(0, 0, BW, BH, P.warm); }
      F.fallers(g, 'confetti', 1);
    }
  }
};

/* ==================== s101 與畢業紀念冊的對話 ===================== */
/* 深夜書房，一本會說話的紀念冊。整首歌就是一次推理，畫面跟著推理走。 */
S.s101 = {
  pal: PAL.memo, exe: 'SOTSUGYO.EXE', tag: '紀念冊', banner: '卒業紀念',
  gauges: ['MEMORY', 'MEANING'],
  gaugeA: g => clamp(.2 + g.prog * .8, 0, 1),
  gaugeB: g => clamp(g.lit ? .9 : .25 + g.F.level * .3, 0, 1),
  shots: [
    { t: 0,      id: 'desk',  lit: 0 },
    { t: 10.14,  id: 'nums',  lit: 0 },
    { t: 23.50,  id: 'class', lit: 0 },
    { t: 39.73,  id: 'cards', lit: 0 },
    { t: 61.09,  id: 'dark',  lit: 0 },
    { t: 64.74,  id: 'talk',  lit: 0, bust:'feng' },
    { t: 82.67,  id: 'cards', lit: 1 },        // 5-12 榜首
    { t: 114.95, id: 'rank',  lit: 1, bust:'feng' },
    { t: 145.07, id: 'cards', lit: 5 },        // 5-23 補習班同學
    { t: 159.95, id: 'table', lit: 5 },
    { t: 200.16, id: 'cards', lit: 45 },       // 12-18 市長 + 18-23 總統
    { t: 225.69, id: 'close', lit: 45 }
  ],
  scene(g, SC) { SC.room(g, { city: .15 }); },
  front(g, F) {
    const P = g.P, s = g.shot, BW = g.BW, BH = g.BH;
    const dy = Math.round(g.fy - BH * .04);
    // the yearbook open on the desk, glowing when it talks
    const glow = (s.id === 'talk' || s.id === 'cards' || s.id === 'rank') ? 1 : .3;
    const bw = Math.round(BW * .22), bh = Math.round(BH * .1);
    const bx = Math.round(BW * .13), by = dy - bh;
    F.fill(bx, by, bw, bh, P.ink);
    F.fill(bx + bw / 2, by, 1, bh, P.bg2);
    F.frame(bx, by, bw, bh, P.bg0, 1);
    if (glow > .5 && (g.t * 2 | 0) % 2) F.frame(bx - 2, by - 2, bw + 4, bh + 4, P.acc2, 1);
    // the reader
    if (s.id !== 'close') {
      F.figure({ x: g.sw * .62, y: g.fy, h: BH * .34, t: g.t, sing: g.F.level, ...FENG,
                 pose: s.id === 'talk' ? 'point' : 'idle', shadowBack: P.bg0, shadowFront: P.bg1 });
    }
    if (s.id === 'nums') {
      const p = clamp(g.shotP * 2, 0, 1);
      const items = ['2021', '33 名', '33 歲'];
      for (let i = 0; i < 3; i++) {
        if (p * 3 < i) continue;
        F.text(items[i], g.cx, BH * (.18 + i * .09), Math.round(BH * .07), P.warm, 'center', 900);
      }
    }
    if (s.id === 'class') {
      // the class list scrolling, four of them circled
      const keep = ['5', '12', '18', '23'];
      for (let i = 1; i <= 24; i++) {
        const x = BW * (.42 + ((i - 1) % 6) * .09), y = BH * (.16 + (((i - 1) / 6) | 0) * .07);
        const on = keep.indexOf(String(i)) >= 0 && g.shotP > .3;
        F.text(String(i), x, y, 8, on ? P.warm : P.bg2, 'center', on ? 900 : 700);
        if (on) F.frame(x - 6, y - 2, 12, 11, P.acc, 1);
      }
    }
    if (s.id === 'cards' || s.id === 'dark') {
      const list = ['5-12', '5-18', '5-23', '12-18', '12-23', '18-23'];
      F.cards(g, list, s.id === 'dark' ? 0 : s.lit, Math.round(BH * .09));
    }
    if (s.id === 'rank') {
      const rows = [['5', '五職等'], ['12', '十二職等'], ['12', '副秘書長']];
      for (let i = 0; i < rows.length; i++) {
        if (g.shotP * 3 < i) continue;
        F.text(rows[i][0], BW * .46, BH * (.18 + i * .08), 11, P.warm, 'right', 900);
        F.text('→ ' + rows[i][1], g.cx, BH * (.18 + i * .08), 10, P.ink, 'left', 800);
      }
    }
    if (s.id === 'table') {
      // the term table that gets drawn then struck out
      const cols = ['台北市', '金門', '連江'];
      for (let i = 0; i < 3; i++) {
        const y = BH * (.18 + i * .08);
        F.text(cols[i], BW * .42, y, 9, P.ink, 'right', 800);
        F.text('第 8 屆', BW * .46, y, 9, P.acc2, 'left', 800);
        if (g.shotP > .5 + i * .12) F.fill(BW * .38, y + 5, BW * .3, 1, P.acc);
      }
    }
    if (s.id === 'close') {
      const p = clamp(g.shotP * 2, 0, 1);
      F.text('以上是排列組合的對話', g.cx, BH * .3, Math.round(BH * .06),
             P.lit, 'center', 800);
      if (p > .5) F.fill(0, 0, BW, BH, 'rgba(0,0,0,' + ((p - .5) * .9).toFixed(2) + ')');
    }
  }
};

/* ========================= s102 頭獎發票 =========================== */
/* 招財喵布布主持的慶生會。金幣一直掉，畫面最滿的一首。 */
S.s102 = {
  pal: PAL.money, exe: 'TOUSEN.EXE', tag: '頭獎', banner: '頭獎發票',
  gauges: ['YEN', 'LUCK'],
  gaugeA: g => clamp(.3 + g.prog * .7, 0, 1),
  gaugeB: g => clamp(.5 + g.F.level, 0, 1),
  shots: [
    { t: 0,      id: 'enter' },
    { t: 11.20,  id: 'cake', bust:'bubu' },
    { t: 17.00,  id: 'num', v: '20 萬', label: '統一發票 頭獎' },
    { t: 34.95,  id: 'num', v: '4800', label: '鋒兄買單 六人份' },
    { t: 42.06,  id: 'num', v: '2025 萬', label: '威力彩 分紅' },
    { t: 51.00,  id: 'rain' },
    { t: 65.50,  id: 'family', bust:'feng' },
    { t: 88.50,  id: 'num', v: '2025 萬', label: '再中一次' },
    { t: 104.94, id: 'photo' }
  ],
  scene(g, SC) { this._o = {}; SC.table(g, this._o); },
  front(g, F) {
    const P = g.P, s = g.shot, BW = g.BW, BH = g.BH;
    const ty = Math.round(g.fy);
    const fh = Math.round(BH * .28);
    const sing = g.F.level;
    // 招財喵布布 in the middle, paw up, the way a lucky cat stands
    const cx = g.cx;
    F.figure({ x: cx, y: ty + BH * .02, h: BH * .3, t: g.t, sing: 0, ...CAST.bubu,
               pose: 'raise', collar: P.acc, shadowBack: P.bg0, shadowFront: P.bg1 });
    if (s.id === 'cake' || s.id === 'family' || s.id === 'photo') {
      // the cake with the 37 candles
      const kx = BW * .78;
      F.fill(kx - BH * .06, ty - BH * .06, BH * .12, BH * .05, P.ink);
      F.fill(kx - BH * .06, ty - BH * .06, BH * .12, 2, P.acc);
      F.text('37', kx, ty - BH * .105, 10, P.warm, 'center', 900);
    }
    if (s.id === 'family' || s.id === 'photo') {
      const cast = [FENG, TU, CAST.whale, CAST.gugu];
      for (let i = 0; i < 4; i++) {
        const x = BW * (i < 2 ? .13 + i * .13 : .61 + (i - 2) * .13);
        F.figure({ x, y: ty + BH * .02, h: fh, t: g.t, sing, ph: i, ...cast[i],
                   shadowBack: P.bg0, shadowFront: P.bg1 });
      }
    }
    if (s.id === 'num') {
      F.bigNum(g, s.v, clamp(g.shotP * 1.4, 0, 1), P.warm);
      if (g.shotP < .75) F.text(s.label, g.cx, BH * .42, 9, P.acc2, 'center', 800);
    }
    F.fallers(g, 'coin', s.id === 'rain' || s.id === 'photo' ? 1 : .35 + g.F.level * .4);
    if (s.id === 'photo' && g.shotP > .55) {
      const p = clamp((g.shotP - .55) * 3, 0, 1);
      F.frame(4, 4, BW - 8, BH - 8, P.warm, 2);
      if (p > .5) F.text('全 家 福', g.cx, BH * .12, 12, P.warm, 'center', 900);
    }
  }
};

/* a song with no story of its own still gets a stage to stand on */
S.__default = d => ({
  pal: PAL.dream, exe: 'MV.EXE', tag: 'MV', banner: '鋒兄宇宙',
  gauges: ['LEVEL', 'TIME'],
  shots: [{ t: 0, id: 'x' }],
  scene(g, SC) { SC.stage(g, {}); },
  front(g, F) {
    F.figure({ x: g.g.cx, y: g.BH * .78, h: g.BH * .3, t: g.t, sing: g.F.level, ...FENG,
               shadowBack: g.P.bg0, shadowFront: g.P.bg1 });
  }
});

S.__who = n => CAST[n];
S.__cast = () => [CAST.whale, CAST.gugu, CAST.feng, CAST.tu,
                  CAST.bubu, CAST.baibai, CAST.ya, CAST.yu];

return S;
})();
