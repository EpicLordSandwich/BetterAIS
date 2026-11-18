(function () {
  'use strict';
  const BU = self.BU || window.BU;
  if (!BU || !BU.features) return;
  function offNow(state) {
    if (!state || !state.enabled) return true;
    try { return (state.disabledPages || []).includes(location.pathname); } catch (e) { return false; }
  }
  function sameOrigin(u) { try { return new URL(u, location.origin).origin === location.origin; } catch (e) { return false; } }
  const GRADES_PATH = '/auth/student/pruchod_studiem.pl';
  function gradeCellText(cell) {
    const t = (cell.textContent || '').replace(/\s+/g, ' ').trim();
    if (t) return t;
    const icon = cell.querySelector('[data-sysid]');   // povinnosť je ikona, text nesie title/aria-label
    return icon ? String(icon.getAttribute('title') || icon.getAttribute('aria-label') || '').trim() : '';
  }
  function gradeCell(cell) {
    const a = cell.querySelector('a[href]');
    return { text: gradeCellText(cell), href: a && sameOrigin(a.href) ? a.getAttribute('href') || '' : '' };
  }
  function gradesStat(value, label) {
    const box = document.createElement('div');
    box.className = 'bu-grades-stat';
    const b = document.createElement('b'); b.textContent = value;
    const s = document.createElement('span'); s.textContent = label;
    box.append(b, s);
    return box;
  }
  // Slovenské množné číslo: 1 / 2–4 / 5+.
  function buPlural(n, one, few, many) { return n === 1 ? one : (n >= 2 && n <= 4 ? few : many); }
  function gradePeriod(table) {
    let el = table.previousElementSibling;
    for (let i = 0; el && i < 8; i++, el = el.previousElementSibling) {
      if (!/^(B|STRONG|H2|H3|H4)$/.test(el.tagName)) continue;
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (/\b\d{4}\/\d{4}\b/.test(t)) return t.replace(/:$/, '');
    }
    return '';
  }
  function periodHeading(table) {
    let el = table.previousElementSibling;
    for (let i = 0; el && i < 8; i++, el = el.previousElementSibling) {
      if (!/^(B|STRONG|H2|H3|H4)$/.test(el.tagName)) continue;
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (/\b\d{4}\/\d{4}\b/.test(t)) return el;
    }
    return null;
  }
  function collectGrades() {
    const out = [];
    let firstTable = null;
    document.querySelectorAll('table').forEach((table) => {
      if (table.closest(TT_EXCLUDE)) return;
      const headerRow = (table.tHead && table.tHead.rows[0]) || table.rows[0];
      if (!headerRow) return;
      const header = [...headerRow.cells].map((c) => c.textContent || '');
      if (!BU.grades.isGradeHeader(header)) return;
      if (!header.some((h) => BU.grades.norm(h) === 'pokus')) return;   // len podrobné tabuľky, nie súhrny
      if (!firstTable) firstTable = table;
      const body = table.tBodies[0] || table;
      const rows = [...body.rows]
        .filter((r) => !r.querySelector('th'))
        .map((r) => [...r.cells].map(gradeCell));
      out.push(...BU.grades.parseTable(header, rows, gradePeriod(table)));
    });
    return { grades: out, firstTable };
  }
  BU.features.register({
    name: 'grades-dashboard', frames: 'top', cost: 'light',
    run(state) {
      if (typeof document === 'undefined' || offNow(state)) return;
      if (window.top !== window) return;
      if (!(state && state.grades && state.grades.on)) return;
      if (!location.pathname.includes('pruchod_studiem')) return;
      function gradesDashboard() {
        if (!isTop || offNow()) return;
        const enabled = !state.grades || state.grades.on !== false;
        const existing = document.getElementById('bu-grades');
        if (!enabled) { if (existing) existing.remove(); return; }
        if (location.pathname.replace(/\/+$/, '') !== GRADES_PATH) { if (existing) existing.remove(); return; }
        const collected = collectGrades();
        const grades = collected.grades;
        if (!grades.length) { if (existing) existing.remove(); return; }
        const sum = BU.grades.summarize(grades, state.grades && state.grades.requiredCredits);
        const sig = JSON.stringify({ r: (state.grades && state.grades.requiredCredits) || 0, e: sum.earnedCredits, a: sum.average, c: sum.counts, f: sum.failed.map((g) => g.code), p: sum.periods });
        if (existing && existing.dataset.sig === sig) return;
        if (existing) existing.remove();
        const host = document.createElement('section');
        host.id = 'bu-grades';
        host.dataset.sig = sig;
      
        const head = document.createElement('div');
        head.className = 'bu-grades-head';
        const h = document.createElement('h2'); h.textContent = 'Prehľad hodnotení';
        const badge = document.createElement('span'); badge.className = 'bu-grades-badge'; badge.textContent = 'neoficiálny prepočet';
        head.append(h, badge);
        host.appendChild(head);
      
        const stats = document.createElement('div');
        stats.className = 'bu-grades-stats';
        stats.append(
          gradesStat(String(sum.earnedCredits), buPlural(sum.earnedCredits, 'získaný kredit', 'získané kredity', 'získaných kreditov')),
          gradesStat(BU.grades.formatAverage(sum.average), 'vážený priemer'),
          gradesStat(String(sum.subjectCount), buPlural(sum.subjectCount, 'predmet s výsledkom', 'predmety s výsledkom', 'predmetov s výsledkom')),
          gradesStat(String(sum.failedCount), buPlural(sum.failedCount, 'aktuálne neúspešný', 'aktuálne neúspešné', 'aktuálne neúspešných'))
        );
        host.appendChild(stats);
      
        if (sum.progress != null) {
          const req = Number(state.grades.requiredCredits) || 0;
          const goal = document.createElement('div');
          goal.className = 'bu-grades-goal';
          const bar = document.createElement('div'); bar.className = 'bu-grades-progress';
          const fill = document.createElement('span'); fill.style.width = sum.progress.toFixed(1) + '%';
          bar.appendChild(fill);
          const label = document.createElement('small');
          label.textContent = sum.earnedCredits + ' / ' + req + ' ' + buPlural(req, 'kredit', 'kredity', 'kreditov') + ' (' + Math.round(sum.progress) + ' %)';
          goal.append(bar, label);
          host.appendChild(goal);
        }
      
        const total = sum.counts.A + sum.counts.B + sum.counts.C + sum.counts.D + sum.counts.E + sum.counts.FX + sum.counts.Z;
        if (total) {
          const dist = document.createElement('div');
          dist.className = 'bu-grades-dist';
          const bar = document.createElement('div'); bar.className = 'bu-grades-bar';
          const chips = document.createElement('div'); chips.className = 'bu-grades-chips';
          ['A', 'B', 'C', 'D', 'E', 'FX', 'Z'].forEach((letter) => {
            const n = sum.counts[letter];
            if (!n) return;
            const seg = document.createElement('span');
            seg.className = 'bu-grades-seg bu-g-' + letter.toLowerCase();
            seg.style.width = (n / total * 100).toFixed(2) + '%';
            seg.title = letter + ': ' + n;
            bar.appendChild(seg);
            const chip = document.createElement('span');
            chip.className = 'bu-grades-chip bu-g-' + letter.toLowerCase();
            chip.textContent = letter + ' ' + n;
            chips.appendChild(chip);
          });
          dist.append(bar, chips);
          host.appendChild(dist);
        }
      
        if (sum.failed.length) {
          const box = document.createElement('div');
          box.className = 'bu-grades-fails';
          const title = document.createElement('b');
          title.textContent = 'Aktuálne neúspešné predmety';
          const ul = document.createElement('ul');
          sum.failed.slice(0, 8).forEach((gr) => {
            const li = document.createElement('li');
            if (gr.href) {
              const a = document.createElement('a'); a.href = gr.href; a.textContent = gr.code || gr.subject;
              li.appendChild(a);
              li.appendChild(document.createTextNode(' - ' + gr.subject));
            } else {
              li.textContent = (gr.code || gr.subject) + (gr.code ? ' - ' + gr.subject : '');
            }
            li.appendChild(document.createTextNode(' (' + gr.result.letter + (gr.date ? ', ' + gr.date : '') + ')'));
            ul.appendChild(li);
          });
          box.append(title, ul);
          host.appendChild(box);
        }
      
        const note = document.createElement('p');
        note.className = 'bu-grades-note';
        note.textContent = 'Počíta sa len z tabuliek na tejto stránke' +
          (sum.periods.length ? ' (' + sum.periods.length + ' ' + buPlural(sum.periods.length, 'obdobie', 'obdobia', 'období') + ')' : '') +
          '. Pre opakovaný predmet sa počíta posledný výsledok; predmety bez známky sa nezahŕňajú. Oficiálne štatistiky ostávajú v UIS.';
        host.appendChild(note);
      
        const heading = periodHeading(collected.firstTable);
        if (heading && heading.parentNode) heading.parentNode.insertBefore(host, heading);
        else {
          const main = document.querySelector('.mainpage');
          if (main) main.prepend(host);
        }
      }
    },
  });
})();
