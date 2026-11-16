// Test čistej logiky notifikácií (notifcore.js): node tools/test-notif-core.mjs
globalThis.self = globalThis;
await import('../../notifcore.js');
const N = globalThis.BU.notif;

let failed = 0;
function eq(actual, expected, name) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) console.log('OK   ' + name);
  else { failed++; console.log(`FAIL ${name}: expected ${e}, got ${a}`); }
}

/* ===== isQuiet(h, from, to) ===== */
// from === to → tiché hodiny vypnuté
eq(N.isQuiet(23, 23, 23), false, 'quiet disabled when from==to (23h)');
eq(N.isQuiet(2, 5, 5), false, 'quiet disabled when from==to (5h)');
// cez polnoc (23 → 7): ticho je 23,22,21..., 0..6; nie 7..22
eq(N.isQuiet(23, 23, 7), true, 'midnight wrap: 23 in');
eq(N.isQuiet(0, 23, 7), true, 'midnight wrap: 0 in');
eq(N.isQuiet(6, 23, 7), true, 'midnight wrap: 6 in');
eq(N.isQuiet(7, 23, 7), false, 'midnight wrap: 7 out (to exclusive)');
eq(N.isQuiet(12, 23, 7), false, 'midnight wrap: noon out');
eq(N.isQuiet(22, 23, 7), false, 'midnight wrap: 22 out');
// normálny rozsah (1 → 9): 1..8 ticho
eq(N.isQuiet(1, 1, 9), true, 'range: from in');
eq(N.isQuiet(8, 1, 9), true, 'range: 8 in');
eq(N.isQuiet(9, 1, 9), false, 'range: 9 out (to exclusive)');
eq(N.isQuiet(0, 1, 9), false, 'range: 0 out');

/* ===== decide(prevCount, count) ===== */
// prvý beh = baseline: bez notifikácie, badge podľa počtu
eq(N.decide(null, 3), { badge: '3', notify: false }, 'first run: baseline, badge 3');
eq(N.decide(null, 0), { badge: '', notify: false }, 'first run: zero mails, empty badge');
// nárast → notifikácia
eq(N.decide(2, 5), { badge: '5', notify: true }, 'increase 2→5: notify');
eq(N.decide(0, 1), { badge: '1', notify: true }, 'increase 0→1: notify');
// pokles (prečítal si) → len badge update
eq(N.decide(5, 2), { badge: '2', notify: false }, 'decrease 5→2: no notify');
eq(N.decide(3, 0), { badge: '', notify: false }, 'decrease 3→0: empty badge');
// rovnaký počet → bez notifikácie
eq(N.decide(4, 4), { badge: '4', notify: false }, 'same count: no notify');
// cap na 99
eq(N.decide(10, 150), { badge: '99', notify: true }, 'count capped at 99');

/* ===== countUnreadHtml(html) – parser pošty (regex, bez DOMParsera: SW ho nemá) ===== */
const FIXTURE_MAIL = [
  '<table>',
  '<tr><td><a href="/auth/posta/citanie.pl?oid=123">Prečítaná</a></td></tr>',
  '<tr><td><b><a href="/auth/posta/citanie.pl?oid=124">Neprečítaná 1</a></b></td></tr>',
  '<tr><td><a href="/auth/posta/citanie.pl?oid=125" style="font-weight:600">Neprečítaná 2</a></td></tr>',
  '<tr><td>\n  <a href=\'/auth/posta/citanie.pl?oid=126\' style="font-weight:400">Tiež prečítaná</a>\n</td></tr>',
  '<tr><td><a href="/auth/dok_server/nove_dok.pl">Iný odkaz</a></td></tr>',
  '<tr><td>Bez odkazu, len <br>text</td></tr>',
  '</table>',
].join('\n');

