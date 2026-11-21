// Popup: rýchly režim/téma + vypínač betterAIS pre aktuálnu stránku.
(async function () {
  'use strict';
  if (!self.BU) throw new Error('betterAIS core not loaded (themes.js missing)');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = BU.t(el.dataset.i18n); });

  let S = await BU.load();
  const sel = document.getElementById('theme');
  const fillThemes = () => {
    sel.innerHTML = '';
    Object.entries(BU.THEMES).forEach(([id, t]) => {
      const o = document.createElement('option'); o.value = id; o.textContent = t.name + ' - ' + t.tagline; sel.appendChild(o);
    });
    Object.entries(S.customThemes || {}).forEach(([id, t]) => {
      const o = document.createElement('option'); o.value = id; o.textContent = '★ ' + t.name; sel.appendChild(o);
    });
  };

  // Aktuálna karta – URL je dostupná vďaka activeTab (udelené kliknutím na ikonku).
  let path = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && /^https:\/\/is\.stuba\.sk\//.test(tab.url)) path = new URL(tab.url).pathname;
  } catch (e) { swallow(e); }

  const pt = document.getElementById('pageToggle');
  const pp = document.getElementById('pagePath');
  const renderPageToggle = () => {
    if (!path) { pt.disabled = true; pt.textContent = BU.t('notUIS'); pp.textContent = ''; return; }
    pt.disabled = false;
    pt.textContent = S.disabledPages.includes(path) ? BU.t('enableHere') : BU.t('disableHere');
    pp.textContent = path;
  };
  const render = () => {
    BU.applyVars(BU.compute(S));
    sel.value = (S.theme in BU.THEMES || (S.customThemes && S.theme in S.customThemes)) ? S.theme : 'classic';
    const fixed = !!(BU.THEMES[S.theme] && BU.THEMES[S.theme].mode);
    document.getElementById('mode').hidden = fixed;
    document.getElementById('modeHead').hidden = fixed;
    document.querySelectorAll('#mode button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.mode));
    renderPageToggle();
  };
  const commit = async (p) => {
    const fresh = await BU.load();          // proti stale-state: vždy základ z úložiska, nie z pamäte
    S = BU.normalize(Object.assign({}, fresh, p));
    await BU.save(S);
    render();
  };

  fillThemes();
  try { chrome.runtime.sendMessage({ type: 'bu-update-check' }, () => { void chrome.runtime.lastError; }); } catch (e) {}   // refresh dostupnosti novej verzie
  document.querySelectorAll('#mode button').forEach((b) => (b.onclick = () => commit({ mode: b.dataset.v })));
  sel.onchange = () => commit({ theme: sel.value });
  pt.onclick = () => {
    if (!path) return;
    const off = S.disabledPages.includes(path);
    const pages = off ? S.disabledPages.filter((p) => p !== path) : S.disabledPages.concat([path]);
    commit({ disabledPages: pages });
  };
  document.getElementById('more').onclick = () => chrome.runtime.openOptionsPage();

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area === 'local' && ch[BU.KEY] && ch[BU.KEY].newValue) { S = BU.normalize(ch[BU.KEY].newValue); fillThemes(); render(); }
    });
  }
  render();
})();
