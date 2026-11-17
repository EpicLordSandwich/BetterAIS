// Test notif nastavení v themes.js: node tools/test-notif-settings.mjs
// Čisté node spustenie (žiadne chrome.*) – themes.js sa nastaví na self.BU.
globalThis.self = globalThis;
await import('../../themes.js');
const BU = globalThis.BU;

let failed = 0;
function eq(actual, expected, name) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) console.log('OK   ' + name);
  else { failed++; console.log(`FAIL ${name}: expected ${e}, got ${a}`); }
}

// 1) predvolené hodnoty
eq(BU.normalize(null).notif, { on: false, interval: 20, quietFrom: 23, quietTo: 7 }, 'defaults');

// 2) neplatný interval → default 20
eq(BU.normalize({ notif: { interval: 5 } }).notif.interval, 20, 'bad interval -> 20');
eq(BU.normalize({ notif: { interval: 30 } }).notif.interval, 30, 'valid interval kept');
eq(BU.normalize({ notif: { interval: '20' } }).notif.interval, 20, 'numeric string kept');

// 3) clamps tichých hodín na 0..23
const clamped = BU.normalize({ notif: { quietFrom: 99, quietTo: -4 } }).notif;
eq([clamped.quietFrom, clamped.quietTo], [23, 0], 'quiet clamped');

// 4) `on` je striktne bool
eq(BU.normalize({ notif: { on: 'x' } }).notif.on, true, 'truthy on -> true');
eq(BU.normalize({ notif: { on: 0 } }).notif.on, false, 'falsy on -> false');

// 5) re-normalizácia zachová platné hodnoty (round-trip)
const once = BU.normalize({ notif: { on: true, interval: 60, quietFrom: 1, quietTo: 9 } });
eq(BU.normalize(once).notif, { on: true, interval: 60, quietFrom: 1, quietTo: 9 }, 'round-trip');

// 6) exportované API
eq(BU.NOTIF_KEY, 'bu-notif', 'NOTIF_KEY exported');
eq(BU.SYNC_KEYS.includes('notif'), true, 'notif in SYNC_KEYS');

console.log(failed ? `ZLYHALO: ${failed}` : 'VŠETKO OK');
process.exitCode = failed ? 1 : 0;