const r1 = N.countUnreadHtml(FIXTURE_MAIL);
eq(r1.ok, true, 'parser: rows found -> ok');
eq(r1.count, 2, 'parser: 2 unread (bold + fw600), fw400/prečítané nie');
eq(N.countUnreadHtml('<tr><td>žiadna pošta</td></tr>').ok, false, 'parser: zero posta rows -> ok:false');
eq(N.countUnreadHtml('').ok, false, 'parser: empty html -> ok:false');
// cap na 99
const many = '<tr><td><b><a href="/auth/posta/x.pl">m</a></b></td></tr>'.repeat(150);
eq(N.countUnreadHtml(many).count, 99, 'parser: capped at 99');
// <br> sa nepočíta ako <b>
const brOnly = '<tr><td><a href="/auth/posta/x.pl">a<br>b</a></td></tr>';
eq(N.countUnreadHtml(brOnly).count, 0, 'parser: <br> is not bold');
// font-weight 700
const fw700 = '<tr><td><a href="/auth/posta/x.pl" style="font-weight:700">a</a></td></tr>';
eq(N.countUnreadHtml(fw700).count, 1, 'parser: fw700 counts');
// viacriadkový riadok
const multiline = '<tr>\n  <td><b><a href="/auth/posta/x.pl">a</a></b></td>\n</tr>';
eq(N.countUnreadHtml(multiline).count, 1, 'parser: multiline row');

// Nový dizajn UIS (15.11.2026): presný počet z badge v účtovom menu (server-side).
const NEW_MAIL_BADGE = [
  '<div id="menu-popup"><a href="/auth/posta/?lang=sk" class="item">',
  '<span class="uf-icon md" role="img" data-sysid="usermenu-email" data-id="6121"> <svg><use xlink:href="/icons.svg#uc-glyph677" /></svg> </span>',
  '<span>Pošta</span><span class="badge">704</span></a>',
  '<a href="/auth/dok_server/nove_dok.pl?lang=sk" class="item"><span>Dokumentový server</span><span class="badge">6</span></a></div>',
].join('\n');
eq(N.countUnreadHtml(NEW_MAIL_BADGE), { count: 99, ok: true }, 'parser: badge 704 -> capped 99, ok');
const BADGE_ZERO = '<a class="item"><span data-sysid="usermenu-email"></span><span>Pošta</span><span class="badge">0</span></a>';
eq(N.countUnreadHtml(BADGE_ZERO), { count: 0, ok: true }, 'parser: badge 0 -> 0, ok');
// badge inej aplikácie (Dokumentový server) sa nesmie použiť
eq(N.countUnreadHtml('<a class="item"><span>Dokumentový server</span><span class="badge">6</span></a>').ok, false, 'parser: foreign badge not used');

// Nový dizajn pošty: riadky <tr> s odkazom ./email.pl?eid= (nie /auth/posta/)
const NEW_ROWS = [
  '<table id="tmtab_1">',
  '<tr class="zahlavi zahlavi-int"><td>Predmet</td></tr>',
  '<tr class=" uis-hl-table lbn"><td><a href="./email.pl?eid=1;fid=2;on=0;lang=sk"><b>Neprečítaná</b></a></td></tr>',
  '<tr class=" uis-hl-table lbn"><td><a href="./email.pl?eid=2;fid=2;on=0;lang=sk">Prečítaná</a></td></tr>',
  '<tr class=" uis-hl-table lbn"><td><a href="./slozka.pl?fid=2;eid=3;menu_akce=vymazat">akcia</a></td></tr>',
  '</table>',
].join('\n');
eq(N.countUnreadHtml(NEW_ROWS), { count: 1, ok: true }, 'parser: new email.pl rows, 1 unread');
// badge má prednosť pred riadkami (presný celkový počet)
eq(N.countUnreadHtml(NEW_MAIL_BADGE + NEW_ROWS).count, 99, 'parser: badge wins over rows');
// badge môže mať ďalšie triedy alebo tvar „99+“ – stále je to počet pošty
const BADGE_EXTRA = '<a class="item"><span data-sysid="usermenu-email"></span><span>Pošta</span><span class="badge unread">7</span></a>';
eq(N.countUnreadHtml(BADGE_EXTRA), { count: 7, ok: true }, 'parser: badge with extra class');
const BADGE_PLUS = '<a class="item"><span data-sysid="usermenu-email"></span><span>Pošta</span><span class="badge">99+</span></a>';
eq(N.countUnreadHtml(BADGE_PLUS), { count: 99, ok: true }, 'parser: badge 99+');

