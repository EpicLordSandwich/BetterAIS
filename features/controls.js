(function () {
  'use strict';
  const BU = self.BU || window.BU;
  if (!BU || !BU.features) return;
  function offNow(state) { if (!state || !state.enabled) return true; try { return (state.disabledPages || []).includes(location.pathname); } catch (e) { return false; } }
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
  BU.features.register({
    name: 'controls', frames: 'top', cost: 'light',
    run(state) {
      if (typeof document === 'undefined' || offNow(state)) return;
      if (window.top !== window) return;
      function controls() {
        if (window.top !== window || offNow(state)) return;
        const eff = BU.resolveMode(state.mode);
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
              const next = BU.resolveMode(state.mode) === 'dark' ? 'light' : 'dark';
              BU.store.set(BU.normalize(Object.assign({}, S, { mode: next })))
              applyAll(); BU.save(BU.store.get());
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
      
      /* ================= 5) Profilovka (len lokálne) ================= */
    },
  });
})();
