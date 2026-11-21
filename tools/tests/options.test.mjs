import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('options.html', 'utf8');
const css = readFileSync('options.css', 'utf8');
const js = readFileSync('options.js', 'utf8');
const popup = readFileSync('popup.html', 'utf8');
const base = readFileSync('base.css', 'utf8');

test('options.css má @charset na prvom riadku', () => {
  assert.equal(css.split('\n')[0], '@charset "UTF-8";');
  assert.ok(!/^\s*section h2\s*\{\s*text-align:\s*center/is.test(css));
});

test('HTML nemá inline štýly ani chýbajúcu ikonu', () => {
  assert.equal(/\sstyle\s*=/.test(html), false);
  assert.equal(/\sstyle\s*=/.test(popup), false);
  assert.equal(/<style\b/.test(popup), false);
  assert.equal(/icon48\.png/.test(html + css + js + popup), false);
});

test('navigácia zodpovedá panelom', () => {
  const links = [...html.matchAll(/<a href="#([\w-]+)"/g)].map((m) => m[1]);
  const panels = [...html.matchAll(/<section class="panel" id="([\w-]+)"/g)].map((m) => m[1]);
  assert.ok(links.length >= 5);
  assert.deepEqual([...links].sort(), [...panels].sort());
});

test('všetky ovládacie prvky používajú v JS existujúce ID', () => {
  for (const id of [
    'masterSwitch', 'mode', 'store', 'accent', 'link', 'radius', 'fontSel', 'fontCustom',
    'hideOperinfo', 'aisLogo', 'mailPreview', 'schedulePreview', 'scheduleView', 'schedView', 'schedGroups',
    'todoPreview', 'links', 'addLink', 'nick', 'pic', 'avUrl', 'avUpload', 'avOrig',
    'colorblindSel', 'snippets', 'addSnippet', 'experimentalOn', 'exportCfg', 'importCfg',
    'importTheme', 'copyDiag', 'reset', 'toast',
  ]) assert.ok(html.includes('id="' + id + '"'), 'chýba ID ' + id);
});

test('šablóna používa triedy z CSS a responzívnu mriežku tém', () => {
  for (const cls of ['setting-row', 'setting-info', 'field-grid', 'field-row', 'card', 'grid-themes', 'nav', 'panel', 'save-status', 'popup']) {
    assert.ok(css.includes('.' + cls), 'CSS chýba trieda ' + cls);
  }
  assert.ok(css.includes('repeat(auto-fill, minmax(180px, 1fr))'));
  assert.ok(css.includes('prefers-reduced-motion'));
  assert.ok(css.includes(':focus-visible'));
  assert.ok(css.includes(':disabled'));
  assert.ok(js.includes('hashchange'));
  assert.ok(js.includes('addEventListener(\'input\''));
});

test('mriežka rozvrhu používa premenné a vlastný scroll kontajner', () => {
  assert.ok(base.includes('--hour-w'));
  assert.ok(base.includes('--sched-pred'));
  assert.ok(base.includes('--sched-cvic'));
  assert.ok(base.includes('.bu-grid-scroll { overflow-x: auto'));
  assert.ok(base.includes('max-width: 700px'));
});

test('texty predvolených hodnôt zodpovedajú DEFAULTS', () => {
  assert.equal(/Všetky predvolene zapnuté/.test(html), false);
  assert.equal(/ne nahraný|zelena/.test(html + js), false);
});
