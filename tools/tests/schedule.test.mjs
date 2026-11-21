import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.self = globalThis;
await import('../../text-utils.js');
await import('../../schedule.js');
const Sch = globalThis.BU.schedule;

const HTML = readFileSync('tools/fixtures/rozvrh.html', 'utf8');
const FETCH_URL = 'https://is.stuba.sk/auth/katalog/rozvrhy_view.pl?rozvrh_student=150164;zobraz=1;format=html;typ_vypisu=souhrn;konani_od=16.11.2026;konani_do=22.11.2026;poznamky=1;lang=sk';
const parsed = () => Sch.parseSchedule(HTML, FETCH_URL);

test('parser nájde rozvrh, nie legendu ani formulár', () => {
  const p = parsed();
  assert.equal(p.events.length, 4);
  assert.ok(!p.events.some((e) => e.subject === 'Prednáška'));
  assert.equal(Sch.parseSchedule('<form><table><tr><td>x</td></tr></table></form>', FETCH_URL).events.length, 0);
});

test('Bunka s colspan 22 na stĺpci 24 je 10:00–11:50', () => {
  const e = parsed().events[0];
  assert.deepEqual({ day: e.day, start: e.start, end: e.end, type: e.type }, { day: 'Po', start: '10:00', end: '11:50', type: 'pred' });
});

test('event obsahuje miestnosť, skupinu, predmet, vyučujúceho a poznámky', () => {
  const e = parsed().events[0];
  assert.equal(e.room, 'de300 (BA-FEI-FEI D-E)');
  assert.equal(e.group, 'b-rk');
  assert.equal(e.subject, 'Logické systémy 1');
  assert.equal(e.subjectId, 'LOG1');
  assert.equal(e.teacher, 'T. Visnyai');
  assert.deepEqual(e.noteRefs, [13]);
});

test('všetky odkazy sú absolútne voči is.stuba.sk', () => {
  const e = parsed().events[0];
  assert.equal(e.url, 'https://is.stuba.sk/auth/katalog/syllabus.pl?predmet=LOG1');
  assert.equal(e.roomUrl, 'https://is.stuba.sk/auth/mistnosti/?zobrazit_mistnost=de300');
  assert.equal(e.teacherUrl, 'https://is.stuba.sk/auth/lide/clovek.pl?id=900001');
});

test('pokračovací riadok dedí deň', () => {
  const e = parsed().events[2];
  assert.equal(e.day, 'Po');
  assert.equal(e.group, 'B1');
  assert.equal(e.start, '11:50');
  assert.deepEqual(e.noteRefs, []);
});

test('poznámky sa čítajú z tabuľky pod rozvrhom', () => {
  const p = parsed();
  assert.equal(p.notes[13], 'Párny týždeň (podľa kalendára)');
  assert.equal(p.notes[7], 'Voľný deň: 17. 11. 2026');
  assert.equal(p.notes[12], 'Určené pre: 1B-RK4');
  assert.equal(p.validFrom, '16.11.2026');
  assert.equal(p.validTo, '22.11.2026');
});

test('URL sa skladá z ID a aktuálneho týždňa, nie z navštívenej URL', () => {
  const url = Sch.buildScheduleUrl(150164, '16.11.2026', '22.11.2026');
  assert.ok(url.startsWith('https://is.stuba.sk/auth/katalog/rozvrhy_view.pl?'));
  assert.ok(url.includes('rozvrh_student=150164'));
  assert.ok(url.includes('zobraz=1'));
  assert.ok(url.includes('typ_vypisu=souhrn'));
  assert.ok(url.includes('konani_od=16.11.2026'));
  assert.ok(!url.includes('rozvrh_student_obec'));
  assert.ok(!url.includes('zpet='));
});

test('týždeň začína pondelkom a končí nedeľou', () => {
  assert.deepEqual(Sch.weekRange(new Date(2026, 10, 21)), { from: '16.11.2026', to: '22.11.2026' });
  assert.deepEqual(Sch.weekRange(new Date(2026, 10, 16)), { from: '16.11.2026', to: '22.11.2026' });
  assert.equal(Sch.isoWeek(new Date(2026, 10, 21)), 47);
});

test('filter dňa rešpektuje paritu, voľný deň a výber skupín', () => {
  const p = parsed();
  const parnyPondelok = new Date(2026, 10, 23);
  const neparnyPiatok = new Date(2026, 10, 20);
  const utorok = new Date(2026, 10, 17);
  assert.equal(Sch.isEventActive(p.events[0], p.notes, parnyPondelok, []), true);
  assert.equal(Sch.isEventActive(p.events[0], p.notes, neparnyPiatok, []), false);
  assert.equal(Sch.isEventActive(p.events[3], p.notes, utorok, []), false);
  assert.equal(Sch.isEventActive(p.events[1], p.notes, new Date(2026, 10, 16), ['1B-RK4']), true);
  assert.equal(Sch.isEventActive(p.events[1], p.notes, new Date(2026, 10, 16), ['2A']), false);
  assert.equal(Sch.isEventActive(p.events[2], p.notes, new Date(2026, 10, 16), []), true);
});

test('vlastné ID sa nájde v odkaze aj vo fotke a musí sedieť', () => {
  const html = '<a href="../lide/clovek.pl?id=150164">Ja</a><img src="../foto.pl?id=150164"><img src="../foto.pl?id=900001">';
  assert.equal(globalThis.BU.notif.studentIdFromHtml(html), '150164');
  assert.equal(globalThis.BU.notif.photoId('../foto.pl?id=900001'), '900001');
  assert.equal(globalThis.BU.notif.pickOwnPhoto(['../foto.pl?id=900001', '../foto.pl?id=150164'], '150164'), '../foto.pl?id=150164');
});
