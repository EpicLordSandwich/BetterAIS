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