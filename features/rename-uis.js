// Feature: premenovanie UIS → AIS v texte (opt-in).
(function () {
  'use strict';
  const BU = (typeof self !== 'undefined' && self.BU) ? self.BU : (typeof window !== 'undefined' ? window.BU : null);
  if (!BU || !BU.features) return;
  const RENAME_SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1, NOSCRIPT: 1 };
  const RENAME_RE = /\bUIS\b/;
  const RENAME_RE_G = /\bUIS\b/g;
  function pagePath() {
    try { return location.pathname; } catch (e) { return ''; }
  }
  function offNow(state) {
    if (!state || !state.enabled) return true;
    const paths = Array.isArray(state.disabledPages) ? state.disabledPages : [];
    return paths.includes(pagePath());
  }
  BU.features.register({
    name: 'rename-uis', frames: 'all', cost: 'light',
    run(state) {
      if (offNow(state) || !(state && state.rename && state.rename.uisToAis)) return;
      if (typeof document === 'undefined') return;
      if (window.top === window && RENAME_RE.test(document.title)) document.title = document.title.replace(RENAME_RE_G, 'AIS');
      const body = document.body;
      if (!body) return;
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.nodeValue && RENAME_RE.test(n.nodeValue) && n.parentElement && !RENAME_SKIP[n.parentElement.tagName] && !n.parentElement.closest('#bu-palette')
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
      });
      let n, count = 0;
      while ((n = walker.nextNode()) && count < 4000) {
        n.nodeValue = n.nodeValue.replace(RENAME_RE_G, 'AIS');
        count++;
      }
    },
  });
})();
