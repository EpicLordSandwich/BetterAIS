import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('manifesty sa líšia len v povolených kľúčoch', () => {
  const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
  const { background: _b1, minimum_chrome_version: _m, ...chrome } = read('manifest.json');
  const { background: _b2, browser_specific_settings: _g, ...firefox } = read('manifest.firefox.json');
  assert.deepEqual(chrome, firefox);
});

test('verzia v package.json sa zhoduje s manifestom', () => {
  const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
  assert.equal(read('package.json').version, read('manifest.json').version);
});

test('package.mjs zahŕňa všetky súbory z manifestov a žiadne zmazané', () => {
  const pkg = readFileSync('tools/package.mjs', 'utf8');
  const listSrc = pkg.match(/const common = \[([\s\S]*?)\];/)[1];
  const files = [...listSrc.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
  const required = new Set([
    manifest.action.default_popup,
    manifest.options_ui.page,
    ...manifest.content_scripts.flatMap((c) => [...(c.js || []), ...(c.css || [])]),
    manifest.background.service_worker,
    ...manifest.web_accessible_resources.flatMap((r) => r.resources),
  ]);
  for (const f of required) assert.ok(files.includes(f), `package.mjs chýba: ${f}`);
  for (const f of files) assert.ok(!f.startsWith('grades'), `package.mjs obsahuje zmazaný súbor: ${f}`);
});