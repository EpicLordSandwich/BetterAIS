// betterUIS – čistá logika zdieľaná content scriptom (bez chrome.* a DOMParsera),
// aby bola testovateľná v node: hľadanie bez diakritiky, table-tools, redakcia výpisu.
// background.js ju načíta cez importScripts; Firefox ju má v background.scripts.
(function (g) {
  'use strict';

  /* ===== hľadanie bez diakritiky (Ctrl+K, table-tools filter) ===== */
  // NFD rozloží diakritiku na combining marks a tie odstránime; výsledok je lowercase.
  /** Odstráni diakritiku a lowercasuje. @param {any} s @returns {string} */
  function stripDiacritics(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  // Fuzzy skóre pre paletu: zhoda substringu (bonus na začiatku) > subsekvenčná zhoda > 0.
  /** Fuzzy skóre pre vyhľadávanie (bez diakritiky). @param {string} q @param {string} s @returns {number} */
  function fuzzyScore(q, s) {
    q = stripDiacritics(q).trim();
    s = stripDiacritics(s);
    if (!q) return 1;
    const idx = s.indexOf(q);
    if (idx >= 0) return 100 - Math.min(idx, 50) + (idx === 0 ? 20 : 0);
    let i = 0;
    for (const ch of s) if (ch === q[i]) i++;
    return i === q.length ? 10 : 0;
  }

  /* ===== table-tools: porovnávanie a CSV (čisté funkcie) ===== */
  // Číslo: medzery/NBSP ako tisíce, čiarka aj bodka ako desatinný oddeľovač.
  /** Parsuje číslo z textu bunky (null ak nie je číslo). @param {any} v @returns {number|null} */
  function cellNum(v) {
    let s = String(v == null ? '' : v).replace(/[\s\u00a0\u202f]/g, '');
    if (!s) return null;
    // Keď sú prítomné oba oddeľovače, posledný je desatinný (1.234,5 → 1234.5).
    const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    if (lc !== -1 && ld !== -1) {
      if (lc > ld) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else {
      s = s.replace(',', '.');
    }
    if (!/^[-+]?\d+(?:\.\d+)?$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  // Dátum dd.mm.yyyy / d.m.y s voliteľným časom; neplatný vstup → null (fallback text).
  /** Parsuje dátum dd.mm.yyyy (s voliteľným časom). @returns {number|null} */
  function cellDate(v) {
    const m = /^\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*$/
      .exec(String(v == null ? '' : v).trim());
    if (!m) return null;
    const y = Number(m[3]), mo = Number(m[2]) - 1;
    const dt = new Date(y, mo, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
    if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== Number(m[1])) return null;
    return dt.getTime();
  }
  // Zoradenie: čísla → dátumy → text (sk collation, ch sa radí medzi h a i).
  // Rovnaké hodnoty → 0; Array.sort je od ES2019 stabilný, takže pôvodné poradie zostáva.
  /** Porovná dve bunky tabuľky (číslo/dátum/text). @param {any} a @param {any} b @returns {number} */
  function compareCells(a, b) {
    const na = cellNum(a), nb = cellNum(b);
    if (na != null && nb != null) return na - nb;
    const da = cellDate(a), db = cellDate(b);
    if (da != null && db != null) return da - db;
    return String(a == null ? '' : a).localeCompare(String(b == null ? '' : b), 'sk');
  }
  // Jeden riadok CSV: v úvozovkách, keď hodnota obsahuje ", oddeľovač alebo nový riadok.
  /** Z bunky/riadku vyrobí CSV (quoted pri potrebe). @param {any[]} cells @returns {string} */
  function toCsv(cells) {
    return (cells || []).map((c) => {
      const s = String(c == null ? '' : c);
      return /["\n\r,]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',');
  }
  // Tabuľka s formulárom (prihlásenie na skúšky…) sa nesmie triediť/filtrovať.
  /** Detekuje formulárové prvky v HTML bunkách. @param {string|string[]} cellsHtml @returns {boolean} */
  function hasFormControls(cellsHtml) {
    const re = /<\s*(input|select|textarea|button)\b/i;
    return (Array.isArray(cellsHtml) ? cellsHtml : [cellsHtml]).some((h) => re.test(String(h || '')));
  }

  /* ===== redakcia diagnostiky (P1-5): citlivé hodnoty v query a ISIC fotka preč ===== */
  // foto.pl odkazy → <foto>; hodnoty citlivých kľúčov → <n> (číslo) / <meno> (iné);
  // ďalšie dlhé číselné hodnoty v query (telefón, rodné číslo…) → <n>. Štvormiestne čísla
  // (roky) a krátke parametre ostávajú, aby dump zostal použiteľný na diagnostiku.
  /** Rediguje citlivé hodnoty v texte (query, foto.pl). @param {string} s @returns {string} */
  function redactText(s) {
    s = String(s || '');
    s = s.replace(/https?:\/\/[^"'\s]*foto\.pl[^"'\s]*/gi, '<foto>');
    s = s.replace(/([?;&](?:osobne_cislo|oid|uid|kod|token|pic|login|meno|user|name|email)=)([^&;"'\s]*)/gi,
      (m, k, v) => k + (/^\d+$/.test(v) ? '<n>' : '<meno>'));
    s = s.replace(/([?;&][^&;"'\s=]*=)(\d{5,})(?=&|;|"|'|\s|$)/g, (m, k) => k + '<n>');
    return s;
  }

  // Sémantické farby UIS: detekcia sýtých inline farieb (pure funkcie, testovateľné).
  const NAMED_COLORS = { red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', maroon: '#800000', navy: '#000080', teal: '#008080', olive: '#808000', lime: '#00ff00', aqua: '#00ffff', cyan: '#00ffff', fuchsia: '#ff00ff', magenta: '#ff00ff', gold: '#ffd700', silver: '#c0c0c0', gray: '#808080', grey: '#808080' };
  function parseCol(str) {
    str = (str || '').trim().toLowerCase();
    if (!str || str === 'transparent' || str === 'inherit') return null;
    if (NAMED_COLORS[str]) str = NAMED_COLORS[str];
    let m = /^#([0-9a-f]{3})$/.exec(str);
    if (m) return m[1].split('').map((c) => parseInt(c + c, 16) / 255).concat(1);
    m = /^#([0-9a-f]{6})/.exec(str);
    if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255).concat(1); }
    m = /^rgba?\(([^)]+)\)/.exec(str);
    if (m) {
      const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
      if (p.length >= 3 && p.slice(0, 3).every((v) => Number.isFinite(v))) {
        const alpha = p.length >= 4 && Number.isFinite(p[3]) ? p[3] : 1;
        return p.slice(0, 3).map((v) => Math.min(255, Math.max(0, v)) / 255).concat(alpha);
      }
    }
    return null;
  }
  function isSaturated(str) {
    const rgb = parseCol(str);
    if (!rgb || rgb[3] === 0) return false;
    const [r, g, b] = rgb;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx === mn) return false;
    const l = (mx + mn) / 2;
    const s = l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn);
    return s > 0.3 && l > 0.12 && l < 0.88;
  }

  g.BU = g.BU || {};
  g.BU.notif = { stripDiacritics, fuzzyScore, compareCells, cellNum, cellDate, toCsv, hasFormControls, redactText, parseCol, isSaturated };
  // Backward-compatible alias (some tests/old code still reference BUNOTIF).
  g.BUNOTIF = g.BU.notif;
})(self);
