// betterAIS – nastavenia: témy, úpravy, profilovka, odkazy, snippety, zálohovanie.
(async function () {
  'use strict';
  if (!self.BU) throw new Error('betterAIS core not loaded (themes.js missing)');
  const $ = (id) => document.getElementById(id);

  let S = await BU.load();
  // Snímka pôvodnej ISIC fotky (uloží ju content script pri návšteve AIS, len lokálne).
  let avatarShot = '';
  try {
    const r = await chrome.storage.local.get('bu-avatar-shot');
    const v = r && r['bu-avatar-shot'];
    avatarShot = typeof v === 'string' ? v : (v && v.data) || '';
  } catch (e) { console.warn('betterAIS: avatar shot read failed', e); }

  let toastT, toastResetT;
  function toastMsg(m) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1400); clearTimeout(toastResetT); toastResetT = setTimeout(() => { t.textContent = 'Uložené'; }, 1800); }
  function markSaved(trigger) {
    const row = trigger && trigger.closest ? trigger.closest('.setting-row, .card') : null;
    const el = row && row.querySelector(':scope .save-status');
    if (!el) return;
    el.textContent = 'Uložené';
    clearTimeout(el._buTimer);
    el._buTimer = setTimeout(() => { el.textContent = ''; }, 1400);
  }

  const panels = [...document.querySelectorAll('.panel')];
  const navLinks = [...document.querySelectorAll('.nav a')];
  function route() {
    const id = location.hash.slice(1) || 'vzhlad';
    let found = false;
    panels.forEach((p) => { const on = p.id === id; p.classList.toggle('active', on); if (on) found = true; });
    if (!found && panels[0]) { panels[0].classList.add('active'); }
    navLinks.forEach((a) => {
      const on = a.getAttribute('href') === '#' + (found ? id : (panels[0] && panels[0].id));
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  window.addEventListener('hashchange', route);
  document.querySelectorAll('.setting-row').forEach((row) => {
    const info = row.querySelector('.setting-info');
    if (!info || info.querySelector('.save-status')) return;
    const s = document.createElement('span'); s.className = 'save-status'; s.setAttribute('aria-live', 'polite');
    info.appendChild(s);
  });
  route();

  // Vždy základ z úložiska – nikdy neprepisujeme starými dátami v pamäti (stale-state).
  async function commit(patch, trigger) {
    const fresh = await BU.load();
    S = BU.normalize(Object.assign({}, fresh, patch));
    await BU.save(S);
    render();
    markSaved(trigger);
  }
  const setCustom = (k, v, el) => commit({ custom: Object.assign({}, S.custom, { [k]: v }) }, el);

  /* ================= témy (obchod) ================= */
  function renderStore(mode) {
    const store = $('store');
    store.innerHTML = '';
    const groups = [
      { key: 'general', label: 'Všeobecné' },
      { key: 'stu', label: 'STU (fakulty)' },
      { key: 'pastel', label: 'Pastelové' },
      { key: 'fun', label: 'Špeciálne (retro a experimenty)' },
    ];
    const custom = Object.entries(S.customThemes || {}).map(([id, t]) => ({ id, t, group: 'custom' }));
    groups.forEach((g) => {
      const items = Object.entries(BU.THEMES).filter(([, t]) => (t.group || 'general') === g.key);
      if (!items.length) return;
      const det = document.createElement('details'); det.className = 'theme-group'; det.open = true;
      const sum = document.createElement('summary'); sum.textContent = g.label;
      det.appendChild(sum);
      const grid = document.createElement('div'); grid.className = 'grid-themes';
      items.forEach(([id, t]) => {
        const b = renderThemeBtnEl(id, t, mode);
        grid.appendChild(b);
      });
      det.appendChild(grid);
      store.appendChild(det);
    });
    if (custom.length) {
      const det = document.createElement('details'); det.className = 'theme-group'; det.open = true;
      const sum = document.createElement('summary'); sum.textContent = 'Importované';
      det.appendChild(sum);
      const grid = document.createElement('div'); grid.className = 'grid-themes';
      custom.forEach(({ id, t }) => { grid.appendChild(renderThemeBtnEl(id, t, mode)); });
      det.appendChild(grid);
      store.appendChild(det);
    }
  }
  function renderThemeBtnEl(id, t, mode) {
    const p = t[mode];
    const b = document.createElement('button');
      b.className = 'theme' + (S.theme === id ? ' on' : '');
      const pv = document.createElement('div'); pv.className = 'pv'; pv.style.background = p.bg;
      const bar = document.createElement('div'); bar.className = 'bar'; bar.style.background = p.bg0;
      [p.accent, p.border].forEach((c) => { const i = document.createElement('i'); i.style.background = c; bar.appendChild(i); });
      const body = document.createElement('div'); body.className = 'body';
      [0, 1].forEach(() => {
        const c = document.createElement('div'); c.className = 'c'; c.style.background = p.bg2; c.style.borderColor = p.border;
        if (t.group === 'fun') c.style.borderRadius = Math.min(t.radius, 8) + 'px';
        const bb = document.createElement('b'); bb.style.background = p.bg3;
        const s1 = document.createElement('span'); s1.style.background = p.text;
        const s2 = document.createElement('span'); s2.style.background = p.link; s2.style.width = '60%';
        c.append(bb, s1, s2); body.appendChild(c);
      });
      pv.append(bar, body);
      const meta = document.createElement('div'); meta.className = 'meta';
      const st = document.createElement('strong'); st.textContent = t.name;
      const sm = document.createElement('small'); sm.textContent = t.tagline + (String(id).startsWith('c-') ? ' (importovaná)' : '');
      meta.append(st, sm);
      b.append(pv, meta);
      b.onclick = () => commit({ theme: id }, b);
      if (String(id).startsWith('c-')) {
        const del = document.createElement('button'); del.className = 'ghost del-theme'; del.textContent = '✕'; del.title = 'Odstrániť tému';
        del.onclick = (e) => {
          e.stopPropagation();
          const th = Object.assign({}, S.customThemes); delete th[id];
          commit(S.theme === id ? { customThemes: th, theme: 'classic' } : { customThemes: th }, del);
        };
        meta.appendChild(del);
      }
      return b;
  }

  /* ================= render ================= */
  function render() {
    const out = BU.compute(S);
    BU.applyVars(out);
    document.querySelectorAll('#mode button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.mode));
    renderStore(out.mode);

    const t = BU.getTheme(S.theme, S.customThemes) || BU.THEMES.classic;
    const p = t[out.mode];
    $('accent').value = S.custom.accent || p.accent;
    $('link').value = S.custom.link || p.link;
    const r = S.custom.radius !== '' ? S.custom.radius : t.radius;
    $('radius').value = r; $('radiusVal').textContent = r + ' px';
    const known = BU.FONTS.find((f) => f.value === S.custom.font);
    $('fontSel').value = known ? known.value : '';
    $('fontCustom').value = known ? '' : S.custom.font;

    $('masterSwitch').checked = S.enabled;
    if ($('hideOperinfo')) $('hideOperinfo').checked = !!(S.ui && S.ui.hideOperinfo);
    if ($('aisLogo')) $('aisLogo').checked = !!(S.ui && S.ui.aisLogo);
    if ($('mailPreview')) $('mailPreview').checked = !!(S.ui && S.ui.mail);
    if ($('schedulePreview')) $('schedulePreview').checked = !!(S.ui && S.ui.schedule);
    if ($('todoPreview')) $('todoPreview').checked = !!(S.ui && S.ui.todo);
    if ($('colorblindSel')) $('colorblindSel').value = (S.ui && S.ui.colorblind) || 'off';
    if ($('scheduleView') && document.activeElement !== $('scheduleView')) $('scheduleView').value = (S.ui && S.ui.scheduleView) || 'compact';
    if ($('schedView') && document.activeElement !== $('schedView')) $('schedView').value = (S.ui && S.ui.schedView) || 'today';
    if ($('schedGroups') && document.activeElement !== $('schedGroups')) $('schedGroups').value = (S.ui && S.ui.schedGroups) || '';

    if (document.activeElement !== $('nick')) $('nick').value = S.nick || '';

    $('experimentalOn').checked = !!S.experimental;

    const pic = $('pic');
    const avStatus = $('avStatus');
    const urlInput = $('avUrlInput');
    let statusText = '';
    if (S.avatar.mode === 'custom') statusText = 'Vlastný obrázok' + (S.avatar.dataUrl ? '' : ' (nenahraný)');
    else if (S.avatar.mode === 'url') statusText = 'Obrázok z URL' + (S.avatar.url ? '' : ' (nezadaná)');
    else statusText = avatarShot ? 'Pôvodná fotka z ISIC (snímka z poslednej návštevy AIS).' : 'Pôvodná fotka z ISIC, navštív AIS, aby sa uložila snímka do náhľadu.';
    pic.referrerPolicy = 'no-referrer';
    pic.onerror = () => { pic.onerror = null; pic.src = 'icon128.png'; if (avStatus) avStatus.textContent = 'Obrázok sa nepodarilo načítať.'; };
    pic.src = S.avatar.mode === 'custom' && S.avatar.dataUrl ? S.avatar.dataUrl
      : S.avatar.mode === 'url' && S.avatar.url ? S.avatar.url
        : avatarShot || 'icon128.png';
    if (urlInput) { urlInput.hidden = S.avatar.mode !== 'url'; urlInput.value = S.avatar.url || ''; }
    if (avStatus) avStatus.textContent = statusText;
    // zvýrazni aktívny mód
    ['avUrl', 'avOrig', 'avUpload'].forEach((id) => { const b = $(id); if (b) b.classList.toggle('on', (id === 'avUrl' && S.avatar.mode === 'url') || (id === 'avOrig' && S.avatar.mode === 'original') || (id === 'avUpload' && S.avatar.mode === 'custom')); });
    renderLinks();
    renderSnippets();
  }

  /* ================= odkazy v lište ================= */
  const saveLinks = (links, el) => commit({ links }, el);
  function renderLinks() {
    const box = $('links');
    if (box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;   // neprepisuj počas písania
    box.innerHTML = '';
    if (!S.links.length) box.innerHTML = '<p class="muted">Zatiaľ žiadne odkazy.</p>';
    S.links.forEach((l, i) => {
      const row = document.createElement('div');
      row.className = 'lrow';
      const sel = document.createElement('select');
      Object.entries(BU.ICON_LABELS).forEach(([k, label]) => { const o = document.createElement('option'); o.value = k; o.textContent = label; sel.appendChild(o); });
      sel.value = l.icon;
      const name = document.createElement('input'); name.type = 'text'; name.value = l.name; name.placeholder = 'Názov'; name.maxLength = 40;
      const url = document.createElement('input'); url.type = 'text'; url.value = l.url; url.placeholder = '/auth/… alebo https://…';
      const hide = document.createElement('label'); hide.className = 'switch'; hide.title = 'Skryť rovnaký odkaz v kartách na hlavnej stránke';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = l.hideOriginal;
      hide.append(cb, document.createTextNode('Skryť pôvodný'));
      const up = document.createElement('button'); up.textContent = '↑'; up.disabled = i === 0; up.title = 'Posunúť doľava';
      const down = document.createElement('button'); down.textContent = '↓'; down.disabled = i === S.links.length - 1; down.title = 'Posunúť doprava';
      const del = document.createElement('button'); del.textContent = '✕'; del.className = 'ghost'; del.title = 'Odstrániť';
      const edit = (patch, el) => saveLinks(S.links.map((x, k) => (k === i ? Object.assign({}, x, patch) : x)), el);
      sel.onchange = () => edit({ icon: sel.value }, sel);
      name.onchange = () => { if (name.value.trim()) edit({ name: name.value }, name); else render(); };
      url.onchange = () => { if (BU.cleanUrl(url.value)) edit({ url: BU.cleanUrl(url.value) }, url); else { toastMsg('Neplatná adresa'); url.value = l.url; } };   // render() sa pri zameranom inpute preskočí → vráť uloženú hodnotu explicitne (P1-9)
      cb.onchange = () => edit({ hideOriginal: cb.checked }, cb);
      const move = (d) => { const a = S.links.slice(); [a[i], a[i + d]] = [a[i + d], a[i]]; saveLinks(a, d < 0 ? up : down); };
      up.onclick = () => move(-1); down.onclick = () => move(1);
      del.onclick = () => saveLinks(S.links.filter((_, k) => k !== i), del);
      row.append(sel, name, url, hide, up, down, del);
      box.appendChild(row);
    });
    const pre = $('presets');
    pre.innerHTML = '';
    BU.PRESETS.filter((p) => !S.links.some((l) => l.url === p.url)).forEach((p) => {
      const b = document.createElement('button'); b.className = 'ghost'; b.textContent = '+ ' + p.name;
      b.onclick = () => saveLinks(S.links.concat([BU.cleanLink(Object.assign({}, p, { id: BU.uid() }))]), b);
      pre.appendChild(b);
    });
  }
  $('addLink').onclick = () => saveLinks(S.links.concat([{ id: BU.uid(), name: 'Nový odkaz', url: '/', icon: 'link', hideOriginal: false }]), $('addLink'));

  /* ================= CSS snippety ================= */
  function renderSnippets() {
    const box = $('snippets');
    const ae = document.activeElement;
    if (box.contains(ae) && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT')) return;   // neprepisuj počas písania
    box.innerHTML = '';
    if (!S.snippets.length) box.innerHTML = '<p class="muted">Zatiaľ žiadne snippety.</p>';
    S.snippets.forEach((sn, i) => {
      const row = document.createElement('div');
      row.className = 'snip' + (sn.on ? ' on' : '');
      const on = document.createElement('input'); on.type = 'checkbox'; on.checked = sn.on; on.title = 'Zapnúť/vypnúť';
      const name = document.createElement('input'); name.type = 'text'; name.value = sn.name; name.placeholder = 'Názov snippetu'; name.maxLength = 60;
      const css = document.createElement('textarea'); css.value = sn.css; css.rows = 3; css.spellcheck = false;
      css.placeholder = 'CSS pre is.stuba.sk, napr.\n.rasp-tab { font-size: 13px }';
      const del = document.createElement('button'); del.textContent = '✕'; del.className = 'ghost'; del.title = 'Odstrániť';
      const edit = (patch, el) => commit({ snippets: S.snippets.map((x, k) => (k === i ? Object.assign({}, x, patch) : x)) }, el);
      on.onchange = () => edit({ on: on.checked }, on);
      name.onchange = () => edit({ name: name.value }, name);
      css.onchange = () => edit({ css: css.value }, css);
      del.onclick = () => commit({ snippets: S.snippets.filter((_, k) => k !== i) }, del);
      row.append(on, name, css, del);
      box.appendChild(row);
    });
  }
  $('addSnippet').onclick = () => commit({ snippets: S.snippets.concat([{ id: BU.uid(), name: 'Nový snippet', css: '', on: true }]) }, $('addSnippet'));

  /* ================= zálohovanie a import tém ================= */
  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  function readJson(f) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(f); });
  }
  $('exportCfg').onclick = () => { download('betteruis-nastavenia.json', JSON.stringify(S, null, 2)); toastMsg('Exportované'); };
  $('importCfg').onclick = () => $('cfgFile').click();
  $('cfgFile').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const obj = JSON.parse(await readJson(f));
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('not an object');
      if (!confirm('Import nahradí všetky aktuálne nastavenia betterAIS (témy, odkazy, snippety). Pokračovať?')) return;
      S = BU.normalize(obj);
      await BU.save(S);
      render(); toastMsg('Nastavenia importované');
    } catch (err) { toastMsg('Neplatný súbor s nastaveniami'); }
  };
  $('importTheme').onclick = () => $('themeFile').click();
  $('themeFile').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const v = BU.validateTheme(JSON.parse(await readJson(f)));
      if (!v) { toastMsg('Neplatný súbor témy (chýbajú farby colors.dark / colors.light)'); return; }
      const low = [];
      for (const [fg, bg] of [['text', 'bg'], ['text', 'bg2'], ['muted', 'bg'], ['muted', 'bg2'], ['link', 'bg'], ['link', 'bg2']]) {
        for (const mode of ['dark', 'light']) {
          const r = BU.contrastRatio(v[mode][fg], v[mode][bg]);
          if (r != null && r < 4.5) low.push(mode + ' ' + fg + '/' + bg + ' ' + r.toFixed(1) + ':1');
        }
      }
      if (low.length && !confirm('Téma „' + v.name + '“ nespĺňa WCAG kontrast 4,5:1 (' + low.slice(0, 3).join(', ') + (low.length > 3 ? '…' : '') + '). Importovať aj tak?')) return;
      const id = 'c-' + BU.uid();
      commit({ customThemes: Object.assign({}, S.customThemes, { [id]: v }), theme: id }, $('importTheme'));
      toastMsg('Téma „' + v.name + '“ importovaná');
    } catch (err) { toastMsg('Neplatný súbor témy'); }
  };

  /* ================= zapínanie ================= */
  $('masterSwitch').onchange = (e) => commit({ enabled: e.target.checked }, e.target);
  if ($('hideOperinfo')) $('hideOperinfo').onchange = (e) => commit({ ui: Object.assign({}, S.ui, { hideOperinfo: e.target.checked }) }, e.target);
  if ($('aisLogo')) $('aisLogo').onchange = (e) => commit({ ui: Object.assign({}, S.ui, { aisLogo: e.target.checked }) }, e.target);
  if ($('mailPreview')) $('mailPreview').onchange = (e) => commit({ ui: Object.assign({}, S.ui, { mail: e.target.checked }) }, e.target);
  if ($('schedulePreview')) $('schedulePreview').onchange = (e) => commit({ ui: Object.assign({}, S.ui, { schedule: e.target.checked }) }, e.target);
  if ($('todoPreview')) $('todoPreview').onchange = (e) => commit({ ui: Object.assign({}, S.ui, { todo: e.target.checked }) }, e.target);
  if ($('colorblindSel')) $('colorblindSel').onchange = (e) => commit({ ui: Object.assign({}, S.ui, { colorblind: e.target.value }) }, e.target);
  if ($('scheduleView')) $('scheduleView').onchange = (e) => commit({ ui: Object.assign({}, S.ui, { scheduleView: e.target.value }) }, e.target);
  if ($('schedView')) $('schedView').onchange = (e) => commit({ ui: Object.assign({}, S.ui, { schedView: e.target.value }) }, e.target);
  let groupsTimer;
  if ($('schedGroups')) $('schedGroups').oninput = (e) => {
    clearTimeout(groupsTimer);
    const el = e.target;
    groupsTimer = setTimeout(() => commit({ ui: Object.assign({}, S.ui, { schedGroups: el.value }) }, el), 300);
  };

  /* ================= prezývka ================= */
  let nickTimer;
  $('nick').addEventListener('input', (e) => {
    clearTimeout(nickTimer);
    const el = e.target;
    nickTimer = setTimeout(() => commit({ nick: el.value.trim() }, el), 300);
  });
  $('experimentalOn').checked = !!S.experimental;
  $('experimentalOn').onchange = (e) => commit({ experimental: e.target.checked }, e.target);
  function updateStatusText(info) {
    const el = $('updateStatus');
    if (!info) { el.textContent = 'Ešte neskontrolované.'; return; }
    if (info.status === 'off') { el.textContent = 'Experimentálny režim je vypnutý.'; $('updateLink').hidden = true; return; }
    if (info.status === 'error') { el.textContent = 'Kontrola zlyhala.'; $('updateLink').hidden = true; return; }
    const cur = info.current || (chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest().version : '?');
    const ver = info.version || cur;
    if (info.available) el.textContent = 'Dostupná nová verzia ' + ver + ' (aktuálna ' + cur + ').';
    else el.textContent = 'Máš najnovšiu verziu ' + cur + '.';
    const link = $('updateLink');
    if (info.available && info.url) { link.href = info.url; link.hidden = false; } else { link.hidden = true; }
  }
  (async () => { try { const r = await chrome.storage.local.get('bu-update'); updateStatusText(r && r['bu-update']); } catch (e) {} })();
  $('updateCheck').onclick = () => {
    $('updateStatus').textContent = 'Kontrolujem…';
    try {
      chrome.runtime.sendMessage({ type: 'bu-update-check' }, (r) => {
        if (chrome.runtime.lastError || !r) { $('updateStatus').textContent = 'Kontrola zlyhala.'; return; }
        updateStatusText(r);
      });
    } catch (e) { $('updateStatus').textContent = 'Kontrola zlyhala.'; }
  };

  /* ================= diagnostika (kópia pre bug report) ================= */
  const copyDiagBtn = $('copyDiag');
  if (copyDiagBtn) copyDiagBtn.onclick = async () => {
    const diag = {
      betterAIS: (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) ? chrome.runtime.getManifest().version : '?',
      browser: (navigator && navigator.userAgent) || '',
      language: (navigator && navigator.language) || '',
      viewport: (window.innerWidth || 0) + 'x' + (window.innerHeight || 0),
      time: new Date().toISOString(),
      settings: (function () {
        const s = S || {};
        return {
          theme: s.theme, mode: s.mode, enabled: s.enabled,
          linksCount: Array.isArray(s.links) ? s.links.length : 0,
          snippetsCount: Array.isArray(s.snippets) ? s.snippets.length : 0,
          disabledPagesCount: Array.isArray(s.disabledPages) ? s.disabledPages.length : 0,
          avatarMode: s.avatar && s.avatar.mode,
          customThemesCount: s.customThemes ? Object.keys(s.customThemes).length : 0,
        };
      })(),
    };
    const text = '=== betterAIS diagnostika ===\n' + JSON.stringify(diag, null, 2) +
      '\n\nPozn.: vlož aj výpis z Ctrl+Shift+U (stránka UIS) pre presnú štruktúru.';
    const ok = await BU.copyText(text);
    if ($('diagStatus')) $('diagStatus').textContent = ok ? 'Skopírované, vlož (Ctrl+V).' : 'Kopírovanie zlyhalo, skús Ctrl+C ručne.';
  };

  /* ================= zvyšné handlery ================= */
  document.querySelectorAll('#mode button').forEach((b) => (b.onclick = () => commit({ mode: b.dataset.v }, b)));
  BU.FONTS.forEach((f) => { const o = document.createElement('option'); o.value = f.value; o.textContent = f.label; $('fontSel').appendChild(o); });
  $('fontSel').onchange = (e) => setCustom('font', e.target.value, e.target);
  $('fontCustom').onchange = (e) => { const v = e.target.value.trim(); if (v) setCustom('font', v + ', system-ui, sans-serif', e.target); else setCustom('font', '', e.target); };
  $('accent').onchange = (e) => setCustom('accent', e.target.value, e.target);
  $('link').onchange = (e) => setCustom('link', e.target.value, e.target);
  $('radius').oninput = (e) => { $('radiusVal').textContent = e.target.value + ' px'; };
  $('radius').onchange = (e) => setCustom('radius', e.target.value, e.target);
  document.querySelectorAll('[data-reset]').forEach((b) => (b.onclick = () => setCustom(b.dataset.reset, '', b)));

  // profilovka
  $('avUrl').onclick = async () => {
    const inp = $('avUrlInput');
    if (inp) inp.hidden = false;
    await commit({ avatar: { mode: 'url', dataUrl: '', url: S.avatar.url || '', source: '', crop: null } }, inp);
    const i = $('avUrlInput');
    if (i) { i.value = S.avatar.url || ''; i.focus(); i.select(); }
  };
  const avUrlInput = $('avUrlInput');
  if (avUrlInput) {
    const saveUrl = () => { const v = avUrlInput.value.trim(); if (v) commit({ avatar: { mode: 'url', dataUrl: '', url: v, source: '', crop: null } }, avUrlInput); };
    avUrlInput.addEventListener('change', saveUrl);
    avUrlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveUrl(); avUrlInput.blur(); } });
  }
  $('avOrig').onclick = () => commit({ avatar: { mode: 'original', dataUrl: '', url: '', source: '', crop: null } }, $('avOrig'));
  if ($('avReloadShot')) $('avReloadShot').onclick = async () => {
    try { const r = await chrome.storage.local.get('bu-avatar-shot'); const v = r && r['bu-avatar-shot']; avatarShot = typeof v === 'string' ? v : (v && v.data) || ''; render(); toastMsg('Snímka obnovená'); } catch (e) { console.warn(e); }
  };
  $('avUpload').onclick = () => $('avFile').click();
  $('avFile').onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const dataUrl = await fileToDataUrl(f);
      commit({ avatar: { mode: 'custom', dataUrl, url: '', source: '', crop: null } }, $('avUpload'));
    } catch (err) {
      console.debug('betterAIS avatar upload failed', err);
      toastMsg('Obrázok sa nepodarilo načítať.');
    }
  };
  async function fileToDataUrl(f) {
    if (f.type === 'image/gif') return readAsDataURL(f);
    let bmp;
    try { bmp = await createImageBitmap(f); }
    catch (_) {
      bmp = await new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = rej;
        const r = new FileReader();
        r.onload = () => { img.src = r.result; };
        r.onerror = rej;
        r.readAsDataURL(f);
      });
    }
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const s = Math.min(bmp.width, bmp.height);
    c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
    return c.toDataURL('image/webp', 0.9);
  }
  function readAsDataURL(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); }); }

  $('reset').onclick = () => { if (confirm('Obnoviť všetky nastavenia betterAIS?')) { S = BU.normalize(null); BU.save(S); render(); toastMsg('Nastavenia obnovené'); } };

  // Zmeny z inde (content script, iné zariadenie cez sync) sa prejavia naživo.
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area === 'local' && ch['bu-avatar-shot'] && ch['bu-avatar-shot'].newValue) {
        const v = ch['bu-avatar-shot'].newValue;
        avatarShot = typeof v === 'string' ? v : (v && v.data) || '';
        render();
        return;
      }
      if (area === 'local' && ch[BU.KEY] && ch[BU.KEY].newValue) { S = BU.normalize(ch[BU.KEY].newValue); render(); }
    });
  }
  render();
})();
