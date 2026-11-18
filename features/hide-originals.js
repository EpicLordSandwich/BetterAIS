(function () {
  'use strict';
  const BU = self.BU || window.BU;
  if (!BU || !BU.features) return;
  function offNow(state) {
    if (!state || !state.enabled) return true;
    try { return (state.disabledPages || []).includes(location.pathname); } catch (e) { return false; }
  }
  BU.features.register({
    name: 'hide-originals', frames: 'all', cost: 'light',
    run(state) {
      if (typeof document === 'undefined') return;
      if (offNow(state)) return;
      let rules = [];
      try { rules = (state.links || []).filter((l) => l.hideOriginal).map((l) => { try { return new URL(l.url, location.origin); } catch (e) { return null; } }).filter(Boolean); } catch (e) { rules = []; }
      if (!rules.length) { document.querySelectorAll('.bu-hide').forEach((el) => el.classList.remove('bu-hide')); return; }
      document.querySelectorAll('.bu-card a[href], .mainpage a[href], #stranka a[href]').forEach((a) => {
        if (a.closest('.bu-links, #header, nav')) return;
        let u; try { u = new URL(a.getAttribute('href'), location.origin); } catch (e) { return; }
        const hit = rules.some((r) => r.pathname === u.pathname && (!r.search || r.search === u.search));
        (a.closest('li') || a).classList.toggle('bu-hide', hit);
      });
    },
  });
})();
