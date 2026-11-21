// betterUIS – content script: téma, karty, menu, profilovka, vlastné odkazy v lište,
// CSS snippety, príkazová paleta (Ctrl+K), kill-switch a diagnostika.
//
// SÚBOR JE JEDEN IIFE ZÁMERNE (Chrome content script, bez bundlera):
//  - všetky funkcie zdieľajú S, ready, isTop a chrome.runtime v jednom scope;
//  - poradie načítania (themes.js → text-utils.js → content.js) je
//    fixné v manifestoch a v package.ps1; rozdelenie by vyžadovalo zdieľaný
//    globálny stav a zvýšilo riziko poradia načítania bez build kroku;
//  - smoke-fixture.html overuje table-tools, paletu a umiestnenie ovládacích prvkov.
// Pri pridaní novej funkcie pridaj volanie do runLightContentPass / runHeavyDomScan
// a (ak treba) nový modul ako pure logic (viď grades.js) s testom v tools/tests/.
(function () {
  'use strict';
  if (!self.BU || !self.BU.notif) throw new Error('betterUIS core not loaded (themes.js/notifcore.js missing)');
  const BU = self.BU;
  const isTop = window.top === window;
  let lastCmd = 0;
  function cmdOnce() { const n = performance.now(); if (n - lastCmd < 300) return false; lastCmd = n; return true; }

  let S = BU.normalize(null);
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
    if (off) { setOff(true); mailPreview(); schedPreview(); todoPreview(); return; }
    setOff(false);
    const mode = BU.compute(S).mode;
    delete document.documentElement.dataset.buOff;
    applyTheme();
    applySnippets();
    document.documentElement.dataset.buHideOperinfo = (S.ui && S.ui.hideOperinfo) ? '1' : '0';
    if (ready) runLightContentPass();
  }
  BU.load().then((s) => { S = s; cacheOff(); applyAll(); });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local' || !ch[BU.KEY]) return;
    const nv = ch[BU.KEY].newValue;
    if (!nv) return;
    S = BU.normalize(nv);
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
  function minimalWrapper(el, card, forbid) {
    const txt = el.textContent.trim();
    while (el.parentElement && el.parentElement !== card) {
      const p = el.parentElement;
      if (p.querySelector('ul, ol') || forbid.some((f) => p.contains(f))) break;
      if (p.textContent.trim() !== txt) break;
      el = p;
    }
    return el;
  }
  function firstTitleText(card) {
    const w = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, {
      acceptNode: (t) => t.nodeValue.trim() && !t.parentElement.closest('ul, ol, script, style')
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
    return w.nextNode();
  }
  const hideIfEmpty = (el, keep) => {
    if (el && !keep.includes(el) && !el.textContent.trim() && !el.querySelector('img, ul, ol, input, button')) el.style.display = 'none';
  };

  function tagCards() {
    document.querySelectorAll('.menu-drzak:not([data-bu-done])').forEach((h) => {
      try {
        let card;
        if (h.querySelector('ul, ol')) card = h;                       // .menu-drzak je celá karta
        else {                                                         // .menu-drzak je „držiak“ (hlavička)
          card = h.parentElement;
          while (card && !card.querySelector('ul, ol') && card.parentElement && card.parentElement !== document.body) card = card.parentElement;
          if (!card || !card.querySelector('ul, ol')) return;
          if (card.querySelectorAll('.menu-drzak').length > 1) return; // zachytili by sme viac kariet naraz
        }
        if (!rawCardHtml) rawCardHtml = slim(card, 5000);

        // hlavička = držiak; keď je karta sama držiakom, vyrobíme hlavičku z prvého textu
        let head = h;
        const titleNode = firstTitleText(card);
        const icon = [...card.querySelectorAll('img')].find((i) => !i.closest('ul, ol') && !i.classList.contains('bu-avatar'));
        if (card === h) {
          if (titleNode) { const t = minimalWrapper(titleNode.parentElement, card, [icon].filter(Boolean)); head = t; }
          else head = null;
        }
        if (!head) return;
        head.classList.add('bu-card-head');

        card.classList.add('bu-card');

        // názov do hlavičky (ak nie je vnútri), potom ikonka na začiatok
        if (titleNode && card !== h && !head.contains(titleNode)) {
          const t = minimalWrapper(titleNode.parentElement, card, [head, icon].filter(Boolean));
          if (t !== head && !t.contains(head)) { const old = t.parentElement; head.appendChild(t); hideIfEmpty(old, [card, head]); }
        }
        if (icon) {
          icon.classList.add('bu-icon');
          if (!head.contains(icon) || head.firstChild !== icon) {
            const old = icon.parentElement;
            head.insertBefore(icon, head.firstChild);
            hideIfEmpty(old, [card, head]);
          }
        }

        // označíme až po úspešnom označení – inak sa neúspešná karta nikdy neskúsi znova
        h.dataset.buDone = '1';
        card.dataset.buDone = '1';
      } catch (e) { swallow(e); }   // jedna chybná karta nesmie zastaviť ostatné
    });
    // samokontrola: koľko kariet máme a koľko sa označilo
    try {
      const total = document.querySelectorAll('.menu-drzak').length;
      const tagged = document.querySelectorAll('.bu-card').length;
      const heads = document.querySelectorAll('.bu-card-head').length;
      if (total > 0 && (tagged < total || heads < tagged)) {
        console.warn('betterUIS: tagCards – označených ' + tagged + '/' + total + ' kariet, hlavičiek ' + heads);
      }
      (window.__buTagStats = { total, tagged, heads, at: Date.now() });
    } catch (e) { swallow(e); }
  }

  /* ================= 3) Vlastné odkazy v lište ================= */
  function sameOrigin(u) { try { return new URL(u, location.origin).origin === location.origin; } catch (e) { return false; } }

  function linksBar() {
    if (!isTop || offNow()) return;
    const ol = document.querySelector('nav[aria-label="breadcrumb"] ol.breadcrumb');
    if (!ol) return;
    const loggedIn = !!document.querySelector('#header .info') || !!document.querySelector('#header img[src*="foto.pl"]');
    let li = ol.querySelector('li.bu-links');
    if (!loggedIn) { if (li) li.remove(); return; }
    if (!S.links.length) { if (li) li.remove(); return; }
    if (!li) {
      const items = [...ol.children].filter((c) => c.tagName === 'LI' && !c.classList.contains('bu-links'));
      const anchor = items.find((x) => /Osobn[áa]\s+administrat[íi]va/i.test(x.textContent))
        || items[items.length - 1]
        || items[0];
      li = document.createElement('li');
      li.className = 'breadcrumb-item bu-links';
      if (anchor) anchor.after(li); else ol.appendChild(li);
    }
    const sig = JSON.stringify(S.links.map((l) => [l.id, l.name, l.url, l.icon])) + '|' + location.pathname;
    if (li.dataset.sig === sig) return;
    li.dataset.sig = sig;
    li.textContent = '';
    S.links.forEach((l) => {
      const a = document.createElement('a');
      a.href = l.url;
      a.title = l.name;
      let isOn = false;
      try { isOn = new URL(l.url, location.origin).pathname === location.pathname; } catch (e) { swallow(e); }
      a.className = 'bu-link' + (isOn ? ' on' : '');
      if (!sameOrigin(l.url)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      const ic = document.createElement('span');
      ic.className = 'bu-link-ic';
      ic.innerHTML = svgIcon(l.icon);              // dôveryhodná konštanta z ICONS
      const tx = document.createElement('span');
      tx.textContent = l.name;                     // text používateľa vždy cez textContent
      a.append(ic, tx);
      // badge nových dokumentov (len pre Dokumentový server)
      if (/dok_server/i.test(l.url)) {
        const badge = findDocBadge();
        if (badge) {
          const b = document.createElement('span');
          b.className = 'bu-doc-badge';
          b.textContent = badge;
          a.appendChild(b);
        }
      }
      if (/mail|posta|sprav/i.test(l.url)) {
        const badge = findMailBadge();
        if (badge) {
          const b = document.createElement('span');
          b.className = 'bu-mail-badge';
          b.textContent = badge;
          a.appendChild(b);
        }
      }
      li.appendChild(a);
    });
  }

  function findDocBadge() {
    // Hľadá badge s počtom nových dokumentov v pôvodnom UIS (class="badge" pri odkaze na dok_server).
    try {
      const candidates = [...document.querySelectorAll('.badge')];
      for (const b of candidates) {
        const txt = (b.textContent || '').trim();
        if (!/^\d+$/.test(txt)) continue;
        const link = b.closest('a') || b.parentElement && b.parentElement.closest('a');
        const ctx = (link ? link.getAttribute('href') : '') + ' ' + (link ? link.textContent : '') + ' ' + (b.parentElement ? b.parentElement.textContent : '');
        if (/dok_server|dokument/i.test(ctx)) return txt;
      }
      // fallback: prvý badge s číslom, ktorý je v hornom menu (nie v karte)
      for (const b of candidates) {
        const txt = (b.textContent || '').trim();
        if (/^\d+$/.test(txt) && b.closest('#header, .sd-header, nav, .info')) return txt;
      }
    } catch (e) { swallow(e); }
    return null;
  }

  function hideOriginals() {
    let rules;
    try {
      rules = S.links.filter((l) => l.hideOriginal).map((l) => { try { return new URL(l.url, location.origin); } catch (e) { swallow(e); return null; } }).filter(Boolean);
    } catch (e) { swallow(e); rules = []; }
    if (!rules.length) {
      document.querySelectorAll('.bu-hide').forEach((el) => el.classList.remove('bu-hide'));
      return;
    }
    document.querySelectorAll('.bu-card a[href], .mainpage a[href], #stranka a[href]').forEach((a) => {
      if (a.closest('.bu-links, #header, nav')) return;
      let u; try { u = new URL(a.getAttribute('href'), location.origin); } catch (e) { return; }
      // plná zhoda cesty; ak má pravidlo aj query, musí sedieť aj query
      const hit = rules.some((r) => r.pathname === u.pathname && (!r.search || r.search === u.search));
      (a.closest('li') || a).classList.toggle('bu-hide', hit);
    });
  }

  function findMailBadge() {
    try {
      const candidates = [...document.querySelectorAll('.badge')];
      for (const b of candidates) {
        const txt = (b.textContent || '').trim();
        if (!/^\d+$/.test(txt)) continue;
        const link = b.closest('a') || b.parentElement && b.parentElement.closest('a');
        const ctx = (link ? link.getAttribute('href') : '') + ' ' + (link ? link.textContent : '') + ' ' + (b.parentElement ? b.parentElement.textContent : '');
        if (/mail|po[šs]ta|spr[aá]v/i.test(ctx)) return txt;
      }
    } catch (e) { swallow(e); }
    return null;
  }

  async function addCurrentPage() {
    const crumbs = [...document.querySelectorAll('nav[aria-label="breadcrumb"] li')].map((x) => x.textContent.trim()).filter(Boolean);
    const suggested = (crumbs[crumbs.length - 1] || document.title || 'Odkaz').replace(/\s+/g, ' ').slice(0, 30);
    const name = await buPrompt(BU.t('linkName'), suggested);
    if (!name) return;
    const url = location.pathname + location.search;
    const l = BU.cleanLink({ name, url, icon: 'link' });
    if (!l) return;
    const st = await BU.load();
    if (st.links.some((x) => x.url === url)) { BU.toast(BU.t('alreadyThere')); return; }
    st.links.push(l);
    await BU.save(st);
    BU.toast(BU.t('added') + name);
  }

  /* Nájde kotvu v hlavičke, pred ktorú sa vložia tlačidlá rozšírenia (účet/jazyk),
     aby sa neprekrývali s účtom. */
  function findAccountAnchor(header) {
    const right = header.querySelector('.right');
    // Tlačidlá vľavo od bloku účtu (meno + pfp): kotva = .info (meno/čas)
    const info = (right || header).querySelector('.info');
    if (info) return info;
    const imgs = [...header.querySelectorAll('img')];
    const accImg = imgs.find((i) => /foto\.pl|lide\/foto|podobizn|isic/i.test(i.getAttribute('src') || ''));
    if (accImg) {
      const container = accImg.parentElement;
      if (container && container !== header) return container;
      return accImg;
    }
    const logout = [...header.querySelectorAll('a')].find((a) => /odhl[aá]si[tť]|logout|sign\s*out/i.test(a.textContent || ''));
    if (logout) {
      const container = logout.parentElement;
      if (container && container !== header) return container;
      return logout;
    }
    return (right || header).querySelector('.lang-switcher') || (right || header).querySelector('[class*="lang"]');
  }

  /* ================= 4) Ovládacie tlačidlá ================= */
  const ICON_SUN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const ICON_MOON = '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  const ICON_PLUS = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
  const ICON_FIND = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>';
  const ICON_SET = '<svg viewBox="0 0 24 24"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>';

  function controls() {
    if (!isTop || offNow()) return;
    const eff = BU.resolveMode(S.mode);
    let box = document.getElementById('bu-ctl');
    if (!box) {
      box = document.createElement('div');
      box.id = 'bu-ctl';
      box.innerHTML =
        '<button type="button" class="bu-btn" data-a="mode"></button>' +
        '<button type="button" class="bu-btn" data-a="find" title="' + BU.t('findTitle') + '" aria-label="' + BU.t('findTitle') + '">' + ICON_FIND + '</button>' +
        '<button type="button" class="bu-btn" data-a="add" title="' + BU.t('addTitle') + '" aria-label="' + BU.t('addTitle') + '">' + ICON_PLUS + '</button>' +
        '<button type="button" class="bu-btn" data-a="settings" title="' + BU.t('setTitle') + '" aria-label="' + BU.t('setTitle') + '">' + ICON_SET + '</button>';
      box.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-a]');
        if (!b) return;
        if (b.dataset.a === 'mode') {
          const next = BU.resolveMode(S.mode) === 'dark' ? 'light' : 'dark';
          S = BU.normalize(Object.assign({}, S, { mode: next }));
          applyAll(); BU.save(S);
        } else if (b.dataset.a === 'find') palette();
        else if (b.dataset.a === 'add') addCurrentPage();
        else {
          try { chrome.runtime.sendMessage({ type: 'open-options' }, () => { if (chrome.runtime.lastError) chrome.runtime.openOptionsPage(); }); }
          catch (e) { try { chrome.runtime.openOptionsPage(); } catch (e2) { swallow(e2); } }
        }
      });
      // Vpravo v hlavičke, tesne pred účtom/jazykom (aby sa neprekrývalo)
      const header = document.getElementById('header');
      if (header) {
        if (getComputedStyle(header).position === 'static') header.style.position = 'relative';
        const anchor = findAccountAnchor(header);
        if (anchor && anchor.parentNode === header) header.insertBefore(box, anchor);
        else if (anchor) anchor.parentNode.insertBefore(box, anchor);
        else header.appendChild(box);
      } else { box.classList.add('bu-float'); document.body.appendChild(box); }
    }
    const modeBtn = box.querySelector('[data-a="mode"]');
    if (modeBtn.dataset.m !== eff) {
      modeBtn.dataset.m = eff;
      modeBtn.innerHTML = eff === 'dark' ? ICON_SUN : ICON_MOON;
    }
    modeBtn.title = eff === 'dark' ? BU.t('modeLight') : BU.t('modeDark');
    modeBtn.setAttribute('aria-label', modeBtn.title);
  }

  /* ================= 4b) AIS logo v hlavičke =================
     Pôvodné UIS logo skrýva base.css vo všetkých témach. Sem vložíme AIS logo,
     ak je zapnuté v nastaveniach (ui.aisLogo). Invert podľa režimu rieši CSS. */
  function applyLogo() {
    if (!isTop) return;
    const left = document.querySelector('#header .left');
    if (!left) return;
    const on = !!(S.ui && S.ui.aisLogo);
    let img = left.querySelector('img.bu-logo-ais');
    if (!on) { if (img) img.remove(); return; }
    if (img) return;
    img = document.createElement('img');
    img.className = 'bu-logo-ais';
    img.alt = 'AIS';
    img.addEventListener('error', () => img.remove(), { once: true });
    img.src = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL('ais-logo.png') : 'ais-logo.png';
    left.appendChild(img);
  }

  /* ================= 5) Profilovka (len lokálne) ================= */
  function avatarCandidates() {
    return [...document.images].filter((img) => {
      if (img.dataset.buAv) return true;
      if (img.id === 'uis-logo' || img.classList.contains('bu-icon')) return false;
      const src = img.getAttribute('src') || '';
      if (/foto\.pl|lide\/foto|podobizn|isic/i.test(src)) return true;
      if (img.closest('#header') && !img.closest('.lang-switcher, #bu-ctl, .left')) return !/logo|flag|vlajk|lang|\.svg|icon/i.test(src);
      return false;
    });
  }
  // Vráti obrázok do pôvodného stavu. Nikdy nesiaha na štýly, ktoré sme nenastavili my —
  // staršie verzie ukladali `data-bu-orig-style` už po pridaní vlastných !important rozmerov,
  // takže ten snapshot sa nesmie použiť (inak sa rozmery „zaseknú“).
  function restoreAvatar(img) {
    img.onerror = null;
    if (img.dataset.buAv) {
      if (img.dataset.buOrigSrc != null) img.src = img.dataset.buOrigSrc;
      if (img.dataset.buOrigSrcset) img.srcset = img.dataset.buOrigSrcset; else img.removeAttribute('srcset');
      if (img.dataset.buOrigAlt != null) img.alt = img.dataset.buOrigAlt;
    }
    img.removeAttribute('referrerpolicy');
    img.classList.remove('bu-avatar');
    delete img.dataset.buAv; delete img.dataset.buKey;
    delete img.dataset.buOrigSrc; delete img.dataset.buOrigSrcset; delete img.dataset.buOrigAlt;
  }
  function avatarName() {
    if (S.nick) return S.nick;
    const info = document.querySelector('#header .info');
    if (info) {
      const divs = Array.from(info.querySelectorAll('div'))
        .filter((d) => d.textContent.trim() && !d.classList.contains('dvdr'));
      if (divs.length) return divs[divs.length - 1].textContent.trim();
    }
    return 'A';
  }
  function initialAvatarUrl() {
    const ch = ((avatarName().match(/[\p{L}\p{N}]/u) || ['A'])[0]).toUpperCase();
    let bg = '#831135', fg = '#ffffff';
    try {
      const cs = getComputedStyle(document.documentElement);
      bg = cs.getPropertyValue('--accent').trim() || bg;
      fg = cs.getPropertyValue('--on-accent').trim() || fg;
    } catch (e) { swallow(e); }
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">'
      + '<circle cx="40" cy="40" r="40" fill="' + bg + '"/>'
      + '<text x="40" y="41" text-anchor="middle" dominant-baseline="central" '
      + 'font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="40" font-weight="600" fill="' + fg + '">'
      + ch + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  // Náhľad pôvodnej fotky v nastaveniach: content script ju raz stiahne (same-origin,
  // takže prejde aj s prihlásením) a uloží ako data URL len lokálne. Options stránka
  // nemá prístup k foto.pl s cookies, preto samotná URL nestačí.
  const AVATAR_SHOT_KEY = 'bu-avatar-shot';
  let shotChecked = false;
  function rememberIsicPhoto(imgs) {
    if (shotChecked) return;
    try {
      const src = imgs.map((i) => i.dataset.buOrigSrc || i.getAttribute('src') || '')
        .find((s) => /foto\.pl|lide\/foto|podobizn/i.test(s));
      if (!src) return;
      const abs = new URL(src, location.href).href;
      if (!/^https?:\/\/[^/]*is\.stuba\.sk\//i.test(abs)) return;
      shotChecked = true;
      chrome.storage.local.get(AVATAR_SHOT_KEY).then((r) => {
        const prev = r && r[AVATAR_SHOT_KEY];
        if (prev && prev.url === abs && prev.data) return;   // snímku pre túto fotku už máme
        const avCtrl = new AbortController(); const avTimer = setTimeout(() => avCtrl.abort(), 8000);
        return fetch(abs, { credentials: 'include', signal: avCtrl.signal }).then((res) => {
          if (!res.ok) return null;
          const ct = (res.headers.get('content-type') || '').toLowerCase();
          if (!ct.startsWith('image/')) return null;   // prihlásenie vypršalo → HTML, neukladať
          return res.blob().then((b) => {
            if (!b || b.size > 512 * 1024) return null;
            const fr = new FileReader();
            fr.onload = () => { try { chrome.storage.local.set({ [AVATAR_SHOT_KEY]: { url: abs, data: String(fr.result) } }); } catch (e) { swallow(e); } };
            fr.readAsDataURL(b);
          });
        }).finally(() => clearTimeout(avTimer));
      }).catch((e) => swallow(e));
    } catch (e) { swallow(e); }
  }
  function avatar() {
    if (offNow()) { avatarCandidates().forEach(restoreAvatar); return; }
    const mode = S.avatar.mode;
    const src = mode === 'custom' ? S.avatar.dataUrl : (mode === 'url' ? S.avatar.url : '');
    const key = mode + ':' + (src ? src.length + ':' + src.slice(-24) : '0');
    const imgs = avatarCandidates();
    rememberIsicPhoto(imgs);
    imgs.forEach((img) => {
      if (!src) { restoreAvatar(img); return; }
      if (!img.dataset.buAv) {
        img.dataset.buAv = '1';
        img.dataset.buOrigSrc = img.getAttribute('src') || '';
        img.dataset.buOrigSrcset = img.getAttribute('srcset') || '';
        img.dataset.buOrigAlt = img.getAttribute('alt') || '';
        img.classList.add('bu-avatar');
      }
      if (img.dataset.buKey === key) return;
      img.dataset.buKey = key;
      img.removeAttribute('srcset');
      img.setAttribute('referrerpolicy', 'no-referrer');
      img.alt = avatarName() + ' (profilová fotka)';
      img.onerror = () => { img.onerror = null; img.src = initialAvatarUrl(); };
      img.src = src;
    });
  }

  /* ================= 6) Vyskakovacie menu (po kliknutí na meno atď.) =================
      Všetky kontajnery sú priehľadné, takže absolútne pozicované menu nemá pozadie.
      Nájdeme ich podľa computed štýlu a dáme im plné pozadie. */
  const POP_SKIP = '.bu-card, #bu-ctl, #bu-toast, #bu-pick, #bu-dialog, #bu-palette, #uisFixedBox, #uisFloatingBox, .ui-dialog, .ui-datepicker, .ui-tooltip, .ui-menu, .ui-autocomplete, .ui-widget-overlay';
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
  function semanticScan() {
    if (offNow()) return;
    document.querySelectorAll('[bgcolor],[style]').forEach((el) => {
      if (el.classList.contains('bu-keep') || el.closest('nav, #header, .bu-card, #bu-ctl, #bu-toast, #bu-dialog, #bu-palette, #bu-pick, .bu-pop')) return;
      const bg = el.style.backgroundColor || el.getAttribute('bgcolor') || '';
      const fg = el.style.color || '';
      if ((bg && BU.notif.isSaturated(bg)) || (fg && BU.notif.isSaturated(fg))) el.classList.add('bu-keep');
    });
  }

  /* ================= 8) Diagnostika (Alt+Shift+D = výpis, Alt+Shift+I = vybrať prvok) ================= */
  /* Redakcia citlivých údajov (osobné číslo, ISIC fotka…) pred kopírovaním von –
     pravidlá sú v notifcore.js (testované v node). Voláme priamo BU.notif.redactText. */
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
        S = BU.normalize(Object.assign({}, S, { mode: next }));
        applyAll(); BU.save(S);
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
      S = BU.normalize(Object.assign({}, S, { mode: next }));
      applyAll(); BU.save(S);
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
  const RECENT_KEY = 'bu:recent';
  function recentLinks() {
    try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function rememberRecent(href) {
    try {
      const list = recentLinks().filter((h) => h !== href);
      list.unshift(href);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
    } catch (e) { swallow(e); }
  }
  function navigateTo(href) {
    try {
      const u = new URL(href, location.href);
      if (u.origin === location.origin) location.href = u.href;
      else window.open(u.href, '_blank', 'noopener');
      rememberRecent(u.href);
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
      const rec = recentLinks();
      const recScore = (href) => {
        try { const i = rec.indexOf(new URL(href, location.href).href); return i >= 0 ? (rec.length - i) * 0.6 : 0; } catch (e) { return 0; }
      };
      shown = items.map((it) => ({ it, sc: Math.max(BU.notif.fuzzyScore(q, it.label), BU.notif.fuzzyScore(q, it.grp) * 0.5) + recScore(it.href) }))
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
  function tagHeader() {
    if (document.querySelector('.sd-header, #header')) return;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (!/Slovensk[áa] technick[áa] univerzita/i.test(n.nodeValue)) continue;
      let el = n.parentElement, best = null;
      while (el && el !== document.body && el !== document.documentElement) {
        const r = el.getBoundingClientRect();
        if (r.height > 220) break;
        if (r.width >= innerWidth * 0.9) best = el;
        el = el.parentElement;
      }
      if (best) best.classList.add('sd-header');
      return;
    }
  }
  function tagBoxes() {
    const t0 = performance.now();
    for (const el of document.querySelectorAll('div, table, fieldset')) {
      if (performance.now() - t0 > 30) break;           // časový rozpočet 30 ms (P0-3)
      if (el.classList.contains('sd-box') || el.closest('.bu-card, .bu-pop, .sd-header, #header, #uisFixedBox, #uisFloatingBox, .zasadky-container, nav, #bu-ctl')) continue;
      if (el.parentElement && el.parentElement.closest('.sd-box')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 150 || r.height < 50 || r.width > innerWidth * 0.8) continue;
      if (!hasBorder(getComputedStyle(el))) continue;
      el.classList.add('sd-box');
    }
  }
  /* ================= 11) Table-tools (zoradenie, filter, CSV) =================
     Len generické tabuľky: aspoň 2 dátové riadky a <th>. Tabuľky s formulárovými
     prvkami (prihlásenie na skúšky…) sa NESMÚ triediť – poradie riadkov je súčasť
     formulára. Pravidlo je testované v node ako BU.notif.hasFormControls; tu sa
     kontroluje rovnakým spôsobom cez DOM query. Marker data-bu-tt bráni slučke
     MutationObserver → init (opakovaná inicializácia by prekresľovala donekonečna). */
  const TT_EXCLUDE = '#bu-ctl, #bu-dialog, #bu-palette, .bu-pop, #uisFixedBox, #uisFloatingBox, .ui-dialog, .bu-keep, .uisLegend';

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
      if (BU.schedule.isScheduleOrLegend(table.outerHTML) || table.closest(TT_EXCLUDE)) return;
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

  /* ================= 13) Náhľad pošty (voliteľný) =================
     Číta len zoznam správ (rovnaká doména, s prihlásením), nič neodosiela.
     Dáta sú v pamäti + v chrome.storage.local['bu:mail'] (lokálne, nesynchronizuje sa). */
  const MAIL_URL = '/auth/posta/slozka.pl';
  const MAIL_MAX = 10;
  const MAIL_REFRESH_MS = 3 * 60 * 1000;
  const MAIL_CACHE = 'bu:mail';
  const MAIL_UNREAD_RE = /(?:unread|nepre[cč]ítan\S*|nepře[cč]ten\S*)[^:\d]{0,20}:\s*(\d+)/i;
  let mailState = { items: [], unread: null, time: 0, status: '', error: '' };
  let mailTimer = null;
  let mailFetching = false;
  let mailCollapsed = false;

  function mailOn() {
    return !offNow() && document.documentElement.dataset.buOff !== '1' && !!(S.ui && S.ui.mail);
  }
  function mailMk(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function mailSafeHref(href) {
    try { const u = new URL(href, location.origin); return u.origin === location.origin ? u.href : ''; } catch (e) { return ''; }
  }
  function mailCountUnread(doc, items) {
    const text = (doc.body ? doc.body.textContent : '').replace(/\u00a0/g, ' ');
    const m = text.match(MAIL_UNREAD_RE);
    const summary = m ? parseInt(m[1], 10) : 0;
    const rows = items.filter((i) => i.unread).length;
    if (summary > 0 && rows === 0) items.slice(0, summary).forEach((i) => { i.unread = true; });
    return Math.max(summary || 0, rows);
  }
  function mailParse(html, baseUrl) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const items = [];
    const seen = new Set();
    for (const a of doc.querySelectorAll('a[href*="email.pl?eid="], a[href*="email.pl?eid%3D"]')) {
      const row = a.closest('tr');
      const cell = a.closest('td');
      if (!row || !cell || seen.has(row)) continue;
      seen.add(row);
      const cells = [...row.cells];
      const idx = cells.indexOf(cell);
      items.push({
        href: new URL(a.getAttribute('href'), baseUrl).href,
        subject: (a.getAttribute('title') || a.textContent).replace(/\u00a0/g, ' ').trim(),
        sender: idx > 0 ? cells[idx - 1].textContent.replace(/\u00a0/g, ' ').trim() : '',
        date: cells[idx + 1] ? cells[idx + 1].textContent.replace(/\u00a0/g, ' ').trim() : '',
        unread: !!row.querySelector("b, strong, [data-sysid*='nov'], [data-sysid*='nepre'], [data-sysid*='unread']")
          || /\b(unread|new|nepre\S*)\b/i.test(row.className),
      });
      if (items.length >= MAIL_MAX) break;
    }
    return { items, unread: mailCountUnread(doc, items) };
  }
  async function mailRead(res) {
    const buf = await res.arrayBuffer();
    const ct = res.headers.get('content-type') || '';
    let charset = (ct.match(/charset=([^;\s]+)/i) || [])[1];
    if (!charset) {
      const head = new TextDecoder('latin1').decode(buf.slice(0, 2048));
      charset = (head.match(/charset=["']?([\w-]+)/i) || [])[1];
    }
    try { return new TextDecoder(charset || 'utf-8').decode(buf); }
    catch (e) { return new TextDecoder('utf-8').decode(buf); }
  }
  function homeRow() {
    const menitko = document.getElementById('menitko');
    if (!menitko || !menitko.parentNode) return null;
    let row = document.getElementById('bu-home-row');
    if (!row) {
      row = document.createElement('div');
      row.id = 'bu-home-row';
      row.style.display = 'flex';
      row.style.gap = '12px';
      row.style.alignItems = 'flex-start';
      row.style.marginBottom = '12px';
      menitko.parentNode.insertBefore(row, menitko);
    }
    return row;
  }
  function homeRowCleanup() {
    const row = document.getElementById('bu-home-row');
    if (row && !row.children.length) row.remove();
  }
  function mailPanel() {
    const row = homeRow();
    if (!row) return null;
    let panel = document.getElementById('bu-mail');
    if (!panel) { panel = mailMk('section', 'bu-mail'); panel.id = 'bu-mail'; panel.style.flex = '3'; panel.style.minWidth = '0'; }
    if (panel.parentNode !== row) row.appendChild(panel);
    return panel;
  }
  function mailRender() {
    if (!mailOn()) return;
    const panel = mailPanel();
    if (!panel) return;
    panel.dataset.buRendered = '1';
    panel.replaceChildren();

    const head = mailMk('div', 'bu-mail-head');
    const toggle = mailMk('button', 'bu-mail-toggle', mailCollapsed ? '▸' : '▾');
    toggle.type = 'button';
    toggle.title = mailCollapsed ? 'Rozbaliť' : 'Zbaliť';
    toggle.setAttribute('aria-label', mailCollapsed ? 'Rozbaliť poštu' : 'Zbaliť poštu');
    toggle.addEventListener('click', () => {
      mailCollapsed = !mailCollapsed;
      try { chrome.storage.local.set({ 'bu:mail-collapsed': mailCollapsed }); } catch (e) { swallow(e); }
      mailRender();
    });
    head.appendChild(toggle);
    const title = mailMk('a', 'bu-mail-title', 'Pošta');
    title.href = MAIL_URL;
    head.appendChild(title);
    if (mailState.unread) head.appendChild(mailMk('span', 'bu-mail-badge', String(mailState.unread)));
    head.appendChild(mailMk('span', 'bu-mail-status', mailState.status));
    const btn = mailMk('button', 'bu-mail-refresh', '↻');
    btn.type = 'button';
    btn.title = 'Obnoviť';
    btn.setAttribute('aria-label', 'Obnoviť poštu');
    btn.addEventListener('click', () => mailFetch());
    head.appendChild(btn);
    panel.appendChild(head);

    if (mailCollapsed) return;

    if (mailState.error) panel.appendChild(mailMk('p', 'bu-mail-msg bu-mail-err', mailState.error));
    else if (!mailState.items.length) panel.appendChild(mailMk('p', 'bu-mail-msg', mailState.time ? 'Žiadne správy.' : 'Načítavam…'));
    else {
      const ul = mailMk('ul', 'bu-mail-list');
      for (const m of mailState.items) {
        const li = mailMk('li', m.unread ? 'bu-mail-unread' : '');
        const a = mailMk('a', 'bu-mail-subject', m.subject);
        const href = mailSafeHref(m.href);
        if (href) a.href = href;
        li.append(mailMk('span', 'bu-mail-sender', m.sender), a, mailMk('span', 'bu-mail-date', m.date));
        ul.appendChild(li);
      }
      panel.appendChild(ul);
    }
  }
  async function mailFetch() {
    if (!mailOn() || mailFetching) return;
    mailFetching = true;
    mailState = Object.assign({}, mailState, { status: 'obnovujem…', error: '' });
    mailRender();
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 10000);
      let res;
      try { res = await fetch(MAIL_URL, { credentials: 'include', cache: 'no-store', signal: ctrl.signal }); }
      finally { clearTimeout(t); }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const html = await mailRead(res);
      const parsed = mailParse(html, res.url);
      if (!parsed.items.length) throw new Error('empty');
      const time = new Date();
      mailState = {
        items: parsed.items,
        unread: parsed.unread,
        time: time.getTime(),
        status: 'obnovené ' + time.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }),
        error: '',
      };
      try { await chrome.storage.local.set({ [MAIL_CACHE]: mailState }); } catch (e) { swallow(e); }
    } catch (e) {
      mailState = Object.assign({}, mailState, { status: '', error: 'Poštu sa nepodarilo načítať.' });
    } finally {
      mailFetching = false;
      mailRender();
    }
  }
  function mailStart() {
    if (mailTimer) return;
    mailTimer = setInterval(mailFetch, MAIL_REFRESH_MS);
    chrome.storage.local.get(['bu:mail', 'bu:mail-collapsed']).then((r) => {
      const c = r && r['bu:mail'];
      if (typeof r['bu:mail-collapsed'] === 'boolean') mailCollapsed = r['bu:mail-collapsed'];
      if (c && Array.isArray(c.items) && c.items.length && !mailOn()) return;
      if (c && Array.isArray(c.items) && c.items.length) {
        mailState = {
          items: c.items,
          unread: typeof c.unread === 'number' ? c.unread : null,
          time: c.time || 0,
          status: 'z vyrovnávacej pamäte',
          error: '',
        };
        mailRender();
      }
      if (!mailState.time || Date.now() - mailState.time > MAIL_REFRESH_MS) mailFetch();
    }).catch(() => { mailFetch(); });
  }
  function mailStop() {
    if (mailTimer) { clearInterval(mailTimer); mailTimer = null; }
  }
  function mailPreview() {
    if (!mailOn()) {
      mailStop();
      const p = document.getElementById('bu-mail');
      if (p) p.remove();
      homeRowCleanup();
      return;
    }
    const panel = mailPanel();
    if (!panel) { mailStop(); const p = document.getElementById('bu-mail'); if (p) p.remove(); homeRowCleanup(); return; }
    if (!panel.dataset.buRendered) { panel.dataset.buRendered = '1'; mailRender(); }
    mailStart();
  }

  /* ================= spúšťanie ================= */
  /* ================= 13b) Zoznam úloh To-Do (voliteľný, hlavná stránka) ================= */
  const TODO_CACHE = 'bu:todo';
  const TODO_TYPES = ['úloha','zápočet','skúška'];
  let todoItems = [];
  let todoTimer = null;

  function todoOn() {
    return !offNow() && document.documentElement.dataset.buOff !== '1' && !!(S.ui && S.ui.todo);
  }
  function todoPanel() {
    const row = homeRow();
    if (!row) return null;
    let p = document.getElementById('bu-todo');
    if (!p) { p = document.createElement('section'); p.id = 'bu-todo'; p.style.flex = '2'; p.style.minWidth = '0'; }
    if (p.parentNode !== row) row.appendChild(p);
    return p;
  }
  function todoLoad() {
    chrome.storage.local.get(TODO_CACHE).then((r) => {
      const c = r && r[TODO_CACHE];
      todoItems = Array.isArray(c) ? c : [];
      todoRender();
    }).catch(() => { todoItems = []; todoRender(); });
  }
  function todoSave() {
    try { chrome.storage.local.set({ [TODO_CACHE]: todoItems }); } catch (e) { swallow(e); }
  }
  function todoUid() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
  function todoRender() {
    if (!todoOn()) return;
    const p = todoPanel();
    if (!p) return;
    // Renderuj len pri zmene dát: inak by replaceChildren() spúšťal MutationObserver
    // a panel by sa prepisoval každých 250 ms (strata fokusu pri písaní).
    const sig = JSON.stringify(todoItems);
    if (p.dataset.buSig === sig) return;
    p.dataset.buSig = sig;
    p.replaceChildren();
    const head = document.createElement('div');
    head.className = 'bu-mail-head';
    const title = document.createElement('span');
    title.className = 'bu-mail-title';
    title.textContent = 'To-Do';
    head.appendChild(title);
    const addBtn = document.createElement('button');
    addBtn.className = 'bu-mail-refresh';
    addBtn.type = 'button';
    addBtn.textContent = '+';
    addBtn.title = 'Pridať úlohu';
    addBtn.addEventListener('click', () => todoAddForm(p));
    head.appendChild(addBtn);
    p.appendChild(head);

    if (!todoItems.length) {
      const e = document.createElement('p'); e.className = 'bu-mail-msg'; e.textContent = 'Žiadne úlohy.'; p.appendChild(e);
      return;
    }
    // sort by deadline
    const sorted = todoItems.slice().sort((a,b) => {
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      if (a.done !== b.done) return a.done ? 1 : -1;
      return da - db;
    });
    const ul = document.createElement('ul');
    ul.className = 'bu-mail-list';
    ul.style.listStyle = 'none';
    for (const t of sorted) {
      const li = document.createElement('li');
      li.style.padding = '8px 12px';
      li.style.borderTop = '1px solid var(--border)';
      const row = document.createElement('div');
      row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '8px';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!t.done;
      cb.addEventListener('change', () => { t.done = cb.checked; todoSave(); todoRender(); });
      const tit = document.createElement('span'); tit.textContent = t.title; tit.style.flex = '1'; tit.style.overflow = 'hidden'; tit.style.textOverflow = 'ellipsis'; tit.style.whiteSpace = 'nowrap';
      if (t.done) { tit.style.textDecoration = 'line-through'; tit.style.color = 'var(--muted)'; }
      const typeBadge = document.createElement('span'); typeBadge.textContent = t.type; typeBadge.style.fontSize = '.75em'; typeBadge.style.color = 'var(--muted)';
      const dl = document.createElement('span'); dl.textContent = t.deadline ? new Date(t.deadline).toLocaleString('sk-SK', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : ''; dl.style.fontSize = '.75em'; dl.style.color = 'var(--muted)'; dl.style.whiteSpace='nowrap';
      row.append(cb, tit, typeBadge, dl);
      li.appendChild(row);
      if (t.notes) {
        const n = document.createElement('p'); n.textContent = t.notes; n.style.margin = '4px 0 0 24px'; n.style.fontSize = '.8em'; n.style.color = 'var(--muted)'; n.style.whiteSpace = 'pre-wrap';
        li.appendChild(n);
      }
      if (t.subtasks && t.subtasks.length) {
        const ul2 = document.createElement('ul'); ul2.style.margin = '4px 0 0 24px'; ul2.style.padding = '0'; ul2.style.listStyle = 'none';
        for (const st of t.subtasks) {
          const li2 = document.createElement('li'); li2.style.fontSize = '.85em';
          const cb2 = document.createElement('input'); cb2.type = 'checkbox'; cb2.checked = !!st.done;
          cb2.addEventListener('change', () => { st.done = cb2.checked; todoSave(); todoRender(); });
          const sp = document.createElement('span'); sp.textContent = st.title; if (st.done) { sp.style.textDecoration='line-through'; sp.style.color='var(--muted)'; }
          li2.append(cb2, sp); ul2.appendChild(li2);
        }
        li.appendChild(ul2);
      }
      // actions
      const actions = document.createElement('div'); actions.style.marginTop = '4px'; actions.style.marginLeft = '24px'; actions.style.display='flex'; actions.style.gap='6px';
      const editBtn = document.createElement('button'); editBtn.textContent = 'upraviť'; editBtn.style.fontSize='.75em'; editBtn.addEventListener('click', () => todoEditForm(p, t));
      const delBtn = document.createElement('button'); delBtn.textContent = 'zmazať'; delBtn.style.fontSize='.75em'; delBtn.addEventListener('click', () => { todoItems = todoItems.filter(x=>x.id!==t.id); todoSave(); todoRender(); });
      actions.append(editBtn, delBtn);
      li.appendChild(actions);
      ul.appendChild(li);
    }
    p.appendChild(ul);
  }
  function todoAddForm(container) {
    const form = document.createElement('div');
    form.style.cssText = 'padding:12px; border-top:1px solid var(--border); display:flex; flex-direction:column; gap:10px;';

    const field = (label, required, control) => {
      const wrap = document.createElement('label');
      wrap.style.cssText = 'display:flex; flex-direction:column; gap:4px; font-size:.85em; color:var(--muted);';
      const cap = document.createElement('span');
      cap.textContent = label + (required ? ' *' : ' (nepovinné)');
      if (required) cap.style.color = 'var(--accent)';
      wrap.append(cap, control);
      return wrap;
    };

    const titleIn = document.createElement('input');
    titleIn.type = 'text'; titleIn.required = true; titleIn.maxLength = 120;
    titleIn.placeholder = 'napr. Odovzdať laboratórnu správu';
    titleIn.style.cssText = 'width:100%; box-sizing:border-box;';

    const typeSel = document.createElement('select');
    TODO_TYPES.forEach((x) => { const o = document.createElement('option'); o.value = x; o.textContent = x; typeSel.appendChild(o); });
    typeSel.style.cssText = 'width:100%;';

    const dlIn = document.createElement('input');
    dlIn.type = 'datetime-local'; dlIn.style.cssText = 'width:100%; box-sizing:border-box;';

    const notesIn = document.createElement('textarea');
    notesIn.rows = 2; notesIn.placeholder = 'Poznámky k úlohe';
    notesIn.style.cssText = 'width:100%; box-sizing:border-box; resize:vertical;';

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex; gap:8px; margin-top:4px;';
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Uložiť úlohu';
    saveBtn.className = 'bu-mail-refresh';
    saveBtn.style.cssText = 'width:auto; padding:6px 12px; border-radius:var(--radius-sm) !important;';
    saveBtn.addEventListener('click', () => {
      const title = titleIn.value.trim();
      if (!title) { titleIn.focus(); BU.toast('Vyplň názov úlohy.'); return; }
      todoItems.push({ id: todoUid(), title, type: typeSel.value, deadline: dlIn.value || '', notes: notesIn.value.trim(), done: false, created: Date.now() });
      todoSave(); todoRender();
    });
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Zrušiť';
    cancelBtn.style.cssText = 'font-size:.85em; padding:6px 10px;';
    cancelBtn.addEventListener('click', todoRender);
    actions.append(saveBtn, cancelBtn);

    form.append(
      field('Názov úlohy', true, titleIn),
      field('Typ', true, typeSel),
      field('Termín (dátum a čas)', false, dlIn),
      field('Poznámky', false, notesIn),
      actions,
    );
    setTimeout(() => titleIn.focus(), 0);
    const head = container.querySelector('.bu-mail-head');
    if (head && head.nextSibling) container.insertBefore(form, head.nextSibling); else container.appendChild(form);
  }
  function todoEditForm(container, t) {
    // simple: remove and re-add via addForm pre-filled not implemented; just toggle done handled. Provide delete+recreate by removing then add.
    todoItems = todoItems.filter(x=>x.id!==t.id);
    todoSave();
    todoAddForm(container);
    // prefill
    setTimeout(() => {
      const inputs = container.querySelectorAll('input, select, textarea');
      if (inputs[0]) inputs[0].value = t.title;
      if (inputs[1]) inputs[1].value = t.type;
      if (inputs[2]) inputs[2].value = t.deadline || '';
      if (inputs[3]) inputs[3].value = t.notes || '';
    }, 0);
  }
  function todoStart() {
    todoLoad();
  }
  function todoStop() {
    const p = document.getElementById('bu-todo'); if (p) p.remove();
    homeRowCleanup();
  }
  function todoPreview() {
    if (!todoOn()) { todoStop(); return; }
    const p = todoPanel();
    if (!p) return;
    if (!p.dataset.buRendered) { p.dataset.buRendered = '1'; todoStart(); }
    else todoRender();
  }

  /* ================= 14) Náhľad rozvrhu (voliteľný, hlavná stránka) ================= */
  const SCHED_CACHE = 'bu:schedule';
  const SCHED_REFRESH_MS = 30 * 60 * 1000;
  let schedState = { html: '', time: 0, status: '', error: '' };
  let schedTimer = null;
  let schedFetching = false;

  function schedOn() {
    return !offNow() && document.documentElement.dataset.buOff !== '1' && !!(S.ui && S.ui.schedule);
  }
  function schedPanel() {
    const menitko = document.getElementById('menitko');
    if (!menitko || !menitko.parentNode) return null;
    let p = document.getElementById('bu-schedule');
    const homeRow = document.getElementById('bu-home-row');
    if (p && homeRow && p.parentNode === homeRow) {
      // presunúť von z flex riadku (pod mail+todo)
      homeRow.parentNode.insertBefore(p, homeRow.nextSibling);
    }
    if (!p) {
      p = document.createElement('section');
      p.id = 'bu-schedule';
      const anchor = homeRow || menitko;
      anchor.parentNode.insertBefore(p, anchor.nextSibling);
    }
    return p;
  }
  function schedUrl() {
    // preferuj uloženú URL z návštevy rozvrhu (obsahuje rozvrh_student, obdobie, ...)
    let saved = '';
    try { saved = (JSON.parse(localStorage.getItem('bu:schedUrl') || '""')) || ''; } catch (e) { saved = ''; }
    const links = [...document.querySelectorAll('a[href*="rozvrhy_view"]')];
    const a = links.find((x) => /rozvrh_student/.test(x.getAttribute('href') || ''));
    const href = saved || (a ? a.getAttribute('href') : '') || '/auth/katalog/rozvrhy_view.pl?lang=sk';
    try { return new URL(href, location.origin).href; } catch (e) { return '/auth/katalog/rozvrhy_view.pl?lang=sk'; }
  }
  function schedFindTable(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // IBA skutočný rozvrh (bunky .rozvrh-pred/.rozvrh-cvic). Nikdy nie formulár
    // „Formát / Zobraziť" z výberu kritérií – to nie je rozvrh.
    return doc.querySelector('table:has(.rozvrh-pred), table:has(.rozvrh-cvic)');
  }
  function schedRememberCurrent() {
    if (!/rozvrhy_view\.pl/.test(location.href)) return;
    const tbl = document.querySelector('table.bu-tt-table, table:has(.rozvrh-pred), table:has(.rozvrh-cvic)');
    if (!tbl) return;
    try {
      localStorage.setItem('bu:schedUrl', JSON.stringify(location.href));
      const captured = {
        html: tbl.outerHTML,
        url: location.href,
        time: Date.now(),
        status: 'z poslednej návštevy rozvrhu',
        error: '',
      };
      chrome.storage.local.set({ [SCHED_CACHE]: captured }).catch((e) => swallow(e));
      if (!schedState.html || schedState.time < captured.time) schedState = captured;
    } catch (e) { swallow(e); }
  }
  function schedRender() {
    if (!schedOn()) return;
    const p = schedPanel();
    if (!p) return;
    p.replaceChildren();
    const head = document.createElement('div');
    head.className = 'bu-mail-head';
    const title = document.createElement('a');
    title.className = 'bu-mail-title';
    title.href = schedUrl();
    title.textContent = 'Rozvrh';
    head.appendChild(title);
    const status = document.createElement('span');
    status.className = 'bu-mail-status';
    status.textContent = schedState.status;
    head.appendChild(status);
    const btn = document.createElement('button');
    btn.className = 'bu-mail-refresh';
    btn.type = 'button';
    btn.textContent = '↻';
    btn.title = 'Obnoviť';
    btn.addEventListener('click', () => schedFetch());
    head.appendChild(btn);
    p.appendChild(head);
    if (schedState.error) {
      const e = document.createElement('p'); e.className = 'bu-mail-msg bu-mail-err'; e.textContent = schedState.error; p.appendChild(e);
      return;
    }
    if (!schedState.html) {
      const e = document.createElement('p'); e.className = 'bu-mail-msg'; e.textContent = schedState.time ? 'Žiadne údaje.' : 'Načítavam…'; p.appendChild(e);
      return;
    }
    const tbl = schedFindTable(schedState.html);
    if (!tbl) { const e = document.createElement('p'); e.className='bu-mail-msg'; e.textContent='Rozvrh sa nepodarilo nájsť.'; p.appendChild(e); return; }
    const wrap = document.createElement('div');
    wrap.style.overflowX = 'auto';
    const clone = document.importNode(tbl, true);
    clone.classList.add('bu-tt-table');
    clone.dataset.buTt = '1';
    wrap.appendChild(clone);
    p.appendChild(wrap);
  }
  async function schedFetch() {
    if (!schedOn() || schedFetching) return;
    const candidates = [];
    try { const s = JSON.parse(localStorage.getItem('bu:schedUrl') || '""'); if (s) candidates.push(s); } catch (e) {}
    document.querySelectorAll('a[href*="rozvrhy_view"]').forEach((a) => {
      const h = a.getAttribute('href') || '';
      if (/rozvrh_student/.test(h)) candidates.push(h);
    });
    if (schedState.url) candidates.push(schedState.url);
    const urls = [...new Set(candidates)].map((h) => {
      try { return new URL(h, location.origin).href; } catch (e) { return ''; }
    }).filter(Boolean);
    if (!urls.length) { schedState = Object.assign({}, schedState, { status: '', error: 'Navštív najprv stránku s rozvrhom.' }); schedRender(); return; }

    schedFetching = true;
    schedState = Object.assign({}, schedState, { status: 'obnovujem…', error: '' });
    schedRender();
    let ok = false;
    for (const url of urls) {
      try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 10000);
        let res;
        try { res = await fetch(url, { credentials: 'include', cache: 'no-store', signal: ctrl.signal }); }
        finally { clearTimeout(t); }
        if (!res.ok) continue;
        const html = await res.text();
        if (!schedFindTable(html)) continue;
        schedState = { html, url, time: Date.now(), status: 'obnovené ' + new Date().toLocaleTimeString('sk-SK', { hour:'2-digit', minute:'2-digit' }), error: '' };
        try { localStorage.setItem('bu:schedUrl', JSON.stringify(url)); } catch (e) { swallow(e); }
        try { await chrome.storage.local.set({ [SCHED_CACHE]: schedState }); } catch (e) { swallow(e); }
        ok = true;
        break;
      } catch (e) { swallow(e); }
    }
    if (!ok) {
      // zlá uložená URL → zmaž, nech sa pri ďalšej návšteve uloží správna
      try { localStorage.removeItem('bu:schedUrl'); } catch (e) { swallow(e); }
      schedState = Object.assign({}, schedState, { status: '', error: 'Rozvrh sa nepodarilo načítať. Otvor raz svoj rozvrh.' });
    }
    schedFetching = false;
    schedRender();
  }
  function schedStart() {
    if (schedTimer) return;
    schedTimer = setInterval(() => { if (schedOn()) schedFetch(); }, SCHED_REFRESH_MS);
    chrome.storage.local.get(SCHED_CACHE).then((r) => {
      const c = r && r[SCHED_CACHE];
      if (c && c.html && schedFindTable(c.html)) { schedState = { html: c.html, time: c.time || 0, status: 'z vyrovnávacej pamäte', error: '' }; schedRender(); }
      if (!schedState.time || Date.now() - schedState.time > SCHED_REFRESH_MS) schedFetch();
    }).catch(() => { schedFetch(); });
  }
  function schedStop() {
    if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
    const p = document.getElementById('bu-schedule'); if (p) p.remove();
    homeRowCleanup();
  }
  function schedPreview() {
    schedRememberCurrent();
    if (!schedOn()) { schedStop(); return; }
    const p = schedPanel();
    if (!p) return;
    if (!p.dataset.buRendered) { p.dataset.buRendered = '1'; schedRender(); }
    schedStart();
  }

  function runLightContentPass() { tagCards(); linksBar(); hideOriginals(); controls(); applyLogo(); avatar(); tableTools(); swapNick(); mailPreview(); schedPreview(); todoPreview(); }

  /* ================= prezývka v hlavičke ================= */
  function swapNick() {
    if (offNow()) return;
    const info = document.querySelector('#header .info');
    if (!info) return;
    const divs = [...info.querySelectorAll('div')];
    const nameDiv = divs.length ? divs[divs.length - 1] : null;
    if (!nameDiv) return;
    if (!nameDiv.dataset.buOrigName) nameDiv.dataset.buOrigName = nameDiv.textContent.trim();
    const orig = nameDiv.dataset.buOrigName;
    if (S.nick) nameDiv.textContent = S.nick;
    else nameDiv.textContent = orig;
  }

  function runHeavyDomScan() {
    if (!isTop) return;   // ťažké skeny (hlavička, boxy, logo, popupy, sémantika) len v hlavnom frame (P0-3)
    tagHeader(); applyLogo(); tagBoxes(); scanPopups(); semanticScan();
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
