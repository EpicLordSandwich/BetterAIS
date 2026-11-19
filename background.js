// betterAIS – background (MV3 service worker / Firefox event page).
// Úlohy: relay príkazov (open-options, chrome.commands) + kontrola aktualizácií
// (experimental, iba na výslovnú žiadosť) + welcome po prvej inštalácii.

if (typeof importScripts === 'function') importScripts('themes.js', 'text-utils.js'); // Chrome SW; Firefox ich má v manifeste
(function () {
  'use strict';
  const BU = self.BU;
  if (!BU || !BU.notif) throw new Error('betterAIS core not loaded (themes.js/text-utils.js missing)');

const UPDATE_URL = 'https://api.github.com/repos/EpicLordSandwich/BetterAIS/releases/latest';
const UPDATE_ZIP = 'https://github.com/EpicLordSandwich/BetterAIS/releases/latest';

/* ================= relay ================= */

chrome.commands.onCommand.addListener((name) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || tab.id == null) return;
    const p = chrome.tabs.sendMessage(tab.id, { type: 'bu-cmd', name }, { frameId: 0 });
    if (p && typeof p.catch === 'function') p.catch(() => {});   // Firefox vráti undefined, MV3 promise
  });
});

function settings() {
  return chrome.storage.local.get(BU.KEY).then((r) => BU.normalize(r[BU.KEY])).catch((e) => { swallow(e); return BU.normalize(null); });
}

function isNewer(a, b) {
  const p = (v) => String(v || '').replace(/^v/, '').split('.').map((n) => Number(n) || 0);
  const [x, y] = [p(a), p(b)];
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}

/* ================= aktualizácie (experimental, iba na klik) ================= */

async function checkUpdate() {
  try {
    const S = await settings();
    if (!S.experimental) { await chrome.storage.local.remove('bu-update'); return { ok: false, status: 'off' }; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let resp, m;
    try {
      resp = await fetch(UPDATE_URL, { cache: 'no-store', signal: ctrl.signal });
      if (!resp.ok) return { ok: false, status: 'error' };
      m = await resp.json();
    } finally { clearTimeout(timer); }
    const cur = chrome.runtime.getManifest().version;
    const remoteVer = m && m.tag_name ? m.tag_name : (m && m.name ? m.name : '');
    const newer = isNewer(remoteVer, cur);
    const url = (m && m.html_url) ? m.html_url : UPDATE_ZIP;
    const info = { version: remoteVer, current: cur, available: newer, url, at: Date.now() };
    await chrome.storage.local.set({ 'bu-update': info });
    return { ok: true, ...info };
  } catch (e) { swallow(e); return { ok: false, status: 'error' }; }
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details && details.reason === 'install') {           // vitaj: raz otvor nastavenia po prvej inštalácii
    chrome.storage.local.get('bu-welcomed').then((r) => {
      if (!r || !r['bu-welcomed']) {
        chrome.storage.local.set({ 'bu-welcomed': true }).catch((e) => swallow(e));
        try { chrome.runtime.openOptionsPage(); } catch (e) { swallow(e); }
      }
    }).catch((e) => swallow(e));
  }
});

// Sync → local: jeden zapisovateľ (B2). Iba background prenáša vzdialené zmeny do local.
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'sync') return;
  try {
    const all = await chrome.storage.sync.get(null);
    const items = {};
    for (const [k, v] of Object.entries(all || {})) {
      if (k === 'bu:sync:core' || k.startsWith('bu:sync:snip:') || k.startsWith('bu:sync:theme:')) items[k] = v;
    }
    if (!Object.keys(items).length) return;
    // poskladaj core + shardy
    const core = items['bu:sync:core'] || {};
    const snippets = [];
    const customThemes = {};
    for (const [k, v] of Object.entries(items)) {
      if (k.startsWith('bu:sync:snip:')) snippets.push(v);
      else if (k.startsWith('bu:sync:theme:')) customThemes[k.slice('bu:sync:theme:'.length)] = v;
    }
    // snippet shards absent → keep local snippets (do not wipe with [])
    const remoteBase = { ...core, customThemes: Object.keys(customThemes).length ? customThemes : null };
    if (snippets.length) remoteBase.snippets = snippets;
    const remote = BU.normalize(remoteBase);
    const lr = await chrome.storage.local.get(BU.KEY).catch(() => ({}));
    const local = lr && lr[BU.KEY] ? BU.normalize(lr[BU.KEY]) : BU.normalize(null);
    const syncKeys = ['theme', 'mode', 'custom', 'links', 'enabled', 'ui', 'disabledPages', 'experimental', 'rename', 'snippets', 'customThemes'];
    const merged = BU.normalize({ ...local });
    for (const k of syncKeys) if (remote[k] !== undefined) merged[k] = remote[k];
    // lokálne polia (nick, avatar) ostanú z local
    merged.nick = local.nick;
    merged.avatar = local.avatar;
    await chrome.storage.local.set({ [BU.KEY]: merged });
  } catch (e) { swallow(e); }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object' || sender.id !== chrome.runtime.id) return;
  if (msg.type === 'open-options') { chrome.runtime.openOptionsPage(); return; }
  if (msg.type === 'bu-update-check') {
    checkUpdate().then((r) => sendResponse(r));
    return true;                        // async sendResponse
  }
});

})();
