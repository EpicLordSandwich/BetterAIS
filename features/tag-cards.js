(function () {
  'use strict';
  const BU = self.BU || window.BU;
  if (!BU || !BU.features) return;
  function offNow(state) { if (!state || !state.enabled) return true; try { return (state.disabledPages || []).includes(location.pathname); } catch (e) { return false; } }
  let rawCardHtmlLocal = '';
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
  function slim(el, max) { if (typeof BU.notif !== 'undefined' && BU.notif.slim) return BU.notif.slim(el, max); return ''; }
  BU.features.register({
    name: 'tag-cards', frames: 'all', cost: 'light',
    run(state) {
      if (typeof document === 'undefined' || offNow(state)) return;
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
            if (!rawCardHtmlLocal) rawCardHtmlLocal = slim(card, 5000);
      
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
            console.warn('betterUIS: tagCards, označených ' + tagged + '/' + total + ' kariet, hlavičiek ' + heads);
          }
          (window.__buTagStats = { total, tagged, heads, at: Date.now() });
        } catch (e) { swallow(e); }
      }
    },
  });
})();
