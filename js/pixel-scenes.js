/* Lyrics cue the artwork by line number. A four-number cue follows the
   Chinese, English, Japanese and Cantonese edits of the same passage. */
window.MV_PIXEL_SCENES = (() => {
'use strict';

const pair = ['feng', 'tu'];
const band = ['whale', 'feng', 'tu', 'gugu'];
const wedding = ['feng', 'ya', 'tu', 'yu'];
const party = ['bubu', 'feng', 'tu', 'baibai'];
const family = ['claude', ...party, 'gpt'];
const cat = ['bubu'];
const feng = ['feng'];
const tu = ['tu'];
const stories = {
  s023: ['workshop', [
    [-1, 'blueprint', [], '1994'],
    [0, 'blueprint', pair, '鋒塗力'],
    [4, 'network', pair, '資訊・文化・水電'],
    [8, 'city', pair, '百年企業'],
    [12, 'tools', pair, '職人的堅固'],
    [16, 'house', pair, '安心的家'],
    [20, 'city', pair, '鋒塗力'],
    [24, 'map', pair, '從這裡到全國'],
    [28, 'city', pair, '2094', 'cheer']
  ]],
  s024: ['concert', [
    [-1, 'mic', [], '水電進化 Show'],
    [0, 'mic', pair, '台北', 'bounce'],
    [[1, 3, 1, 1], 'guitar', pair, '從水電到樂團', 'bounce'],
    [[2, 4, 2, 2], 'camera', pair, '記者拍照', 'raise'],
    [[4, 6, 4, 4], 'exam', feng, '37 歲・榜首'],
    [[5, 7, 5, 5], 'terminal', feng, '資訊處理'],
    [[7, 9, 7, 7], 'hall', feng, '52 歲・代理市長'],
    [[8, 10, 8, 8], 'mic', band, '團員開唱', 'bounce'],
    [[9, 11, 9, 9], 'roster', band, '備取 → 正取'],
    [[12, 14, 12, 12], 'guitar', band, '水電進化', 'clap'],
    [[16, 18, 16, 16], 'city', band, '2040・兩廳院', 'wave'],
    [[19, 21, 19, 19], 'pipes', pair, 'AI・水管操作'],
    [[21, 23, 21, 21], 'mic', band, '大合唱', 'routine'],
    [[27, 29, 27, 27], 'guitar', band, '水電進化 Show', 'cheer']
  ]],
  s026: ['temple', [
    [-1, 'cushion', [], ''],
    [0, 'cushion', cat, '本喵出場', 'lie'],
    [4, 'fur', cat, '本喵掉的毛', 'lie'],
    [12, 'auction', cat, '拍賣', 'lie'],
    [20, 'stamp', cat, '本喵原廠', 'lie'],
    [24, 'auction', cat, '888', 'lie'],
    [26, 'auction', cat, '88', 'lie'],
    [28, 'fur', cat, '喵布布', 'lie'],
    [36, 'cushion', cat, '掉一床', 'lie'],
    [37, 'treasure', cat, '收回珍藏', 'lie'],
    [39, 'phone', cat, '本喵相片', 'lie'],
    [40, 'shrine', cat, '排隊朝拜', 'lie']
  ]],
  s027: ['arcade', [
    [-1, 'crown', feng, '鋒兄的傳奇人生'],
    [4, 'receipt', feng, '統一發票特別獎', 'cheer'],
    [5, 'lottery', feng, '威力彩頭獎', 'clap'],
    [6, 'lottery', feng, '大樂透頭獎', 'clap'],
    [7, 'exam', feng, '高考三級榜首'],
    [[8, 8, 9, 8], 'roster', feng, '放棄報到', 'point'],
    [[9, 9, 10, 9], 'blueprint', pair, '鋒兄塗哥公關資訊'],
    [[12, 13, 14, 12], 'hall', feng, '台北市資訊局長'],
    [[14, 15, 16, 14], 'hall', feng, '台北市副秘書長'],
    [[16, 19, 20, 16], 'city', feng, '台北市長候選人'],
    [[21, 24, 25, 21], 'hall', feng, '總統候選人', 'raise'],
    [[22, 25, 26, 22], 'crown', feng, '一兆總統', 'cheer'],
    [[25, 28, 29, 25], 'crown', feng, '鋒兄的傳奇人生', 'bow']
  ]],
  s028: ['broadcast', [
    [-1, 'tv', [], ''],
    [0, 'book', tu, '2004.06.15'],
    [[7, 7, 7, 8], 'pastry', tu, '台中小吃店・太陽餅'],
    [[12, 13, 14, 16], 'sunflower', tu, '彰化向日葵農場', 'walk'],
    [[15, 18, 19, 22], 'blackboard', pair, '鋒兄歷史小學堂'],
    [[16, 20, 21, 24], 'robot', tu, 'AI 機器人與水電工'],
    [[22, 27, 30, 32], 'split', pair, '同名誤會'],
    [[34, 40, 44, 45], 'book', pair, '水電工・250 萬冊'],
    [[38, 43, 49, 57], 'mic', tu, '動物園快閃・KTV', 'bounce'],
    [[44, 52, 58, 65], 'tv', tu, '電視劇・水電情'],
    [[55, 64, 70, 76], 'book', tu, '高職國文課本'],
    [[58, 67, 74, 80], 'phone', ['bubu', 'tu'], '傻眼貓咪'],
    [[60, 69, 78, 83], 'camera', tu, '現象級水電工・人物專訪'],
    [[68, 78, 88, 91], 'drink', pair, '青木瓜四木飲'],
    [[73, 83, 94, 96], 'paper', tu, '碩士・博士論文引用'],
    [[81, 94, 107, 107], 'money', feng, '333 億', 'cheer'],
    [[82, 95, 108, 108], 'money', tu, '3 億', 'cheer']
  ]],
  s029: ['wedding', [
    [-1, 'rings', pair, '最瞎結婚理由'],
    [2, 'rings', ['feng', 'ya'], '結婚'],
    [4, 'lottery', ['feng', 'ya'], '今彩 539', 'bounce'],
    [6, 'money', ['feng', 'ya'], '頭獎', 'clap'],
    [8, 'thread', ['feng', 'ya'], '命中注定'],
    [10, 'thread', wedding, '今彩 539 牽紅線', 'heart'],
    [[17, 18, 18, 18], 'tv', ['tu', 'yu'], '換小塗這邊'],
    [[19, 20, 20, 20], 'lottery', ['tu', 'yu'], '今彩 539', 'bounce'],
    [[21, 22, 22, 22], 'thread', ['tu', 'yu'], '魚妹寫的號碼'],
    [[25, 26, 26, 26], 'rings', wedding, '走進禮堂', 'walk'],
    [[27, 28, 28, 28], 'meal', wedding, '十桌百桌・喝喜酒', 'cheer'],
    [[32, 33, 33, 33], 'lottery', wedding, '明天也買一張', 'bow']
  ]],
  s062: ['arcade', [
    [-1, 'mic', pair, '鋒兄進化 Show', 'bounce'],
    [[2, 2, 4, 4], 'camera', pair, '記者拍照', 'raise'],
    [[4, 4, 8, 8], 'exam', feng, '37 歲・榜首'],
    [[7, 7, 14, 14], 'hall', feng, '52 歲・副市長'],
    [[9, 9, 19, 19], 'roster', pair, '備取 → 正取'],
    [[14, 14, 28, 28], 'mic', pair, '全場大合唱', 'clap'],
    [[16, 16, 32, 32], 'city', feng, '2040・市政府'],
    [[19, 19, 39, 38], 'terminal', feng, 'AI・開放資料'],
    [[22, 22, 43, 43], 'receipt', pair, '選票', 'wave'],
    [[25, 25, 48, 46], 'hall', feng, '榜首到市長', 'cheer'],
    [[28, 28, 54, 51], 'mic', pair, '鋒兄進化 Show', 'routine']
  ]],
  s101: ['study', [
    [-1, 'book', feng, '國中畢業紀念冊'],
    [0, 'book', feng, '2021・33'],
    [[3, 3, 4, 4], 'roster', feng, '5・12・18・23'],
    [[11, 8, 10, 10], 'cards', feng, '四取二・六種組合'],
    [[19, 14, 19, 20], 'closed', feng, ''],
    [[20, 15, 20, 21], 'book', feng, '紀念冊在說話', 'point'],
    [[29, 23, 29, 30], 'cards', feng, '5 ＋ 12'],
    [[34, 28, 34, 36], 'exam', feng, '2022・46 分'],
    [[37, 31, 37, 39], 'exam', feng, '2025・50 分'],
    [[44, 37, 44, 46], 'exam', feng, '榜首', 'cheer'],
    [[45, 38, 46, 47], 'roster', feng, '5 職等 → 12 職等'],
    [[57, 51, 61, 66], 'cards', feng, '5 ＋ 23'],
    [[67, 61, 71, 76], 'hall', feng, '12 ＋ 18・市長'],
    [[82, 74, 90, 93], 'cards', feng, '12 ＋ 23'],
    [[84, 76, 92, 95], 'hall', feng, '18 ＋ 23・總統'],
    [[94, 88, 104, 107], 'closed', [], '排列組合的對話']
  ]],
  s102: ['banquet', [
    [-1, 'lantern', party, '招財喵布布'],
    [0, 'lantern', party, '祝福滿滿', 'raise'],
    [1, 'cake', party, '37 歲生日', 'clap'],
    [2, 'receipt', party, '統一發票頭獎', 'clap'],
    [3, 'receipt', party, '20 萬', 'cheer'],
    [4, 'cake', party, '塗哥的生日願望', 'bounce'],
    [5, 'lottery', party, '威力彩頭獎', 'clap'],
    [6, 'meal', party, '六人份・4800'],
    [7, 'money', party, '分紅・2025 萬', 'cheer'],
    [8, 'meal', family, '全家共享', 'bounce'],
    [9, 'money', party, '招財喵布布', 'wave'],
    [10, 'photo', family, '全家福', 'clap'],
    [14, 'cake', party, '塗哥的生日願望', 'bounce'],
    [15, 'lottery', party, '威力彩頭獎', 'clap'],
    [16, 'meal', party, '六人份・4800'],
    [17, 'money', party, '分紅・2025 萬', 'cheer'],
    [18, 'photo', family, '全家福', 'heart']
  ]]
};

const languages = ['zh', 'en', 'ja', 'yue'];
function cues(song, meta) {
  const [world, scenes] = stories[meta.baseId] || stories[meta.id] || ['concert', [[-1, 'mic', pair, '']]];
  const language = Math.max(0, languages.indexOf(meta.lang));
  const timeline = new Map();
  for (const [line, prop, cast, caption, move] of scenes) {
    const index = Array.isArray(line) ? line[language] : line;
    const time = index < 0 ? 0 : song.lines[index]?.t;
    if (!Number.isFinite(time)) throw new Error('Missing pixel scene cue: ' + song.id + ' / ' + index);
    timeline.set(time, { t: time, index, world, prop, cast, caption, move });
  }
  return [...timeline.values()];
}

const colors = {
  paper: '#ffecd0', page: '#fff6e4', black: '#17142b', green: '#57ca98',
  cyan: '#6cdce1', yellow: '#ffd271', purple: '#a896ed', pink: '#ff8795',
  blue: '#4075ae', red: '#bd455e', copper: '#b96949', brown: '#614052'
};
const { paper, page, black, green, cyan, yellow, purple, pink, blue, red, copper, brown } = colors;

function brush(F, x, y, scale) {
  const R = (a, b, w, h, color) => F.fill(x + a * scale, y + b * scale, w * scale, h * scale, color);
  const S = (points, color) => F.polygon(points.map(([a, b]) => [x + a * scale, y + b * scale]), color);
  const T = (label, a, b, size, color = black) => F.text(label, x + a * scale, y + b * scale, size * scale, color, 'center', 900);
  const O = (a, b, w, h, color) => S([[a + 3, b], [a + w - 3, b], [a + w, b + 3],
    [a + w, b + h - 3], [a + w - 3, b + h], [a + 3, b + h], [a, b + h - 3], [a, b + 3]], color);
  return { R, S, T, O };
}

function star({ R }, x, y, color) {
  R(x - 3, y, 7, 1, color);
  R(x, y - 3, 1, 7, color);
  R(x - 1, y - 1, 3, 3, color);
}

function book({ R, S }, x, y, w, h, ink = blue) {
  S([[x - 3, y + 3], [x + w / 2, y + 6], [x + w + 3, y + 3], [x + w + 5, y + h + 1],
    [x + w / 2, y + h + 5], [x - 5, y + h + 1]], ink);
  S([[x, y], [x + w / 2, y + 5], [x + w / 2, y + h], [x - 2, y + h - 4]], page);
  S([[x + w / 2, y + 5], [x + w, y], [x + w + 2, y + h - 4], [x + w / 2, y + h]], paper);
  R(x + w / 2, y + 5, 1, h - 4, copper);
  for (let i = 0; i < 4; i++) {
    R(x + 5, y + 9 + i * 4, w * .32, 1, '#c7a9a0');
    R(x + w * .58, y + 9 + i * 4, w * .32, 1, '#c7a9a0');
  }
}

function ticket({ R, S, T }, x, y, w, h, label, color = red) {
  const edge = x + w;
  S([[x, y + 2], [x + w * .1, y], [x + w * .2, y + 2], [x + w * .3, y],
    [x + w * .4, y + 2], [x + w * .5, y], [x + w * .6, y + 2], [x + w * .7, y],
    [x + w * .8, y + 2], [x + w * .9, y], [edge, y + 2], [edge, y + h - 2],
    [x + w * .9, y + h], [x + w * .8, y + h - 2], [x + w * .7, y + h], [x + w * .6, y + h - 2],
    [x + w * .5, y + h], [x + w * .4, y + h - 2], [x + w * .3, y + h],
    [x + w * .2, y + h - 2], [x + w * .1, y + h], [x, y + h - 2]], page);
  R(x + 3, y + 6, w - 6, 3, color);
  T(label, x + w / 2, y + 13, label.length > 2 ? 6 : 8, color);
  for (let i = 0; i < 11; i++) R(x + w * .16 + i * w * .062, y + h - 8, 1 + i % 2, 3, black);
}

function lantern({ R, O }, x, y, size) {
  R(x + size * .44, 0, 2, y, brown);
  O(x, y, size, size * .88, red);
  O(x + 2, y + 2, size - 4, size * .72, '#f77e5e');
  R(x + size * .31, y + 1, size * .38, size * .78, '#ffa970');
  R(x + size * .25, y - 2, size * .5, 3, yellow);
  R(x + size * .25, y + size * .82, size * .5, 3, yellow);
  R(x + size * .44, y + size * .92, 2, size * .28, yellow);
}

function towers({ R }, x, y, w, h, light, progress = 1) {
  for (let i = 0; i < 9; i++) {
    const bx = x + i * w / 9, bw = w / 9 - 2;
    const bh = h * (.26 + (i * 19 % 8) / 12) * (.45 + .55 * progress);
    R(bx + 2, y - bh - 4, bw - 4, 4, '#34345e');
    R(bx, y - bh, bw, bh, i % 2 ? '#4b416e' : '#2d385e');
    for (let j = 0; j < bh - 6; j += 6) for (let k = 2; k < bw - 1; k += 4)
      if ((i + j / 6 + k) % 4 !== 0) R(bx + k, y - bh + j + 3, 2, 2, light);
  }
}

function flower({ R, O }, x, y, size, ground) {
  R(x, y + 2, 2, ground - y, '#648960');
  R(x + 2, y + size * .8, size * .55, 3, green);
  O(x - size / 2, y - size / 2, size, size, yellow);
  R(x - size * .39, y - 1, size * .8, 3, '#e9975d');
  O(x - size / 4, y - size / 4, size / 2, size / 2, brown);
}

function coin({ O, R }, x, y, size) {
  O(x, y, size, size, '#985435');
  O(x, y - 2, size, size, yellow);
  R(x + size * .4, y + 1, Math.max(1, size * .18), size - 6, '#ed9957');
}

function microphone({ R, O }, x, y) {
  R(x, y + 13, 3, 34, '#b8aec7');
  O(x - 11, y + 45, 25, 5, '#73658e');
  O(x - 7, y, 15, 17, '#a79ac9');
  O(x - 6, y + 1, 13, 8, paper);
  for (let i = 0; i < 3; i++) R(x - 4, y + 3 + i * 2, 9, 1, '#9a86a3');
}

function television({ R, O }, x, y, w, h, image) {
  O(x + 3, y + 4, w, h, black);
  O(x, y, w, h, copper);
  O(x + 4, y + 4, w - 19, h - 8, '#523b4d');
  O(x + 7, y + 7, w - 25, h - 14, '#405e71');
  O(x + w - 12, y + 10, 7, 7, paper);
  O(x + w - 12, y + 21, 7, 7, yellow);
  for (let i = 0; i < 4; i++) R(x + w - 12, y + h - 8 - i * 2, 7, 1, brown);
  image?.(x + 9, y + 9, w - 29, h - 18);
}

const art = {
  blueprint(B) {
    B.S([[6, 56], [13, 17], [87, 17], [94, 56]], '#244d82');
    B.S([[7, 55], [12, 18], [86, 18], [92, 54]], '#3a71a9');
    for (let i = 0; i < 8; i++) B.R(16 + i * 9, 22, 1, 28, '#5b96bf');
    for (let i = 0; i < 5; i++) B.R(13, 22 + i * 7, 72, 1, '#5b96bf');
    B.S([[22, 45], [22, 31], [39, 31], [39, 24], [63, 24], [63, 36], [77, 36],
      [77, 46], [73, 46], [73, 39], [59, 39], [59, 27], [43, 27], [43, 34], [26, 34], [26, 45]], cyan);
    B.S([[47, 45], [80, 9], [85, 13], [51, 48], [44, 50]], yellow);
    B.S([[45, 45], [51, 48], [44, 50]], black);
  },
  network(B, g) {
    art.blueprint(B);
    [cyan, yellow, pink].forEach((color, i) => {
      const x = 16 + i * 33, y = 11 + i % 2 * 4;
      B.R(x, y + 8, 2, 18, color); B.R(x, y + 25, 17, 2, color);
      B.O(x - 5, y, 13, 11, color);
      B.R(x - 2, y + 3, 7, 5, black);
      if (Math.floor(g.beatN + i) % 2 === 0) star(B, x + 4, y - 4, page);
    });
  },
  city(B, g) {
    B.O(5, 8, 90, 50, '#25284c');
    B.O(11, 13, 77, 41, '#37365e');
    B.O(67, 13, 13, 13, yellow);
    towers(B, 10, 54, 82, 44, g.shotP > .4 ? yellow : cyan, Math.min(1, .35 + g.prog));
    B.R(6, 54, 88, 3, purple);
  },
  tools(B) {
    B.O(7, 18, 86, 39, '#55405f');
    B.R(8, 46, 84, 7, '#71516d');
    B.S([[15, 17], [25, 20], [23, 25], [29, 30], [37, 23], [39, 34], [32, 40],
      [69, 49], [67, 56], [29, 44], [20, 42], [13, 34]], '#c6bed6');
    B.S([[53, 39], [77, 11], [82, 15], [61, 42]], '#dacfe0');
    B.S([[56, 33], [64, 40], [48, 59], [40, 53]], red);
    B.R(73, 31, 12, 3, yellow); B.R(78, 30, 3, 10, copper);
  },
  house(B) {
    B.S([[12, 34], [50, 6], [88, 34], [77, 36], [77, 56], [22, 56], [22, 36]], red);
    B.R(25, 34, 50, 23, paper);
    B.R(43, 38, 14, 19, copper);
    B.R(30, 37, 10, 11, cyan); B.R(60, 37, 10, 11, cyan);
    B.R(11, 57, 78, 2, green);
    B.S([[9, 53], [14, 41], [21, 53]], green);
    B.S([[78, 51], [87, 38], [96, 51]], green);
  },
  map(B, g) {
    B.O(12, 8, 76, 52, blue);
    B.S([[53, 10], [66, 13], [67, 20], [59, 31], [54, 40], [49, 45], [44, 57],
      [38, 50], [37, 39], [39, 31], [43, 23]], green);
    for (let i = 0; i < 5; i++) if (g.shotP * 8 + 1 > i) star(B, 59 - i * 5, 17 + i * 7, yellow);
  },
  mic(B) {
    microphone(B, 49, 10);
    star(B, 29, 19, cyan); star(B, 73, 27, yellow);
  },
  guitar(B, g) {
    if (g.shotP < .23) { art.tools(B); return; }
    B.S([[19, 46], [22, 36], [31, 34], [36, 37], [45, 30], [51, 34], [51, 43],
      [46, 53], [36, 59], [24, 57]], copper);
    B.O(27, 39, 19, 14, red);
    B.S([[35, 44], [70, 14], [75, 18], [40, 49]], paper);
    B.S([[69, 16], [78, 6], [84, 10], [78, 22]], '#f2aa69');
    B.S([[33, 43], [80, 10], [81, 11], [34, 45]], black);
    B.R(26, 49, 12, 3, yellow);
  },
  camera(B, g) {
    B.O(15, 21, 70, 34, '#605470'); B.O(19, 24, 62, 23, '#8b7fa2');
    B.R(24, 15, 15, 10, paper);
    B.O(34, 21, 34, 33, black); B.O(38, 25, 26, 26, blue);
    B.O(43, 30, 16, 16, cyan); B.R(44, 31, 6, 4, page);
    B.R(69, 27, 8, 4, yellow);
    if (g.beatN % 2 < .4) star(B, 24, 12, yellow);
  },
  exam(B, g) {
    B.O(27, 5, 46, 54, blue); B.R(31, 8, 38, 47, paper);
    B.R(34, 13, 32, 3, copper);
    for (let i = 0; i < 5; i++) B.R(35, 22 + i * 5, 20 + (i % 2) * 6, 1, '#bfa39c');
    B.O(52, 32, 28, 19, red);
    B.T(g.shot.caption.match(/46|50/)?.[0] || '1', 66, 36, 12, page);
  },
  terminal(B) {
    television(B, 13, 9, 74, 45, (x, y) => {
      for (let i = 0; i < 5; i++) {
        B.R(x + 2, y + 2 + i * 4, 4, 1, yellow);
        B.R(x + 9, y + 2 + i * 4, 16 + i % 3 * 5, 1, cyan);
      }
    });
    B.R(42, 54, 16, 5, purple); B.R(32, 59, 37, 3, '#695c87');
  },
  hall(B) {
    B.S([[12, 23], [50, 5], [88, 23]], yellow);
    B.S([[21, 23], [50, 12], [79, 23]], copper);
    B.R(16, 23, 68, 29, paper);
    for (let i = 0; i < 5; i++) {
      B.R(20 + i * 13, 27, 7, 23, '#b68e92');
      B.R(21 + i * 13, 28, 3, 21, page);
    }
    B.R(12, 52, 76, 4, copper); B.R(8, 56, 84, 3, yellow);
  },
  roster(B, g) {
    B.O(20, 5, 60, 54, '#bd956d');
    B.R(24, 9, 52, 46, page); B.R(38, 5, 24, 6, '#8b6d93');
    const exam = g.shot.caption.includes('23');
    for (let i = 0; i < 4; i++) {
      B.O(28, 15 + i * 9, 7, 7, exam || i === 1 ? green : '#d0b7ba');
      if (exam) B.T(['5', '12', '18', '23'][i], 44, 15 + i * 9, 8);
      else B.R(40, 17 + i * 9, 29 - i * 4, 2, '#ab8598');
    }
  },
  pipes(B) {
    B.R(20, 10, 9, 40, '#82a2bc'); B.R(21, 10, 2, 39, page);
    B.R(21, 43, 44, 9, '#82a2bc'); B.R(24, 44, 38, 2, page);
    B.R(62, 24, 9, 28, '#82a2bc'); B.R(63, 24, 2, 23, page);
    B.O(53, 9, 26, 19, green); B.T('AI', 66, 13, 10);
    B.O(34, 22, 16, 16, red); B.R(41, 26, 3, 16, copper);
    B.R(36, 29, 12, 2, yellow);
  },
  cushion(B, g) {
    B.S([[12, 42], [21, 29], [79, 29], [88, 42], [86, 54], [15, 54]], red);
    B.O(20, 29, 60, 17, '#d9688c');
    B.R(19, 48, 62, 3, yellow);
    for (let i = 0; i < 7; i++) B.R(23 + i * 8, 51, 2, 5, yellow);
    if (g.shot.cast.length) for (let i = 0; i < 3; i++) star(B, 31 + i * 19, 22 - i * 3, paper);
  },
  fur(B, g) {
    B.O(19, 11, 62, 42, '#8e5c92'); B.O(23, 13, 54, 38, '#bd89af');
    for (let i = 0; i < 7; i++) {
      const y = 23 + (i * 23 % 26) - (g.beatN + i) % 2 * 2;
      B.S([[26 + i * 7, y], [29 + i * 7, y - 6], [33 + i * 7, y - 9], [31 + i * 7, y - 5]], page);
    }
    star(B, 19, 17, yellow); star(B, 80, 27, yellow);
  },
  auction(B) {
    B.S([[41, 31], [48, 25], [76, 50], [70, 56]], copper);
    B.S([[18, 24], [34, 9], [56, 31], [41, 45]], '#ad695f');
    B.S([[17, 24], [25, 17], [47, 39], [40, 47]], yellow);
    B.S([[33, 9], [41, 5], [63, 26], [56, 34]], yellow);
    B.O(14, 50, 38, 9, brown); B.R(17, 49, 31, 2, yellow);
  },
  stamp(B) {
    ticket(B, 21, 23, 58, 34, '本喵', red);
    B.O(41, 5, 18, 17, copper); B.R(46, 16, 8, 10, brown);
    B.O(36, 23, 28, 12, red); B.R(39, 32, 22, 2, '#ffb084');
  },
  treasure(B) {
    B.O(20, 15, 60, 41, copper); B.R(20, 31, 60, 5, yellow);
    B.R(24, 37, 6, 16, '#95534d'); B.R(70, 37, 6, 16, '#95534d');
    B.O(42, 30, 16, 16, yellow); B.R(48, 35, 4, 6, brown);
    star(B, 75, 13, paper); star(B, 18, 19, paper);
  },
  shrine(B) {
    B.S([[8, 22], [19, 19], [31, 8], [69, 8], [81, 19], [92, 22], [84, 27], [16, 27]], red);
    B.R(20, 26, 60, 3, yellow); B.R(24, 29, 7, 24, copper); B.R(69, 29, 7, 24, copper);
    B.O(35, 45, 30, 8, pink);
    B.R(18, 53, 64, 5, brown);
  },
  phone(B) {
    B.O(31, 4, 38, 58, '#6c547a'); B.O(34, 7, 32, 51, black);
    B.R(36, 12, 28, 40, '#d29ca3');
    B.S([[39, 22], [40, 16], [47, 23], [54, 23], [61, 17], [62, 28],
      [60, 43], [42, 43], [39, 34]], paper);
    B.R(42, 25, 6, 4, copper); B.R(51, 24, 5, 4, black);
    B.R(43, 32, 4, 2, black); B.R(54, 32, 4, 2, black); B.R(49, 36, 3, 2, pink);
    B.R(46, 55, 8, 1, paper);
  },
  crown(B) {
    B.S([[15, 20], [32, 32], [49, 10], [67, 32], [85, 20], [75, 54], [25, 54]], '#d68648');
    B.S([[20, 24], [32, 36], [49, 15], [67, 36], [80, 24], [72, 49], [28, 49]], yellow);
    B.O(44, 34, 11, 11, red); B.O(31, 39, 6, 6, purple); B.O(63, 39, 6, 6, purple);
    B.R(25, 51, 50, 4, paper);
  },
  receipt(B, g) {
    const cap = g.shot.caption || '';
    const label = cap.includes('特別獎') ? '特別獎' : cap.includes('選票') ? '選票' : '頭獎';
    ticket(B, 24, 10, 52, 46, label);
    star(B, 79, 16, yellow);
  },
  lottery(B, g) {
    const cap = g.shot.caption || '';
    // 威力彩第一區只到 38；大樂透可以到 49。539 才用 39。
    const nums = cap.includes('大樂透') ? ['05', '12', '18', '23', '49']
      : cap.includes('539') || cap.includes('明天也買') ? ['02', '09', '17', '26', '35']
      : ['05', '12', '18', '23', '31'];
    B.O(8, 22, 84, 32, '#55446c');
    for (let i = 0; i < nums.length; i++) {
      const x = 13 + i * 15, y = 27 + Math.round(Math.sin(g.t * 5 + i) * (1 - Math.min(1, g.shotP * 5)) * 6);
      B.O(x, y, 13, 18, [pink, yellow, green, purple, cyan][i]);
      B.T(nums[i], x + 6.5, y + 5, 7);
    }
    B.R(12, 50, 76, 2, yellow);
  },
  tv(B) {
    television(B, 13, 10, 74, 46, (x, y, w, h) => {
      B.S([[x + 4, y + h - 3], [x + w * .45, y + 4], [x + w * .66, y + 4], [x + 14, y + h - 3]], '#7f98a5');
      B.R(x + w * .6, y + h / 2, w * .26, 2, cyan);
    });
  },
  book(B, g) {
    book(B, 11, 17, 77, 37, blue);
    B.S([[47, 44], [79, 10], [83, 14], [51, 47], [43, 49]], g.shot.world === 'study' ? yellow : copper);
  },
  closed(B) {
    B.S([[25, 24], [72, 15], [82, 39], [36, 53], [24, 47]], '#935879');
    B.S([[28, 28], [71, 20], [77, 40], [36, 51]], purple);
    B.S([[36, 51], [77, 40], [77, 44], [36, 55]], paper);
    B.R(40, 31, 23, 2, yellow);
  },
  pastry(B) {
    B.O(9, 36, 82, 19, '#9f7781');
    [23, 43, 63].forEach((x, i) => {
      B.O(x, 19 + i % 2 * 4, 18, 24, copper);
      B.O(x, 19 + i % 2 * 4, 18, 16, yellow);
      B.R(x + 4, 25 + i % 2 * 4, 9, 2, '#eb9b69');
    });
  },
  sunflower(B) {
    B.R(8, 42, 84, 16, '#315742');
    [19, 34, 50, 66, 82].forEach((x, i) => flower(B, x, 20 + i * 7 % 13, 16 - i % 3 * 2, 52));
  },
  blackboard(B) {
    B.O(9, 12, 82, 44, '#b47f59');
    B.R(13, 15, 74, 35, '#355952');
    B.T('2004', 48, 20, 12, page);
    B.R(23, 37, 46, 1, cyan); B.R(28, 42, 32, 1, cyan);
    B.R(64, 50, 10, 2, paper);
  },
  robot(B) {
    B.O(31, 10, 38, 26, '#a8bbc9'); B.R(48, 5, 3, 5, '#a8bbc9'); B.O(46, 2, 7, 7, red);
    B.O(37, 17, 26, 12, '#303855'); B.R(41, 20, 5, 4, cyan); B.R(54, 20, 5, 4, cyan);
    B.O(36, 37, 28, 19, '#899dbd'); B.R(45, 42, 10, 5, green);
    B.R(29, 39, 6, 14, '#6f7a9d'); B.R(65, 39, 6, 14, '#6f7a9d');
  },
  split(B) {
    B.O(10, 15, 35, 35, blue); B.O(55, 15, 35, 35, red);
    B.T('鋒', 27, 23, 17, page); B.T('鋒', 73, 23, 17, page);
    B.T('?', 50, 40, 19, yellow);
  },
  drink(B) {
    [22, 53].forEach((x, i) => {
      B.S([[x + 11, 26], [x + 13, 8 - i * 3], [x + 24, 7 - i * 3], [x + 24, 10 - i * 3],
        [x + 16, 11 - i * 3], [x + 14, 26]], pink);
      B.S([[x, 23], [x + 26, 23], [x + 22, 56], [x + 5, 56]], '#c6e7a0');
      B.S([[x + 2, 30], [x + 24, 30], [x + 20, 54], [x + 6, 54]], '#86ba67');
      B.R(x - 1, 22, 28, 4, paper); B.O(x + 8, 36, 10, 10, yellow);
    });
  },
  paper(B) {
    B.O(22, 10, 40, 42, '#b8a0c1'); B.O(31, 14, 41, 44, paper); B.O(39, 18, 41, 44, page);
    B.R(44, 23, 30, 3, purple);
    for (let i = 0; i < 5; i++) B.R(45, 32 + i * 4, i % 2 ? 20 : 27, 1, '#b09eb4');
    B.R(64, 52, 10, 3, red);
  },
  money(B, g) {
    for (let i = 0; i < 5; i++) B.O(17 + i * 6, 40 - i * 4, 55, 19, i % 2 ? '#83bb8d' : '#51967c');
    B.R(45, 24, 10, 19, paper);
    for (let i = 0; i < 5; i++) coin(B, 20 + i * 13, 9 + (i * 5 + g.t * 7) % 13, 8);
  },
  rings(B) {
    B.O(23, 22, 32, 32, yellow); B.O(45, 22, 32, 32, '#eaa25d');
    B.O(28, 27, 22, 22, brown); B.O(50, 27, 22, 22, brown);
    B.R(45, 43, 8, 4, yellow);
    B.S([[29, 18], [38, 11], [48, 18], [39, 25]], cyan);
    star(B, 63, 16, paper); star(B, 78, 29, pink);
  },
  thread(B) {
    ticket(B, 9, 14, 30, 36, '539'); ticket(B, 61, 14, 30, 36, '539');
    B.R(31, 43, 38, 2, red);
    B.S([[50, 43], [38, 32], [38, 23], [44, 19], [50, 24], [56, 19], [62, 23], [62, 32]], pink);
  },
  meal(B) {
    B.O(10, 24, 80, 35, '#ab5d66');
    for (let i = 0; i < 6; i++) {
      const x = 19 + i % 3 * 24, y = 28 + Math.floor(i / 3) * 13;
      B.O(x, y, 14, 10, page); B.O(x + 3, y + 2, 8, 6, ['#e78b5d', green, yellow][i % 3]);
    }
    B.R(13, 56, 73, 2, yellow);
  },
  cards(B, g) {
    const items = ['5·12', '5·18', '5·23', '12·18', '12·23', '18·23'];
    items.forEach((label, i) => {
      const x = 9 + i % 3 * 28, y = 10 + Math.floor(i / 3) * 24;
      const active = !g.shot.caption.includes('＋') || label === g.shot.caption.replace(/ ＋ /, '·');
      B.O(x, y, 25, 19, active ? paper : '#b8a8bd');
      B.R(x + 3, y + 3, 19, 2, active ? red : '#9483a6');
      B.T(label, x + 12.5, y + 8, 6.5);
    });
  },
  lantern(B) {
    lantern(B, 16, 16, 22); lantern(B, 39, 10, 24); lantern(B, 65, 16, 19);
    star(B, 48, 49, yellow);
  },
  cake(B, g) {
    B.O(12, 51, 76, 9, '#a07e9a'); B.O(21, 28, 58, 26, '#ce705e');
    B.O(21, 27, 58, 10, page);
    for (let i = 0; i < 6; i++) B.R(24 + i * 9, 33, 4, 5 + i % 2 * 3, page);
    B.R(40, 18, 4, 10, red); B.R(55, 18, 4, 10, red);
    B.O(39, 10 + g.beatN % 2, 6, 7, yellow); B.O(54, 10, 6, 7, yellow);
    if (g.shot.caption.includes('37')) B.T('37', 50, 40, 10, page);
  },
  photo(B) {
    B.O(19, 9, 62, 49, paper);
    B.R(24, 13, 52, 34, '#729788');
    for (let i = 0; i < 6; i++) {
      const x = 26 + i * 8, y = 24 + i % 2 * 4;
      B.O(x, y, 7, 9, [copper, paper, yellow, purple, page, cyan][i]);
      B.R(x, y + 8, 7, 43 - y - 8, [red, brown, copper, blue, paper, purple][i]);
    }
    B.R(38, 51, 24, 2, '#ac8993');
  }
};

const decor = {
  workshop(B, g, w, h) {
    B.R(4, 14, w - 8, h * .53, '#292b4d');
    B.R(9, 19, w - 18, h * .47, '#383d67');
    towers(B, 12, 18 + h * .47, w - 24, h * .54, '#c7996f', g.prog);
    for (const x of [w * .34, w * .66]) B.R(x, 15, 3, h * .53, '#575274');
    B.R(4, 14 + h * .53, w - 8, 3, '#64617c');
    B.R(0, h * .72, w, 2, '#66516b');
  },
  concert(B, g, w, h) {
    B.R(0, 10, w, 6, '#3c4b6a');
    B.R(0, 13, w, 2, '#6a657c');
    for (let i = 0; i < 4; i++) {
      const x = w * (.13 + i * .245);
      const aim = x + Math.sin(g.t * .8 + i) * w * .11;
      B.S([[x - 4, 17], [x + 4, 17], [aim + w * .12, h], [aim - w * .12, h]],
        ['#263351', '#3c304e', '#273c56', '#2c3959'][i]);
      B.O(x - 8, 13, 16, 8, '#877699');
      B.R(x - 4, 18, 8, 2, i % 2 ? pink : cyan);
    }
    for (let i = 0; i < 20; i++) {
      const x = (i + .5) * w / 20;
      B.O(x - 4, h * .95 - i % 3 * 3, 9, 14, '#1a182b');
    }
  },
  temple(B, g, w, h) {
    B.S([[w * .27, 12], [w * .73, 12], [w * .9, h], [w * .1, h]], '#502c55');
    for (const x of [w * .07, w * .9]) {
      B.R(x, 19, 9, h * .78, '#8b4b6b');
      B.R(x + 2, 21, 2, h * .71, '#bf716f');
      B.R(x - 3, 16, 15, 4, '#ca846c');
      B.R(x - 3, h * .78, 15, 6, '#ca846c');
    }
    for (let i = 0; i < 4; i++) B.R(w * .2 - i * 5, h * .79 + i * 6, w * .6 + i * 10, 3, '#703e62');
  },
  arcade(B, g, w, h) {
    B.O(8, 12, w - 16, h * .8, '#30274b');
    B.O(10, 14, w - 20, h * .78, '#241e3e');
    for (let x = 18; x < w - 12; x += 15) for (let y = 24; y < h * .74; y += 13)
      B.R(x, y, 2, 2, '#5f4673');
    B.R(12, 19, w - 24, 2, '#815193');
    B.R(12, h * .78, w - 24, 2, '#8c5d9b');
    if (g.shot.prop === 'city') towers(B, 12, h * .79, w - 24, h * .61, '#61a7b7');
  },
  broadcast(B, g, w, h) {
    for (let y = 17; y < h; y += 12) B.R(0, y, w, 1, '#57404b');
    B.O(5, 13, w - 10, h * .82, '#774d50');
    B.O(9, 17, w - 18, h * .76, '#383043');
    B.R(16, 19, w * .28, 2, '#bb7a6e');
    for (let i = 0; i < 6; i++) B.R(w - 19, h * .48 + i * 4, 5, 1, '#8f6263');
    if (g.shot.prop === 'sunflower') {
      B.R(12, h * .66, w - 24, h * .22, '#344943');
      for (let i = 0; i < 9; i++) flower(B, 18 + i * (w - 36) / 8, h * .7 - i % 3 * 5, 7, h * .86);
    }
  },
  wedding(B, g, w, h) {
    B.O(w * .12, 15, w * .76, h * .82, '#874263');
    B.O(w * .15, 20, w * .7, h * .77, '#482840');
    B.S([[w * .37, h * .56], [w * .63, h * .56], [w * .83, h], [w * .17, h]], '#6d3554');
    for (let i = 0; i < 5; i++) {
      B.R(w * .13 + i * 4, 19 + i * 4, 5, h * .46 - i * 6, i % 2 ? '#b25a71' : '#984b69');
      B.R(w * .87 - i * 4, 19 + i * 4, 5, h * .46 - i * 6, i % 2 ? '#b25a71' : '#984b69');
    }
    star(B, w * .2, h * .62, yellow); star(B, w * .81, h * .65, pink);
  },
  study(B, g, w, h) {
    const shelf = w * .29;
    B.O(6, 16, shelf, h * .58, '#4e3b55');
    for (let row = 0; row < 3; row++) {
      const y = 20 + row * h * .16;
      for (let i = 0; i < 7; i++) {
        const bh = 9 + (i * 3 + row * 7) % 10;
        B.R(11 + i * (shelf - 10) / 7, y + 19 - bh, (shelf - 16) / 7, bh,
          ['#5a7491', '#7b556c', '#927162', '#6a6388'][(i + row) % 4]);
      }
      B.R(8, y + 19, shelf - 4, 3, '#7e5b65');
    }
    B.S([[w * .77, 21], [w * .82, 21], [w * .96, h], [w * .5, h]], '#514459');
    B.R(w * .8, 4, 2, 17, '#ac805d');
    B.S([[w * .77, 16], [w * .83, 16], [w * .86, 22], [w * .74, 22]], '#c99466');
  },
  banquet(B, g, w, h) {
    B.O(5, 14, w - 10, h * .83, '#29413f');
    B.R(10, 19, w - 20, h * .73, '#304c43');
    for (let i = 0; i < 6; i++) {
      const x = w * (.08 + i * .17);
      B.R(x, 21, 1, h * .65, '#416051');
      lantern(B, x, 17 + i % 2 * 5, Math.min(15, w * .08));
    }
    B.R(0, h * .79, w, 3, '#77634d');
    if (g.shot.prop === 'money') for (let i = 0; i < 9; i++)
      coin(B, (i * 19 % 91) * w / 100, (i * 41 + g.t * 23) % h, 7);
  }
};

const wall = {
  workshop: '#20243d', concert: '#202236', temple: '#361f3c', arcade: '#211b37',
  broadcast: '#352a37', wedding: '#43253b', study: '#25283a', banquet: '#1f3434'
};

function castRow(g, F, cast, left, width, floor, height, move, labels, crop) {
  if (!cast.length) return;
  const gap = width / cast.length;
  const h = Math.min(height / (crop ? .78 : 1), gap * (move === 'lie' ? .85 : 1.7));
  const labelSize = Math.max(7, Math.min(12, gap * .2));
  for (const [i, id] of cast.entries()) {
    const who = window.MV_STORY.__who(id);
    const x = left + gap * (i + .5);
    const outfit = id === 'feng' && g.shot.world === 'arcade' && g.shot.prop === 'hall'
      ? { cloth: '#6b648c', cloth2: '#3d375c', pants: '#3e415b', collar: '#e1d7ee' } : {};
    F.figure({ ...who, ...outfit, x, y: floor, h, crop: crop ? h * .22 : 0, t: g.t, ph: i * .7, di: i,
      sing: g.F.level, dance: move, pose: move === 'lie' ? 'lie' : undefined,
      awake: g.shot.prop === 'auction' || (g.shot.prop === 'fur' && g.beatN % 4 < 2),
      shadowBack: '#1b1928' });
    const size = F.fitText(who.name, labelSize, gap - 3, 800);
    labels.push([who.name, x, floor + 4, size, gap - 1]);
  }
}

function draw(g, F, box, sheet) {
  const { BW: w, BH: h, shot, port } = g;
  const H = box.h, W = box.w;
  const height = box.y + H;
  F.fill(0, 0, w, h, wall[shot.world]);
  decor[shot.world](brush(F, 0, 0, 1), g, w, height);
  F.fill(0, height - 11, w, h - height + 11, '#211e30');
  F.fill(0, height - 11, w, 1, '#71617c');

  const cast = sheet ? sheet.map(who => who.id) : shot.cast;
  const stacked = port;
  const twoRows = port && cast.length >= 4;
  const split = Math.ceil(cast.length / 2);
  const rows = !twoRows ? [cast] : !sheet && shot.world === 'banquet'
    ? [cast.filter(id => id !== 'feng' && id !== 'tu'), pair]
    : [cast.slice(0, split), cast.slice(split)];
  const artShare = cast.length > 4 ? .28 : .35;
  const artWidth = W * (stacked || !cast.length ? .88 : artShare);
  const artHeight = H * (!cast.length ? .88 : twoRows ? .31 : stacked ? .45 : .87);
  const caption = shot.caption;
  const artSize = Math.min(artWidth / 100, artHeight / (caption ? 82 : 65));
  const artX = box.x + W * (stacked || !cast.length ? .5 : artShare / 2) - artSize * 50;
  const artY = box.y + (stacked && cast.length ? H * .035 : (H - artHeight) * .46);
  if (!sheet) {
    const B = brush(F, artX, artY, artSize);
    B.O(2, 4, 96, 59, '#211e30');
    B.O(3, 3, 94, 58, '#41374e');
    B.R(8, 59, 84, 1, '#786382');
    art[shot.prop](B, g);
    if (caption) {
      const size = F.fitText(caption, Math.max(9, Math.min(22, H * .105)), Math.max(24, artWidth - 5), 900);
      const cy = artY + artSize * 65;
      const labelWidth = Math.min(artWidth, F.measure(caption, size, 900) + 13);
      F.fill(artX + 50 * artSize - labelWidth / 2, cy - 2, labelWidth, size + 5, '#211e30');
      F.text(caption, artX + 50 * artSize, cy, size, yellow, 'center', 900);
    }
  }

  const floor = height - 20;
  const castTop = sheet ? box.y + H * .1 : artY + artSize * 65 + (caption ? H * .13 : 0);
  const rowGap = 20;
  const rowHeight = twoRows ? (floor - castTop - rowGap) / 2.34 : H * (stacked ? .47 : .76);
  const left = box.x + (stacked || sheet ? 0 : W * (artShare + .02));
  const rowWidth = box.x + W - left;
  const labels = [];
  const move = sheet ? 'routine' : shot.move;
  const crop = g.detail && twoRows && move !== 'lie';
  for (const [index, row] of rows.entries()) {
    const rowFloor = floor - (rows.length - 1 - index) * (rowHeight * 1.17 + rowGap);
    castRow(g, F, row, left, rowWidth, rowFloor, rowHeight, move, labels, crop);
  }
  for (const args of labels) F.castLabel(...args);
}

return { cues, draw };
})();
