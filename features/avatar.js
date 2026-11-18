(function () {
  'use strict';
  const BU = self.BU || window.BU;
  if (!BU || !BU.features) return;
  let S = (BU && BU.store) ? BU.store.get() : null;
  if (BU && BU.store) BU.store.subscribe((ns) => { S = ns; });
  function offNow(state) {
    if (!state || !state.enabled) return true;
    try { return (state.disabledPages || []).includes(location.pathname); } catch (e) { return false; }
  }
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
            fr.onload = () => { try { chrome.storage.local.set({ [AVATAR_SHOT_KEY]: { url: abs, data: String(fr.result) } }); } catch (e) { if (BU.log) BU.log.warn("avatar", e); } };
            fr.readAsDataURL(b);
          });
        });
      }).catch((e) => { if (BU.log) BU.log.warn("avatar", e); });
    } catch (e) { if (BU.log) BU.log.warn("avatar", e); }
  }
  function avatar() {
    if (offNow()) return;
    const mode = S.avatar.mode;
    const key = mode + ':' + (mode === 'custom' ? S.avatar.dataUrl.length : (mode === 'url' ? S.avatar.url.length : 0));
    const imgs = avatarCandidates();
    rememberIsicPhoto(imgs);
    imgs.forEach((img) => {
      if (mode === 'original' || (mode === 'custom' && !S.avatar.dataUrl) || (mode === 'url' && !S.avatar.url)) { restoreAvatar(img); return; }
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
      const chain = mode === 'custom' ? [S.avatar.dataUrl] : (mode === 'url' ? [S.avatar.url] : []);
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
  // adapter: original avatar() reads S; make it read state
  BU.features.register({
    name: 'avatar', frames: 'all', cost: 'light',
    run(state) {
      if (typeof document === 'undefined' || offNow(state)) return;
      S = state;
      // call the original avatar logic
      try { avatar(); } catch (e) { if (BU.log) BU.log.warn('avatar', e); }
    },
  });
})();
