// Integration smoke test: themes.js + text-utils.js spolupráca (node)
globalThis.self = globalThis;
globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false, addEventListener: () => {} }));
await import('../../themes.js');
await import('../../text-utils.js');
const BU = globalThis.BU;
const N = BU.notif;

let failed = 0;
function eq(actual, expected, name) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) console.log('OK   ' + name);
  else { failed++; console.log(`FAIL ${name}: expected ${e}, got ${a}`); }
}

// settings round-trip
const raw = { theme: 'softbrown', mode: 'light', links: [{ name: 'x', url: '/auth/x.pl', icon: 'mail' }], snippets: [{ id: 's', name: 'n', css: '.x{}', on: true }] };
const n1 = BU.normalize(raw);
const n2 = BU.normalize(n1);
eq(JSON.stringify(n1), JSON.stringify(n2), 'integration: normalize idempotent');
eq(n1.theme, 'softbrown', 'integration: theme preserved');
eq(n1.links.length, 1, 'integration: links preserved');
eq(n1.snippets.length, 1, 'integration: snippets preserved');

// sync payload excludes avatar
eq(BU.SYNC_KEYS.includes('avatar'), false, 'integration: avatar not in SYNC_KEYS');
eq(BU.SYNC_KEYS.includes('theme'), true, 'integration: theme in SYNC_KEYS');

// form-control guard
eq(N.hasFormControls(['<td><input></td>']), true, 'integration: form control detected');
eq(N.hasFormControls(['<td>text</td>']), false, 'integration: clean cell passes');

// redact + diacritics compose
eq(N.stripDiacritics(N.redactText('?meno=Jano')), '?meno=<meno>', 'integration: redact then strip');

// contrast
eq(typeof BU.contrast('#3f74d9'), 'string', 'integration: contrast returns string');

console.log(failed ? `ZLYHALO: ${failed}` : 'VŠETKO OK');
process.exitCode = failed ? 1 : 0;
