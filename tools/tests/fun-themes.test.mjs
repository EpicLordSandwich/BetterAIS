import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.self = globalThis;
await import('../../themes.js');
await import('../../fun-themes.js');
const BU = globalThis.BU;

const ids = BU.FUN_THEME_IDS;

// Vráti dvojice [selektor, telo] pre pravidlá na najvyššej úrovni (bez @-pravidiel).
function topRules(css) {
  const out = [];
  let depth = 0, buf = '', sel = '';
  for (const ch of css) {
    if (ch === '{') { if (depth === 0) { sel = buf.trim(); buf = ''; } else buf += ch; depth++; continue; }
    if (ch === '}') { depth--; if (depth === 0) { out.push([sel, buf.trim()]); buf = ''; sel = ''; } else buf += ch; continue; }
    buf += ch;
  }
  assert.equal(depth, 0, 'nevyvážené zátvorky');
  return out;
}
// Rozdelí zoznam selektorov na čiarkách mimo zátvoriek.
function splitSelectors(sel) {
  const parts = []; let d = 0, cur = '';
  for (const ch of sel) {
    if (ch === '(' || ch === '[') d++;
    if (ch === ')' || ch === ']') d--;
    if (ch === ',' && d === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
  }
  parts.push(cur.trim());
  return parts.filter(Boolean);
}

test('štýlové témy sú zaregistrované v skupine fun', () => {
  assert.ok(ids.length >= 10);
  for (const id of ids) assert.equal(BU.THEMES[id].group, 'fun', id);
});

test('normalize zachová id štýlovej témy a compute funguje v oboch režimoch', () => {
  for (const id of ids) {
    assert.equal(BU.normalize({ theme: id }).theme, id);
    for (const mode of ['dark', 'light']) {
      const out = BU.compute({ theme: id, mode });
      assert.equal(out.theme, id);
      assert.ok(out.vars['--accent']);
    }
  }
});

test('palety štýlových tém sú platné', () => {
  for (const id of ids) {
    const t = BU.THEMES[id];
    assert.ok(BU.validateTheme({ name: t.name, colors: { dark: t.dark, light: t.light } }), id);
  }
});

test('štýlové témy majú jeden pevný režim', () => {
  for (const id of ids) {
    const t = BU.THEMES[id];
    if (id === 'nostalgia') {
      assert.equal(t.mode, undefined, id);
      for (const mode of ['dark', 'light']) assert.equal(BU.compute({ theme: id, mode }).mode, mode, id);
      continue;
    }
    assert.ok(t.mode === 'dark' || t.mode === 'light', id);
    for (const mode of ['dark', 'light']) assert.equal(BU.compute({ theme: id, mode }).mode, t.mode, id);
  }
});

for (const id of ['retroxp', 'retro95', 'crtamber', 'gameboy', 'c64', 'synthwave', 'crt', 'aqua', 'newspaper', 'dos']) {
  test('CSS témy ' + id + ' je bezpečné a v rozsahu témy', () => {
    const css = BU.THEMES[id].css;
    assert.ok(css && css.length > 200, 'prázdne css');
    assert.ok(!/url\s*\(/i.test(css), 'url() nie je povolené');
    assert.ok(!css.includes('&'), 'nenahradené &');
    assert.equal(BU.sanitizeCss(css), css, 'sanitizeCss zmenil CSS');
    const scopeStart = 'html[data-bu-theme="' + id + '"]';
    for (const [sel, body] of topRules(css)) {
      assert.ok(body.length > 0, 'prázdne pravidlo: ' + sel);
      for (const part of splitSelectors(sel)) {
        assert.ok(part.startsWith(scopeStart), 'selektor mimo rozsahu témy: ' + part);
      }
    }
  });
}

test('Nostalgia je kill-switch okrem hlavičky, tlačidiel a panels Osobná administratíva', () => {
  const content = readFileSync('content.js', 'utf8');
  const css = readFileSync('base.css', 'utf8');
  assert.match(content, /offNow\(\).*S\.theme === 'nostalgia'/);
  assert.match(content, /dataset\.buNostalgia = '1'/);
  assert.match(content, /offNow\(\) && S\.theme !== 'nostalgia'/);
  assert.match(css, /html\[data-bu-nostalgia="1"\] #header/);
  assert.match(css, /html\[data-bu-nostalgia="1"\] nav\[aria-label="breadcrumb"\]/);
  assert.match(css, /html\[data-bu-nostalgia="1"\] #bu-ctl \.bu-btn/);
  assert.ok(!BU.THEMES.nostalgia.css, 'Nostalgia nesmie mať vlastnú CSS vrstvu');
});

test('pravidlá štýlových tém rešpektujú kill-switch', () => {
  for (const id of ids) {
    const css = BU.THEMES[id].css;
    if (!css) continue;
    for (const [sel] of topRules(css)) {
      for (const part of splitSelectors(sel)) {
        if (/^html\[data-bu-theme="[a-z0-9]+"\]\[data-bu-mode="(dark|light)"\]\s*$/.test(part)) continue; // definície premenných
        assert.ok(part.includes(':not([data-bu-off])'), 'chýba kill-switch: ' + part);
      }
    }
  }
});
