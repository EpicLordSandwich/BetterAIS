// betterUIS – dashboard hodnotení: čistá logika bez DOM a chrome.*,
// aby sa dala testovať v node (tools/tests/test-grades-core.mjs).
// Vstupom sú hlavička a riadky tabuľky E-indexu; výstupom predmety, súhrn a priemer.
// Je to neoficiálny prepočet – oficiálne štatistiky ostávajú na stránke UIS.
(function (g) {
  'use strict';

  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'FX', 'Z'];
  // Bodové ohodnotenie podľa bežného slovenského zvyku (A=1 … FX=4).
  // Pred použitím v UI sa zobrazuje upozornenie „neoficiálny prepočet“.
  const POINTS = { A: 1, B: 1.5, C: 2, D: 2.5, E: 3, FX: 4, Z: null };

  /** Normalizuje text pre porovnávanie: bez diakritiky, malé písmená, bez koncovej bodky. @param {string} s @returns {string} */
  function norm(s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/[.:]+$/, '');
  }

  /** Prevedie viditeľný výsledok UIS na známku a body. @param {string} text @returns {{letter:string, passed:boolean, points:number|null, label:string, text:string}|null} */
  function parseResult(text) {
    const raw = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    if (!raw) return null;
    let m = raw.match(/\(\s*(A|B|C|D|E|FX|Z)\s*\)/i);
    let letter = m ? m[1].toUpperCase() : null;
    if (!letter) {
      m = raw.match(/\b(A|B|C|D|E|FX|Z)\b/i);
      if (m) letter = m[1].toUpperCase();
    }
    if (!letter) return null;
    const points = Object.prototype.hasOwnProperty.call(POINTS, letter) ? POINTS[letter] : null;
    const label = raw.replace(/\s*\(\s*(?:A|B|C|D|E|FX|Z)\s*\)\s*$/i, '').trim();
    return { letter, passed: letter !== 'FX', points, label, text: raw };
  }

  const ALIASES = {
    kod: 'code', predmet: 'subject', povinnost: 'obligation', jaz: 'language',
    uk: 'completion', pokus: 'attempt', vysledok: 'result', zadane: 'date',
    zadal: 'examiner', kredity: 'credits', sposob: 'method', poznamka: 'note',
  };

  /** Z hlavičky spraví mapu stĺpcov; null ak chýba niektorý povinný stĺpec. @param {Array} header @returns {object|null} */
  function headerMap(header) {
    const map = {};
    (header || []).forEach((cell, i) => {
      const key = ALIASES[norm(cell)];
      if (key && map[key] === undefined) map[key] = i;
    });
    return ['code', 'subject', 'result', 'credits'].every((k) => map[k] !== undefined) ? map : null;
  }

  /** Je to hlavička tabuľky hodnotení (Kód/Predmet/Výsledok/Kredity)? @param {Array} header @returns {boolean} */
  function isGradeHeader(header) {
    return !!headerMap(header);
  }

  const text = (c) => (c && typeof c === 'object' ? c.text : c);
  const href = (c) => (c && typeof c === 'object' && typeof c.href === 'string' ? c.href : '');
  const clean = (c) => String(text(c) == null ? '' : text(c)).replace(/\s+/g, ' ').trim();
  function num(c) {
    const m = clean(c).match(/\d+/);
    return m ? Number(m[0]) : null;
  }

  /** Z jednej tabuľky vytvorí záznamy predmetov. Riadky bez výsledku sa preskočia. @param {Array} header @param {Array<Array>} rows @param {string} [period] @returns {Array<object>} */
  function parseTable(header, rows, period) {
    const map = headerMap(header);
    if (!map) return [];
    const out = [];
    for (const row of rows || []) {
      if (!row || !row.length) continue;
      const at = (key) => (map[key] === undefined ? '' : row[map[key]]);
      const result = parseResult(clean(at('result')));
      if (!result) continue;                       // zapísaný predmet bez známky sa do dashboardu nepočíta
      const code = clean(at('code'));
      const subject = clean(at('subject'));
      if (!code && !subject) continue;
      out.push({
        period: period || '',
        code,
        subject,
        href: href(at('subject')),
        obligation: clean(at('obligation')),
        language: clean(at('language')),
        completion: clean(at('completion')),
        attempt: clean(at('attempt')),
        result,
        date: clean(at('date')),
        examiner: clean(at('examiner')),
        credits: num(at('credits')),
        method: clean(at('method')),
      });
    }
    return out;
  }

  const dateMs = (d) => {
    const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(d || '').trim());
    return m ? Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : -Infinity;
  };

  /** Nechá pre každý predmet len najnovší pokus (podľa dátumu; pri zhode neskorší v poradí). @param {Array<object>} grades @returns {Array<object>} */
  function unique(grades) {
    const map = new Map();
    for (const gr of grades || []) {
      const key = norm(gr.code) || norm(gr.subject);
      if (!key) continue;
      const prev = map.get(key);
      if (!prev || dateMs(gr.date) >= dateMs(prev.date)) map.set(key, gr);
    }
    return [...map.values()];
  }

  /** Súhrn: kredity, vážený priemer, rozdelenie známok, neúspešné predmety a progres. @param {Array<object>} grades @param {number} [requiredCredits] @returns {object} */
  function summarize(grades, requiredCredits) {
    const uniq = unique(grades);
    const counts = { A: 0, B: 0, C: 0, D: 0, E: 0, FX: 0, Z: 0, other: 0 };
    const failed = [];
    let earnedCredits = 0, gradedCredits = 0, weighted = 0, missingCredits = 0;
    for (const gr of uniq) {
      const r = gr.result;
      if (!r) continue;
      if (Object.prototype.hasOwnProperty.call(counts, r.letter)) counts[r.letter]++;
      else counts.other++;
      const credits = Number.isFinite(gr.credits) ? gr.credits : null;
      if (!r.passed) {
        failed.push(gr);
        continue;
      }
      if (credits == null) { missingCredits++; continue; }
      earnedCredits += credits;                    // Z aj A–E získavajú kredity
      if (r.points != null) {
        gradedCredits += credits;                  // Z sa do priemeru nepočíta
        weighted += r.points * credits;
      }
    }
    const req = Number(requiredCredits);
    return {
      subjectCount: uniq.length,
      passedCount: counts.A + counts.B + counts.C + counts.D + counts.E + counts.Z,
      failedCount: counts.FX,
      counts,
      failed,
      earnedCredits,
      gradedCredits,
      average: gradedCredits > 0 ? weighted / gradedCredits : null,
      missingCredits,
      progress: Number.isFinite(req) && req > 0 ? Math.max(0, Math.min(100, earnedCredits / req * 100)) : null,
      periods: [...new Set(uniq.map((x) => x.period).filter(Boolean))],
    };
  }

  /** Priemer s desatinnou čiarkou (2,01); null → pomlčka. @param {number|null} n @returns {string} */
  function formatAverage(n) {
    return Number.isFinite(n) ? n.toFixed(2).replace('.', ',') : '–';
  }

  g.BU = g.BU || {};
  g.BU.grades = { LETTERS, POINTS, norm, parseResult, isGradeHeader, parseTable, unique, summarize, formatAverage };
  g.BUGRADES = g.BU.grades;   // alias pre staršie testy/konzolu
})(self);
