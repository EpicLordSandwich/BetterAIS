// Test jadra nastavení (themes.js): node tools/test-settings-core.mjs
globalThis.self = globalThis;
globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false, addEventListener: () => {} }));
await import('../../themes.js');
const BU = globalThis.BU;

let failed = 0;
function eq(actual, expected, name) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) console.log('OK   ' + name);
  else { failed++; console.log(`FAIL ${name}: expected ${e}, got ${a}`); }
}

/* ===== compute / contrast / validateTheme / getTheme / resolveMode ===== */
const out = BU.compute(BU.DEFAULTS);
eq(typeof out.vars, 'object', 'compute: vars object');
eq(out.vars['--accent'], BU.DEFAULTS.custom.accent || BU.THEMES.classic.dark.accent, 'compute: accent from theme');
eq(BU.contrast('#3f74d9'), '#000000', 'contrast: blue accent -> black text');
eq(BU.contrast('#1f1e1d'), '#ffffff', 'contrast: dark bg -> white text');
eq(BU.contrast('#ffffff'), '#000000', 'contrast: white -> black text');
eq(BU.contrast('bad'), null, 'contrast: invalid -> null');
eq(out.vars['--sched-pred'], out.vars['--info'], 'compute: prednáška používa farebnú premennú témy');
eq(out.vars['--sched-cvic'], out.vars['--accent'], 'compute: cvičenie používa farebnú premennú témy');
eq(Math.abs(BU.contrastRatio('#ffffff', '#000000') - 21) < 0.01, true, 'contrastRatio: black/white = 21');
eq(BU.contrastRatio('#777777', '#777777'), 1, 'contrastRatio: same color = 1');
eq(BU.contrastRatio('bad', '#ffffff'), null, 'contrastRatio: invalid -> null');
eq(BU.contrastRatio(BU.THEMES.classic.dark.text, BU.THEMES.classic.dark.bg) >= 4.5, true, 'contrastRatio: builtin theme passes');
eq(BU.resolveMode('dark'), 'dark', 'resolveMode: dark');
eq(BU.resolveMode('light'), 'light', 'resolveMode: light');
eq(BU.validateTheme(null), null, 'validateTheme: null -> null');
eq(BU.validateTheme({ colors: { dark: BU.THEMES.classic.dark, light: BU.THEMES.classic.light } }).name, 'Téma', 'validateTheme: valid');
eq(BU.getTheme('classic', null).name, 'Classic', 'getTheme: builtin');
eq(BU.getTheme('nostalgia', null).name, 'Nostalgia', 'getTheme: Nostalgia builtin');
eq(BU.compute({ theme: 'nostalgia', mode: 'light' }).theme, 'nostalgia', 'compute: Nostalgia theme id');
eq(BU.compute({ theme: 'nostalgia', mode: 'light' }).vars['--bg-0'], BU.THEMES.nostalgia.light.bg0, 'compute: Nostalgia light header token');
eq(BU.compute({ theme: 'nostalgia', mode: 'light' }).vars['--accent-color'], '#831135', 'compute: Nostalgia accent bar maroon');
eq(BU.contrastRatio(BU.THEMES.nostalgia.light.link, BU.THEMES.nostalgia.light.bg) >= 4.5, true, 'Nostalgia: light link contrast');
eq(BU.getTheme('c-abc', { 'c-abc': { name: 'X', tagline: '', radius: 5, font: '', colors: { dark: BU.THEMES.classic.dark, light: BU.THEMES.classic.light } } }).name, 'X', 'getTheme: custom');
eq(BU.getTheme('nope', null), null, 'getTheme: missing -> null');
// globalThis.self je nastavené na začiatku súboru, aby themes.js (IIFE nad self) bežal v node.
eq(BU.normalize(null).avatar.mode, 'original', 'default avatar mode = original (privacy)');
eq(BU.normalize({ avatar: { mode: 'pedro' } }).avatar.mode, 'original', 'pedro migrates to original (pedro.gif removed)');
eq(BU.normalize({ avatar: { mode: 'bogus' } }).avatar.mode, 'original', 'invalid mode falls back to original');
eq(BU.normalize({ avatar: { mode: 'custom', dataUrl: 'data:image/png;base64,xx' } }).avatar.mode, 'custom', 'custom mode preserved');

/* ===== základné normalize sanity (regresia) ===== */
const n = BU.normalize(null);
eq(n.theme, 'classic', 'default theme');
eq(n.enabled, true, 'default enabled');
eq(BU.normalize({ links: [{ name: 'x', url: '/auth/x.pl', icon: 'mail' }] }).links.length, 1, 'links normalized');
eq(BU.normalize({ links: [{ name: 'x', url: 'https://evil.example.com/x', icon: 'mail' }] }).links[0].url, 'https://evil.example.com/x', 'absolute http(s) links allowed');
eq(BU.normalize({ snippets: [{ id: 'a', name: 'n', css: '.x{}', on: true }] }).snippets.length, 1, 'snippets normalized');
eq(/@import/i.test(BU.sanitizeCss('@import url("https://evil.example/x.css"); .x{}')), false, 'sanitizeCss: @import removed');
eq(/evil\.example/.test(BU.sanitizeCss('.x{background:url(https://evil.example/p.png)}')), false, 'sanitizeCss: remote url removed');
eq(/evil\.example/.test(BU.sanitizeCss('.x{background:url("//evil.example/p.png")}')), false, 'sanitizeCss: protocol-relative url removed');
eq(/data:image\/png/.test(BU.sanitizeCss('.x{background:url(data:image/png;base64,AA)}')), true, 'sanitizeCss: data url kept');
eq(/\/auth\/img\.png/.test(BU.sanitizeCss('.x{background:url(/auth/img.png)}')), true, 'sanitizeCss: same-origin url kept');
eq(/evil\.example/.test(BU.sanitizeCss('.x{background:URL(  "HTTPS://evil.example/p.png"  )}')), false, 'sanitizeCss: uppercase/quoted remote url removed');
eq(JSON.stringify(Object.keys(BU.normalize({ extra: { interval: 25 } }))), JSON.stringify(Object.keys(BU.normalize(null))), 'normalize shape stable');

console.log(failed ? `ZLYHALO: ${failed}` : 'VŠETKO OK');
process.exitCode = failed ? 1 : 0;
