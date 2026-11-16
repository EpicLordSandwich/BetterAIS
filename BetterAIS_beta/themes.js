// Spoločné pre content script, popup aj nastavenia: témy, výpočet CSS premenných, ukladanie, i18n.
// Toto je jediné „jadro“ betterUIS – všetko ostatné len číta BU.*.
(function (g) {
  'use strict';

  // Spoločný pomocník pre „ignorované“ výnimky (jedno miesto, nie kópia boilerplate).
  // Zaznamená príčinu (debug), aby bolo možné diagnostikovať problémy, ale nespadne.
  const swallow = (e) => { try { if (e) console.debug('betterUIS:swallowed', e); } catch (err) { void err; } };
  g.swallow = swallow;

  // P(bg0 hlavička, bg pozadie, bg2 karty, bg3 hlavičky kariet/hover, border, text, muted, link, accent, info, warn, crit)
  // onAccent sa vždy dopočíta automaticky z accentu ( funkcia contrast() ), ručne sa neuvádza.
  const P = (bg0, bg, bg2, bg3, border, text, muted, link, accent, info, warn, crit) =>
    ({ bg0, bg, bg2, bg3, border, text, muted, link, accent, info, warn, crit });

  const ROUND = 'ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI", system-ui, sans-serif';

  const THEMES = {
    claude: {
      name: 'Claude', tagline: 'Teplé odtiene sivej (pôvodná téma)', radius: 12, font: '',
      dark:  P('#1f1e1d', '#262624', '#2f2e2c', '#3a3936', '#4a4844', '#f0eee6', '#b8b5aa', '#8cb4e6', '#3f74d9', '#5b9bf0', '#e0a73e', '#e8756c'),
      light: P('#ebe8de', '#f5f4ee', '#ffffff', '#ece9df', '#d9d5c7', '#2b2a27', '#6b675d', '#1f5fbf', '#3f74d9', '#2e6ccb', '#966319', '#c53b30'),
    },
    sleek: {
      name: 'Sleek', tagline: 'Minimalistická, ostrá, takmer čierna', radius: 8, font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      dark:  P('#08090b', '#0d0e11', '#14161a', '#1c1f25', '#262a31', '#e8eaed', '#8b919a', '#9db4ff', '#6d7cff', '#7aa2ff', '#e6b450', '#f06a6a'),
      light: P('#ffffff', '#f6f7f9', '#ffffff', '#eef0f3', '#e1e4e8', '#14161a', '#6a717b', '#3a4bd8', '#4f5df0', '#3a63e0', '#99651a', '#d03a3a'),
    },
    nord: {
      name: 'Nord', tagline: 'Chladná arktická modrosivá', radius: 10, font: '',
      dark:  P('#272c36', '#2e3440', '#3b4252', '#434c5e', '#4c566a', '#eceff4', '#aab3c5', '#88c0d0', '#5e81ac', '#99b3cd', '#ebcb8b', '#d9a2a7'),
      light: P('#e5e9f0', '#eceff4', '#f8f9fb', '#e5e9f0', '#d8dee9', '#2e3440', '#4c566a', '#4d6d95', '#5e81ac', '#496e94', '#a85237', '#b24852'),
    },
    bloom: {
      name: 'Bloom', tagline: 'Pastelová ružová, veľmi zaoblená', radius: 20, font: ROUND,
      dark:  P('#221a25', '#2a2030', '#362a3d', '#45354d', '#5a4663', '#fbeaf3', '#cdb3c4', '#f7a8d2', '#ec6fa8', '#b69cf2', '#f2c078', '#f27a8a'),
      light: P('#ffe9f3', '#fff5fa', '#ffffff', '#ffe3ef', '#f4c6da', '#4a2b3b', '#8a6678', '#c2417d', '#e0558f', '#8258cf', '#966716', '#d13148'),
    },
    comfy: {
      name: 'Comfy', tagline: 'Útulná hnedá, krémová a mäkké rohy', radius: 16, font: ROUND,
      dark:  P('#221c18', '#2b2420', '#362d27', '#443830', '#5a4a3f', '#f3e6d3', '#c2ae96', '#e8b47a', '#d08a4e', '#8fb8a0', '#e5b25d', '#e27a6a'),
      light: P('#f1e4cf', '#faf3e8', '#fffaf1', '#f0e3cf', '#e0cfb4', '#4a3a2c', '#7d6a57', '#a35c1e', '#c47a35', '#45785d', '#966319', '#b9473a'),
    },
    catppuccin: {
      name: 'Catppuccin', tagline: 'Mocha (tmavá) / Latte (svetlá)', radius: 12, font: '',
      dark:  P('#11111b', '#1e1e2e', '#2a2b3c', '#313244', '#45475a', '#cdd6f4', '#a6adc8', '#89b4fa', '#89b4fa', '#89dceb', '#f9e2af', '#f38ba8'),
      light: P('#dce0e8', '#eff1f5', '#f7f8fb', '#e6e9ef', '#ccd0da', '#4c4f69', '#686b81', '#145ff5', '#8839ef', '#0374a1', '#986014', '#d20f39'),
    },
    dracula: {
      name: 'Dracula', tagline: 'Tmavá s neónovými akcentmi', radius: 10, font: '',
      dark:  P('#21222c', '#282a36', '#303341', '#44475a', '#565a72', '#f8f8f2', '#b4b8d0', '#8be9fd', '#8be9fd', '#8be9fd', '#ffb86c', '#ff6f6f'),
      light: P('#ecebf5', '#f8f8f2', '#ffffff', '#ebebf5', '#d5d5e6', '#282a36', '#636a8a', '#6a4fd6', '#187a95', '#187a95', '#a65f00', '#d42f2f'),
    },
    gruvbox: {
      name: 'Gruvbox', tagline: 'Retro teplé zemité farby', radius: 6, font: 'ui-monospace, "JetBrains Mono", "Cascadia Code", Consolas, monospace',
      dark:  P('#1d2021', '#282828', '#32302f', '#3c3836', '#504945', '#ebdbb2', '#a89984', '#83a598', '#d79921', '#8ec07c', '#fabd2f', '#fc6b5a'),
      light: P('#ebdbb2', '#fbf1c7', '#f9f5d7', '#ebdbb2', '#d5c4a1', '#3c3836', '#766a60', '#076678', '#b57614', '#407755', '#956111', '#9d0006'),
    },
    stu: {
      name: 'STU modrá', tagline: 'Hlboká námornícka modrá podľa FEI', radius: 12, font: '',
      dark:  P('#0b1a33', '#0f2342', '#15305a', '#1c3c70', '#2a4f8a', '#eaf1ff', '#a9bddf', '#7fb2ff', '#2f7bff', '#7fb2ff', '#f0b94d', '#ff6b6b'),
      light: P('#dbe7fb', '#f2f6fd', '#ffffff', '#e3ecfb', '#c6d6f1', '#0f2342', '#4d6389', '#1c56c4', '#2f6fe0', '#2769df', '#98641a', '#c93a3a'),
    },
    oled: {
      name: 'OLED', tagline: 'Čistá čierna, šetrí batériu', radius: 10, font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      dark:  P('#000000', '#000000', '#0b0b0c', '#161618', '#26262a', '#f2f2f3', '#8e8e93', '#6cb2ff', '#0a84ff', '#64d2ff', '#ffd60a', '#ff453a'),
      light: P('#ffffff', '#f2f2f7', '#ffffff', '#e9e9ee', '#d8d8de', '#111111', '#6e6e73', '#0a63d6', '#0a84ff', '#006ad6', '#956219', '#cf2e23'),
    },
    og: {
      name: 'OG AIS', tagline: 'Pôvodný AIS/UIS: bordová, krémová, čierny text', radius: 0, font: 'Verdana, Tahoma, "Segoe UI", sans-serif', bar: { color: '#831135', text: '#ffffff' },
      dark:  P('#3a0a1c', '#1b1315', '#241a1d', '#2f2226', '#4a343a', '#f5ecef', '#c9b3b8', '#f0a3b8', '#c94d6e', '#7fb8ff', '#e8b45a', '#ff8a7a'),
      light: P('#f3e6ea', '#ffffff', '#fffdfa', '#f2f2f2', '#d9d9d9', '#333333', '#666666', '#831135', '#831135', '#1565c0', '#8a5a00', '#b3261e'),
    },
    nothing: {
      name: 'Nothing', tagline: 'Monochromatická, technická, OLED čierna', radius: 8, font: 'Space Grotesk, "DM Sans", system-ui, sans-serif',
      dark:  P('#000000', '#000000', '#111111', '#1a1a1a', '#333333', '#e8e8e8', '#999999', '#5b9bf6', '#d71921', '#999999', '#d4a843', '#e83c43'),
      light: P('#f5f5f5', '#f5f5f5', '#ffffff', '#f0f0f0', '#cccccc', '#1a1a1a', '#666666', '#006bdf', '#d71921', '#666666', '#8a6a20', '#d71921'),
    },
    techy: {
      name: 'Techy', tagline: 'Modrá technická, ostré rohy', radius: 6, font: 'ui-monospace, "JetBrains Mono", "Fira Code", Consolas, monospace',
      dark:  P('#0a0a0a', '#0d1117', '#161b22', '#21262d', '#30363d', '#e6edf3', '#8b949e', '#58a6ff', '#00a8e9', '#58a6ff', '#e0a73e', '#ff4b33'),
      light: P('#f6f8fa', '#ffffff', '#f6f8fa', '#eaeef2', '#d0d7de', '#1f2328', '#59636e', '#0969da', '#0061d8', '#0969da', '#9a6700', '#cf222e'),
    },
    clean: {
      name: 'Clean', tagline: 'Editorial, teplá červená (Fajnorka)', radius: 8, font: 'Space Grotesk, system-ui, sans-serif',
      dark:  P('#0a0a0a', '#141414', '#1f1f1f', '#2a2a2a', '#3a3a3a', '#f5f5f5', '#9a9a9a', '#4a9eff', '#cc2222', '#4a9eff', '#e0a73e', '#e45a5a'),
      light: P('#faf9f6', '#faf9f6', '#ffffff', '#f0f0f0', '#dddddd', '#0a0a0a', '#6b6b6b', '#1a6bcc', '#cc2222', '#1a6bcc', '#966319', '#cc2222'),
    },
  };

  const FONTS = [
    { label: 'Podľa témy', value: '' },
    { label: 'Systémové', value: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
    { label: 'Zaoblené', value: ROUND },
    { label: 'Humanistické', value: '"Segoe UI", Candara, "Trebuchet MS", sans-serif' },
    { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
    { label: 'Monospace', value: 'ui-monospace, "JetBrains Mono", "Cascadia Code", Consolas, monospace' },
  ];

  const DEFAULTS = {
    theme: 'claude',
    mode: 'dark', // dark | light | auto
    custom: { accent: '', link: '', radius: '', font: '' },
    avatar: { mode: 'original', dataUrl: '' }, // pedro | custom | original (default original = súkromie P0-4)
    links: null,            // zoznam odkazov v lište (null = predvolené)
    enabled: true,          // hlavný vypínač
    ui: { logoSwap: true }, // výmena loga UIS za FEI logo
    snippets: [],           // vlastné CSS snippety [{ id, name, css, on }]
    disabledPages: [],      // cesty (/auth/...), kde je betterUIS vypnutý
    customThemes: null,     // importované témy { 'c-xxx': {name, tagline, radius, font, dark, light} }
    notif: { on: false, interval: 20, quietFrom: 23, quietTo: 7 }, // notifikácie (opt-in): interval min, tiché hodiny 23-7
    grades: { on: true, requiredCredits: 0 }, // dashboard hodnotení na E-indexe; 0 = cieľ kreditov nie je nastavený
    experimental: false, // experimental mode: fetch latest from GitHub; stable otherwise
  };

  // Ikonky pre odkazy v lište (feather-štýl, viewBox 24)
  const ICONS = {
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    cap: '<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11.5V16c3 2.5 9 2.5 12 0v-4.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  };
  const ICON_LABELS = { link: 'Odkaz', mail: 'Pošta', file: 'Dokument', folder: 'Priečinok', star: 'Hviezda', book: 'Kniha', calendar: 'Kalendár', cap: 'Štúdium', user: 'Osoba', chat: 'Chat' };

  const uid = () => Math.random().toString(36).slice(2, 9);

  /* ================= i18n ( UIS má ;lang=sk aj ;lang=en ) ================= */
  const I18N = {
    sk: {
      linkName: 'Názov odkazu v lište:',
      ok: 'OK', cancel: 'Zrušiť',
      added: 'Pridané do lišty: ',
      alreadyThere: 'Táto stránka už v lište je',
      dumped: 'Diagnostika skopírovaná – vlož ju do chatu (Ctrl+V)',
      copyFail: 'Kopírovanie zlyhalo',
      pickHint: 'Klikni na prvok, ktorý chceš skopírovať (Esc = zrušiť)',
      picked: 'Prvok skopírovaný – vlož ho do chatu (Ctrl+V)',
      searchPh: 'Hľadať v UIS…', noResults: 'Nič nenájdené',
      confirmLink: 'Pridať', dialogTitle: 'Nový odkaz do lišty',
      myLinks: 'Moje odkazy',
      palEnter: '↵ otvoriť', palEsc: 'Esc zavrieť', palArrows: '↑↓ výber',
      findTitle: 'Hľadať v UIS (Ctrl+K)',
      addTitle: 'Pridať túto stránku do lišty', setTitle: 'Nastavenia betterUIS',
      modeLight: 'Prepnúť na svetlý režim', modeDark: 'Prepnúť na tmavý režim',
      mode: 'Režim', modeDarkBtn: 'Tmavý', modeLightBtn: 'Svetlý', modeAutoBtn: 'Auto', theme: 'Téma',
      thisPage: 'Táto stránka', disableHere: 'Vypnúť na tejto stránke', enableHere: 'Zapnúť na tejto stránke',
      notUIS: 'Otvor is.stuba.sk',
      hint: 'Paleta príkazov: Ctrl+K · Diagnostika: Ctrl+Shift+U',
      allSettings: 'Všetky nastavenia…',
      ttFilter: 'Filtrovať…', ttSort: 'Zoradiť podľa tohto stĺpca', csvOk: 'Tabuľka skopírovaná ako CSV',
    },
    en: {
      linkName: 'Link name for the bar:',
      ok: 'OK', cancel: 'Cancel',
      added: 'Added to the bar: ',
      alreadyThere: 'This page is already in the bar',
      dumped: 'Diagnostics copied – paste it into the chat (Ctrl+V)',
      copyFail: 'Copying failed',
      pickHint: 'Click the element you want to copy (Esc = cancel)',
      picked: 'Element copied – paste it into the chat (Ctrl+V)',
      searchPh: 'Search UIS…', noResults: 'No results',
      confirmLink: 'Add', dialogTitle: 'New link for the bar',
      myLinks: 'My links',
      palEnter: '↵ open', palEsc: 'Esc close', palArrows: '↑↓ select',
      findTitle: 'Search UIS (Ctrl+K)',
      addTitle: 'Add this page to the bar', setTitle: 'betterUIS settings',
      modeLight: 'Switch to light mode', modeDark: 'Switch to dark mode',
      mode: 'Mode', modeDarkBtn: 'Dark', modeLightBtn: 'Light', modeAutoBtn: 'Auto', theme: 'Theme',
      thisPage: 'This page', disableHere: 'Disable on this page', enableHere: 'Enable on this page',
      notUIS: 'Open is.stuba.sk',
      hint: 'Palette: Ctrl+K · Diagnostics: Ctrl+Shift+U',
      allSettings: 'All settings…',
      ttFilter: 'Filter…', ttSort: 'Sort by this column', csvOk: 'Table copied as CSV',
    },
    uk: {
      linkName: 'Назва посилання в панелі:', ok: 'OK', cancel: 'Скасувати',
      added: 'Додано до панелі: ', alreadyThere: 'Ця сторінка вже в панелі',
      dumped: 'Діагностику скопійовано – вставте її в чат (Ctrl+V)', copyFail: 'Копіювання не вдалося',
      pickHint: 'Клацніть на елемент, який хочете скопіювати (Esc = скасувати)',
      picked: 'Елемент скопійовано – вставте його в чат (Ctrl+V)',
      searchPh: 'Пошук в UIS…', noResults: 'Нічого не знайдено',
      confirmLink: 'Додати', dialogTitle: 'Нове посилання в панель', myLinks: 'Мої посилання',
      palEnter: '↵ відкрити', palEsc: 'Esc закрити', palArrows: '↑↓ вибір',
      findTitle: 'Пошук в UIS (Ctrl+K)', addTitle: 'Додати цю сторінку до панелі', setTitle: 'Налаштування betterUIS',
      modeLight: 'Перемкнути на світлий режим', modeDark: 'Перемкнути на темний режим',
      mode: 'Режим', modeDarkBtn: 'Темний', modeLightBtn: 'Світлий', modeAutoBtn: 'Авто', theme: 'Тема',
      thisPage: 'Ця сторінка', disableHere: 'Вимкнути на цій сторінці', enableHere: 'Увімкнути на цій сторінці',
      notUIS: 'Відкрийте is.stuba.sk', hint: 'Палітра команд: Ctrl+K · Діагностика: Ctrl+Shift+U',
      allSettings: 'Усі налаштування…', ttFilter: 'Фільтрувати…', ttSort: 'Сортувати за цим стовпцем', csvOk: 'Таблицю скопійовано як CSV',
    },
    ru: {
      linkName: 'Название ссылки в панели:', ok: 'OK', cancel: 'Отмена',
      added: 'Добавлено в панель: ', alreadyThere: 'Эта страница уже в панели',
      dumped: 'Диагностика скопирована – вставьте её в чат (Ctrl+V)', copyFail: 'Копирование не удалось',
      pickHint: 'Кликните на элемент, который хотите скопировать (Esc = отмена)',
      picked: 'Элемент скопирован – вставьте его в чат (Ctrl+V)',
      searchPh: 'Поиск в UIS…', noResults: 'Ничего не найдено',
      confirmLink: 'Добавить', dialogTitle: 'Новая ссылка в панель', myLinks: 'Мои ссылки',
      palEnter: '↵ открыть', palEsc: 'Esc закрыть', palArrows: '↑↓ выбор',
      findTitle: 'Поиск в UIS (Ctrl+K)', addTitle: 'Добавить эту страницу в панель', setTitle: 'Настройки betterUIS',
      modeLight: 'Переключить на светлый режим', modeDark: 'Переключить на тёмный режим',
      mode: 'Режим', modeDarkBtn: 'Тёмный', modeLightBtn: 'Светлый', modeAutoBtn: 'Авто', theme: 'Тема',
      thisPage: 'Эта страница', disableHere: 'Отключить на этой странице', enableHere: 'Включить на этой странице',
      notUIS: 'Откройте is.stuba.sk', hint: 'Палитра команд: Ctrl+K · Диагностика: Ctrl+Shift+U',
      allSettings: 'Все настройки…', ttFilter: 'Фильтровать…', ttSort: 'Сортировать по этому столбцу', csvOk: 'Таблица скопирована как CSV',
    },
  };
  function langOf() {                                   // jazyk UIS stránky
    const m = /[?&;]lang=(sk|en)\b/i.exec(String(g.location ? g.location.href : ''));
    if (m) return m[1].toLowerCase();
    return uiLang();                                    // bez parametra → jazyk prehliadača
  }
  function uiLang() {                                   // jazyk popupu/nastavení
    const l = String((g.navigator && g.navigator.language) || '');
    if (/^uk/i.test(l)) return 'uk';
    if (/^ru/i.test(l)) return 'ru';
    if (/^cs/i.test(l)) return 'sk';
    return /^en/i.test(l) ? 'en' : 'sk';
  }
  function t(key) {
    const lang = String(g.location ? g.location.href : '').startsWith('chrome-extension') ? uiLang() : langOf();
    return (I18N[lang] && I18N[lang][key]) || I18N.sk[key] || key;
  }

  /** Vyčistí a validuje URL odkazu. Vracia null, ak URL nie je platná relatívna cesta ani http(s) adresa. @param {string} u @returns {string|null} */

  function cleanUrl(u) {
    u = String(u || '').trim();
    if (/^\/(?!\/)/.test(u)) return u;                       // relatívna cesta v rámci is.stuba.sk
    if (/^https?:\/\//i.test(u)) return u;
    if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(u)) return 'https://' + u;   // "example.com/x"
    return null;
  }
  /** Vyčistí objekt odkazu. Vracia null, ak url alebo name chýba. @param {object} l @returns {object|null} */
  function cleanLink(l) {
    if (!l) return null;
    const url = cleanUrl(l.url);
    const name = String(l.name || '').trim().slice(0, 40);
    if (!url || !name) return null;
    return { id: l.id || uid(), name, url, icon: Object.hasOwn(ICONS, l.icon) ? l.icon : 'link', hideOriginal: !!l.hideOriginal };
  }
  const PRESETS = [
    { id: 'preset-posta', name: 'Pošta', url: '/auth/posta/slozka.pl?lang=sk', icon: 'mail', hideOriginal: false },
    { id: 'preset-dok', name: 'Dokumentový server', url: '/auth/dok_server/index.pl?lang=sk', icon: 'file', hideOriginal: true },
  ];

  const KEY = 'bu';
  const NOTIF_KEY = 'bu-notif';   // snapshot stavu notifikácií (vždy len local, nikdy sync)
  // Zdieľané konštanty oprávnení (background.js aj options.js)
  const ORIGINS = { origins: ['https://is.stuba.sk/*'] };
  const QUIET_PERM = { permissions: ['alarms', 'notifications'], origins: ['https://is.stuba.sk/*'] };
  const hasPermissionApi = () => typeof chrome !== 'undefined' && !!chrome.permissions && !!chrome.permissions.request;

  /* ================= validácia importovaných tém ================= */
  const PAL_KEYS = ['bg0', 'bg', 'bg2', 'bg3', 'border', 'text', 'muted', 'link', 'accent', 'info', 'warn', 'crit'];
  const HEX = /^#[0-9a-f]{6}$/i;
  const cleanFont = (v) => String(v || '').replace(/[;{}]/g, '').slice(0, 160);
  const sanitizeCss = (v) => String(v || '')
    .replace(/@import[^;]*;?/gi, '')
    // Vzdialené url() by obchádzali pravidlo „všetko lokálne“ (tracking pixel, únik referrera).
    // Ponechávame data:, relatívne a same-origin cesty; regex nie je plný CSS parser.
    .replace(/\burl\(\s*["']?\s*(?:https?:)?\/\/[^)]*\)/gi, '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/-moz-binding\s*:[^;}]*/gi, '')
    .replace(/behavior\s*:[^;}]*/gi, '')
    .replace(/<\/style/gi, '')
    .slice(0, 60000);
  function validatePalette(p) {
    if (!p || typeof p !== 'object') return null;
    const out = {};
    for (const k of PAL_KEYS) { const v = String(p[k] || ''); if (!HEX.test(v)) return null; out[k] = v.toLowerCase(); }
    return out;
  }
  // Importovaná téma: { name, tagline, radius, font, colors: { dark: {...12}, light: {...12} } }
  /** Validuje importovanú tému. Vracia null pri neplatnosti. @param {any} raw @returns {object|null} */
  function validateTheme(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const colors = raw.colors || raw;
    const dark = validatePalette(colors.dark), light = validatePalette(colors.light);
    if (!dark || !light) return null;
    let r = Number(raw.radius);
    if (!Number.isFinite(r)) r = 12;
    return {
      name: String(raw.name || 'Téma').replace(/[<>]/g, '').trim().slice(0, 40) || 'Téma',
      tagline: String(raw.tagline || '').replace(/[<>]/g, '').slice(0, 80),
      radius: Math.min(28, Math.max(0, Math.round(r))),
      font: cleanFont(raw.font),
      dark, light,
    };
  }

  /** Normalizuje surový stav nastavení na kanonický tvar; neplatné hodnoty nahradí predvolenými. @param {any} s @returns {object} */

  function normalize(s, localAvatar) {
    s = s || {};
    let links;
    if (Array.isArray(s.links)) links = s.links.map(cleanLink).filter(Boolean);
    else {                                   // predvolené + migrácia zo staršieho nastavenia "docs"
      const d = s.docs || {};
      links = PRESETS.filter((p) => !(p.icon === 'file' && d.show === false))
        .map((p) => cleanLink(Object.assign({}, p, p.icon === 'file' && 'hideOriginal' in d ? { hideOriginal: d.hideOriginal } : {})));
    }
    let customThemes = null;
    if (s.customThemes && typeof s.customThemes === 'object') {
      customThemes = {};
      for (const [id, th] of Object.entries(s.customThemes).slice(0, 20)) {
        const v = validateTheme(th);
        if (v) customThemes[String(id).slice(0, 20)] = v;
      }
      if (!Object.keys(customThemes).length) customThemes = null;
    }
    const snippets = Array.isArray(s.snippets)
      ? s.snippets.slice(0, 30).map((x) => ({
          id: String(x && x.id || '').slice(0, 12) || uid(),
          name: String(x && x.name || '').replace(/[<>]/g, '').slice(0, 60),
          css: sanitizeCss(x && x.css),
          on: !!(x && x.on),
        })) : []; // zachovať aj prázdny snippet, aby sa dal najprv vytvoriť a potom editovať
    const disabledPages = Array.isArray(s.disabledPages)
      ? [...new Set(s.disabledPages.map((p) => String(p).slice(0, 300)).filter((p) => p.startsWith('/')))].slice(0, 200) : [];
    const n = s.notif && typeof s.notif === 'object' ? s.notif : {};
    const clampH = (v, d) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.min(23, Math.max(0, x)) : d; };
    const notif = {
      on: !!n.on,
      interval: [15, 20, 30, 60].includes(Number(n.interval)) ? Number(n.interval) : 20,
      quietFrom: clampH(n.quietFrom, 23),
      quietTo: clampH(n.quietTo, 7),
    };
    const av = (s.avatar && typeof s.avatar === 'object') ? s.avatar : (localAvatar && typeof localAvatar === 'object' ? localAvatar : {});
    const avMode = ['pedro', 'custom', 'original'].includes(av.mode) ? av.mode : DEFAULTS.avatar.mode;
    const avatar = {
      mode: avMode,
      dataUrl: avMode === 'custom' && typeof av.dataUrl === 'string' && av.dataUrl.startsWith('data:image/') ? av.dataUrl : '',
    };
    const gr = (s.grades && typeof s.grades === 'object') ? s.grades : {};
    const reqCredits = Math.round(Number(gr.requiredCredits));
    const grades = {
      on: gr.on === undefined ? DEFAULTS.grades.on : !!gr.on,
      requiredCredits: Number.isFinite(reqCredits) ? Math.min(400, Math.max(0, reqCredits)) : 0,
    };
    return {
      theme: s.theme && s.theme.startsWith('c-') ? s.theme : (THEMES[s.theme] ? s.theme : DEFAULTS.theme),
      mode: ['dark', 'light', 'auto'].includes(s.mode) ? s.mode : DEFAULTS.mode,
      custom: Object.assign({}, DEFAULTS.custom, s.custom && typeof s.custom === 'object' ? s.custom : {}),
      avatar,
      links,
      enabled: s.enabled === undefined ? DEFAULTS.enabled : !!s.enabled,
      ui: Object.assign({}, DEFAULTS.ui, s.ui && typeof s.ui === 'object' ? { logoSwap: !!s.ui.logoSwap } : {}),
      snippets, disabledPages,
      customThemes: customThemes,
      notif,
      grades,
      experimental: s.experimental === undefined ? DEFAULTS.experimental : !!s.experimental,
    };
  }

  /** Vráti tému podľa id (vstavanú alebo importovanú). @param {string} id @param {object} [customThemes] @returns {object|null} */

  function getTheme(id, customThemes) {
    if (id && String(id).startsWith('c-')) {
      return (customThemes && customThemes[id]) || null;   // už validované v normalize() pri ukladaní
    }
    return THEMES[id] || null;
  }

  /** Rozrieši režim (auto → podľa systému). @param {string} mode @returns {string} */

  function resolveMode(mode) {
    if (mode !== 'dark' && mode !== 'light' && mode !== 'auto') mode = 'dark';
    if (mode === 'auto') return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return mode;
  }

  // Relative luminance → text na zvýraznení (prah 0,179 ≈ prieseň 4,5:1 pre biele aj čierne).
  function toast(msg, ms) {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('bu-toast') || document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), ms || 2000);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { swallow(e); }
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return !!ok;
    } catch (e) { swallow(e); return false; }
  }
  /** Relatívna luminancia farby podľa WCAG 2.1; null pre neplatný hex. @param {string} hex @returns {number|null} */
  function luminance(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return null;
    const n = parseInt(m[1], 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  /** Vypočíta farbu textu (čierna/biela) pre daný hex akcent (WCAG 4.5:1). Vracia null pre neplatný hex. @param {string} hex @returns {string|null} */
  function contrast(hex) {
    const l = luminance(hex);
    return l == null ? null : l > 0.179 ? '#000000' : '#ffffff';
  }
  /** WCAG kontrastný pomer dvoch farieb (1–21); null ak je niektorá neplatná. @param {string} a @param {string} b @returns {number|null} */
  function contrastRatio(a, b) {
    const x = luminance(a), y = luminance(b);
    if (x == null || y == null) return null;
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  // Zo stavu nastavení spočíta všetky CSS premenné.
  /** Zo stavu nastavení spočíta všetky CSS premenné. @param {any} raw @returns {object} */
  function compute(raw) {
    const s = normalize(raw);
    const t = getTheme(s.theme, s.customThemes) || THEMES[DEFAULTS.theme];
    const mode = resolveMode(s.mode);
    const dark = mode === 'dark';
    const p = Object.assign({}, t[mode]);
    if (s.custom.accent && HEX.test(s.custom.accent)) p.accent = s.custom.accent.toLowerCase();
    if (s.custom.link && HEX.test(s.custom.link)) p.link = s.custom.link.toLowerCase();
    p.onAccent = contrast(p.accent) || '#ffffff';
    const r = s.custom.radius !== '' && s.custom.radius != null ? Number(s.custom.radius) : t.radius;
    const font = s.custom.font || t.font || '';
    const bar = (t.bar && typeof t.bar === 'object') ? t.bar : {};
    return {
      mode, font, theme: s.theme,
      vars: {
        '--bg-0': p.bg0, '--bg': p.bg, '--bg-2': p.bg2, '--bg-3': p.bg3,
        '--border': p.border, '--text': p.text, '--muted': p.muted,
        '--link': p.link, '--accent': p.accent, '--on-accent': p.onAccent,
        '--info': p.info, '--warn': p.warn, '--crit': p.crit,
        '--radius': r + 'px', '--radius-sm': Math.max(3, Math.round(r / 2)) + 'px',
        '--shadow-1': dark ? '0 1px 3px rgba(0,0,0,.30)' : '0 1px 3px rgba(0,0,0,.08)',
        '--shadow-2': dark ? '0 4px 14px rgba(0,0,0,.40)' : '0 4px 14px rgba(0,0,0,.12)',
        '--shadow-3': dark ? '0 16px 40px rgba(0,0,0,.55)' : '0 16px 40px rgba(0,0,0,.18)',
        '--icon-glow': dark ? 'drop-shadow(0 0 3px rgba(255,255,255,.30))' : 'none',
        '--chip': dark ? '#f0eee6' : 'transparent',
        '--accent-color': bar.color || p.bg0, '--accent-color-text-contrast': bar.text || p.text, // prebije bordovú lištu UIS
      },
    };
  }

  /** Aplikuje vypočítané premenné na root element. @param {object} out @param {Element} [root] */

  function applyVars(out, root) {
    root = root || document.documentElement;
    if (!root || !out || !out.vars) return;
    for (const k in out.vars) root.style.setProperty(k, out.vars[k]);
    root.style.colorScheme = out.mode;
    root.dataset.buMode = out.mode;
    if (out.theme) root.dataset.buTheme = out.theme;
    if (out.font) { root.style.setProperty('--font', out.font); root.dataset.buFont = '1'; }
    else { root.style.removeProperty('--font'); delete root.dataset.buFont; }
  }

  const varKeys = () => Object.keys(compute(DEFAULTS).vars);

  /* ================= úložisko: local ako zdroj pravdy + sync mirror ================= */
  function hasStorage() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && chrome.storage.sync;
  }
  const SYNC_KEYS = ['theme', 'mode', 'custom', 'links', 'enabled', 'ui', 'snippets', 'disabledPages', 'customThemes', 'notif', 'experimental'];
  function syncPayload(n) {
    const o = {};
    for (const k of SYNC_KEYS) o[k] = n[k];
    if (JSON.stringify(o).length > 95000) { delete o.snippets; if (JSON.stringify(o).length > 95000) delete o.customThemes; }
    return o;
  }
  async function load() {
    if (!hasStorage()) return normalize(null);
    const r = await chrome.storage.local.get(KEY).catch((e) => { swallow(e); return {}; });
    let raw = r[KEY];
    if (!raw) {                                        // nový počítač – dosadíme zo syncu (témа/odkazy putujú s tebou)
      const sy = await chrome.storage.sync.get(KEY).catch((e) => { swallow(e); return {}; });
      if (sy[KEY]) { raw = sy[KEY]; try { await chrome.storage.local.set({ [KEY]: raw }); } catch (e) { swallow(e); } }
    }
    return normalize(raw);
  }
  /** Uloží stav (local + sync mirror). @param {any} state @returns {Promise<object>} */
  function save(state) {
    const n = normalize(state);
    if (!hasStorage()) return Promise.resolve({ state: n, truncated: false, ok: true });
    const payload = syncPayload(n);
    const truncated = (Array.isArray(n.snippets) && n.snippets.length > 0 && !payload.snippets) ||
      (!!n.customThemes && !payload.customThemes);
    if (truncated) console.warn('betterUIS: sync payload truncated (snippets/customThemes dropped)');
    const local = chrome.storage.local.set({ [KEY]: n }).then(() => true).catch((e) => { swallow(e); return false; });
    const sync = chrome.storage.sync.set({ [KEY]: payload }).then(() => true).catch(() => false);
    return Promise.all([local, sync]).then(([localOk, syncOk]) => ({ state: n, truncated, ok: !!localOk, syncOk: !!syncOk }));
  }

  g.BU = {
    THEMES, FONTS, DEFAULTS, KEY, NOTIF_KEY, SYNC_KEYS, ICONS, ICON_LABELS, PRESETS, ORIGINS, QUIET_PERM, hasPermissionApi,
    normalize, cleanLink, cleanUrl, uid, compute, applyVars, resolveMode, load, save, contrast, contrastRatio,
    getTheme, validateTheme, varKeys, I18N, t, langOf, uiLang, swallow, sanitizeCss, copyText, toast,
  };
})(self);
