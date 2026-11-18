(function(){'use strict';const BU=self.BU||window.BU;if(!BU||!BU.features)return;
  function offNow(state) { if (!state || !state.enabled) return true; try { return (state.disabledPages || []).includes(location.pathname); } catch (e) { return false; } }
BU.features.register({name:'tag-header',frames:'top',cost:'heavy',run(state){if(typeof document==='undefined')return;
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
    },});
})();
