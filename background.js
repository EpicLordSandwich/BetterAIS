// betterUIS – background (MV3 service worker / Firefox event page).


if (typeof importScripts === 'function') importScripts('themes.js', 'notifcore.js'); // Chrome SW; Firefox ich má v manifeste
(function () {
  'use strict';
  const BU = self.BU;
  if (!BU || !BU.notif) throw new Error('betterUIS core not loaded (themes.js/notifcore.js missing)');
// Úlohy: relay príkazov (open-options, chrome.commands) + notifikácie pošty (fáza 1, opt-in).
const MAIL_URL = 'https://is.stuba.sk/auth/posta/slozka.pl?lang=sk';
const UPDATE_URL = 'https://raw.githubusercontent.com/EpicLordSandwich/BetterAIS/main/manifest.json';
const UPDATE_ZIP = 'https://github.com/EpicLordSandwich/BetterAIS/archive/refs/heads/main.zip';
const ALARM = 'bu-mail';
const BADGE_COLOR = '#3f74d9';

/* ================= relay ================= */

chrome.commands.onCommand.addListener((name) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || tab.id == null) return;
    const p = chrome.tabs.sendMessage(tab.id, { type: 'bu-cmd', name });
    if (p && typeof p.catch === 'function') p.catch(() => {});   // Firefox vráti undefined, MV3 promise
  });
});

/* ================= notifikácie pošty (opt-in, iba čítanie) ================= */
const canPerm = () => BU.hasPermissionApi();

function hasPermission() {
  return new Promise((res) => {
    if (!canPerm()) return res(false);
    chrome.permissions.contains({ permissions: ['alarms', 'notifications'], ...BU.ORIGINS }, (ok) => {
      res(!chrome.runtime.lastError && !!ok);   // lastError musí byť prečítaný, inak Chrome hlási chybu
    });
  });
}

function settings() {
  return chrome.storage.local.get(BU.KEY).then((r) => BU.normalize(r[BU.KEY])).catch((e) => { swallow(e); return BU.normalize(null); });
}

function snapshot() {
  return chrome.storage.local.get(BU.NOTIF_KEY).then((r) => BU.notif.normalizeSnapshot(r[BU.NOTIF_KEY])).catch((e) => { swallow(e); return null; });
}
function saveSnapshot(snap) {
  return chrome.storage.local.set({ [BU.NOTIF_KEY]: BU.notif.normalizeSnapshot(snap) }).catch((e) => { swallow(e); });
}
function setBadge(text) {
  try {
    chrome.action.setBadgeText({ text: text || '' });
    chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  } catch (e) { swallow(e); }
}

// Pozn.: background (SW) číta chrome.storage priamo (nie BU.load), lebo SW kontext
// nemá sync-fallback potrebu (settings sú local-first) a BU.load vyžaduje storage.sync.
// settings() normalizuje cez BU.normalize; snapshot() cez BU.notif.normalizeSnapshot.
// Chrome MV3 service worker nemá DOM API; regex je aj testovateľný v node).

let inFlightPromise = null;

// Hlavná kontrola. Vracia { ok, count, status, at }.
// statusy: 'ok' | 'off' | 'login' | 'parse' | 'quiet' | 'error'
async function checkMail() {
  if (inFlightPromise) return inFlightPromise;   // súbežný volajúci čaká na ten istý výsledok (nie syntetický snapshot)
  const run = (async () => {
    const at = Date.now();
    try {
      if (!(await hasPermission())) return { ok: false, count: 0, status: 'off', at };
      const S = await settings();
      if (!S.notif.on) return { ok: false, count: 0, status: 'off', at };
      if (BU.notif.isQuiet(new Date().getHours(), S.notif.quietFrom, S.notif.quietTo)) return { ok: false, count: 0, status: 'quiet', at };

      let resp, html;
      try {
        resp = await fetch(MAIL_URL, { credentials: 'include', cache: 'no-store' });
        if (!resp.ok) return { ok: false, count: 0, status: 'error', at };
        html = await resp.text();
      } catch (e) { swallow(e); return { ok: false, count: 0, status: 'error', at }; }

      if (BU.notif.looksLikeLogin(html)) {
        setBadge('');
        await saveSnapshot({ at, status: 'login' });
        return { ok: false, count: 0, status: 'login', at };
      }

      const { count, ok: parsed } = BU.notif.countUnreadHtml(html);
      if (!parsed) return { ok: false, count: 0, status: 'parse', at };

      const prev = await snapshot();
      const prevCount = prev && prev.status === 'ok' ? prev.count : null;
      const d = BU.notif.decide(prevCount, count);
      setBadge(d.badge);
      await saveSnapshot({ at, count, status: 'ok', baseline: true });
      if (d.notify) notifyNew(count);
      return { ok: true, count, status: 'ok', at };
    } finally {
      // nothing; clearing handled below
    }
  })();
  inFlightPromise = run;
  run.finally(() => { inFlightPromise = null; });
  return run;
}