/* ===== normalizeSnapshot(snap) – kanonický tvar snapshotu notifikácií ===== */
eq(N.normalizeSnapshot(null), null, 'snapshot: null -> null');
eq(N.normalizeSnapshot({ at: 123, count: 5, status: 'ok' }), { at: 123, count: 5, status: 'ok', baseline: false }, 'snapshot: valid ok');
eq(N.normalizeSnapshot({ at: 1, count: 150, status: 'ok' }).count, 99, 'snapshot: count capped at 99');
eq(N.normalizeSnapshot({ status: 'bogus' }), null, 'snapshot: invalid status -> null');
eq(N.normalizeSnapshot({ at: 'x', count: 2, status: 'login' }).at > 0, true, 'snapshot: non-numeric at -> now()');

/* ===== parseCol / isSaturated – sémantické farby (content.js → notifcore) ===== */
eq(Array.isArray(N.parseCol('#ff0000')), true, 'parseCol: hex returns array');
eq(N.parseCol('#ff0000')[3], 1, 'parseCol: hex alpha = 1');
eq(N.parseCol('transparent'), null, 'parseCol: transparent -> null');
eq(N.parseCol('rgba(255,0,0,0)'), [1, 0, 0, 0], 'parseCol: rgba alpha parsed');
eq(N.isSaturated('#ff0000'), true, 'isSaturated: pure red saturated');
eq(N.isSaturated('#808080'), false, 'isSaturated: gray not saturated');
eq(N.isSaturated('rgba(255,0,0,0)'), false, 'isSaturated: transparent -> false');
eq(N.parseCol('gray').slice(0, 3).map((v) => Math.round(v * 255)), [128, 128, 128], 'parseCol: gray -> #808080');
eq(N.parseCol('grey').slice(0, 3).map((v) => Math.round(v * 255)), [128, 128, 128], 'parseCol: grey -> #808080');

/* ===== looksLikeLogin(html) ===== */
eq(N.looksLikeLogin('<form><input type="password" name="heslo"></form>'), true, 'login: password input');
eq(N.looksLikeLogin('<input TYPE="PASSWORD" name="x">'), true, 'login: uppercase attrs');
eq(N.looksLikeLogin(FIXTURE_MAIL), false, 'login: mail page is not login');
eq(N.looksLikeLogin(''), false, 'login: empty');

/* ===== stripDiacritics(s) – hľadanie bez diakritiky (Ctrl+K) ===== */
eq(N.stripDiacritics('Skúšky'), 'skusky', 'strip: Skúšky -> skusky');
eq(N.stripDiacritics('Žltý'), 'zlty', 'strip: Žltý -> zlty');
eq(N.stripDiacritics('Chlap'), 'chlap', 'strip: ch digraph intact');
eq(N.stripDiacritics('Čaša Ť PĽ'), 'casa t pl', 'strip: mixed case and spaces');
eq(N.stripDiacritics(''), '', 'strip: empty');
eq(N.stripDiacritics(null), '', 'strip: null safe');

/* ===== fuzzyScore(q, s) – fuzzy score s diakritikou ===== */
eq(N.fuzzyScore('skusky', 'Skúšky a termíny') > 0, true, 'fuzzy: no-diacritics query finds accented');
eq(N.fuzzyScore('', 'čokoľvek'), 1, 'fuzzy: empty query = 1');
eq(N.fuzzyScore('xyz', 'Skúšky a termíny'), 0, 'fuzzy: no match = 0');
eq(N.fuzzyScore('skusky', 'skusky'), 120, 'fuzzy: exact prefix = 120');
eq(N.fuzzyScore('termin', 'termíny'), 120, 'fuzzy: substring at idx0 = 120');
eq(N.fuzzyScore('st', 'Skúšky a termíny') > 0, true, 'fuzzy: subsequence match');

