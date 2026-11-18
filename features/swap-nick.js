(function () {
  'use strict';
  const BU = self.BU || window.BU;
  if (!BU || !BU.features) return;
  function offNow(state) {
    if (!state || !state.enabled) return true;
    try { return (state.disabledPages || []).includes(location.pathname); } catch (e) { return false; }
  }
  BU.features.register({
    name: 'swap-nick', frames: 'all', cost: 'light',
    run(state) {
      if (typeof document === 'undefined' || offNow(state)) return;
      const info = document.querySelector('#header .info');
      if (!info) return;
      const divs = [...info.querySelectorAll('div')];
      const nameDiv = divs.length ? divs[divs.length - 1] : null;
      if (!nameDiv) return;
      if (!nameDiv.dataset.buOrigName) nameDiv.dataset.buOrigName = nameDiv.textContent.trim();
      const orig = nameDiv.dataset.buOrigName;
      if (state && state.nick) nameDiv.textContent = state.nick;
      else nameDiv.textContent = orig;
    },
  });
})();
