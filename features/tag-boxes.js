(function(){'use strict';const BU=self.BU||window.BU;if(!BU||!BU.features)return;
  function offNow(state) { if (!state || !state.enabled) return true; try { return (state.disabledPages || []).includes(location.pathname); } catch (e) { return false; } }
BU.features.register({name:'tag-boxes',frames:'top',cost:'heavy',run(state){if(typeof document==='undefined')return;
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
    },});
})();
