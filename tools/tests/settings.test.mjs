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
  const x = { theme: 'softbrown', mode: 'light', nick: 'Miro', rename: { uisToAis: true } };
  assert.deepEqual(BU.normalize(BU.normalize(x)), BU.normalize(x));
});

test('vzdialená zmena nezmaže lokálne polia', () => {
  const local = BU.normalize({ nick: 'Miro' });
  const next = BU.normalize({ ...local, ...{ theme: 'softbrown' } });
  assert.equal(next.nick, 'Miro');
  assert.equal(next.theme, 'softbrown');
});
test('avatar url mode preserved', () => {
  const u = 'https://media.giphy.com/media/abc/giphy.gif';
  assert.equal(BU.normalize({ avatar: { mode: 'url', url: u } }).avatar.mode, 'url');
  assert.equal(BU.normalize({ avatar: { mode: 'url', url: u } }).avatar.url, u);
  assert.equal(BU.normalize({ avatar: { mode: 'url', url: 'not-a-url' } }).avatar.mode, 'url');
  assert.equal(BU.normalize({ avatar: { mode: 'url', url: 'not-a-url' } }).avatar.url, '');
});

test('avatar crop a source sa validujú', () => {
  const a = BU.normalize({ avatar: { mode: 'custom', dataUrl: 'data:image/webp;base64,AAAA', source: 'data:image/webp;base64,BBBB', crop: { zoom: 99, x: -5, y: 0.5 } } }).avatar;
  assert.equal(a.source, 'data:image/webp;base64,BBBB');
  assert.deepEqual(a.crop, { zoom: 3, x: -1, y: 0.5 });
  const b = BU.normalize({ avatar: { mode: 'url', url: 'https://x.test/a.png', source: 'data:image/webp;base64,BBBB' } }).avatar;
  assert.equal(b.source, '');
  assert.equal(b.crop, null);
  assert.equal(BU.normalize({ avatar: { mode: 'custom', dataUrl: 'data:image/webp;base64,AAAA', crop: 'nope' } }).avatar.crop, null);
});

test('náhľad pošty je opt-in a zachová sa', () => {
  assert.equal(BU.normalize(null).ui.mail, false);
  assert.equal(BU.normalize({ ui: { mail: true } }).ui.mail, true);
  assert.equal(BU.normalize({ ui: { mail: false } }).ui.mail, false);
});

test('náhľad rozvrhu je opt-in', () => {
  assert.equal(BU.normalize(null).ui.schedule, false);
  assert.equal(BU.normalize({ ui: { schedule: true } }).ui.schedule, true);
});
