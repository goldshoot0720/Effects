'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name));
const sha = data => createHash('sha256').update(data).digest('hex');
const context = vm.createContext({window:{}});
const run = name => vm.runInContext(read(name).toString(), context, {filename:name});
run('data/songs.js');
run('js/story.js');
run('js/pixel-scenes.js');
const {MV_SONGS: songs, MV_STORY: story, MV_PIXEL_SCENES: pixelScenes} = context.window;
const sources = JSON.parse(read('data/song_sources.json'));
const imported = JSON.parse(read('data/import-neweffects.json'));
const translations = JSON.parse(read('data/lyric_translations.json'));
assert.equal(songs.length, 36);
assert.equal(new Set(songs.map(s => s.id)).size, 36);
assert.equal(new Set(songs.map(s => s.baseId)).size, 9);
assert.deepEqual(Array.from(songs, s => s.id), sources.map(s => s.id));
const seenFiles = new Set();
for (let pv = 1; pv <= 9; pv++) {
  assert.deepEqual(Array.from(songs.filter(s => s.pv === pv), s => s.lang), ['zh','en','ja','yue']);
}
for (const meta of songs) {
  run(meta.src);
  const data = context.window.MV_SONG_DATA[meta.id];
  const provenance = imported.songs.find(s => s.id === meta.id);
  assert.equal(sha(read(meta.audio)), provenance.sources[0].sha256, meta.id + ' audio changed');
  assert.equal(sha(read(`data/lyrics/${meta.id}.srt`)), provenance.subtitleSha256);
  assert.equal(data.analysis.duration, meta.dur);
  assert.equal(data.lines.length, meta.lines);
  assert.equal(data.tagline, meta.tagline);
  assert.equal(data.tagline, sources.find(source => source.id === meta.id).tagline);
  assert(data.lines.length > 0);
  assert.equal(Buffer.from(data.analysis.bands, 'base64').length, data.analysis.frames * data.analysis.bandCount);
  for (const [i, line] of data.lines.entries()) {
    assert(line.text && line.t >= 0 && line.d > 0 && line.t + line.d <= meta.dur + .1, meta.id + ' cue bounds');
    if (i) assert(line.t >= data.lines[i-1].t + data.lines[i-1].d - .002, meta.id + ' overlapping cues');
    if (meta.lang === 'en' || meta.lang === 'ja') {
      assert(/\p{Script=Han}/u.test(line.translation || ''), meta.id + ' missing Chinese at cue ' + i);
      const entry = translations[meta.id]?.[i];
      if (entry !== undefined) {
        const expected = typeof entry === 'number'
          ? context.window.MV_SONG_DATA[meta.baseId].lines[entry].text : entry;
        assert.equal(line.translation, expected, meta.id + ' translation differs at cue ' + i);
      }
    } else assert(!line.translation, meta.id + ' should have one subtitle language');
  }
  story.__setLanguage(data);
  const pixel = pixelScenes.cues(data, meta);
  assert.equal(pixel[0].t, 0, meta.id + ' has no opening scene');
  for (const [index, scene] of pixel.entries()) {
    assert(scene.t >= 0 && scene.t < meta.dur, meta.id + ' pixel scene out of range');
    if (index) assert(scene.t > pixel[index - 1].t, meta.id + ' out-of-order pixel scene');
    if (scene.index >= 0) assert.equal(scene.t, data.lines[scene.index].t);
    for (const who of scene.cast) assert(story.__who(who), meta.id + ' unknown pixel cast member');
  }
  const adapted = story.__forSong(data);
  assert.equal(adapted.front, story[meta.baseId].front, meta.id + ' lost its story');
  assert(adapted.shots.every(s => s.t >= 0 && s.t < meta.dur));
  assert.equal(story.__lead(meta.id).length, story.__lead(meta.baseId).length);
  assert.equal(story.__who('feng').name, {zh:'鋒兄',en:'Feng',ja:'フェン',yue:'鋒兄'}[meta.lang]);
  assert.equal(story.__isJackpot(meta.id), meta.baseId === 's102');
  assert.equal(story.__who('ya').id, meta.baseId === 's102' ? 'claude' : 'ya');
  const file = `PV${String(meta.pv).padStart(2,'0')}${meta.lang === 'zh' ? '' : '_' + meta.lang.toUpperCase()}`;
  assert(!seenFiles.has(file)); seenFiles.add(file);
}
const japaneseJackpot = context.window.MV_SONG_DATA.s104;
const lyricAt = time => story.__lyricCue(japaneseJackpot.lines, time, japaneseJackpot.analysis.duration, 'ja');
assert.equal(lyricAt(57 - 3.4).gap, '間奏');
assert.equal(lyricAt(59 - 3.4).gap, '間奏');
assert.equal(lyricAt(111 - 3.4).gap, '演奏の余韻');
assert.equal(lyricAt(66.28).line.text, 'りょうけのおやもあつまる');
assert.equal(lyricAt(66.28).line.translation, '兩家的父母也齊聚一堂');
assert.equal(lyricAt(66.28).gap, '');
// A translated take must not change the original story's shot times.
const before = JSON.stringify(story.s028.shots);
story.__forSong(context.window.MV_SONG_DATA['s028-ja']).shots[1].t = 999;
assert.equal(JSON.stringify(story.s028.shots), before);
for (const id of ['s023','s024','s026','s027','s028','s029','s062','s101','s102','s103','s104','s105']) {
  assert(songs.some(s => s.id === id), 'Legacy link missing: ' + id);
}
console.log('36 editions passed: 9 four-language groups, source hashes, timed lyrics, spectra, stories, names and unique output names.');
