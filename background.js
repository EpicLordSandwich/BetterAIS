// betterUIS – background (MV3 service worker / Firefox event page).
// Úlohy: relay príkazov (open-options, chrome.commands) + kontrola aktualizácií
// (experimental) + soft-update tém z GitHubu + welcome po prvej inštalácii.
// Kontrola pošty bola odstránená (ľudia majú forwarding).

if (typeof importScripts === 'function') importScripts('themes.js', 'notifcore.js'); // Chrome SW; Firefox ich má v manifeste
(function () {
  'use strict';
  const BU = self.BU;
  if (!BU || !BU.notif) throw new Error('betterUIS core not loaded (themes.js/notifcore.js missing)');

const UPDATE_URL = 'https://raw.githubusercontent.com/EpicLordSandwich/BetterAIS/main/manifest.json';
const UPDATE_ZIP = 'https://github.com/EpicLordSandwich/BetterAIS/archive/refs/heads/main.zip';
const REMOTE_THEMES_URL = 'https://raw.githubusercontent.com/EpicLordSandwich/BetterAIS/main/updates/remote.json';

/* ================= relay ================= */

chrome.commands.onCommand.addListener((name) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || tab.id == null) return;
    const p = chrome.tabs.sendMessage(tab.id, { type: 'bu-cmd', name });
    if (p && typeof p.catch === 'function') p.catch(() => {});   // Firefox vráti undefined, MV3 promise
  });
});

function settings() {
  return chrome.storage.local.get(BU.KEY).then((r) => BU.normalize(r[BU.KEY])).catch((e) => { swallow(e); return BU.normalize(null); });
}

/* ================= aktualizácie (experimental) ================= */

async function checkUpdate() {
  try {
    const S = await settings();
    if (!S.experimental) { await chrome.storage.local.remove('bu-update'); return { ok: false, status: 'off' }; }
    const resp = await fetch(UPDATE_URL, { cache: 'no-store' });
    if (!resp.ok) return { ok: false, status: 'error' };
    const m = await resp.json();
    const cur = chrome.runtime.getManifest().version;
    const newer = String(m.version) !== String(cur);
    const info = { version: m.version, current: cur, available: newer, url: UPDATE_ZIP, at: Date.now() };
    await chrome.storage.local.set({ 'bu-update': info });
    return { ok: true, ...info };
  } catch (e) { swallow(e); return { ok: false, status: 'error' }; }
}

async function fetchRemoteThemes() {
  try {
    const now = Date.now();
    const r = await chrome.storage.local.get('bu-remote-ts');
    const last = (r && r['bu-remote-ts']) || 0;
    if (now - last < 24 * 60 * 60 * 1000) return; // raz denne
    const resp = await fetch(REMOTE_THEMES_URL, { cache: 'no-store' });
    if (!resp.ok) return;
    const remote = await resp.json();
    if (!remote || !remote.themes || typeof remote.themes !== 'object') return;
    const S = await settings();
    const merged = Object.assign({}, S.customThemes || {}, remote.themes);
    await chrome.storage.local.set({ [BU.KEY]: Object.assign({}, S, { customThemes: merged }), 'bu-remote-ts': now });
  } catch (e) { swallow(e); }
}

chrome.runtime.onInstalled.addListener((details) => {
  checkUpdate(); fetchRemoteThemes();
  if (details && details.reason === 'install') {           // vitaj: raz otvor nastavenia po prvej inštalácii
    chrome.storage.local.get('bu-welcomed').then((r) => {
      if (!r || !r['bu-welcomed']) {
        chrome.storage.local.set({ 'bu-welcomed': true }).catch((e) => swallow(e));
        try { chrome.runtime.openOptionsPage(); } catch (e) { swallow(e); }
      }
    }).catch((e) => swallow(e));
  }
});
chrome.runtime.onStartup.addListener(() => { checkUpdate(); fetchRemoteThemes(); });
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'local' && ch[BU.KEY]) { checkUpdate(); fetchRemoteThemes(); }
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
