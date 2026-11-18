// Kontrastná kontrola tém podľa WCAG 2.1 (prah 4.5:1 pre bežný text).
// Použitie: node tools/contrast-check.mjs
// Vypíše páry farieb pod prahom a navrhne opravenú paletu (mení iba svetlosť, zachová odtieň/saturáciu).
globalThis.self = globalThis;
await import('../themes.js');
const BU = globalThis.BU;

const PRAH = 4.5;
const ZOSIL = 4.62; // malá rezerva, aby zaokrúhlenie hexu nepokazilo výsledok

const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgb2hex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
const lum = (hex) => { const [r, g, b] = hex2rgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rgb2hsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; };
const hsl2rgb = ([h, s, l]) => { const c = (1 - Math.abs(2 * l - 1)) * s, hp = h / 60, x = c * (1 - Math.abs(hp % 2 - 1)); let [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x]; const m = l - c / 2; return [r, g, b].map((v) => (v + m) * 255); };

// Upraví svetlosť farby tak, aby ratio(fix, bg) >= cieľ; smer určí podľa svetlosti pozadia.
function fixFor(fg, bg, ciel) {
  const [h, s] = rgb2hsl(hex2rgb(fg));
  const bgLight = lum(bg) > 0.18;
  let lo = 0, hi = 1;                 // lo = strana, ktorá NEPRECHÁDZA; hi = strana, ktorá PRECHÁDZA
  for (let i = 0; i < 44; i++) {
    const mid = (lo + hi) / 2;
    const cand = rgb2hex(hsl2rgb([h, s, mid]).map((v) => Math.round(v)));
    const ok = ratio(cand, bg) >= ciel;
    if (bgLight) (ok ? lo = mid : hi = mid);   // svetlé pozadie: potrebná TMASKÁ farba, priechodné nízke L
    else (ok ? hi = mid : lo = mid);           // tmavé pozadie: potrebná SVETLÁ farba, priechodné vysoké L
    if (hi - lo < 0.0004) break;
  }
  const L = bgLight ? lo : hi;
  return rgb2hex(hsl2rgb([h, s, L]).map((v) => Math.round(v)));
}

const PAIRS = [
  ['text', 'bg'], ['text', 'bg0'], ['text', 'bg2'], ['text', 'bg3'],
  ['muted', 'bg'], ['muted', 'bg2'], ['muted', 'bg3'],
  ['link', 'bg'], ['link', 'bg2'], ['link', 'bg3'],
  ['info', 'bg'], ['info', 'bg2'],
  ['warn', 'bg'], ['warn', 'bg2'],
  ['crit', 'bg'], ['crit', 'bg2'],
];
const ACCENT_PAIRS = [['accent', 'bg'], ['accent', 'bg2']];
const ACCENT_PRAH = 3.0;
const ACCENT_ZOSIL = 3.1;

let fails = 0;
const fixes = [];
for (const [id, t] of Object.entries(BU.THEMES)) {
  for (const mode of ['dark', 'light']) {
    const p = t[mode];
    const out = { ...p };
    const cand = {}; // f -> {lum, hex} – vyberie sa najprísnejší návrh
    let changed = false;
    const rows = [];
    for (const [f, b] of PAIRS) {
      const r = ratio(p[f], p[b]);
      if (r < PRAH) {
        const nf = fixFor(p[f], p[b], ZOSIL);
        const L = lum(nf);
        if (!cand[f] || (L > 0.18 ? L > cand[f].lum : L < cand[f].lum)) cand[f] = { lum: L, hex: nf };
        rows.push(`    ${mode} ${f}/${b}: ${r.toFixed(2)} -> ${nf} (bolo ${p[f]})`);
        changed = true; fails++;
      }
    }
    for (const [f, b] of ACCENT_PAIRS) {
      const r = ratio(p[f], p[b]);
      if (r < ACCENT_PRAH) {
        const nf = fixFor(p[f], p[b], ACCENT_ZOSIL);
        const L = lum(nf);
        if (!cand[f] || (L > 0.18 ? L > cand[f].lum : L < cand[f].lum)) cand[f] = { lum: L, hex: nf };
        rows.push(`    ${mode} ${f}/${b}: ${r.toFixed(2)} -> ${nf} (bodo ${p[f]})`);
        changed = true; fails++;
      }
    }
    for (const f in cand) out[f] = cand[f].hex;
    if (changed) {
      fixes.push(`${id}:\n  ${mode}: P('${out.bg0}', '${out.bg}', '${out.bg2}', '${out.bg3}', '${out.border}', '${out.text}', '${out.muted}', '${out.link}', '${out.accent}', '${out.info}', '${out.warn}', '${out.crit}'),`);
      console.log(`[${id} – ${mode}]`);
      rows.forEach((r) => console.log(r));
    }
  }
}
console.log(`\nKontrastných porušení: ${fails}`);
if (fixes.length) console.log('\n=== Navrhnuté opravené palety (meniť iba svetlosť) ===\n' + fixes.join('\n\n'));
process.exitCode = fails ? 1 : 0;
