// betterAIS: štýlové témy skupiny "Špeciálne" (paleta + vlastná CSS vrstva).
// Načítava sa hneď po themes.js (content script, popup, nastavenia, background).
// Každá téma = dve palety (tmavá, svetlá) cez P(...) ako ostatné témy + voliteľné `css`.
// `css` sa vkladá len pre aktívnu tému. Znak & sa nahradí rozsahom
//   html[data-bu-theme="<id>"][data-bu-mode]:not([data-bu-off])
// takže sa nič nevypne kill-switchom a žiadne pravidlo neunikne mimo témy.
// Žiadne url() a žiadne externé zdroje: všetko sú gradienty a box-shadow.
(function (g) {
  'use strict';
  const BU = g.BU;
  if (!BU || !BU.THEMES) return;

  const P = (bg0, bg, bg2, bg3, border, text, muted, link, accent, info, warn, crit) =>
    ({ bg0, bg, bg2, bg3, border, text, muted, link, accent, info, warn, crit });

  const scope = (id) => 'html[data-bu-theme="' + id + '"][data-bu-mode]:not([data-bu-off])';
  const build = (id, css) => css.replace(/&/g, scope(id)).replace(/\n{2,}/g, '\n').trim();

  // Spoločné skupiny selektorov (všetko existuje v AIS alebo v betterAIS).
  const CARDS = '.bu-card, .sd-box, .polozky-obal, .zasadky-info, .zasadky-warning, .zasadky-crit, #bu-mail, #bu-schedule, #bu-todo';
  const HEADS = '.bu-card-head, .bu-mail-head';
  const BTNS = 'input[type="submit"], input[type="button"], button:not(.bu-mail-toggle)';
  const FIELDS = 'input[type="text"], input[type="password"], input[type="search"], input[type="number"], input[type="email"], input[type="date"], select, textarea';
  const POPS = '#menu-popup, .bu-pop, #uisFloatingBox, .ui-dialog, .ui-menu, .ui-autocomplete, .ui-datepicker, #bu-palette, #bu-dialog .bu-dialog-card, #uisFixedBox .obsah';
  const HDR_TXT = '#header :is(a, span, div, p, b, strong, small, li, td)';

  /* ================= Retro XP (Luna) ================= */
  const retroxp = `
html[data-bu-theme="retroxp"][data-bu-mode="light"] { --x1:#0a58e0; --x2:#4d9bff; --x3:#083ca8; --xf1:#ffffff; --xf2:#ece9d8; --xe:#aca899; --xb:#003c74; --xi:#7f9db9; }
html[data-bu-theme="retroxp"][data-bu-mode="dark"] { --x1:#3b3b3b; --x2:#6a6a6a; --x3:#161616; --xf1:#454545; --xf2:#2a2a2a; --xe:#666666; --xb:#000000; --xi:#666666; }
& #header, & .sd-header { background-image: linear-gradient(180deg, var(--x2) 0, var(--x1) 12%, var(--x1) 88%, var(--x3) 100%) !important; border-bottom: 1px solid var(--x3) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,.4) !important; }
& ${HDR_TXT} { color: #ffffff !important; text-shadow: 0 1px 0 rgba(0,0,0,.5); }
& img.bu-logo-ais { filter: invert(1) brightness(1.15) !important; }
& nav[aria-label="breadcrumb"] { background-image: linear-gradient(180deg, var(--xf1), var(--xf2)) !important; border-top: 0 !important; border-bottom: 1px solid var(--xe) !important; }
& li.bu-links a.bu-link { border-radius: 3px !important; }
& :is(${CARDS}) { background-color: var(--bg-2) !important; border: 1px solid var(--x1) !important; border-radius: 6px 6px 3px 3px !important; box-shadow: 2px 2px 5px rgba(0,0,0,.25) !important; }
& :is(${HEADS}) { background-image: linear-gradient(180deg, var(--x2) 0, var(--x1) 18%, var(--x1) 80%, var(--x3) 100%) !important; border-bottom: 1px solid var(--x3) !important; border-radius: 5px 5px 0 0 !important; }
& :is(${HEADS}) :is(a, span, b, strong, div) { color: #ffffff !important; text-shadow: 0 1px 0 rgba(0,0,0,.5); }
& :is(th, thead td):not(.bu-keep) { background-image: linear-gradient(180deg, var(--xf1), var(--xf2)) !important; border: 1px solid var(--xe) !important; }
& :is(${BTNS}) { background-image: linear-gradient(180deg, var(--xf1) 0, var(--xf2) 85%, rgba(0,0,0,.08) 100%) !important; border: 1px solid var(--xb) !important; border-radius: 3px !important; box-shadow: inset 0 0 0 1px rgba(255,255,255,.45); }
& :is(${BTNS}):hover { border-color: #e68b2c !important; box-shadow: inset 0 0 0 1px #ffe38a !important; }
& #bu-ctl .bu-btn { background-image: linear-gradient(180deg, var(--xf1), var(--xf2)) !important; border: 1px solid var(--xb) !important; border-radius: 3px !important; }
& :is(${FIELDS}) { border: 1px solid var(--xi) !important; border-radius: 0 !important; }
& :is(${POPS}) { border: 1px solid var(--x1) !important; border-radius: 6px 6px 0 0 !important; box-shadow: 3px 3px 6px rgba(0,0,0,.35) !important; }
& .ui-dialog .ui-dialog-titlebar { background-image: linear-gradient(180deg, var(--x2), var(--x1)) !important; color: #ffffff !important; }
& img.bu-avatar { border-radius: 3px !important; border: 2px solid #ffffff !important; box-shadow: 0 0 0 1px var(--x3) !important; }
& ::selection { background: #316ac5; color: #ffffff; }
`;

  /* ================= Retro 95 ================= */
  const retro95 = `
html[data-bu-theme="retro95"][data-bu-mode="light"] { --hi:#ffffff; --lo:#808080; --dk:#000000; --fc:#c0c0c0; --f2:#dfdfdf; --t1:#000080; --t2:#1084d0; }
html[data-bu-theme="retro95"][data-bu-mode="dark"] { --hi:#5a5a5a; --lo:#050505; --dk:#000000; --fc:#2a2a2a; --f2:#3a3a3a; --t1:#000000; --t2:#4a4a4a; }
& #header, & .sd-header { background-image: linear-gradient(90deg, var(--t1), var(--t2)) !important; border-bottom: 2px solid var(--dk) !important; }
& ${HDR_TXT} { color: #ffffff !important; font-weight: 700; }
& img.bu-logo-ais { filter: invert(1) brightness(1.15) !important; }
& nav[aria-label="breadcrumb"] { background-color: var(--fc) !important; border: 0 !important; box-shadow: inset 0 1px 0 var(--hi), inset 0 -1px 0 var(--lo) !important; }
& li.bu-links a.bu-link { border-radius: 0 !important; border: 0 !important; box-shadow: inset -1px -1px 0 var(--dk), inset 1px 1px 0 var(--hi), inset -2px -2px 0 var(--lo) !important; background: var(--fc) !important; }
& :is(${CARDS}), & fieldset { background-color: var(--fc) !important; border: 0 !important; border-radius: 0 !important; box-shadow: inset -1px -1px 0 var(--dk), inset 1px 1px 0 var(--hi), inset -2px -2px 0 var(--lo), inset 2px 2px 0 var(--f2) !important; }
& :is(${HEADS}) { background-image: linear-gradient(90deg, var(--t1), var(--t2)) !important; border-bottom: 0 !important; margin: 2px 2px 0 !important; }
& :is(${HEADS}) :is(a, span, b, strong, div) { color: #ffffff !important; }
& :is(th, thead td):not(.bu-keep) { border: 0 !important; background-color: var(--fc) !important; box-shadow: inset -1px -1px 0 var(--dk), inset 1px 1px 0 var(--hi), inset -2px -2px 0 var(--lo) !important; }
& :is(${BTNS}), & #bu-ctl .bu-btn { background-color: var(--fc) !important; border: 0 !important; border-radius: 0 !important; box-shadow: inset -1px -1px 0 var(--dk), inset 1px 1px 0 var(--hi), inset -2px -2px 0 var(--lo), inset 2px 2px 0 var(--f2) !important; }
& :is(${BTNS}):active, & #bu-ctl .bu-btn:active { box-shadow: inset 1px 1px 0 var(--dk), inset -1px -1px 0 var(--hi), inset 2px 2px 0 var(--lo) !important; }
& :is(${FIELDS}) { border: 0 !important; border-radius: 0 !important; background-color: var(--bg-2) !important; box-shadow: inset 1px 1px 0 var(--lo), inset -1px -1px 0 var(--hi), inset 2px 2px 0 var(--dk), inset -2px -2px 0 var(--f2) !important; }
& :is(${POPS}) { border: 0 !important; border-radius: 0 !important; background-color: var(--fc) !important; box-shadow: inset -1px -1px 0 var(--dk), inset 1px 1px 0 var(--hi), inset -2px -2px 0 var(--lo), 4px 4px 0 rgba(0,0,0,.35) !important; }
& .ui-dialog .ui-dialog-titlebar { background-image: linear-gradient(90deg, var(--t1), var(--t2)) !important; color: #ffffff !important; border-radius: 0 !important; }
& img.bu-avatar { border-radius: 0 !important; border: 0 !important; box-shadow: inset 1px 1px 0 var(--lo), 1px 1px 0 var(--hi) !important; }
& #bu-mail .bu-mail-badge { border-radius: 0 !important; }
& ::selection { background: #000080; color: #ffffff; }
`;

  /* ================= Amber CRT ================= */
  const crtamber = `
& body { text-shadow: 0 0 4px color-mix(in srgb, var(--text) 40%, transparent); }
html[data-bu-theme="crtamber"][data-bu-mode="light"]:not([data-bu-off]) body { text-shadow: none; }
html[data-bu-theme="crtamber"][data-bu-mode="dark"]:not([data-bu-off]) body::after { content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 2147482000; background: repeating-linear-gradient(0deg, rgba(0,0,0,.16) 0, rgba(0,0,0,.16) 1px, transparent 1px, transparent 3px), radial-gradient(ellipse at center, transparent 62%, rgba(0,0,0,.45) 100%); }
& #header, & .sd-header { border-bottom: 2px solid var(--accent) !important; }
& :is(${CARDS}), & fieldset { border: 1px solid var(--accent) !important; border-radius: 0 !important; box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 28%, transparent) !important; }
& :is(${HEADS}) { border-bottom: 1px dashed var(--accent) !important; text-transform: uppercase; letter-spacing: .06em; }
& :is(th, thead td):not(.bu-keep) { text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid var(--accent) !important; }
& :is(${BTNS}), & #bu-ctl .bu-btn { border: 1px solid var(--accent) !important; border-radius: 0 !important; text-transform: uppercase; letter-spacing: .05em; }
& :is(${BTNS}):hover, & #bu-ctl .bu-btn:hover { background-color: var(--accent) !important; color: var(--on-accent) !important; }
& :is(${FIELDS}) { border-radius: 0 !important; border: 1px solid var(--border-strong) !important; }
& :is(${POPS}) { border: 1px solid var(--accent) !important; border-radius: 0 !important; box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 35%, transparent) !important; }
& #titulek h1::before { content: "> "; opacity: .7; }
& img.bu-avatar { border-radius: 0 !important; filter: sepia(1) saturate(2.5) hue-rotate(-12deg) brightness(.95); }
& li.bu-links a.bu-link, & #bu-mail .bu-mail-badge { border-radius: 0 !important; }
`;

  /* ================= Game Boy ================= */
  const gameboy = `
html[data-bu-theme="gameboy"][data-bu-mode="light"] { --gb-d:#0f380f; --gb-m:#306230; --gb-l:#8bac0f; --gb-x:#9bbc0f; }
html[data-bu-theme="gameboy"][data-bu-mode="dark"] { --gb-d:#9bbc0f; --gb-m:#8bac0f; --gb-l:#306230; --gb-x:#0f380f; }
& #header, & .sd-header { border-bottom: 4px solid var(--gb-d) !important; }
& :is(${CARDS}), & fieldset { border: 3px solid var(--gb-d) !important; border-radius: 0 !important; box-shadow: 4px 4px 0 var(--gb-d) !important; }
& :is(${HEADS}) { border-bottom: 3px solid var(--gb-d) !important; font-weight: 700; }
& :is(th, thead td):not(.bu-keep) { border: 2px solid var(--gb-d) !important; font-weight: 700; }
& :is(${BTNS}), & #bu-ctl .bu-btn { border: 3px solid var(--gb-d) !important; border-radius: 0 !important; font-weight: 700; box-shadow: 0 3px 0 var(--gb-d); }
& :is(${BTNS}):active, & #bu-ctl .bu-btn:active { box-shadow: 0 0 0 var(--gb-d); transform: translateY(3px); }
& :is(${FIELDS}) { border: 2px solid var(--gb-d) !important; border-radius: 0 !important; }
& :is(${POPS}) { border: 3px solid var(--gb-d) !important; border-radius: 0 !important; box-shadow: 5px 5px 0 var(--gb-d) !important; }
& img.bu-avatar { border-radius: 0 !important; border: 3px solid var(--gb-d) !important; image-rendering: pixelated; filter: grayscale(1) sepia(1) hue-rotate(40deg) saturate(2.2) contrast(1.1); }
& :is(.sd-box img, img.bu-icon) { filter: grayscale(1) sepia(1) hue-rotate(40deg) saturate(2.2) contrast(1.1) !important; }
& li.bu-links a.bu-link, & #bu-mail .bu-mail-badge { border-radius: 0 !important; }
& ::selection { background: var(--gb-d); color: var(--gb-x); }
`;

  /* ================= Commodore 64 ================= */
  const c64 = `
html[data-bu-theme="c64"][data-bu-mode="light"] { --c6-f:#352879; }
html[data-bu-theme="c64"][data-bu-mode="dark"] { --c6-f:#7869c4; }
& body::before { content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 2147482000; border: 12px solid var(--c6-f); }
& #header, & .sd-header { border-bottom: 2px solid var(--border-strong) !important; }
& :is(${CARDS}), & fieldset { border: 2px solid var(--border-strong) !important; border-radius: 0 !important; box-shadow: none !important; }
& :is(${HEADS}) { border-bottom: 2px solid var(--border-strong) !important; letter-spacing: .04em; }
& :is(th, thead td):not(.bu-keep) { border: 1px solid var(--border-strong) !important; letter-spacing: .03em; }
& :is(${BTNS}), & #bu-ctl .bu-btn { border: 2px solid var(--border-strong) !important; border-radius: 0 !important; }
& :is(${BTNS}):hover, & #bu-ctl .bu-btn:hover { background-color: var(--accent) !important; color: var(--on-accent) !important; }
& :is(${FIELDS}) { border: 2px solid var(--border-strong) !important; border-radius: 0 !important; }
& :is(${POPS}) { border: 2px solid var(--border-strong) !important; border-radius: 0 !important; box-shadow: none !important; }
& #titulek h1::after { content: "\\2588"; margin-left: .3em; color: var(--accent); }
& img.bu-avatar { border-radius: 0 !important; }
& li.bu-links a.bu-link, & #bu-mail .bu-mail-badge { border-radius: 0 !important; }
`;

  /* ================= Synthwave ================= */
  const synthwave = `
html[data-bu-theme="synthwave"][data-bu-mode="dark"]:not([data-bu-off]), html[data-bu-theme="synthwave"][data-bu-mode="dark"]:not([data-bu-off]) body { background-image: linear-gradient(180deg, #120a24 0%, #26104d 55%, #4a1060 100%) !important; background-attachment: fixed !important; }
html[data-bu-theme="synthwave"][data-bu-mode="light"]:not([data-bu-off]), html[data-bu-theme="synthwave"][data-bu-mode="light"]:not([data-bu-off]) body { background-image: linear-gradient(180deg, #faf3ff 0%, #f1ddff 60%, #ffd9f3 100%) !important; background-attachment: fixed !important; }
& #header, & .sd-header { border-bottom: 2px solid transparent !important; border-image: linear-gradient(90deg, #ff2bd6, #4df0ff) 1 !important; }
& :is(${CARDS}), & fieldset { border: 1px solid color-mix(in srgb, var(--accent) 60%, var(--border)) !important; box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 30%, transparent) !important; }
& :is(${HEADS}) { border-bottom: 1px solid color-mix(in srgb, var(--accent) 60%, var(--border)) !important; text-shadow: 0 0 8px color-mix(in srgb, var(--accent) 70%, transparent); letter-spacing: .03em; }
& #titulek h1, & h1, & h2 { text-shadow: 0 0 10px color-mix(in srgb, var(--accent) 65%, transparent); }
& :is(th, thead td):not(.bu-keep) { border-bottom: 2px solid var(--accent) !important; }
& :is(${BTNS}) { background-image: linear-gradient(90deg, color-mix(in srgb, var(--accent) 35%, transparent), color-mix(in srgb, var(--link) 25%, transparent)) !important; border: 1px solid var(--accent) !important; box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 35%, transparent); }
& :is(${BTNS}):hover { box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 60%, transparent) !important; }
& :is(${FIELDS}) { border: 1px solid color-mix(in srgb, var(--link) 55%, var(--border)) !important; }
& :is(${POPS}) { border: 1px solid var(--accent) !important; box-shadow: 0 0 22px color-mix(in srgb, var(--accent) 45%, transparent) !important; }
& img.bu-avatar { border: 2px solid var(--accent) !important; box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 60%, transparent) !important; }
`;

  /* ================= Brutalizmus ================= */
  const brutal = `
& #header, & .sd-header { border-bottom: 4px solid var(--border) !important; }
& nav[aria-label="breadcrumb"] { border-top: 0 !important; border-bottom: 3px solid var(--border) !important; }
& :is(${CARDS}), & fieldset { border: 3px solid var(--border) !important; border-radius: 0 !important; box-shadow: 6px 6px 0 var(--border) !important; }
& :is(${CARDS}):hover { box-shadow: 8px 8px 0 var(--border) !important; transform: translate(-2px, -2px); }
& :is(${HEADS}) { border-bottom: 3px solid var(--border) !important; font-weight: 800; text-transform: uppercase; letter-spacing: .02em; }
& :is(th, thead td):not(.bu-keep) { border: 2px solid var(--border) !important; font-weight: 800; }
& td { border-color: var(--border) !important; }
& :is(${BTNS}), & #bu-ctl .bu-btn { border: 3px solid var(--border) !important; border-radius: 0 !important; font-weight: 800; box-shadow: 4px 4px 0 var(--border); }
& :is(${BTNS}):hover, & #bu-ctl .bu-btn:hover { background-color: var(--accent) !important; color: var(--on-accent) !important; transform: translate(-1px, -1px); }
& :is(${BTNS}):active, & #bu-ctl .bu-btn:active { box-shadow: 0 0 0 var(--border); transform: translate(4px, 4px); }
& :is(${FIELDS}) { border: 3px solid var(--border) !important; border-radius: 0 !important; }
& :is(${POPS}) { border: 3px solid var(--border) !important; border-radius: 0 !important; box-shadow: 8px 8px 0 var(--border) !important; }
& a { text-decoration: underline 2px !important; text-underline-offset: 2px; }
& img.bu-avatar { border: 3px solid var(--border) !important; border-radius: 0 !important; }
& li.bu-links a.bu-link, & #bu-mail .bu-mail-badge { border-radius: 0 !important; border-width: 2px !important; }
`;

  /* ================= Aqua / sklo ================= */
  const aqua = `
html[data-bu-theme="aqua"][data-bu-mode="light"]:not([data-bu-off]), html[data-bu-theme="aqua"][data-bu-mode="light"]:not([data-bu-off]) body { background-image: radial-gradient(900px 500px at 12% -5%, #bfe3ff 0%, transparent 60%), radial-gradient(800px 500px at 95% 10%, #d9ecff 0%, transparent 55%), linear-gradient(180deg, #eaf3fb, #dcebf8) !important; background-attachment: fixed !important; }
html[data-bu-theme="aqua"][data-bu-mode="dark"]:not([data-bu-off]), html[data-bu-theme="aqua"][data-bu-mode="dark"]:not([data-bu-off]) body { background-image: radial-gradient(900px 500px at 12% -5%, #153a66 0%, transparent 60%), radial-gradient(800px 500px at 95% 10%, #123055 0%, transparent 55%), linear-gradient(180deg, #101e30, #0a1422) !important; background-attachment: fixed !important; }
& #header, & .sd-header { background-color: color-mix(in srgb, var(--bg-0) 72%, transparent) !important; backdrop-filter: blur(14px) saturate(1.5); border-bottom: 1px solid color-mix(in srgb, var(--text) 14%, transparent) !important; }
& nav[aria-label="breadcrumb"] { background-color: color-mix(in srgb, var(--bg-2) 55%, transparent) !important; backdrop-filter: blur(10px); border-bottom: 1px solid color-mix(in srgb, var(--text) 12%, transparent) !important; border-top: 0 !important; }
& :is(${CARDS}), & fieldset { background-color: color-mix(in srgb, var(--bg-2) 62%, transparent) !important; backdrop-filter: blur(14px) saturate(1.4); border: 1px solid color-mix(in srgb, var(--text) 16%, transparent) !important; box-shadow: 0 8px 24px rgba(10,40,90,.14), inset 0 1px 0 rgba(255,255,255,.45) !important; }
& :is(${HEADS}) { background-color: color-mix(in srgb, var(--bg-3) 55%, transparent) !important; }
& :is(${BTNS}) { background-image: linear-gradient(180deg, rgba(255,255,255,.55) 0, rgba(255,255,255,.12) 50%, rgba(255,255,255,0) 51%, rgba(255,255,255,.18) 100%) !important; border-radius: 999px !important; border: 1px solid color-mix(in srgb, var(--accent) 55%, var(--border)) !important; padding-left: 14px; padding-right: 14px; box-shadow: 0 1px 2px rgba(0,0,0,.18); }
& :is(${BTNS}):hover { background-color: var(--accent-soft) !important; }
& :is(${FIELDS}) { border-radius: 8px !important; background-color: color-mix(in srgb, var(--bg-2) 80%, transparent) !important; }
& :is(${POPS}) { background-color: color-mix(in srgb, var(--bg-2) 82%, transparent) !important; backdrop-filter: blur(18px) saturate(1.5); border-radius: 14px !important; box-shadow: 0 16px 40px rgba(10,40,90,.25) !important; }
& img.bu-avatar { box-shadow: 0 0 0 2px rgba(255,255,255,.6), 0 3px 10px rgba(10,40,90,.3) !important; }
`;

  /* ================= Noviny ================= */
  const newspaper = `
& #header, & .sd-header { border-bottom: 4px double var(--border) !important; }
& nav[aria-label="breadcrumb"] { border-top: 0 !important; border-bottom: 1px solid var(--border) !important; }
& #titulek h1 { font-size: 1.9rem; letter-spacing: -.01em; text-align: center; border-bottom: 3px double var(--border); padding-bottom: 8px; }
& :is(${CARDS}), & fieldset { border: 1px solid var(--border) !important; border-top: 3px solid var(--border) !important; border-radius: 0 !important; box-shadow: none !important; }
& :is(${HEADS}) { border-bottom: 1px solid var(--border) !important; font-variant: small-caps; letter-spacing: .04em; font-weight: 700; }
& :is(th, thead td):not(.bu-keep) { border: 0 !important; border-top: 2px solid var(--border) !important; border-bottom: 1px solid var(--border) !important; font-variant: small-caps; letter-spacing: .04em; }
& td { border-left: 0 !important; border-right: 0 !important; }
& :is(${BTNS}), & #bu-ctl .bu-btn { border: 1px solid var(--border) !important; border-radius: 0 !important; font-variant: small-caps; letter-spacing: .03em; }
& :is(${BTNS}):hover { background-color: var(--accent) !important; color: var(--on-accent) !important; }
& :is(${FIELDS}) { border-radius: 0 !important; border: 1px solid var(--border) !important; }
& :is(${POPS}) { border: 1px solid var(--border) !important; border-top: 3px solid var(--border) !important; border-radius: 0 !important; box-shadow: 4px 4px 0 rgba(0,0,0,.18) !important; }
& img.bu-avatar { border-radius: 0 !important; filter: grayscale(.85) contrast(1.05); }
& li.bu-links a.bu-link, & #bu-mail .bu-mail-badge { border-radius: 0 !important; }
`;

  /* ================= DOS / Norton Commander ================= */
  const dos = `
& #header, & .sd-header { background-color: #00aaaa !important; background-image: none !important; border-bottom: 0 !important; }
& ${HDR_TXT} { color: #000000 !important; }
& img.bu-logo-ais { filter: none !important; }
& nav[aria-label="breadcrumb"] { border-top: 0 !important; border-bottom: 3px double var(--border-strong) !important; }
& :is(${CARDS}), & fieldset { border: 3px double var(--border-strong) !important; border-radius: 0 !important; box-shadow: 6px 6px 0 rgba(0,0,0,.55) !important; }
& :is(${HEADS}) { border-bottom: 3px double var(--border-strong) !important; }
& :is(th, thead td):not(.bu-keep) { border: 1px solid var(--border-strong) !important; }
& :is(${BTNS}), & #bu-ctl .bu-btn { border: 0 !important; border-radius: 0 !important; background-color: #00aaaa !important; color: #000000 !important; box-shadow: 3px 3px 0 rgba(0,0,0,.55); }
& :is(${BTNS}):hover, & #bu-ctl .bu-btn:hover { background-color: #55ffff !important; }
& #bu-ctl .bu-btn svg { stroke: #000000; }
& :is(${FIELDS}) { border: 1px solid var(--border-strong) !important; border-radius: 0 !important; }
& :is(${POPS}) { border: 3px double var(--border-strong) !important; border-radius: 0 !important; box-shadow: 8px 8px 0 rgba(0,0,0,.6) !important; }
& img.bu-avatar { border-radius: 0 !important; }
& li.bu-links a.bu-link, & #bu-mail .bu-mail-badge { border-radius: 0 !important; }
& ::selection { background: #00aaaa; color: #000000; }
`;

  const MONO = 'ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace';

  const FUN = {
    retroxp: {
      name: 'Retro XP', tagline: 'Modré okno, béžové tlačidlá, nostalgia z roku 2001', radius: 4, font: 'Tahoma, "Segoe UI", Verdana, sans-serif', group: 'fun',
      dark:  P('#141414', '#1e1e1e', '#2a2a2a', '#363636', '#666666', '#eeeeee', '#bbbbbb', '#ffb04d', '#e8820c', '#6cb0ff', '#e0a73e', '#ff7b72'),
      light: P('#ece9d8', '#f5f4ea', '#ffffff', '#ece9d8', '#aca899', '#111111', '#4d4a3c', '#0033cc', '#316ac5', '#0a5bc4', '#8a5a00', '#b3261e'),
      css: build('retroxp', retroxp),
    },
    retro95: {
      name: 'Retro 95', tagline: 'Sivé skosené okná a tmavomodrý titulok', radius: 0, font: 'Tahoma, "Microsoft Sans Serif", Arial, sans-serif', group: 'fun',
      dark:  P('#000000', '#101010', '#1c1c1c', '#2a2a2a', '#808080', '#ffffff', '#c0c0c0', '#66ffff', '#00a0a0', '#66b3ff', '#ffd060', '#ff8080'),
      light: P('#c0c0c0', '#c0c0c0', '#d4d4d4', '#b4b4b4', '#808080', '#000000', '#2b2b2b', '#0000a8', '#000080', '#00508a', '#674700', '#a00000'),
      css: build('retro95', retro95),
    },
    crtamber: {
      name: 'Jantárový terminál', tagline: 'Jantár na čiernej, jemné scanlines', radius: 0, font: MONO, group: 'fun',
      dark:  P('#0a0700', '#0f0a00', '#171000', '#221800', '#6b4a00', '#ffb000', '#d09000', '#ffd24d', '#ffb000', '#ffcc66', '#ffdd88', '#ff7043'),
      light: P('#fff3d6', '#fff8e6', '#fffdf5', '#ffe9b8', '#d9b46a', '#3a2400', '#6b4a10', '#7a4a00', '#b36b00', '#1d5a8a', '#7a4a00', '#a82a10'),
      css: build('crtamber', crtamber),
    },
    gameboy: {
      name: 'Game Boy', tagline: 'Štyri odtiene zelenej, pixelové tiene', radius: 0, font: MONO, group: 'fun',
      dark:  P('#0f380f', '#0f380f', '#143f14', '#1b4a1b', '#8bac0f', '#b5d52b', '#a7c820', '#c4e03a', '#9bbc0f', '#c4e03a', '#e0e060', '#f0a080'),
      light: P('#8bac0f', '#9bbc0f', '#a8c716', '#8bac0f', '#0f380f', '#0f380f', '#173f17', '#0f380f', '#306230', '#0f380f', '#173f17', '#3a1a0f'),
      css: build('gameboy', gameboy),
    },
    c64: {
      name: 'Commodore 64', tagline: 'Modrá obrazovka a svetlomodrý rám', radius: 0, font: MONO, group: 'fun',
      dark:  P('#352879', '#40318d', '#4a3ba0', '#5547b0', '#7869c4', '#e6e2ff', '#cfcaff', '#ffffaa', '#a99bff', '#aaeeff', '#ffe08a', '#ffb0a0'),
      light: P('#d8d2ff', '#e8e4ff', '#f6f4ff', '#d0c9ff', '#7869c4', '#2a1f6b', '#4a3f94', '#352879', '#40318d', '#20578a', '#6b4a00', '#a02a20'),
      css: build('c64', c64),
    },
    synthwave: {
      name: 'Synthwave', tagline: 'Fialová noc, ružový a tyrkysový neón', radius: 6, font: '', group: 'fun',
      dark:  P('#120a24', '#1a1033', '#241547', '#2f1b5c', '#5b3a9e', '#f3e8ff', '#c0a8e8', '#4df0ff', '#ff2bd6', '#4df0ff', '#ffd166', '#ff6b8a'),
      light: P('#f4e9ff', '#faf3ff', '#ffffff', '#ecd9ff', '#c9a5f0', '#2a0f4d', '#5b3d8c', '#a0008f', '#d4119e', '#0a6fa8', '#8a5a00', '#b3261e'),
      css: build('synthwave', synthwave),
    },
    brutal: {
      name: 'Brutalizmus', tagline: 'Hrubé čierne rámy a posunuté tiene', radius: 0, font: 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif', group: 'fun',
      dark:  P('#000000', '#111111', '#1a1a1a', '#2b2b2b', '#ffffff', '#ffffff', '#cfcfcf', '#ffe600', '#ffe600', '#7fc0ff', '#ffb84d', '#ff7b7b'),
      light: P('#ffe600', '#fffbe0', '#ffffff', '#ffe600', '#000000', '#000000', '#333333', '#1a1aff', '#e6002b', '#0033cc', '#7a4000', '#c00000'),
      css: build('brutal', brutal),
    },
    aqua: {
      name: 'Aqua (sklo)', tagline: 'Priesvitné karty a lesklé tlačidlá', radius: 14, font: '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif', group: 'fun',
      dark:  P('#0c1624', '#101e30', '#172a42', '#1f3856', '#35567e', '#e6f1ff', '#a9c3e0', '#7fc4ff', '#3b9cff', '#7fc4ff', '#e0b04a', '#ff8a80'),
      light: P('#dcecf8', '#eaf3fb', '#f7fbff', '#d3e6f5', '#9fc3e0', '#0b2540', '#3d5f7f', '#0a56b0', '#1c7be0', '#0a6fa8', '#7a5200', '#b3261e'),
      css: build('aqua', aqua),
    },
    newspaper: {
      name: 'Noviny', tagline: 'Pätkové písmo, dvojité linky, krémový papier', radius: 0, font: 'Georgia, "Times New Roman", serif', group: 'fun',
      dark:  P('#171410', '#1d1913', '#26201a', '#312a21', '#6b5e4a', '#eee4cf', '#bfb299', '#e8c27a', '#d9a441', '#8fb8e0', '#e0a73e', '#e8756c'),
      light: P('#f1ead7', '#f7f1e1', '#fbf7ea', '#ebe3cb', '#3b3226', '#1b1710', '#544a3a', '#6b1a1a', '#8b1a1a', '#1d4e7a', '#7a4a00', '#9b1c1c'),
      css: build('newspaper', newspaper),
    },
    dos: {
      name: 'DOS (Norton)', tagline: 'Modrý panel, tyrkysová lišta, dvojité rámy', radius: 0, font: MONO, group: 'fun',
      dark:  P('#00007a', '#0000aa', '#0000b4', '#2c2cc8', '#55ffff', '#ffffff', '#d0d0ff', '#ffff55', '#55ffff', '#55ffff', '#ffff55', '#ff7777'),
      light: P('#00aaaa', '#d8d8d8', '#e8e8e8', '#00aaaa', '#000080', '#000000', '#2a2a60', '#0000a8', '#0000aa', '#0000a8', '#6b4a00', '#a00000'),
      css: build('dos', dos),
    },
  };

  Object.assign(BU.THEMES, FUN);
  BU.FUN_THEME_IDS = Object.keys(FUN);
})(self);
