(function () {
  'use strict';
  const BU = self.BU || window.BU;
  if (!BU || !BU.features) return;
  function offNow(state) { if (!state || !state.enabled) return true; try { return (state.disabledPages || []).includes(location.pathname); } catch (e) { return false; } }
  function sameOrigin(u) { try { return new URL(u, location.origin).origin === location.origin; } catch (e) { return false; } }
  function svgIcon(name) { const p = (BU.ICONS && BU.ICONS[name]) || ''; return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'; }
  function findDocBadge() {
    try {
      const candidates = [...document.querySelectorAll('.badge')];
      for (const b of candidates) {
        const txt = (b.textContent || '').trim();
        if (!/^\d+$/.test(txt)) continue;
        const link = b.closest('a') || (b.parentElement && b.parentElement.closest('a'));
        const ctx = (link ? link.getAttribute('href') : '') + ' ' + (link ? link.textContent : '') + ' ' + (b.parentElement ? b.parentElement.textContent : '');
        if (/dok_server|dokument/i.test(ctx)) return txt;
      }
      for (const b of candidates) {
        const txt = (b.textContent || '').trim();
        if (/^\d+$/.test(txt) && b.closest('#header, .sd-header, nav, .info')) return txt;
      }
    } catch (e) { if (BU.log) BU.log.warn('links-bar:findDocBadge', e); }
    return null;
  }
  function findMailBadge() {
    try {
      const candidates = [...document.querySelectorAll('.badge')];
      for (const b of candidates) {
        const txt = (b.textContent || '').trim();
        if (!/^\d+$/.test(txt)) continue;
        const link = b.closest('a') || (b.parentElement && b.parentElement.closest('a'));
        const ctx = (link ? link.getAttribute('href') : '') + ' ' + (link ? link.textContent : '') + ' ' + (b.parentElement ? b.parentElement.textContent : '');
        if (/mail|po[šs]ta|spr[aá]v/i.test(ctx)) return txt;
      }
    } catch (e) { if (BU.log) BU.log.warn('links-bar:findMailBadge', e); }
    return null;
  }
  BU.features.register({
    name: 'links-bar', frames: 'top', cost: 'light',
    run(state) {
      if (typeof document === 'undefined' || offNow(state)) return;
      if (window.top !== window) return;
      const ol = document.querySelector('nav[aria-label="breadcrumb"] ol.breadcrumb');
      if (!ol) return;
      let li = ol.querySelector('li.bu-links');
      if (!state.links || !state.links.length) { if (li) li.remove(); return; }
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
        try { isOn = new URL(l.url, location.origin).pathname === location.pathname; } catch (e) {}
        a.className = 'bu-link' + (isOn ? ' on' : '');
        if (!sameOrigin(l.url)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        const ic = document.createElement('span');
        ic.className = 'bu-link-ic';
        ic.innerHTML = svgIcon(l.icon);
        const tx = document.createElement('span');
        tx.textContent = l.name;
        a.append(ic, tx);
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
    },
  });
})();
