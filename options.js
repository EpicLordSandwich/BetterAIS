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
  function toast() { const t = $('toast'); t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1100); }
  function toastMsg(m) { $('toast').textContent = m; toast(); clearTimeout(toastResetT); toastResetT = setTimeout(() => { $('toast').textContent = 'Uložené'; }, 1600); }

  // Vždy základ z úložiska – nikdy neprepisujeme starými dátami v pamäti (stale-state).
  async function commit(patch) {
    const fresh = await BU.load();
    S = BU.normalize(Object.assign({}, fresh, patch));
    await BU.save(S);
    render(); toast();
  }
  const setCustom = (k, v) => commit({ custom: Object.assign({}, S.custom, { [k]: v }) });

  /* ================= témy (obchod) ================= */
  function renderStore(mode) {
    const store = $('store');
    store.innerHTML = '';
    const list = Object.entries(BU.THEMES).concat(Object.entries(S.customThemes || {}));
    list.forEach(([id, t]) => {
      const p = t[mode];
      const b = document.createElement('button');
      b.className = 'theme' + (S.theme === id ? ' on' : '');
      const pv = document.createElement('div'); pv.className = 'pv'; pv.style.background = p.bg;
      const bar = document.createElement('div'); bar.className = 'bar'; bar.style.background = p.bg0;
      [p.accent, p.border].forEach((c) => { const i = document.createElement('i'); i.style.background = c; bar.appendChild(i); });
      const body = document.createElement('div'); body.className = 'body';
      [0, 1].forEach(() => {
        const c = document.createElement('div'); c.className = 'c'; c.style.background = p.bg2; c.style.borderColor = p.border;
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
      b.onclick = () => commit({ theme: id });
      if (String(id).startsWith('c-')) {
        const del = document.createElement('button'); del.className = 'ghost del-theme'; del.textContent = '✕'; del.title = 'Odstrániť tému';
        del.onclick = (e) => {
          e.stopPropagation();
          const th = Object.assign({}, S.customThemes); delete th[id];
          commit(S.theme === id ? { customThemes: th, theme: 'classic' } : { customThemes: th });
        };
        meta.appendChild(del);
      }
      store.appendChild(b);
    });
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
     $('offCount').textContent = S.disabledPages.length ? '(' + S.disabledPages.length + ')' : '';

    $('nick').value = S.nick || '';

    $('gradesOn').checked = S.grades.on;
    $('gradesRequired').value = S.grades.requiredCredits || '';
    $('experimentalOn').checked = !!S.experimental;

    const pic = $('pic');
    const avStatus = $('avStatus');
    const urlInput = $('avUrlInput');
    let statusText = '';
    if (S.avatar.mode === 'custom') statusText = 'Vlastný obrázok' + (S.avatar.dataUrl ? '' : ' (ne nahraný)');
    else if (S.avatar.mode === 'url') statusText = 'Obrázok z URL' + (S.avatar.url ? '' : ' (nezadaná)');
    else statusText = avatarShot ? 'Pôvodná fotka z ISIC (snímka z poslednej návštevy AIS).' : 'Pôvodná fotka z ISIC, navštív AIS, aby sa uložila snímka do náhľadu.';
    pic.onerror = () => { pic.onerror = null; pic.src = 'icon48.png'; if (avStatus) avStatus.textContent = 'Obrázok sa nepodarilo načítať.'; };
    pic.src = S.avatar.mode === 'custom' && S.avatar.dataUrl ? S.avatar.dataUrl
      : S.avatar.mode === 'url' && S.avatar.url ? S.avatar.url
        : avatarShot || 'icon48.png';
    if (urlInput) { urlInput.hidden = S.avatar.mode !== 'url'; urlInput.value = S.avatar.url || ''; }
    if (avStatus) avStatus.textContent = statusText;
    // zvýrazni aktívny mód
    ['avUrl', 'avOrig', 'avUpload'].forEach((id) => { const b = $(id); if (b) b.classList.toggle('on', (id === 'avUrl' && S.avatar.mode === 'url') || (id === 'avOrig' && S.avatar.mode === 'original') || (id === 'avUpload' && S.avatar.mode === 'custom')); });
    renderLinks();
    renderSnippets();
  }

  /* ================= odkazy v lište ================= */
  const saveLinks = (links) => commit({ links });
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
      const edit = (patch) => saveLinks(S.links.map((x, k) => (k === i ? Object.assign({}, x, patch) : x)));
      sel.onchange = () => edit({ icon: sel.value });
      name.onchange = () => { if (name.value.trim()) edit({ name: name.value }); else render(); };
      url.onchange = () => { if (BU.cleanUrl(url.value)) edit({ url: BU.cleanUrl(url.value) }); else { toastMsg('Neplatná adresa'); url.value = l.url; } };   // render() sa pri zameranom inpute preskočí → vráť uloženú hodnotu explicitne (P1-9)
      cb.onchange = () => edit({ hideOriginal: cb.checked });
      const move = (d) => { const a = S.links.slice(); [a[i], a[i + d]] = [a[i + d], a[i]]; saveLinks(a); };
      up.onclick = () => move(-1); down.onclick = () => move(1);
      del.onclick = () => saveLinks(S.links.filter((_, k) => k !== i));
      row.append(sel, name, url, hide, up, down, del);
      box.appendChild(row);
    });
    const pre = $('presets');
    pre.innerHTML = '';
    BU.PRESETS.filter((p) => !S.links.some((l) => l.url === p.url)).forEach((p) => {
      const b = document.createElement('button'); b.className = 'ghost'; b.textContent = '+ ' + p.name;
      b.onclick = () => saveLinks(S.links.concat([BU.cleanLink(Object.assign({}, p, { id: BU.uid() }))]));
      pre.appendChild(b);
    });
  }
  $('addLink').onclick = () => saveLinks(S.links.concat([{ id: BU.uid(), name: 'Nový odkaz', url: '/', icon: 'link', hideOriginal: false }]));

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
      const edit = (patch) => commit({ snippets: S.snippets.map((x, k) => (k === i ? Object.assign({}, x, patch) : x)) });
      on.onchange = () => edit({ on: on.checked });
      name.onchange = () => edit({ name: name.value });
      css.onchange = () => edit({ css: css.value });
      del.onclick = () => commit({ snippets: S.snippets.filter((_, k) => k !== i) });
      row.append(on, name, css, del);
      box.appendChild(row);
    });
  }
  $('addSnippet').onclick = () => commit({ snippets: S.snippets.concat([{ id: BU.uid(), name: 'Nový snippet', css: '', on: true }]) });

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
      commit({ customThemes: Object.assign({}, S.customThemes, { [id]: v }), theme: id });
      toastMsg('Téma „' + v.name + '“ importovaná');
    } catch (err) { toastMsg('Neplatný súbor témy'); }
  };

  /* ================= zapínanie ================= */
  $('masterSwitch').onchange = (e) => commit({ enabled: e.target.checked });

  $('renameUis').checked = !!S.rename.uisToAis;
  $('renameUis').onchange = (e) => commit({ rename: { uisToAis: e.target.checked } });
  $('clearOff').onclick = () => commit({ disabledPages: [] });

  /* ================= dashboard hodnotení ================= */
  $('nick').value = S.nick || '';
  $('nick').onchange = (e) => commit({ nick: e.target.value });
  $('experimentalOn').checked = !!S.experimental;
  $('experimentalOn').onchange = (e) => commit({ experimental: e.target.checked });
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

  $('gradesRequired').onchange = (e) => {
    const n = Math.max(0, Math.min(400, Math.round(Number(e.target.value) || 0)));
    e.target.value = n || '';
    commit({ grades: Object.assign({}, S.grades, { requiredCredits: n }) });
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
          grades: s.grades,
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
  document.querySelectorAll('#mode button').forEach((b) => (b.onclick = () => commit({ mode: b.dataset.v })));
  BU.FONTS.forEach((f) => { const o = document.createElement('option'); o.value = f.value; o.textContent = f.label; $('fontSel').appendChild(o); });
  $('fontSel').onchange = (e) => setCustom('font', e.target.value);
  $('fontCustom').onchange = (e) => { const v = e.target.value.trim(); if (v) setCustom('font', v + ', system-ui, sans-serif'); else setCustom('font', ''); };
  $('accent').onchange = (e) => setCustom('accent', e.target.value);
  $('link').onchange = (e) => setCustom('link', e.target.value);
  $('radius').oninput = (e) => { $('radiusVal').textContent = e.target.value + ' px'; };
  $('radius').onchange = (e) => setCustom('radius', e.target.value);
  document.querySelectorAll('[data-reset]').forEach((b) => (b.onclick = () => setCustom(b.dataset.reset, '')));

  // profilovka
  $('avUrl').onclick = () => commit({ avatar: { mode: 'url', dataUrl: '', url: S.avatar.url || '' } });
  const avUrlInput = $('avUrlInput');
  if (avUrlInput) avUrlInput.addEventListener('change', () => commit({ avatar: { mode: 'url', dataUrl: '', url: avUrlInput.value.trim() } }));
  $('avOrig').onclick = () => commit({ avatar: { mode: 'original', dataUrl: '' } });
  $('avUpload').onclick = () => $('avFile').click();
  $('avFile').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const dataUrl = await fileToDataUrl(f);
    commit({ avatar: { mode: 'custom', dataUrl } });
    e.target.value = '';
  };
  function readAsDataURL(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); }); }
  async function fileToDataUrl(f) {
    if (f.type === 'image/gif' && f.size <= 2.5 * 1024 * 1024) return readAsDataURL(f);
    const bmp = await createImageBitmap(f);
    const size = 256, c = document.createElement('canvas');
    c.width = c.height = size;
    const s = Math.min(bmp.width, bmp.height);
    c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
    return c.toDataURL('image/webp', 0.9);
  }

  $('reset').onclick = () => { if (confirm('Obnoviť všetky nastavenia betterAIS?')) { S = BU.normalize(null); BU.save(S); render(); toast(); } };

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