function notifyNew(count) {
  try {
    chrome.notifications.create('bu-mail-' + Date.now(), {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon128.png'),
      title: 'betterUIS – UIS pošta',
      message: 'Nové správy v UIS pošte: ' + count,
    });
  } catch (e) { swallow(e); }
}

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
    // Soft update: stiahne vzdialené témy (JSON) a zlúči ich do customThemes (len experimental).
    try {
      const r2 = await fetch('https://raw.githubusercontent.com/EpicLordSandwich/BetterAIS/main/updates/remote.json', { cache: 'no-store' });
      if (r2.ok) {
        const remote = await r2.json();
        if (remote && remote.themes && typeof remote.themes === 'object') {
          const curS = await settings();
          const merged = Object.assign({}, curS.customThemes || {}, remote.themes);
          await chrome.storage.local.set({ [BU.KEY]: Object.assign({}, curS, { customThemes: merged }) });
        }
      }
    } catch (e) { swallow(e); }
    return { ok: true, ...info };
  } catch (e) { swallow(e); return { ok: false, status: 'error' }; }
}

// Alarm drží v syncu s nastaveniami a permissionami (volá sa aj po zmene nastavení).
// Listeneri pre alarms/notifications sú optional permissions – bez udelenej permission môže byť
// API nedostupné, preto guarded registrácia + lazy re-registrácia (inak SW padne status 15).
let alarmListenerRegistered = false;
let notifClickListenerRegistered = false;
function ensureListeners() {
  try {
    if (!alarmListenerRegistered && chrome && chrome.alarms && chrome.alarms.onAlarm) {
      chrome.alarms.onAlarm.addListener((a) => {
        if (a && a.name === ALARM) checkMail().catch(() => ({ ok: false, count: 0, status: 'error', at: Date.now() }));
      });
      alarmListenerRegistered = true;
    }
  } catch (e) { swallow(e); }
  try {
    if (!notifClickListenerRegistered && chrome && chrome.notifications && chrome.notifications.onClicked) {
      chrome.notifications.onClicked.addListener((id) => {
        if (!String(id).startsWith('bu-mail-')) return;
        try { if (chrome.notifications && chrome.notifications.clear) chrome.notifications.clear(id); } catch (e) { swallow(e); }
        if (chrome.tabs && chrome.tabs.create) chrome.tabs.create({ url: MAIL_URL });
      });
      notifClickListenerRegistered = true;
    }
  } catch (e) { swallow(e); }
}
try { ensureListeners(); } catch (e) { swallow(e); }

async function ensureAlarm() {
  try { ensureListeners(); } catch (e) { swallow(e); }
  try {
    if (!chrome || !chrome.alarms) { setBadge(''); return; }
    if (!(await hasPermission())) { try { chrome.alarms.clear(ALARM); } catch (e) { swallow(e); } setBadge(''); return; }
    const S = await settings();
    if (S.notif.on) { try { chrome.alarms.create(ALARM, { delayInMinutes: 1, periodInMinutes: Math.max(15, S.notif.interval) }); } catch (e) { swallow(e); } }
    else { try { chrome.alarms.clear(ALARM); } catch (e) { swallow(e); } setBadge(''); }
  } catch (e) { try { if (chrome && chrome.alarms) chrome.alarms.clear(ALARM); } catch (e2) { swallow(e2); } setBadge(''); }
}

chrome.runtime.onInstalled.addListener(() => { ensureAlarm(); checkUpdate(); });
chrome.runtime.onStartup.addListener(() => { ensureAlarm(); checkUpdate(); });
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'local' && ch[BU.KEY]) { ensureAlarm(); checkUpdate(); }
});
// Permission odobraná mimo našich nastavení (chrome://extensions) → žiadna zastaraná hodnota, žiadny orphan alarm.
if (typeof chrome.permissions !== 'undefined' && chrome.permissions) {
  if (chrome.permissions.onRemoved) chrome.permissions.onRemoved.addListener(() => { ensureListeners(); ensureAlarm(); });
  if (chrome.permissions.onAdded) chrome.permissions.onAdded.addListener(() => { ensureListeners(); ensureAlarm(); });
}

// Manuálna kontrola z nastavení („Skúsiť teraz“).
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object' || sender.id !== chrome.runtime.id) return;
  if (msg.type === 'open-options') { chrome.runtime.openOptionsPage(); return; }
  if (msg.type === 'bu-notif-check') {
    checkMail().catch(() => ({ ok: false, count: 0, status: 'error', at: Date.now() })).then((r) => sendResponse(r));
    return true;                        // async sendResponse
  }
  if (msg.type === 'bu-update-check') {
    checkUpdate().then((r) => sendResponse(r));
    return true;
  }
});

})();
