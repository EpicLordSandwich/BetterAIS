# AGENTS.md — BetterAIS (betterUIS browser extension)

Browser extension (Chrome/Firefox, MV3) pre STU UIS (is.stuba.sk). Zlepšuje vzhľad, ovládanie a používateľský komfort UIS: témy, tmavý/svetlý režim, CSS snippety, paleta príkazov (Ctrl+K), table-tools, vlastné odkazy, notifikácie pošty, dashboard hodnotení (E-index).

## Stack
- Vanilla JS (žiadny framework/build step), CSS, HTML
- Chrome/Firefox MV3: `manifest.json` / `manifest.firefox.json`
- Runtime súbory v `BetterAIS_beta/`
- Testy: Node mjs v `BetterAIS_beta/tools/tests/`

## Štruktúra
```
BetterAIS_beta/
  manifest.json, manifest.firefox.json
  themes.js        # jadro: témy, compute CSS vars, storage, i18n
  content.js       # všetko na stránke UIS
  base.css         # základné pravidlá (visia na html:not([data-bu-off]))
  options.html/js/css  # nastavenia
  popup.html/js
  notifcore.js, grades.js
  tools/           # testy, contrast-check, package.ps1
```

## Príkazy
- `npm test` (v `BetterAIS_beta/`): všetky testy + contrast check
- `node --check *.js` syntaktická kontrola
- `node tools/contrast-check.mjs` WCAG 4.5:1 kontrola tém
- `npm run package` (Windows/powershell) balík

## Konvencie
- CSS cez premenné `--bg`, `--text`, `--accent`, ... (počítané v `themes.js` → `compute()`).
- Téma = `P(bg0,bg,bg2,bg3,border,text,muted,link,accent,info,warn,crit)` pre dark/light.
- Žiadne gradienty, fialové farby, em-dashes v obsahu; monochromatické/konzistentné palety.
- Farby `#rrggbb`, kontrast ≥ 4.5:1 (over `contrast-check.mjs`).
- Relatívne linky na vlastný web (nikdy absolútne self-linky).
- Secrets nikdy v kóde.

## Dizajn princípy
- Konzistencia naprieč nastaveniami: všetko poháňané CSS premennými témy.
- Žiadny AI slop: žiadne fialové gradienty, žiadne m-dashes, žiadne generické ilustrácie.
- Používateľsky príjemné: čitateľné kontrasty, jasné hierarchie, minimálne dekorácie.
- Lightweight CSS: žiadne ťažké blur efekty; rešpektovať `prefers-reduced-motion`.
- Prístupnosť: viditeľné focus stavy, WCAG 4.5:1.

## Témy
Claude, Sleek, Nord, Bloom, Comfy, Catppuccin, Dracula, Gruvbox, STU modrá, OLED, OG AIS, Nothing, Techy, Clean, Minimal (+ importované vlastné).

## Štýl práce
- Pred commitom `git status`, stage-uj len svoje súbory, nikdy `git add -A` naslepo.
- Pred prácou/pushom `git pull --ff-only`.
- Verifikácia: `npm test` pred commitom.
