'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({window:{}});
const run = file => vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
run('data/songs.js');run('js/story.js');
const story = context.window.MV_STORY;
assert.equal(story.__text('「你好！」（三十七歲），全家·幸福。'), '你好三十七歲全家幸福');
assert.equal(story.__text("Tu’s thirty-seven-year-old family: 20,250,000!"), 'Tus thirty seven year old family 20250000');
assert.equal(story.__text('クロード娘・ユー「しあわせ！」'), 'クロード娘ユーしあわせ');
assert.equal(story.__text('招財喵布布，送嚟祝福！'), '招財喵布布送嚟祝福');
assert.equal(story.__text(' '), ' ');
assert.equal(story.__text('♥ ▶ 🔥'), '♥ ▶ 🔥');
let count=0;
for(const meta of context.window.MV_SONGS){
  run(meta.src);const original=context.window.MV_SONG_DATA[meta.id];
  const saved=JSON.stringify(original);
  story.__setLanguage(original);
  const shown=story.__displaySong(original);
  for(const field of ['title','cast','tagline'])assert(!/\p{P}/u.test(shown[field]));
  for(const [i,line] of shown.lines.entries()){
    assert(!/\p{P}/u.test(line.text),meta.id+' punctuation left in subtitle');
    if(line.translation)assert(!/\p{P}/u.test(line.translation));
    assert.equal(line.t,original.lines[i].t);assert.equal(line.d,original.lines[i].d);
    count++;
  }
  assert.equal(shown.id,original.id);assert.equal(shown.audio,original.audio);
  assert.equal(shown.analysis,original.analysis);
  assert.equal(JSON.stringify(original),saved,'Original lyrics changed');
}
const calls=[];
const canvas={fillText:(...a)=>calls.push(a),strokeText:(...a)=>calls.push(a),measureText:text=>({width:text.length})};
story.__cleanCanvas(canvas);
canvas.fillText('SEC.01：副歌！',10,20);canvas.strokeText('Feng · Tu',30,40,200);
assert.deepEqual(calls,[['SEC01副歌',10,20],['Feng Tu',30,40,200]]);
assert.equal(canvas.measureText('SEC.01：副歌！').width,'SEC01副歌'.length);
console.log(`No-punctuation display passed for all 36 editions / ${count} cues; original data, timing, Japanese vowels and effects inputs preserved.`);
