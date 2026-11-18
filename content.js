// betterUIS – content script: téma, karty, menu, profilovka, vlastné odkazy v lište,
// CSS snippety, príkazová paleta (Ctrl+K), kill-switch a diagnostika.
//
// SÚBOR JE JEDEN IIFE ZÁMERNE (Chrome content script, bez bundlera):
//  - všetky funkcie zdieľajú S, ready, isTop a chrome.runtime v jednom scope;
//  - poradie načítania (themes.js → text-utils.js → grades.js → content.js) je
//    fixné v manifestoch a v package.ps1; rozdelenie by vyžadovalo zdieľaný
//    globálny stav a zvýšilo riziko poradia načítania bez build kroku;
//  - smoke-fixture.html overuje table-tools, paletu a umiestnenie ovládacích prvkov.
// Pri pridaní novej funkcie pridaj volanie do runLightContentPass / runHeavyDomScan
// a (ak treba) nový modul ako pure logic (viď grades.js) s testom v tools/tests/.
(function () {
  'use strict';
  if (!self.BU || !self.BU.notif) throw new Error('betterUIS core not loaded (themes.js/text-utils.js missing)');
  const BU = self.BU;
  const isTop = window.top === window;
  let lastCmd = 0;
  function cmdOnce() { const n = performance.now(); if (n - lastCmd < 300) return false; lastCmd = n; return true; }

  let S = BU.store.get();
  BU.store.subscribe((ns) => { S = ns; });
  let ready = false;
  let rawCardHtml = '';   // pôvodné HTML prvej karty (pre diagnostiku, kým ju nezmeníme)
  let snipStyle = null;

  /* ================= 0) Kill-switch (globálne / per-stránka) ================= */
  function pagePath() {
    try { if (!isTop && window.top.location.origin === location.origin) return window.top.location.pathname; } catch (e) { swallow(e); }
    return location.pathname;
  }
  function offNow() { return !S.enabled || S.disabledPages.includes(pagePath()); }
  function setOff(off) {
    const root = document.documentElement;
    if (off) {
      root.dataset.buOff = '1';
      for (const k of BU.varKeys()) root.style.removeProperty(k);
      root.style.removeProperty('--font');
      root.style.removeProperty('color-scheme');
      delete root.dataset.buMode;
      delete root.dataset.buFont;
    } else {
      delete root.dataset.buOff;
    }
  }
  function cacheOff() {
    try { localStorage.setItem('bu:off', JSON.stringify({ enabled: S.enabled, paths: S.disabledPages })); } catch (e) { swallow(e); }
  }

  /* ================= 1) Téma (bez blikania: cache v localStorage) ================= */
  try {
    const oc = JSON.parse(localStorage.getItem('bu:off') || 'null');
    const offEarly = !!(oc && (!oc.enabled || (oc.paths || []).includes(pagePath())));
    const c = JSON.parse(localStorage.getItem('bu:cache') || 'null');
    if (offEarly) setOff(true);
    else if (c) BU.applyVars(c);
  } catch (e) { swallow(e); }

  function applyTheme() {
    const out = BU.compute(S);
    BU.applyVars(out);
    try { localStorage.setItem('bu:cache', JSON.stringify(out)); } catch (e) { swallow(e); }
  }
  function applyAll() {
    const off = offNow();
    const wasOff = document.documentElement.dataset.buOff === '1';
    if (ready && off !== wasOff) { location.reload(); return; }   // kill-switch sa zmenil → čistý štart stránky
    if (off) { setOff(true); return; }
    setOff(false);
    applyTheme();
    applySnippets();
    // hustota kariet
    document.documentElement.dataset.buDensity = S.ui.cardDensity || 'compact';
    if (ready) runLightContentPass();
  }
  BU.load().then((s) => { BU.store.set(s); cacheOff(); applyAll(); });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local' || !ch[BU.KEY]) return;
    const nv = ch[BU.KEY].newValue;
    if (!nv) return;
    BU.store.set(BU.normalize(nv));
    cacheOff();
    applyAll();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { applyAll(); });

  /* ================= CSS snippety používateľa ================= */
  function applySnippets() {
    if (offNow()) return;
    const css = S.snippets.filter((x) => x.on && x.css).map((x) => BU.sanitizeCss(x.css)).join('\n');
    if (!snipStyle) {
      snipStyle = document.createElement('style');
      snipStyle.id = 'bu-snips';
      (document.head || document.documentElement).appendChild(snipStyle);
    }
    snipStyle.textContent = css;
  }

  /* ================= pomocné ================= */
  const svgIcon = (name) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + (BU.ICONS[name] || BU.ICONS.link) + '</svg>';

  /* Dialóg namiesto window.prompt */
  function buPrompt(label, value) {
    return new Promise((res) => {
      if (!isTop || !document.body) { res(window.prompt(label, value)); return; }  // núdzový fallback
      const w = document.createElement('div'); w.id = 'bu-dialog';
      const card = document.createElement('div'); card.className = 'bu-dialog-card';
      const l = document.createElement('label'); l.textContent = label;
      const input = document.createElement('input'); input.type = 'text'; input.value = value || '';
      const btns = document.createElement('div'); btns.className = 'bu-dialog-btns';
      const ok = document.createElement('button'); ok.textContent = BU.t('ok');
      const no = document.createElement('button'); no.className = 'ghost'; no.textContent = BU.t('cancel');
      btns.append(no, ok); card.append(l, input, btns); w.appendChild(card);
      let settled = false;
      const done = (v) => { if (settled) return; settled = true; w.remove(); document.removeEventListener('keydown', esc, true); res(v); };
      ok.onclick = () => done(input.value.trim());
      no.onclick = () => done(null);
      w.addEventListener('mousedown', (e) => { if (e.target === w) done(null); });
      const esc = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(null); } };
      document.addEventListener('keydown', esc, true);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(input.value.trim()); } });
      document.body.appendChild(w);
      input.focus(); input.select();
    });
  }

  /* ================= 2) Karty hlavného menu (.menu-drzak) ================= */
  // Najmenší obal, ktorý obsahuje presne ten istý text (aby sme pri presune nezobrali niečo navyše).
  /* ================= 3) Vlastné odkazy v lište ================= */
  function sameOrigin(u) { try { return new URL(u, location.origin).origin === location.origin; } catch (e) { return false; } }

  function scanPopups() {
    if (!isTop || document.hidden) return;              // ťažké skeny len v hlavnom frame (P0-3)
    const t0 = performance.now();
    const header = document.getElementById('header');
    const hr = header ? header.getBoundingClientRect() : null;
    for (const el of document.querySelectorAll('div, ul, nav, section, aside, table')) {
      if (performance.now() - t0 > 8) break;            // časový rozpočet 8 ms (P0-3)
      if (el.dataset.buPop || !el.offsetWidth || !el.offsetHeight) continue;
      if (el === header || (header && el.contains(header))) continue;
      if (el.closest(POP_SKIP)) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== 'absolute' && cs.position !== 'fixed') continue;
      if (cs.visibility !== 'visible' || Number(cs.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 100 || r.height < 40) continue;
      if (r.width > innerWidth * 0.95 && r.height > innerHeight * 0.9) continue;     // celostránkové pozadie
      if (!el.querySelector('a, button, input, li')) continue;
      const z = parseInt(cs.zIndex, 10);
      if (header && header.contains(el)) {                                          // v hlavičke len to, čo z nej vyčnieva (menu)
        if (!(r.top >= hr.bottom - 12 || r.height > hr.height + 40)) continue;
      } else if (!(z > 0) && cs.position !== 'fixed') continue;
      if (el.parentElement && el.parentElement.closest('[data-bu-pop]')) continue;   // vnorené v už označenom
      el.dataset.buPop = '1';
      el.classList.add('bu-pop');
    }
  }
  let popTimer, lastHover = 0;
  function schedulePopups() {
    clearTimeout(popTimer);
    [40, 250, 700].forEach((d) => setTimeout(scanPopups, d));
  }
  document.addEventListener('click', schedulePopups, true);
  document.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') schedulePopups(); }, true);
  document.addEventListener('mouseover', (e) => {
    const now = Date.now();
    if (now - lastHover < 400 || !(e.target.closest && e.target.closest('#header, nav, [class*="menu"], [class*="drop"]'))) return;
    lastHover = now; schedulePopups();
  }, true);

  /* ================= 7) Sémantické farby UIS (rozhodne nemeníme) =================
      Elementy so sýtou inline farbou/bgcolor (chyby, stavy, rozvrh) dostanú .bu-keep
      a základný CSS ich nechá v pôvodných farbách. */
  // Sémantické farby UIS: detekcia sýtých inline farieb – pure logika v BU.notif (parseCol, isSaturated).
  /* ================= 8) Diagnostika (Alt+Shift+D = výpis, Alt+Shift+I = vybrať prvok) ================= */
  /* Redakcia citlivých údajov (osobné číslo, ISIC fotka…) pred kopírovaním von –
     pravidlá sú v text-utils.js (testované v node). Voláme priamo BU.notif.redactText. */
  function slim(el, max) {
    const c = el.cloneNode(true);
    c.querySelectorAll('script, style, noscript').forEach((n) => n.remove());
    c.querySelectorAll('svg').forEach((s) => { const e = document.createElement('svg'); const k = s.getAttribute('class'); if (k) e.setAttribute('class', k); s.replaceWith(e); });
    const keep = ['class', 'id', 'href', 'src', 'role', 'aria-label', 'title', 'type', 'data-dd', 'onclick', 'style'];
    [c, ...c.querySelectorAll('*')].forEach((n) => {
      [...n.attributes].forEach((a) => {
        if (!keep.includes(a.name)) n.removeAttribute(a.name);
        else if (a.value.startsWith('data:')) n.setAttribute(a.name, 'data:…');
        else if (a.value.length > 100) n.setAttribute(a.name, a.value.slice(0, 100) + '…');
      });
    });
    let h = BU.notif.redactText(c.outerHTML.replace(/\s+/g, ' ').replace(/> </g, '><'));
    if (h.length > max) h = h.slice(0, max) + ' …[skrátené]';
    return h;
  }
  function describe(el) {
    const cs = getComputedStyle(el);
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') +
      ' [pos=' + cs.position + ' z=' + cs.zIndex + ' bg=' + cs.backgroundColor + ' disp=' + cs.display + ']';
  }
  async function dump() {
    const parts = ['=== betterUIS dump ===', 'URL: ' + BU.notif.redactText(location.pathname + location.search), 'Viewport: ' + innerWidth + 'x' + innerHeight, ''];
    parts.push('--- KARTA (pôvodné HTML) ---', rawCardHtml || '(na tejto stránke nie je .menu-drzak)', '');
    if (window.__buTagStats) parts.push('--- tagCards stats ---', JSON.stringify(window.__buTagStats), '');
    const header = document.getElementById('header');
    parts.push('--- #header ---', header ? slim(header, 5000) : '(nenájdený)', '');
    const nav = document.querySelector('nav[aria-label="breadcrumb"]');
    parts.push('--- breadcrumb ---', nav ? slim(nav, 3000) : '(nenájdený)', '');
    scanPopups();
    const pops = [...document.querySelectorAll('.bu-pop')].filter((e) => e.offsetWidth && e.offsetHeight);
    parts.push('--- VIDITEĽNÉ MENU / POPUPY (' + pops.length + ') ---');
    pops.slice(0, 4).forEach((p) => parts.push(describe(p), slim(p, 5000), ''));
    const ok = await BU.copyText(parts.join('\n'));
    if (!ok) {
      const ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px;';
      const ta = document.createElement('textarea');
      ta.value = parts.join('\n');
      ta.style.cssText = 'width:min(90vw,800px);height:70vh;font:12px/1.4 monospace;padding:10px;border:0;border-radius:8px;';
      ta.readOnly = true;
      ov.appendChild(ta);
      ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
      document.body.appendChild(ov);
      ta.focus(); ta.select();
      BU.toast(BU.t('copyFail'));
    } else BU.toast(BU.t('dumped'));
  }

  let picking = false;
  function startPicker() {
    if (picking || !isTop) return;
    picking = true;
    const box = document.createElement('div');
    box.id = 'bu-pick';
    document.body.appendChild(box);
    BU.toast(BU.t('pickHint'));
    let target = null;
    const move = (e) => {
      target = document.elementFromPoint(e.clientX, e.clientY);
      if (!target || target === box) return;
      const r = target.getBoundingClientRect();
      Object.assign(box.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    };
    const stop = () => {
      picking = false; box.remove();
      document.removeEventListener('mousemove', move, true);
      document.removeEventListener('mousedown', block, true);
      document.removeEventListener('click', pick, true);
      document.removeEventListener('keydown', esc, true);
    };
    const block = (e) => { e.preventDefault(); e.stopPropagation(); };
    const pick = async (e) => {
      block(e);
      const el = target || e.target;
      stop();
      const chain = [];
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) chain.push(describe(n));
      const text = '=== betterUIS: vybraný prvok ===\nURL: ' + BU.notif.redactText(location.pathname + location.search) +
        '\n--- predkovia (od vnútra von) ---\n' + chain.slice(0, 12).join('\n') + '\n--- HTML ---\n' + slim(el, 6000);
      BU.toast((await BU.copyText(text)) ? BU.t('picked') : BU.t('copyFail'));
    };
    const esc = (e) => { if (e.key === 'Escape') { block(e); stop(); } };
    document.addEventListener('mousemove', move, true);
    document.addEventListener('mousedown', block, true);
    document.addEventListener('click', pick, true);
    document.addEventListener('keydown', esc, true);
  }
  // príkazy z manifestu (premapovateľné v chrome://extensions/shortcuts) + Alt+Shift fallback
  chrome.runtime.onMessage.addListener((m, sender) => {
    if (!m || typeof m !== 'object' || sender.id !== chrome.runtime.id) return;
    if (m.type === 'bu-cmd') {
      if (!isTop) return;
      if (m.name === 'pick') startPicker();
      else if (m.name === 'toggle-mode') {
        if (!cmdOnce()) return;
        const next = BU.resolveMode(S.mode) === 'dark' ? 'light' : 'dark';
        BU.store.set(BU.normalize(Object.assign({}, S, { mode: next })))
        applyAll(); BU.save(BU.store.get());
      } else { if (!cmdOnce()) return; dump(); }
    }
  });
  document.addEventListener('keydown', (e) => {
    if (!isTop || !e.altKey || !e.shiftKey) return;
    if (e.code === 'KeyD') { e.preventDefault(); dump(); }
    else if (e.code === 'KeyI') { e.preventDefault(); startPicker(); }
  }, true);
  // manuálna záloha skratiek (Chrome niekedy nepriradí default)
  document.addEventListener('keydown', (e) => {
    if (!isTop) return;
    if (e.ctrlKey && e.shiftKey && !e.altKey && e.code === 'KeyU') { e.preventDefault(); dump(); }
    else if (e.ctrlKey && e.shiftKey && !e.altKey && e.code === 'KeyY') { e.preventDefault(); startPicker(); }
    else if (e.ctrlKey && e.shiftKey && !e.altKey && e.code === 'KeyM') {
      e.preventDefault();
      const next = BU.resolveMode(S.mode) === 'dark' ? 'light' : 'dark';
      BU.store.set(BU.normalize(Object.assign({}, S, { mode: next })))
      applyAll(); BU.save(BU.store.get());
    }
  }, true);

  /* ================= 9) Príkazová paleta (Ctrl+K) ================= */
  function buildIndex() {
    const out = [];
    S.links.forEach((l) => out.push({ label: l.name, href: l.url, grp: BU.t('myLinks') }));
    document.querySelectorAll('.bu-card').forEach((card) => {
      const head = card.querySelector('.bu-card-head');
      const grp = head ? head.textContent.trim().replace(/\s+/g, ' ').slice(0, 30) : '';
      card.querySelectorAll('a[href]').forEach((a) => {
        const label = a.textContent.trim().replace(/\s+/g, ' ');
        if (label) out.push({ label, href: a.href, grp });
      });
    });
    return out;
  }
  // Fuzzy hľadanie beží cez notif-core (bez diakritiky: „skusky“ nájde „Skúšky“).
  function markLabel(label, q) {
    const span = document.createElement('span');
    const needle = BU.notif.stripDiacritics(q || '').trim();
    const stripped = BU.notif.stripDiacritics(label);
    const i = needle ? stripped.indexOf(needle) : -1;
    if (i < 0) { span.textContent = label; return span; }
    // Mapovanie indexu v stripped → index kódového bodu v originále (diakritika mení dĺžku len v NFD).
    const cps = [...label];
    const map = [];
    let sj = 0;
    cps.forEach((ch, oi) => {
      const st = BU.notif.stripDiacritics(ch);
      for (let k = 0; k < st.length; k++) map[sj++] = oi;
    });
    const start = map[i] || 0;
    const end = (map[i + needle.length - 1] != null ? map[i + needle.length - 1] : cps.length - 1) + 1;
    span.append(document.createTextNode(cps.slice(0, start).join('')));
    const m = document.createElement('mark'); m.textContent = cps.slice(start, end).join('');
    span.append(m, document.createTextNode(cps.slice(end).join('')));
    return span;
  }
  function navigateTo(href) {
    try {
      const u = new URL(href, location.href);
      if (u.origin === location.origin) location.href = u.href;
      else window.open(u.href, '_blank', 'noopener');
    } catch (e) { swallow(e); }
  }
  function palette() {
    if (!isTop || offNow()) return;
    const ex = document.getElementById('bu-palette');
    if (ex) { ex.remove(); return; }
    const items = buildIndex();
    const w = document.createElement('div'); w.id = 'bu-palette';
    const input = document.createElement('input'); input.placeholder = BU.t('searchPh');
    const ul = document.createElement('ul');
    const hint = document.createElement('div'); hint.className = 'bu-pal-hint';
    hint.textContent = BU.t('palEnter') + '  ·  ' + BU.t('palArrows') + '  ·  ' + BU.t('palEsc');
    w.append(input, ul, hint);
    (document.body || document.documentElement).appendChild(w);
    let sel = 0, shown = [];
    let closed = false;
    const close = () => { if (closed) return; closed = true; w.remove(); document.removeEventListener('keydown', keys, true); document.removeEventListener('mousedown', outside, true); };
    const outside = (e) => { if (!w.contains(e.target)) close(); };
    const render = () => {
      const q = input.value;
      shown = items.map((it) => ({ it, sc: Math.max(BU.notif.fuzzyScore(q, it.label), BU.notif.fuzzyScore(q, it.grp) * 0.5) }))
        .filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 12).map((x) => x.it);
      ul.textContent = '';
      if (!shown.length) {
        const li = document.createElement('li'); li.className = 'bu-pal-empty'; li.textContent = BU.t('noResults');
        ul.appendChild(li);
        return;
      }
      shown.forEach((it, i) => {
        const li = document.createElement('li');
        if (i === sel) li.classList.add('on');
        li.append(markLabel(it.label, q));
        if (it.grp) { const g = document.createElement('span'); g.className = 'bu-pal-grp'; g.textContent = it.grp; li.append(g); }
        li.onclick = () => { close(); navigateTo(it.href); };
        ul.appendChild(li);
      });
    };
    const keys = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, Math.max(shown.length - 1, 0)); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); render(); }
      else if (e.key === 'Enter') { e.preventDefault(); const h = shown[sel] && shown[sel].href; if (h) { close(); navigateTo(h); } }
    };
    input.addEventListener('input', () => { sel = 0; render(); });
    document.addEventListener('keydown', keys, true);
    // zatvorenie kliknutím mimo paletu (nie hneď, aby otvárací klik nezatvoril)
    setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
    render();
    input.focus();
  }
  document.addEventListener('keydown', (e) => {
    if (!isTop || !(e.ctrlKey || e.metaKey) || e.altKey || e.code !== 'KeyK') return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    e.preventDefault();
    palette();
  }, true);

  /* ================= 10) Staršie heuristiky (hlavička, boxy, logo) ================= */
  const parsePx = (v) => parseFloat(v) || 0;
  const hasBorder = (cs) => parsePx(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none' && cs.borderTopStyle !== 'hidden';
  /* ================= 11) Table-tools (zoradenie, filter, CSV) =================
     Len generické tabuľky: aspoň 2 dátové riadky a <th>. Tabuľky s formulárovými
     prvkami (prihlásenie na skúšky…) sa NESMÚ triediť, poradie riadkov je súčasť
     formulára. Pravidlo je testované v node ako BU.notif.hasFormControls; tu sa
     kontroluje rovnakým spôsobom cez DOM query. Marker data-bu-tt bráni slučke
     MutationObserver → init (opakovaná inicializácia by prekresľovala donekonečna). */
  const TT_EXCLUDE = '#bu-ctl, #bu-dialog, #bu-palette, .bu-pop, #uisFixedBox, #uisFloatingBox, .ui-dialog, .bu-keep';

  /* ================= 12) Dashboard hodnotení (E-index) =================
     Počíta len z tabuliek, ktoré sú práve na stránke. Oficiálne štatistiky
     UIS nechávame nedotknuté; panel je doplnok s viditeľnou značkou
     „neoficiálny prepočet“. Beží len v hlavnom frame a len na E-indexe. */
  /* ================= spúšťanie ================= */
  function runLightContentPass() { if (BU.features) BU.features.runAll("light"); }

  /* ================= prezývka v hlavičke ================= */
  /* ================= premenovanie UIS → AIS ================= */
  function runHeavyDomScan() {
    if (!isTop) return;   // ťažké skeny (hlavička, boxy, logo, popupy, sémantika) len v hlavnom frame (P0-3)
    scanPopups(); if (BU.features) BU.features.runAll('heavy');
  }

  let timer;
  function boot() {
    ready = true;
    if (!offNow()) { runLightContentPass(); runHeavyDomScan(); }
    new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (ready && !offNow()) runLightContentPass(); }, 250);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  window.addEventListener('load', () => { if (!offNow()) { runLightContentPass(); runHeavyDomScan(); } });
})();
