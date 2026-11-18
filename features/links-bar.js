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
    name: 'links-bar', frames: 'top', cost: 'light',
    run(state) {
      if (typeof document === 'undefined' || offNow(state)) return;
      function linksBar() {
        if (window.top !== window || offNow(state)) return;
        const ol = document.querySelector('nav[aria-label="breadcrumb"] ol.breadcrumb');
        if (!ol) return;
        let li = ol.querySelector('li.bu-links');
        if (!state.links.length) { if (li) li.remove(); return; }
        if (!li) {
          const items = [...ol.children].filter((c) => c.tagName === 'LI' && !c.classList.contains('bu-links'));
          const anchor = items.find((x) => /Osobn[áa]\s+administrat[íi]va/i.test(x.textContent))
            || items[items.length - 1]
            || items[0];
          li = document.createElement('li');
          li.className = 'breadcrumb-item bu-links';
          if (anchor) anchor.after(li); else ol.appendChild(li);
        }
        const sig = JSON.stringify(state.links.map((l) => [l.id, l.name, l.url, l.icon])) + '|' + location.pathname;
        if (li.dataset.sig === sig) return;
        li.dataset.sig = sig;
        li.textContent = '';
        state.links.forEach((l) => {
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
          li.appendChild(a);
        });
      }
    },
  });
})();
