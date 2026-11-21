import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.self = globalThis;
await import('../../text-utils.js');
const N = globalThis.BU.notif;
const HTML = readFileSync('tools/fixtures/avatar.html', 'utf8');
const photos = [...HTML.matchAll(/src="([^"]*foto\.pl\?id=\d+[^"]*)"/g)].map((m) => m[1]);

test('fixture obsahuje vlastnú aj cudzie fotky', () => {
  assert.equal(photos.length, 3);
  assert.equal(N.studentIdFromHtml(HTML), '150164');
});

test('snímka ISIC sa vezme len z vlastného ID', () => {
  assert.equal(N.pickOwnPhoto(photos, '150164'), '../foto.pl?id=150164');
  assert.equal(N.pickOwnPhoto(photos, '900001'), '../foto.pl?id=900001');
  assert.equal(N.pickOwnPhoto(photos, '999999'), '');
});

test('bez ID sa nesmie uložiť žiadna snímka', () => {
  assert.equal(N.pickOwnPhoto(photos, ''), '');
});
