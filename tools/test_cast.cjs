'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(root, 'js/story.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'data/cast.js'), 'utf8'), context);
const story = context.window.MV_STORY;
const ids = list => Array.from(list, who => who.id);
const lead = ['claude', 'bubu', 'feng', 'tu', 'baibai', 'gpt'];
for (const [id, names] of [
  ['s102', ['Claude 娘', 'GPT 娘']], ['s103', ['Claude Girl', 'GPT Girl']],
  ['s104', ['クロード娘', 'GPT娘']], ['s105', ['Claude 娘', 'GPT 娘']],
]) {
  story.__setLanguage({ id });
  assert.deepEqual(ids(story.__lead(id)), lead);
  const cast = story.__cast();
  assert.deepEqual(ids(cast).slice(3, 5), ['feng', 'tu']);
  assert(!ids(cast).includes('ya') && !ids(cast).includes('yu'));
  assert.deepEqual(Array.from(cast.filter(c => ['claude', 'gpt'].includes(c.id)), c => c.name), names);
  assert.equal(story.__who('ya').id, 'claude');
  assert.equal(story.__who('yu').id, 'gpt');
  assert.equal(story.__credits('牙妹 · 魚妹'), names.join(' · '));
  const figures = [];
  const noop = () => {};
  story[id].front({ P: {}, shot: { id: 'family' }, BW: 400, BH: 225,
    fy: 180, cx: 200, t: 0, F: { level: 0 }, prog: 0, shotP: 0 },
    { figure: f => figures.push(f), fill: noop, text: noop, fallers: noop });
  const feng = figures.find(c => c.id === 'feng'), tu = figures.find(c => c.id === 'tu');
  assert(feng.x < 200 && tu.x > 200);
  assert.equal((feng.x + tu.x) / 2, 200);
  assert(figures.find(c => c.id === 'claude').x < feng.x);
  assert(figures.find(c => c.id === 'gpt').x > tu.x);
}
story.__setLanguage({ id: 's029' });
assert.deepEqual(ids(story.__lead('s029')), ['ya', 'feng', 'tu', 'yu']);
assert.equal(story.__who('ya').name, '牙妹');
assert.equal(story.__who('yu').name, '魚妹');
assert(!ids(story.__cast()).includes('claude'));
assert(!ids(story.__cast()).includes('gpt'));
for (const id of lead) assert(context.window.MV_CAST_ART[id]?.body.startsWith('data:image/webp;base64,'));
assert.equal(context.window.MV_CAST_ART.gpt.rigid, true);
console.log('Cast, language, isolated replacement and Feng/Tu centre positioning checks passed.');
