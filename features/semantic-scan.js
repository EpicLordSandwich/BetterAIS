(function(){'use strict';const BU=self.BU||window.BU;if(!BU||!BU.features)return;
  function offNow(state) { if (!state || !state.enabled) return true; try { return (state.disabledPages || []).includes(location.pathname); } catch (e) { return false; } }
BU.features.register({name:'semantic-scan',frames:'top',cost:'heavy',run(state){if(typeof document==='undefined'||offNow(state))return;
      function semanticScan() {
        if (offNow()) return;
        document.querySelectorAll('[bgcolor],[style]').forEach((el) => {
          if (el.classList.contains('bu-keep') || el.closest('nav, #header, .bu-card, #bu-ctl, #bu-toast, #bu-dialog, #bu-palette, #bu-pick, .bu-pop')) return;
          const bg = el.style.backgroundColor || el.getAttribute('bgcolor') || '';
          const fg = el.style.color || '';
          if ((bg && BU.notif.isSaturated(bg)) || (fg && BU.notif.isSaturated(fg))) el.classList.add('bu-keep');
        });
      }
    },});
})();
