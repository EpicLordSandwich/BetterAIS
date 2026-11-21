// Čistá logika rozvrhu: parser surového HTML z rozvrhy_view.pl a práca s dátumami.
// Žiadny DOM, žiadne chrome.* – beží v node aj v content scripte.
(function (g) {
  'use strict';
  const BU = (g.BU = g.BU || {});
  const ORIGIN = 'https://is.stuba.sk';
  const PATH = '/auth/katalog/rozvrhy_view.pl';
  const DAY_INDEX = { Po: 1, Ut: 2, St: 3, Št: 4, Pi: 5 };
  const DAY_ALIAS = { Mon: 'Po', Tue: 'Ut', Wed: 'St', Thu: 'Št', Fri: 'Pi', 'Štvrtok': 'Št', 'Streda': 'St' };

  function decode(s) {
    return String(s == null ? '' : s)
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"').replace(/&#0*39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  }
  function text(html) {
    return decode(String(html || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  }
  function attr(tagAttrs, name) {
    const m = new RegExp('\\b' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i').exec(tagAttrs || '');
    return m ? decode(m[1] || m[2] || m[3] || '') : '';
  }
  function hasClass(tagAttrs, cls) {
    return new RegExp('(?:^|\\s)' + cls + '(?:\\s|$)', 'i').test(attr(tagAttrs, 'class'));
  }
  function links(html) {
    const out = [];
    const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html || ''))) out.push({ href: attr(m[1], 'href'), text: text(m[2]) });
    return out;
  }
  function refs(html) {
    const out = [];
    const re = /<sup>\s*\((\d+)\)\s*<\/sup>/gi;
    let m;
    while ((m = re.exec(html || ''))) out.push(Number(m[1]));
    return out;
  }
  function safeUrl(href, base) {
    if (!href) return '';
    try {
      const u = new URL(href, base || ORIGIN);
      if (!/^https?:$/.test(u.protocol) || !/(^|\.)is\.stuba\.sk$/i.test(u.hostname)) return '';
      return u.href;
    } catch (e) { return ''; }
  }
  function hhmm(min) {
    const h = Math.floor(min / 60), m = min % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function fmtDate(d) { return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear(); }
  function weekRange(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const to = new Date(d); to.setDate(to.getDate() + 6);
    return { from: fmtDate(d), to: fmtDate(to) };
  }
  function isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }
  function buildScheduleUrl(id, from, to, type) {
    const params = [
      'rozvrh_student=' + encodeURIComponent(String(id || '')),
      'zobraz=1', 'format=html',
      'typ_vypisu=' + (type || 'souhrn'),
      'konani_od=' + encodeURIComponent(from),
      'konani_do=' + encodeURIComponent(to),
      'poznamky=1', 'lang=sk',
    ];
    return ORIGIN + PATH + '?' + params.join(';');
  }

  function tables(html) {
    const out = [];
    const re = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
    let m;
    while ((m = re.exec(html || ''))) out.push({ tag: m[0], body: m[1] });
    return out;
  }
  function rows(html) {
    const out = [];
    const re = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi;
    let m;
    while ((m = re.exec(html || ''))) out.push({ attrs: m[1], body: m[2] });
    return out;
  }
  function cells(row) {
    const out = [];
    const re = /<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi;
    let m;
    while ((m = re.exec(row || ''))) out.push({ attrs: m[1], body: m[2] });
    return out;
  }
  function mainTable(html) {
    return tables(html).find((t) => {
      const thead = /<thead\b[^>]*>([\s\S]*?)<\/thead>/i.exec(t.body);
      if (!thead || !/<tr\b[^>]*class\s*=\s*"[^"]*\bzahlavi\b/i.test(thead[1])) return false;
      return /<t[dh]\b[^>]*class\s*=\s*"[^"]*\brozvrh-(?:pred|cvic)\b/i.test(t.body);
    }) || null;
  }
  function dayOf(label) {
    const s = text(label);
    if (DAY_INDEX[s]) return s;
    if (DAY_ALIAS[s]) return DAY_ALIAS[s];
    const m = /^(Po|Ut|St|Št|Pi)\b/.exec(s);
    return m ? m[1] : '';
  }

  function parseSchedule(html, fetchUrl) {
    const empty = { validFrom: '', validTo: '', notes: {}, events: [] };
    const main = mainTable(html);
    if (!main) return empty;
    const vm = /konani_od=(\d{2}\.\d{2}\.\d{4})/.exec(fetchUrl || '');
    const tm = /konani_do=(\d{2}\.\d{2}\.\d{4})/.exec(fetchUrl || '');
    const notes = {};
    tables(html).forEach((t) => {
      if (t === main) return;
      rows(t.body).forEach((r) => cells(r.body).forEach((c) => {
        const m = /^\((\d+)\)\s*(.+)$/.exec(text(c.body));
        if (m) notes[m[1]] = m[2];
      }));
    });
    const tbody = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i.exec(main.body);
    const body = tbody ? tbody[1] : main.body.replace(/<thead\b[^>]*>[\s\S]*?<\/thead>/gi, '');
    const events = [];
    let day = '';
    rows(body).forEach((r) => {
      if (hasClass(r.attrs, 'rozvrh-sep')) { day = ''; return; }
      let col = 0;
      cells(r.body).forEach((c) => {
        const colspan = Math.max(1, parseInt(attr(c.attrs, 'colspan'), 10) || 1);
        if (hasClass(c.attrs, 'zahlavi')) {
          const d = dayOf(c.body);
          if (d) day = d;
        } else if (day && (hasClass(c.attrs, 'rozvrh-pred') || hasClass(c.attrs, 'rozvrh-cvic'))) {
          const ls = links(c.body);
          const roomLink = ls.find((l) => /mistnost/i.test(l.href));
          const subjLink = ls.find((l) => /predmet=/.test(l.href));
          const teachLink = ls.find((l) => /clovek\.pl/i.test(l.href));
          const roomParts = (roomLink ? roomLink.text : '').split(/\s*\/\s*/);
          const subjectId = subjLink ? (/[?;&]predmet=([^&;"']+)/.exec(subjLink.href) || [])[1] || '' : '';
          events.push({
            day,
            start: hhmm(8 * 60 + 5 * col),
            end: hhmm(8 * 60 + 5 * (col + colspan)),
            type: hasClass(c.attrs, 'rozvrh-pred') ? 'pred' : 'cvic',
            room: roomParts[0] || '',
            group: roomParts.slice(1).join(' / '),
            subject: subjLink ? subjLink.text : text(c.body),
            subjectId: decode(subjectId),
            teacher: teachLink ? teachLink.text : '',
            noteRefs: refs(c.body),
            url: safeUrl(subjLink && subjLink.href, fetchUrl),
            roomUrl: safeUrl(roomLink && roomLink.href, fetchUrl),
            teacherUrl: safeUrl(teachLink && teachLink.href, fetchUrl),
          });
        }
        col += colspan;
      });
    });
    return { validFrom: vm ? vm[1] : '', validTo: tm ? tm[1] : '', notes, events };
  }

  function isEventActive(event, notes, date, groups) {
    if (!event || !date) return false;
    if (DAY_INDEX[event.day] !== ((date.getDay() + 6) % 7) + 1) return false;
    const wanted = (groups || []).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
    for (const ref of event.noteRefs || []) {
      const note = notes[ref] || '';
      const parity = /(ne)?párny\s+týždeň/i.exec(note);
      if (parity && (isoWeek(date) % 2 === 0) === !!parity[1]) return false;
      const free = /Voľný\s+deň:\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/i.exec(note);
      if (free && Number(free[1]) === date.getDate() && Number(free[2]) === date.getMonth() + 1 && Number(free[3]) === date.getFullYear()) return false;
      const only = /Určené\s+pre:\s*(.+)$/i.exec(note);
      if (only && wanted.length && !only[1].toLowerCase().split(/[,;/ ]+/).some((x) => wanted.includes(x))) return false;
    }
    return true;
  }

  function isScheduleOrLegend(html) {
    return /<t[dh]\b[^>]*class\s*=\s*"[^"]*\brozvrh-(?:pred|cvic)\b/i.test(html || '')
      || /<table\b[^>]*class\s*=\s*"[^"]*\buisLegend\b/i.test(html || '');
  }

  BU.schedule = { parseSchedule, schedMainTable: (html) => !!mainTable(html), isScheduleOrLegend, buildScheduleUrl, weekRange, isoWeek, isEventActive, fmtDate, DAY_INDEX };
})(self);
