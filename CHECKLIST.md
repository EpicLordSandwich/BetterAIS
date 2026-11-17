# betterUIS v4.8 – Checklist implementácie

Stav k vydaniu v4.8. Označenie: `[x]` = hotové a overené, `[ ]` = neimplementované / blokované.

## 1. Jadro a témy
- [x] 11 vstavaných tém (Claude, Sleek, Nord, Bloom, Comfy, Catppuccin, Dracula, Gruvbox, STU modrá, OLED, OG AIS), tmavý + svetlý variant
- [x] OG AIS – retro téma podľa starého AIS/UIS (bordová hlavička, krémové warning boxy, žlté info boxy, ostré rohy)
- [x] Dokumentácia reverzného inžinierstva OG témy: `docs/OG-AIS.md` + referenčný screenshot `docs/og-uis-reference.png`
- [x] Režim tmavý / svetlý / auto (podľa systému), prepínač v hlavičke UIS
- [x] Vlastné témy vo formáte `theme.json` + import s kontrastným varovaním (< 4,5:1)
- [x] Vlastné CSS snippety (zapínanie/vypínanie osobitne)
- [x] Vlastné odkazy v lište (pridanie, poradie, ikonky, skrytie pôvodného)
- [x] Profilovka: predvolená pôvodná fotka (súkromie), Pedro z lokálneho `pedro.gif`, vlastný upload
- [x] Kill-switch (globálne + per stránka), `html[data-bu-off]`
- [x] `gray`/`grey` → `#808080` (sanitizér)
- [x] Sanitizér blokuje vzdialené `url()` v CSS
- [x] Potvrdenie pri importe nastavení
- [x] Export/import nastavení do JSON

## 2. Table-tools
- [x] Triedenie klikom na hlavičku (čísla, dátumy `dd.mm.yyyy`, text so slovenským `ch`)
- [x] Druhý klik opačne, tretí vráti pôvodné poradie
- [x] Filter pre tabuľky > 15 riadkov (bez diakritiky)
- [x] CSV do schránky (hlavička + viditeľné riadky)
- [x] Zebra a fixná hlavička (CSS)
- [x] Tabuľky s formulárovými prvkami sa netriedia (ochrana formulárov)
- [x] Marker `data-bu-tt` proti slučke MutationObservera

## 3. Paleta príkazov
- [x] Ctrl+K – vyhľadávanie v menu + vlastných odkazoch
- [x] Hľadanie bez diakritiky („skusky“ → „Skúšky“)
- [x] Zatvorenie kliknutím mimo

## 4. Výkon a architektúra
- [x] Beží aj v iframe (téma platí vnútri rámov)
- [x] Ťažké skeny len v hlavnom frame (`isTop` guard)
- [x] Rozpočet skenov (popupy 8 ms, boxy 30 ms)
- [x] `all_frames: true` s guardmi
- [x] Sync cez `chrome.storage.sync` (téma, odkazy, snippety); profilovka len lokálne
- [x] i18n rozhrania (sk/en/uk/ru, cz → sk)

## 5. Notifikácie pošty – ODSTRÁNENÉ (v1.2.0)
- [x] Kompletne odstránené: kontrola pošty na pozadí, notifikácie, alarmy, optional permissions
- [x] Zostávajú v notifcore.js len zdieľané utility (diakritika, table-tools, redakcia výpisu)

