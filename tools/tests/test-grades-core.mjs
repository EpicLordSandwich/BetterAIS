// Test jadra dashboardu hodnotení (grades.js): node tools/tests/test-grades-core.mjs
globalThis.self = globalThis;
await import('../../grades.js');
const G = globalThis.BU.grades;

let failed = 0;
function eq(actual, expected, name) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) console.log('OK   ' + name);
  else { failed++; console.log(`FAIL ${name}: expected ${e}, got ${a}`); }
}
function near(actual, expected, tol, name) {
  eq(typeof actual === 'number' && Math.abs(actual - expected) <= tol, true, name);
}

/* ===== parseResult – názvy známok UIS ===== */
const cases = [
  ['výborne (A)', 'A', true, 1],
  ['veľmi dobre (B)', 'B', true, 1.5],
  ['dobre (C)', 'C', true, 2],
  ['uspokojivo (D)', 'D', true, 2.5],
  ['dostatočne (E)', 'E', true, 3],
  ['nedostatočne (FX)', 'FX', false, 4],
  ['započítané (Z)', 'Z', true, null],
  ['B', 'B', true, 1.5],
  ['FX', 'FX', false, 4],
];
for (const [text, letter, passed, points] of cases) {
  const r = G.parseResult(text);
  eq([r && r.letter, r && r.passed, r && r.points], [letter, passed, points], 'parseResult: ' + text);
}
eq(G.parseResult(''), null, 'parseResult: empty -> null');
eq(G.parseResult('bez známky'), null, 'parseResult: unknown -> null');

/* ===== reálna tabuľka E-indexu (LS 2025/2026, redigované mená) ===== */
const header = ['Por.', 'Kód', 'Predmet', 'Povinnosť', 'Prof.', 'Jaz.', 'Uk.', 'Pokus', 'Výsledok', 'Zadané', 'Zadal', 'Kredity', 'Spôsob'];
const rows = [
  ['', 'B-BP2-EE', { text: 'Bakalársky projekt 2', href: '/auth/katalog/syllabus.pl?predmet=432358' }, 'povinný', '', 'sk', 'kz', '1', 'veľmi dobre (B)', '12.06.2026', 'M. Pípa', '5', ''],
  ['', 'B-ELINST', 'Elektrické inštalácie', 'povinný', '', 'sk', 's', '2', 'dostatočne (E)', '15.06.2026', 'P. Janiga', '6', ''],
  ['', 'B-ELMP', 'Elektromagnetické pole', 'povinne voliteľný', '', 'sk', 's', '1', 'dobre (C)', '22.05.2026', 'V. Jančárik', '6', ''],
  ['', 'B-OZE', 'Obnoviteľné zdroje energie', 'povinne voliteľný', '', 'sk', 's', '1', 'veľmi dobre (B)', '06.06.2026', 'M. Farkas Smitková', '6', ''],
  ['', 'B-SEPS', 'Solárne energetické prvky a systémy', 'povinne voliteľný', '', 'sk', 's', '1', 'veľmi dobre (B)', '28.05.2026', 'V. Šály', '6', ''],
  ['', 'B-TK6', 'Telesná kultúra 6', 'výberový', '', 'sk', 'z', '1', 'započítané (Z)', '09.06.2026', 'K. Hižnayová', '1', ''],
  ['', 'B-ZEE', 'Základy elektroenergetiky', 'povinný', '', 'sk', 's', '1', 'uspokojivo (D)', '30.05.2026', 'Ž. Eleschová', '6', ''],
  ['', 'B-MODEE', 'Základy modelovania v elektroenergetike', 'povinný', '', 'sk', 's', '2', 'nedostatočne (FX)', '18.06.2026', 'A. Beláň', '', ''],
];
eq(G.isGradeHeader(header), true, 'isGradeHeader: E-index header');
eq(G.isGradeHeader(['Por.', 'Kód', 'Predmet']), false, 'isGradeHeader: chýba Výsledok/Kredity');
const parsed = G.parseTable(header, rows, 'LS 2025/2026 - FEI');
eq(parsed.length, 8, 'parseTable: 8 riadkov');
eq(parsed[0].code, 'B-BP2-EE', 'parseTable: kód');
eq(parsed[0].subject, 'Bakalársky projekt 2', 'parseTable: predmet');
eq(parsed[0].href, '/auth/katalog/syllabus.pl?predmet=432358', 'parseTable: odkaz na sylabus');
eq(parsed[0].credits, 5, 'parseTable: kredity');
eq(parsed[0].result.points, 1.5, 'parseTable: body B');
eq(parsed[0].period, 'LS 2025/2026 - FEI', 'parseTable: obdobie');
eq(parsed[7].credits, null, 'parseTable: FX bez kreditov -> null');

const sum = G.summarize(parsed);
eq(sum.earnedCredits, 36, 'summarize: získané kredity');
eq(sum.gradedCredits, 35, 'summarize: kredity do priemeru (bez Z)');
near(sum.average, 70.5 / 35, 1e-9, 'summarize: vážený priemer');
eq(G.formatAverage(sum.average), '2,01', 'formatAverage: 2,01');
eq(sum.counts, { A: 0, B: 3, C: 1, D: 1, E: 1, FX: 1, Z: 1, other: 0 }, 'summarize: rozdelenie známok');
eq([sum.subjectCount, sum.passedCount, sum.failedCount], [8, 7, 1], 'summarize: počty predmetov');
eq(sum.failed.length, 1, 'summarize: zoznam neúspešných');
eq(sum.failed[0].code, 'B-MODEE', 'summarize: neúspešný predmet');
near(G.summarize(parsed, 180).progress, 20, 1e-9, 'summarize: progres 36/180');
eq(G.summarize(parsed, 0).progress, null, 'summarize: bez cieľa -> progress null');

/* ===== duplicitný predmet: FX starší, A novší ===== */
const dup = [
  { code: 'X-1', subject: 'Predmet', credits: null, date: '01.01.2025', result: G.parseResult('nedostatočne (FX)') },
  { code: 'X-1', subject: 'Predmet', credits: 5, date: '01.02.2025', result: G.parseResult('výborne (A)') },
];
const ds = G.summarize(dup);
eq([ds.earnedCredits, ds.failedCount, ds.counts.A], [5, 0, 1], 'unique: novší úspešný pokus vyhráva');
near(ds.average, 1, 1e-9, 'unique: priemer po oprave');
eq(G.summarize([dup[0], dup[1], { code: 'X-1', subject: 'Predmet', credits: null, date: '01.03.2025', result: G.parseResult('nedostatočne (FX)') }]).failedCount, 1, 'unique: najnovší FX vyhráva');

/* ===== header bez Por. a riadok bez výsledku ===== */
const h2 = ['Kód', 'Predmet', 'Výsledok', 'Kredity'];
const p2 = G.parseTable(h2, [['A-1', 'Test', 'výborne (A)', '4'], ['A-2', 'Bez výsledku', '', '3']], '');
eq(p2.length, 1, 'parseTable: riadok bez výsledku sa preskočí');
eq(p2[0].attempt, '', 'parseTable: chýbajúci stĺpec -> prázdny reťazec');

/* ===== prázdne dáta ===== */
eq(G.summarize([]).average, null, 'summarize: prázdne -> average null');
eq(G.formatAverage(null), '–', 'formatAverage: null -> pomlčka');

if (failed) { console.log('ZLYHALO: ' + failed); process.exit(1); }
console.log('VŠETKO OK');