/* ===== compareCells(a, b) – zoradenie buniek tabuľky (table-tools) ===== */
// čísla (aj s medzerou ako tisícmi oddeľovačom a desatinnou čiarkou)
eq(N.compareCells('3', '10') < 0, true, 'cells: 3 < 10 numeric');
eq(N.compareCells('1 234,5', '999') > 0, true, 'cells: 1234,5 > 999');
eq(N.compareCells('-2', '2') < 0, true, 'cells: negative numbers');
eq(N.compareCells('1.234,5', '999') > 0, true, 'cells: mixed separators 1234,5 > 999');
// dátumy dd.mm.yyyy / d.m.y (a čas ako tiebreak)
eq(N.compareCells('1. 3. 2026', '28. 2. 2025') > 0, true, 'cells: later date >');
eq(N.compareCells('1. 3. 2026', '1. 3. 2026'), 0, 'cells: same date = 0');
eq(N.compareCells('1. 3. 2026 14:30', '1. 3. 2026 9:00') > 0, true, 'cells: time tiebreak');
const cmpInvalid = N.compareCells('31. 2. 2026', 'ABC');
eq(typeof cmpInvalid === 'number' && !Number.isNaN(cmpInvalid) && cmpInvalid !== 0, true, 'cells: invalid date falls back to text (no NaN crash)');
// slovenský text: ch je medzi h a i
eq(N.compareCells('chlap', 'hora') > 0, true, 'cells: sk collation ch > h');
eq(N.compareCells('hora', 'chlap') < 0, true, 'cells: sk collation h < ch');
eq(N.compareCells('Bra', 'Brå') < 0, true, 'cells: sk collation base letters');

/* ===== toCsv(cells) – kopírovanie tabuľky ako CSV ===== */
eq(N.toCsv(['a"b', 'c,d', 'e\nf']), '"a""b","c,d","e\nf"', 'csv: quote escape, delimiter, newline');
eq(N.toCsv(['1', '2']), '1,2', 'csv: plain values unquoted');
eq(N.toCsv([]), '', 'csv: empty row');
eq(N.toCsv([null]), '', 'csv: null cell -> empty');

/* ===== hasFormControls(cellsHtml) – formulárové tabuľky sa nesmú triediť ===== */
eq(N.hasFormControls(['<td><input></td>']), true, 'form: input detected');
eq(N.hasFormControls(['<td><SELECT name=x></td>']), true, 'form: select detected (case-insensitive)');
eq(N.hasFormControls(['<td>text</td>', '<td><button/></td>']), true, 'form: button in any cell');
eq(N.hasFormControls(['<td>text</td>', '<td>2</td>']), false, 'form: clean cells');
eq(N.hasFormControls('<td><textarea></td>'), true, 'form: bare string accepted');

/* ===== redactText(s) – redakcia diagnostického výpisu (P1-5) ===== */
eq(N.redactText('?oid=12345&x=1'), '?oid=<n>&x=1', 'redact: sensitive key oid → <n>, benign param stays');
eq(N.redactText('https://is.stuba.sk/img/foto.pl?a=1'), '<foto>', 'redact: foto.pl URL → <foto>');
eq(N.redactText('?tel=0903123456'), '?tel=<n>', 'redact: long numeric query value → <n>');
eq(N.redactText('?meno=Jano'), '?meno=<meno>', 'redact: text value of sensitive key → <meno>');
eq(N.redactText('?rok=2026'), '?rok=2026', 'redact: 4-digit value untouched');
eq(N.redactText('?token=abc123def'), '?token=<meno>', 'redact: alphanumeric token → <meno>');
eq(N.redactText(''), '', 'redact: empty string');
eq(N.redactText('/auth/studenti/osoby.pl?osobne_cislo=00123456&fakulta=FEI'), '/auth/studenti/osoby.pl?osobne_cislo=<n>&fakulta=FEI', 'redact: osobne_cislo in real URL shape');

console.log(failed ? `ZLYHALO: ${failed}` : 'VŠETKO OK');
process.exitCode = failed ? 1 : 0;