## 6. Dashboard hodnotení (E-index) – NOVÉ v4.7
- [x] Modul `grades.js` (čistá logika, testovateľná v node)
- [x] Parser E-indexu (`parseResult`, `isGradeHeader`, `parseTable`, `unique`, `summarize`, `formatAverage`)
- [x] Vážený priemer (váha = kredity), získané kredity, počet predmetov, neúspešné
- [x] Rozdelenie známok (A–FX, Z) so stacked barom a chips
- [x] Cieľ kreditov 0–400 s progress barom
- [x] Dedupe opakovaných predmetov (posledný výsledok podľa dátumu)
- [x] Značka „neoficiálny prepočet“
- [x] Oficiálne štatistiky UIS nedotknuté
- [x] Beží len v top frame, len na `/auth/student/pruchod_studiem.pl`
- [x] Rešpektuje kill-switch a `grades.on`
- [x] Re-render pri zmene nastavení (podpisová kontrola, bez slučky)
- [x] Vloženie panelu pred prvú hlavičku obdobia
- [x] Slovenská pluralizácia (kredit/kredity/kreditov, predmet/predmety/predmetov, neúspešný/neúspešné/neúspešných, obdobie/obdobia/období)
- [x] Nastavenia `DEFAULTS.grades`, normalize clamp 0–400
- [x] Sekcia „Hodnotenia“ v options.html/js
- [x] Diagnostika obsahuje `grades`
- [x] Live validácia: 45 riadkov, 40 unikátnych, 180 kreditov, priemer 2,31, 39 úspešných, 1 FX (sedí s UIS)
- [x] Per-obdobie validácia: LS 2025/2026 → 36 kreditov, 7 úspešných, 1 FX, priemer 2,01

## 7. Testy
- [x] `tools/tests/test-grades-core.mjs` – zelené (reálny fixture 8 predmetov)
- [x] `tools/tests/test-settings-core.mjs` – zelené (vrátane grades normalize)
- [x] `tools/tests/test-notif-core.mjs`, `test-notif-settings.mjs`, `test-integration.mjs` – zelené
- [x] `tools/contrast-check.mjs` – 0 porušení
- [x] `node --check` pre všetky JS – bez chýb
- [x] `npm test` → `VŠETKO OK`
- [ ] Behaviorálne testy content/options (chýba DOM harness – jsdom nedostupný)

## 8. Packaging a distribúcia
- [x] `manifest.json` (Chrome) a `manifest.firefox.json` (Firefox) v syncu (v4.8)
- [x] `grades.js` pridané do oboch manifestov a `package.ps1`
- [x] `npm run package` → `dist/betteruis-chrome-4.8.zip`, `dist/betteruis-firefox-4.8.zip`
- [x] Zipy obsahujú `grades.js`, `pedro.gif`, manifest v4.8 (18 súborov)
- [x] Verzia zosynchronizovaná: manifest.json, manifest.firefox.json, package.json, README (4.8)
- [x] README aktualizovaný (čo vie, súbory, deferred)

## 9. Blokované / neimplementované (bez reálnych dát)
- [ ] **Rozvrh → ICS export** – osobný rozvrh je prázdny („Vybraným kritériám nevyhovujú žiadne rozvrhové akcie“). Potrebný redigovaný dump cez `Ctrl+Shift+U`.
- [ ] **Hlásič termínov (exam-watch)** – stránka prihlásenia na skúšky nemá dostupné termíny. Potrebný dump/screenshot.
- [ ] **Biely text na bielom v dropdowne** – nereprodukované; potrebný screenshot alebo `Ctrl+Shift+Y` pick prvku.
- [ ] **Neutral-recolor plná verzia** – fáza 2; súčasný kompromis `.bu-keep` zostáva.
- [ ] **Plný i18n (`_locales`)** – vyžaduje preklad celej options stránky.
- [ ] **Online marketplace (fáza 5), userScripts (fáza 8), TS monorepo (fáza 0)** – produktové/nástrojové rozhodnutia mimo vydania.

## 10. Známe obmedzenia
- Dashboard počíta len z tabuliek na aktuálnej stránke (nie celý študijný plán).
- Notifikácie fungujú len pri bežiacom prehliadači a prihlásenej session.
- Git nie je inicializovaný v projekte (žiadny commit/push bez výslovného súhlasu).
- Browse extension momentálne odpojená – live screenshot náhľadu sa nepodaril; statický náhľad v `%TEMP%\opencode\grades-preview.html`.
PY