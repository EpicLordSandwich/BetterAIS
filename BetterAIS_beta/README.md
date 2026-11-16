# betterUIS v4.8

Vlastný vzhľad a drobné vylepšenia pre [is.stuba.sk](https://is.stuba.sk) – témy, tmavý/svetlý režim, CSS snippety,
paleta príkazov, table-tools, vlastná profilovka a odkazy v lište. Všetko beží len lokálne, nič sa neposiela na server.

## Inštalácia

**Chrome / Edge / Brave:** `chrome://extensions` → Režim pre vývojárov → „Načítať rozbalené“ → vyber tento priečinok
(alebo nahoď zip).

**Firefox:** `about:debugging` → „Dočasne načítať doplnok“ → vyber `manifest.firefox.json`
(tento manifest je pre Firefox samostatný, lebo MV3 background sa líši). Vyžaduje Firefox 128+
(lebo notifikácie používajú `optional_host_permissions`).

Po zmene súborov: obnov rozšírenie v `chrome://extensions` a na is.stuba.sk daj Ctrl+F5.
Ak si rozšírenie odstránil a znova načítal („Vymazať všetko“), notifikácie pošty sú vypnuté –
zapni ich znova v nastaveniach (udelí sa oprávnenie `alarms`/`notifications`).

## Balík na distribúciu

`npm run package` (Windows) vytvorí `dist/betteruis-chrome-<verzia>.zip` a `dist/betteruis-firefox-<verzia>.zip`.
Balí sa len runtime: manifest, skripty, CSS, ikony, logo a `pedro.gif`. Vývojové veci
(`.desloppify/`, `.claude/`, testy, `scorecard.png`, `sense_check_prompt.txt`) sa nikdy nedostanú do zipu;
pri Firefoxe sa `manifest.firefox.json` v balíku premenuje na `manifest.json`.

## Čo to vie

- **Témy** – 14 vstavaných (Claude, Sleek, Nord, Bloom, Comfy, Catppuccin, Dracula, Gruvbox, STU modrá, OLED, OG AIS, Nothing, Techy, Clean),
  každá s tmavým aj svetlým variantom; vlastné témy vo formáte `theme.json` sa dajú importovať.
- **OG AIS** – retro téma podľa starého AIS/UIS: bordová hlavička, krémové warning boxy,
  žlté info boxy, bordové odkazy a ostré rohy. Proces extrakcie a mapovanie tokenov je v
  [`docs/OG-AIS.md`](docs/OG-AIS.md).
- **Režim** – tmavý / svetlý / auto (podľa systému), prepínač aj v hlavičke UIS.
- **Paleta príkazov (Ctrl+K)** – rýchle vyhľadávanie vo všetkých položkách menu + vlastných odkazoch.
  Hľadá **bez diakritiky**: „skusky“ nájde „Skúšky“, „lt“ nájde „Žltý“. Zatvára sa kliknutím mimo.
- **Table-tools** – tabuľky s hlavičkou (`<th>`) a aspoň 2 riadkami sa dajú triediť klikom na hlavičku
  (čísla, dátumy `dd.mm.yyyy`, text s slovenskou zaradením `ch`), druhý klik zoradí opačne, tretí vráti pôvodné
  poradie. Tabuľky s viac ako 15 riadkami dostanú lištu s **filtrom** (tiež bez diakritiky) a tlačidlom **CSV**
  (skopíruje hlavičku + viditeľné riadky do schránky). Zebra a fixná hlavička sú len CSS.
  **Tabuľky s formulárovými prvkami (`input`/`select`/`textarea`/`button`) sa nepostihnú** – poradie riadkov
  v nich je súčasťou formulára (prihlásenie na skúšky a pod.).
- **CSS snippety** – vlastné CSS pre konkrétne problémy (rozvrh, termíny, tabuľky), zapínajú sa/vypínajú osobitne.
- **Vlastné odkazy v lište** – tlačidlo + v hlavičke UIS pridá aktuálnu stránku; nastavenia umožňujú
  poradie, ikonky a skrytie pôvodného odkazu v kartách.
- **Profilovka** – predvolená je **pôvodná fotka** (súkromie, nič sa nenačítava z tretej strany).
  Pedro funguje ako voliteľný mód z lokálneho súboru `pedro.gif` (96×96, v zipe); vlastný obrázok/GIF
  sa uploaduje v nastaveniach. Náhľad pôvodnej fotky v nastaveniach je snímka z poslednej návštevy AIS.
- **Výkon** – skript beží aj v iframe (aby téma platila aj vnútri rámov), ale ťažké skeny
  (hlavička, boxy, logo, popupy, sémantické farby) bežia len v hlavnom frame; sken popupov má
  rozpočet 8 ms, sken boxov 30 ms – stránka sa nezasekne ani pri dlhých zoznamoch.
- **Nastavenia putujú za tebou** – téma, odkazy a snippety sa zrkadlia cez `chrome.storage.sync`
  (profilovka ostáva len lokálna); ručný export/import do JSON v nastaveniach.
- **Viacjazyčnosť** – rozhranie (názvy tlačidiel, paleta, nastavenia) sa prispôsobí jazyku prehliadača:
  slovenčina, angličtina, ukrajinčina, ruština (čeština → slovenčina). UIS stránky ostávajú v jazyku UIS.
- **Notifikácie pošty (opt-in)** – každých 15–60 minút skontroluje neprečítané správy v UIS pošte,
  upozorní notifikáciou s počtom a badge na ikonke. Len čítanie; nič sa neposiela na server.
  Zapína sa v nastaveniach, zapnutie udelí oprávnenie na pozadie, vypnutie ho odoberie.
- **Dashboard hodnotení (E-index)** – na stránke „Prehľady a informácie o Vašom štúdiu“
  (podrobný prehľad) zobrazí panel s **váženým priemerom** (váha = kredity), získanými
  kreditmi, rozdelením známok a zoznamom aktuálne neúspešných predmetov (dedupe: pre
  opakovaný predmet sa počíta posledný výsledok podľa dátumu). Voliteľný cieľ kreditov
  (0–400) ukáže progres. Počíta len z tabuliek na stránke – je to **neoficiálny prepočet**,
  oficiálne štatistiky UIS ostávajú nedotknuté. Dá sa vypnúť v nastaveniach.

## Skratky

| Skratka | Akcia |
|---|---|
| `Ctrl+K` | paleta príkazov (vyhľadávanie v menu, bez diakritiky) |
| `Ctrl+Shift+U` | diagnostika – skopíruje štruktúru stránky (redigované osobné údaje) |
| `Ctrl+Shift+Y` | vybrať prvok a skopírovať len jeho HTML |
| `Alt+Shift+D` / `Alt+Shift+I` | fallback diagnostiky (ak sú skratky premapované/zablokované) |

Skratky sa dajú zmeniť v `chrome://extensions/shortcuts`.

## Diagnostika a podpora

Výpis z Alt+Shift+D/Ctrl+Shift+U je redigovaný: hodnoty citlivých parametrov (`osobne_cislo`, `oid`, `token`,
`login`…) sa nahrádzajú `<n>` (číslo) alebo `<meno>` (iné), ďalšie dlhé číselné hodnoty v query sa tiež
nahrádzajú `<n>` a odkazy na ISIC fotku (`foto.pl`) sa úplne vymažú. Meno prihláseného používateľa
v hlavičke sa nerediguje (doladí sa proti reálnemu dumpu). Výpis vlož do chatu a pokračujeme.

V nastaveniach je tlačidlo „Skopírovať diagnostiku (verzia + nastavenia)“ – skopíruje verziu, prehliadač,
jazyk a sanitizované nastavenia. Vlož ho do chatu spolu s výpisom z `Ctrl+Shift+U`.

**Testovanie bez UIS:** `tools/smoke-fixture.html` je statická stránka napodobňujúca hlavičku a tabuľky UIS.
Spusti `node tools/serve-fixture.mjs` a otvor `http://127.0.0.1:8811/tools/smoke-fixture.html` – agent môže
testovať content.js (table-tools, paleta, umiestnenie tlačidiel) bez prihlásenia.

## Kontrast farieb

Všetky témy prešli kontrolou podľa WCAG 2.1 (4,5:1). Kontrola po pridaní novej témy:

```
node tools/contrast-check.mjs
```

## Notifikácie pošty (fáza 1)

- **Opt-in** – v nastaveniach prepínač „Zapnúť notifikácie pošty“. Zapnutie udelí oprávnenia
  `alarms`, `notifications` a prístup na pozadie k `https://is.stuba.sk/*`; vypnutie ich zase odoberie.
- Kontrola každých 15/20/30/60 minút (default 20), tiché hodiny (default 23:00–7:00) sa preskočia úplne.
- Notifikácia ukáže **len počet** neprečítaných; obsah správ ostáva v prehliadači. Klik na notifikáciu otvorí poštu.
- Prvý beh po zapnutí nastaví baseline – upozorní až na správy, ktoré prídu potom.
- Parser rozumie starému aj novému dizajnu pošty (11/2026): presný počet berie z badge pri položke
  „Pošta“ v účtovom menu, fallback je počítanie neprečítaných riadkov tabuľky.
- Funguje len pri bežiacom prehliadači a prihlásenej session; keď vyprší prihlásenie, kontrola sa ticho preskočí.
- Ak rozšírenie nerozozná rozhranie pošty (status „Rozhranie pošty nerozpoznané“), otvor
  `/auth/posta/slozka.pl` a stlač `Ctrl+Shift+U` – výpis (redigovaný) vlož do chatu, parser doladíme.

## Pedro

Predvolená profilovka je pôvodná fotka. Mód Pedro používa lokálny `pedro.gif` (96×96, 12 fps, ~440 kB,
súčasť balíka) – načítava sa len z rozšírenia, žiadna požiadavka na tretiu stranu. Keď súbor chýba,
vráti sa pôvodná fotka.

## Formát importovanej témy (theme.json)

```json
{
  "name": "Moja téma",
  "tagline": "Krátke vysvetlenie",
  "radius": 12,
  "font": "",
  "colors": {
    "dark":  { "bg0": "#111111", "bg": "#181818", "bg2": "#222222", "bg3": "#2c2c2c", "border": "#3a3a3a", "text": "#eeeeee", "muted": "#999999", "link": "#7ab0ff", "accent": "#3f74d9", "info": "#5b9bf0", "warn": "#e0a73e", "crit": "#e8756c" },
    "light": { "bg0": "#eeeeee", "bg": "#f5f5f5", "bg2": "#ffffff", "bg3": "#e8e8e8", "border": "#d9d9d9", "text": "#222222", "muted": "#666666", "link": "#1f5fbf", "accent": "#3f74d9", "info": "#2e6ccb", "warn": "#966319", "crit": "#c53b30" }
  }
}
```

Farby musia byť `#rrggbb`. Kontrola kontrastu po importe: `node tools/contrast-check.mjs`.

## Súbory

- `manifest.json` – Chrome/Chromium (MV3, service worker)
- `manifest.firefox.json` – Firefox (MV3, event page)
- `themes.js` – spoločné jadro: témy, výpočet CSS premenných, ukladanie + sync, i18n
- `pedro.gif` – voliteľná lokálna profilovka (96×96, súčasť balíka)
- `notifcore.js` – čistá logika: notifikácie, hľadanie bez diakritiky, zoradenie buniek a CSV
  (table-tools), redakcia výpisu
- `grades.js` – čistá logika dashboardu hodnotení (parser E-indexu, dedupe, súhrn, priemer)
- `content.js` – všetko, čo sa deje na stránke UIS (vrátane table-tools)
- `base.css` – základné pravidlá (visia na `html:not([data-bu-off])`, t. j. kill-switch ich vypína)
- `popup.html/js` – rýchly prepínač režimu, témy a vypínač pre aktuálnu stránku
- `options.html/js/css` – kompletné nastavenia
- `tools/contrast-check.mjs` – WCAG kontrola tém
- `tools/package.ps1` – čistý Chrome/Firefox zip (len runtime súbory)
- `tools/test-notif-*.mjs`, `tools/test-settings-core.mjs`, `tools/test-grades-core.mjs` – testy logiky (node)

## Čo ešte chýba (deferred, s dôvodom)

- **Rozvrh → ICS export, hlásič termínov (exam-watch)** – parser potrebujú reálny HTML
  z prihlásených stránok UIS (redigovaný dump cez `Ctrl+Shift+U`); proti vymysleným selektorom
  sa nepíše. Rozvrh je momentálne prázdny („Vybraným kritériám nevyhovujú žiadne rozvrhové
  akcie“) a stránka prihlásenia na skúšky nemá dostupné termíny – bez dát sa nedá overiť.
  Dashboard hodnotení je implementovaný (viď vyššie).
- **Neutral-recolor plná verzia** – úplné prebitie UIS CSS je fáza-2 veľkosť; súčasný kompromis
  (`.bu-keep` sémantické farby) zostáva.
- **Plný i18n (`_locales`)** – vyžaduje preklad celej options stránky; rozhodnutie o podaní.
- **Online marketplace (fáza 5), userScripts (fáza 8), TS monorepo (fáza 0)** – produktové
  a nástrojové rozhodnutia mimo tohto vydania.
