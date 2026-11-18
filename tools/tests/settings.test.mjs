import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.self = globalThis;
globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false, addEventListener: () => {} }));
await import('../../themes.js');
const BU = globalThis.BU;

test('predvolené rename zodpovedá DEFAULTS', () => {
  assert.equal(BU.normalize(null).rename.uisToAis, BU.DEFAULTS.rename.uisToAis);
  assert.equal(BU.normalize({}).rename.uisToAis, BU.DEFAULTS.rename.uisToAis);
  assert.equal(BU.normalize({ rename: {} }).rename.uisToAis, BU.DEFAULTS.rename.uisToAis);
  assert.equal(BU.normalize({ rename: { uisToAis: false } }).rename.uisToAis, false);
  assert.equal(BU.normalize({ rename: { uisToAis: true } }).rename.uisToAis, true);
});

test('idempotencia normalize', () => {
  const x = { theme: 'warm', mode: 'light', nick: 'Miro', grades: { on: true, requiredCredits: 180 }, rename: { uisToAis: true } };
  assert.deepEqual(BU.normalize(BU.normalize(x)), BU.normalize(x));
});

test('vzdialená zmena nezmaže lokálne polia', () => {
  const local = BU.normalize({ nick: 'Miro', grades: { on: true, requiredCredits: 180 } });
  const next = BU.normalize({ ...local, ...{ theme: 'warm' } });
  assert.equal(next.nick, 'Miro');
  assert.equal(next.grades.requiredCredits, 180);
  assert.equal(next.theme, 'warm');
});
test('avatar url mode preserved', () => {
  const u = 'https://media.giphy.com/media/abc/giphy.gif';
  assert.equal(BU.normalize({ avatar: { mode: 'url', url: u } }).avatar.mode, 'url');
  assert.equal(BU.normalize({ avatar: { mode: 'url', url: u } }).avatar.url, u);
  assert.equal(BU.normalize({ avatar: { mode: 'url', url: 'not-a-url' } }).avatar.mode, 'url');
  assert.equal(BU.normalize({ avatar: { mode: 'url', url: 'not-a-url' } }).avatar.url, '');
});
