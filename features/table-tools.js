(function () {
  'use strict';
  const BU = self.BU || window.BU;
  if (!BU || !BU.features) return;
  const TT_EXCLUDE = '#bu-ctl, #bu-dialog, #bu-palette, .bu-pop, #uisFixedBox, #uisFloatingBox, .ui-dialog, .bu-keep';
  function offNow(state) {
    if (!state || !state.enabled) return true;
    try { return (state.disabledPages || []).includes(location.pathname); } catch (e) { return false; }
  }
  BU.features.register({
    name: 'table-tools', frames: 'all', cost: 'light',
    run(state) {
      if (typeof document === 'undefined' || offNow(state)) return;
      function tableTools() {
        if (offNow()) return;
        document.querySelectorAll('table').forEach((table) => {
          if (table.dataset.buTt) return;
          const ths = [...table.querySelectorAll('th')];
          if (!ths.length) return;
          const tbody = table.tBodies[0];
          if (!tbody) return;
          const sortable = [...tbody.rows].filter((r) => !r.querySelector('th'));   // riadky s <th> (hlavička v tbody) sa nehýbu
          if (sortable.length < 2) return;
          if (BU.notif.hasFormControls([table.outerHTML])) return;       // = pravidlo hasFormControls (testované v node)
          if (table.closest(TT_EXCLUDE)) return;
          table.dataset.buTt = '1';
          table.classList.add('bu-tt-table');
      
          const cellText = (row, col) => (row.cells[col] ? row.cells[col].textContent.trim() : '');
          ths.forEach((th) => {
            const col = th.cellIndex;
            th.dataset.buLabel = th.textContent.trim();      // čistý text hlavičky pre CSV (indikátor by ho znečistil)
            th.title = BU.t('ttSort');
            const ind = document.createElement('span');
            ind.className = 'bu-tt-ind';
            th.appendChild(ind);
            th.addEventListener('click', () => {
              ths.forEach((o) => {                            // iné stĺpce sa vynulujú
                if (o !== th) { o.dataset.buState = '0'; const s = o.querySelector('.bu-tt-ind'); if (s) s.textContent = ''; }
              });
              const state = (Number(th.dataset.buState || 0) + 1) % 3;   // pôvodné → vzostupne → zostupne → pôvodné
              th.dataset.buState = String(state);
              ind.textContent = state === 1 ? '▲' : state === 2 ? '▼' : '';
              const order = sortable.slice();
              if (state === 1) order.sort((r1, r2) => BU.notif.compareCells(cellText(r1, col), cellText(r2, col)));
              else if (state === 2) order.sort((r1, r2) => BU.notif.compareCells(cellText(r2, col), cellText(r1, col)));
              order.forEach((r) => tbody.appendChild(r));     // appendChild = presun; listener na th zotrvá
            });
          });
      
          if (sortable.length > 15) {
            const host = document.createElement('div');
            host.className = 'bu-tt';
            table.before(host);
            host.appendChild(table);
            const bar = document.createElement('div');
            bar.className = 'bu-tt-bar';
            const inp = document.createElement('input');
            inp.type = 'search';
            inp.className = 'bu-tt-filter';
            inp.placeholder = BU.t('ttFilter');
            const csvBtn = document.createElement('button');
            csvBtn.type = 'button';
            csvBtn.className = 'bu-tt-csv';
            csvBtn.textContent = 'CSV';
            bar.append(inp, csvBtn);
            host.insertBefore(bar, table);
            inp.addEventListener('input', () => {
              const q = BU.notif.stripDiacritics(inp.value).trim();
              [...tbody.rows].forEach((r) => {
                r.style.display = !q || BU.notif.stripDiacritics(r.textContent).includes(q) ? '' : 'none';
              });
            });
            csvBtn.addEventListener('click', async () => {
              const lines = [BU.notif.toCsv(ths.map((t) => t.dataset.buLabel || ''))];
              [...tbody.rows].filter((r) => r.style.display !== 'none' && !r.querySelector('th'))
                .forEach((r) => lines.push(BU.notif.toCsv([...r.cells].map((c) => c.textContent.trim()))));
              const ok = await BU.copyText(lines.join('\r\n'));
              BU.toast(ok ? BU.t('csvOk') : BU.t('copyFail'));
            });
          }
        });
      }
    },
  });
})();
