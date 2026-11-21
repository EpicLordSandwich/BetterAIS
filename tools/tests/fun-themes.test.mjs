import test from 'node:test';
import assert from 'node:assert/strict';

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

for (const id of ['retroxp', 'retro95', 'crtamber', 'gameboy', 'c64', 'synthwave', 'brutal', 'aqua', 'newspaper', 'dos']) {
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

test('pravidlá štýlových tém rešpektujú kill-switch', () => {
  for (const id of ids) {
    for (const [sel] of topRules(BU.THEMES[id].css)) {
      for (const part of splitSelectors(sel)) {
        if (/^html\[data-bu-theme="[a-z0-9]+"\]\[data-bu-mode="(dark|light)"\]\s*$/.test(part)) continue; // definície premenných
        assert.ok(part.includes(':not([data-bu-off])'), 'chýba kill-switch: ' + part);
      }
    }
  }
});
