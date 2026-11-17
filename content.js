// betterUIS – content script: téma, karty, menu, profilovka, vlastné odkazy v lište,
// CSS snippety, príkazová paleta (Ctrl+K), kill-switch a diagnostika.
//
// SÚBOR JE JEDEN IIFE ZÁMERNE (Chrome content script, bez bundlera):
//  - všetky funkcie zdieľajú S, ready, isTop a chrome.runtime v jednom scope;
//  - poradie načítania (themes.js → notifcore.js → grades.js → content.js) je
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
    const off = offNow() || (S.theme === 'og');   // OG téma = pôvodný vzhľad stránky, len hlavička ostáva (už je OG)
    const wasOff = document.documentElement.dataset.buOff === '1';
    if (ready && off !== wasOff) { location.reload(); return; }   // kill-switch sa zmenil → čistý štart stránky
    if (off) { setOff(true); return; }
    setOff(false);
    applyTheme();
    applySnippets();
    if (ready) runLightContentPass();
  }
  BU.load().then((s) => { S = s; cacheOff(); applyAll(); });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (!ch[BU.KEY] || (area !== 'local' && area !== 'sync')) return;
    const nv = ch[BU.KEY].newValue;
    if (!nv) return;
    // sync mirror nemá avatar (ten je lokálny) – pri synchrone ho zachováme
    S = BU.normalize(nv, area === 'sync' ? S.avatar : undefined);
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
      let card;
      if (h.querySelector('ul, ol')) card = h;                       // .menu-drzak je celá karta
      else {                                                         // .menu-drzak je „držiak“ (hlavička)
        card = h.parentElement;
        while (card && !card.querySelector('ul, ol') && card.parentElement && card.parentElement !== document.body) card = card.parentElement;
        if (!card || !card.querySelector('ul, ol')) return;
        if (card.querySelectorAll('.menu-drzak').length > 1) return; // zachytili by sme viac kariet naraz
      }
      if (!rawCardHtml) rawCardHtml = slim(card, 5000);
      h.dataset.buDone = '1';
      card.dataset.buDone = '1';
      card.classList.add('bu-card');

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
    });
  }

  /* ================= 3) Vlastné odkazy v lište ================= */
  function sameOrigin(u) { try { return new URL(u, location.origin).origin === location.origin; } catch (e) { return false; } }

  function linksBar() {
    if (!isTop || offNow()) return;
    const ol = document.querySelector('nav[aria-label="breadcrumb"] ol.breadcrumb');
    if (!ol) return;
    let li = ol.querySelector('li.bu-links');
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
      li.appendChild(a);
    });
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
        '<button type="button" class="bu-btn" data-a="find" title="' + BU.t('findTitle') + '">' + ICON_FIND + '</button>' +
        '<button type="button" class="bu-btn" data-a="add" title="' + BU.t('addTitle') + '">' + ICON_PLUS + '</button>' +
        '<button type="button" class="bu-btn" data-a="settings" title="' + BU.t('setTitle') + '">' + ICON_SET + '</button>';
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
  function restoreAvatar(img) {
    if (!img.dataset.buAv) return;
    img.onerror = null;
    img.src = img.dataset.buOrigSrc;
    if (img.dataset.buOrigSrcset) img.srcset = img.dataset.buOrigSrcset;
    if (img.dataset.buOrigStyle) img.setAttribute('style', img.dataset.buOrigStyle); else img.removeAttribute('style');
    img.classList.remove('bu-avatar');
    delete img.dataset.buAv; delete img.dataset.buKey;
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
        return fetch(abs, { credentials: 'include' }).then((res) => {
          if (!res.ok) return null;
          const ct = (res.headers.get('content-type') || '').toLowerCase();
          if (!ct.startsWith('image/')) return null;   // prihlásenie vypršalo → HTML, neukladať
          return res.blob().then((b) => {
            if (!b || b.size > 512 * 1024) return null;
            const fr = new FileReader();
            fr.onload = () => { try { chrome.storage.local.set({ [AVATAR_SHOT_KEY]: { url: abs, data: String(fr.result) } }); } catch (e) { swallow(e); } };
            fr.readAsDataURL(b);
          });
        });
      }).catch((e) => swallow(e));
    } catch (e) { swallow(e); }
  }
  function avatar() {
    if (offNow()) return;
    const mode = S.avatar.mode;
    const key = mode + ':' + (mode === 'custom' ? S.avatar.dataUrl.length : 0);
    const imgs = avatarCandidates();
    rememberIsicPhoto(imgs);
    imgs.forEach((img) => {
      if (mode === 'original' || (mode === 'custom' && !S.avatar.dataUrl)) { restoreAvatar(img); return; }
      if (img.dataset.buKey === key) return;
      if (!img.dataset.buAv) {
        const r = img.getBoundingClientRect();
        img.dataset.buAv = '1';
        img.dataset.buOrigSrc = img.getAttribute('src') || '';
        img.dataset.buOrigSrcset = img.getAttribute('srcset') || '';
        img.dataset.buOrigStyle = img.getAttribute('style') || '';
        const size = Math.round(Math.min(r.width || 40, r.height || 40)) || 40;
        img.style.setProperty('width', size + 'px', 'important');
        img.style.setProperty('height', size + 'px', 'important');
        img.classList.add('bu-avatar');
      }
      img.dataset.buKey = key;
      img.removeAttribute('srcset');
      // len lokálny pedro.gif (žiadna požiadavka na tretiu stranu, P0-4); keď chýba, onerror vráti pôvodnú fotku
      const chain = mode === 'custom' ? [S.avatar.dataUrl] : [chrome.runtime.getURL('pedro.gif')];
      let i = 0;
      img.onerror = () => {
        i++;
        if (i < chain.length) img.src = chain[i];
        else { img.onerror = null; img.src = img.dataset.buOrigSrc; }
      };
      img.src = chain[0];
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
    const header = document.getElementById('header');
    parts.push('--- #header ---', header ? slim(header, 5000) : '(nenájdený)', '');
    const nav = document.querySelector('nav[aria-label="breadcrumb"]');
    parts.push('--- breadcrumb ---', nav ? slim(nav, 3000) : '(nenájdený)', '');
    scanPopups();
    const pops = [...document.querySelectorAll('.bu-pop')].filter((e) => e.offsetWidth && e.offsetHeight);
    parts.push('--- VIDITEĽNÉ MENU / POPUPY (' + pops.length + ') ---');
    pops.slice(0, 4).forEach((p) => parts.push(describe(p), slim(p, 5000), ''));
    const ok = await BU.copyText(parts.join('\n'));
    BU.toast(ok ? BU.t('dumped') : BU.t('copyFail'));
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
    if (m.type === 'bu-cmd') { if (m.name === 'pick') startPicker(); else dump(); }
  });
  document.addEventListener('keydown', (e) => {
    if (!isTop || !e.altKey || !e.shiftKey) return;
    if (e.code === 'KeyD') { e.preventDefault(); dump(); }
    else if (e.code === 'KeyI') { e.preventDefault(); startPicker(); }
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
  function swapLogo() {
    if (!isTop || offNow()) return;
    const img = document.getElementById('uis-logo') || [...document.images].find((i) => { const r = i.getBoundingClientRect(); return r.top < 150 && r.left < 400; });
    if (!img) return;
    if (!S.ui.logoSwap) {
      if (!img.dataset.sdLogo) return;
      img.onerror = null;
      img.src = img.dataset.sdOrigSrc;
      if (img.dataset.sdOrigTitle !== undefined) img.title = img.dataset.sdOrigTitle;
      delete img.dataset.sdLogo;
      return;
    }
    if (img.dataset.sdLogo) return;
    img.dataset.sdLogo = '1';
    img.dataset.sdOrigSrc = img.getAttribute('src') || '';
    img.dataset.sdOrigTitle = img.title || '';
    img.removeAttribute('srcset'); img.removeAttribute('width'); img.removeAttribute('height');
    img.src = chrome.runtime.getURL('logo.png');
    img.title = 'FEI STU – informácie o UIS';
  }

  /* ================= 11) Table-tools (zoradenie, filter, CSV) =================
     Len generické tabuľky: aspoň 2 dátové riadky a <th>. Tabuľky s formulárovými
     prvkami (prihlásenie na skúšky…) sa NESMÚ triediť – poradie riadkov je súčasť
     formulára. Pravidlo je testované v node ako BU.notif.hasFormControls; tu sa
     kontroluje rovnakým spôsobom cez DOM query. Marker data-bu-tt bráni slučke
     MutationObserver → init (opakovaná inicializácia by prekresľovala donekonečna). */
  const TT_EXCLUDE = '#bu-ctl, #bu-dialog, #bu-palette, .bu-pop, #uisFixedBox, #uisFloatingBox, .ui-dialog, .bu-keep';

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

  /* ================= 12) Dashboard hodnotení (E-index) =================
     Počíta len z tabuliek, ktoré sú práve na stránke. Oficiálne štatistiky
     UIS nechávame nedotknuté; panel je doplnok s viditeľnou značkou
     „neoficiálny prepočet“. Beží len v hlavnom frame a len na E-indexe. */
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
  function gradesDashboard() {
    if (!isTop || offNow()) return;
    const enabled = !S.grades || S.grades.on !== false;
    const existing = document.getElementById('bu-grades');
    if (!enabled) { if (existing) existing.remove(); return; }
    if (location.pathname.replace(/\/+$/, '') !== GRADES_PATH) { if (existing) existing.remove(); return; }
    const collected = collectGrades();
    const grades = collected.grades;
    if (!grades.length) { if (existing) existing.remove(); return; }
    const sum = BU.grades.summarize(grades, S.grades && S.grades.requiredCredits);
    const sig = JSON.stringify({ r: (S.grades && S.grades.requiredCredits) || 0, e: sum.earnedCredits, a: sum.average, c: sum.counts, f: sum.failed.map((g) => g.code), p: sum.periods });
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
      const req = Number(S.grades.requiredCredits) || 0;
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
          li.appendChild(document.createTextNode(' – ' + gr.subject));
        } else {
          li.textContent = (gr.code || gr.subject) + (gr.code ? ' – ' + gr.subject : '');
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

  /* ================= spúšťanie ================= */
  function runLightContentPass() { tagCards(); linksBar(); hideOriginals(); controls(); avatar(); tableTools(); gradesDashboard(); }
  function runHeavyDomScan() {
    if (!isTop) return;   // ťažké skeny (hlavička, boxy, logo, popupy, sémantika) len v hlavnom frame (P0-3)
    tagHeader(); tagBoxes(); swapLogo(); scanPopups(); semanticScan();
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
