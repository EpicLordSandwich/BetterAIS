# OG AIS – reverse engineering starého AIS/UIS vzhľadu

Tento dokument popisuje, ako vznikla téma **OG AIS** v betterUIS: z referenčného
screenshotu starého UIS (AIS) sa extrahovali farby a charakteristické prvky a preložili
sa do tokenov betterUIS. Je určený aj pre ďalšieho agenta, ktorý bude tému rozširovať
alebo opravovať.

## 1. Zdroj

- Referenčný obrázok: [`docs/og-uis-reference.png`](og-uis-reference.png)
- Pôvodný súbor: screenshot z iPhone (1170×2532), stará verzia `https://is.stuba.sk/`
  pred redesignom („University Information System“).
- Na obrázku je: bordová hlavička STU, horizontálne menu fakúlt, breadcrumb, krémové
  warning boxy, žlté info boxy, sekcie s ikonami a bordové odkazy.

## 2. Metóda extrakcie

Použité boli **priame pixelové vzorky** a **histogramy dominantných farieb** (Pillow),
nie odhad „od oka“:

```python
from PIL import Image
from collections import Counter
im = Image.open('docs/og-uis-reference.png').convert('RGB')
# vzorka konkrétneho bodu
im.getpixel((x, y))
# dominantné farby regiónu (hlavička, warning box, info box)
Counter(im.crop((x0, y0, x1, y1)).getdata()).most_common(10)
```

Reprodukovateľne: `python docs/sample-og-colors.py` (vyžaduje Pillow).

Overené vzorky (RGB):

| Oblasť | RGB | HEX |
|---|---|---|
| Hlavička STU / odkazy / nadpisy | `(131, 17, 53)` | `#831135` |
| Telo textu | `(51, 51, 51)` | `#333333` |
| Warning box (krémová) | `(255, 241, 221)` | `#FFF1DD` |
| Info box (žltá) | `(255, 255, 204)` | `#FFFFCC` |
| Červená ikona upozornenia | `(220, 21, 14)` | `#DC150E` |
| Modrá ikona info | `(33, 150, 243)` | `#2196F3` |
| Sivý pás / tabuľky | `(242, 242, 242)` | `#F2F2F2` |
| Biely podklad | `(255, 255, 255)` | `#FFFFFF` |
| Tmavosivý text/okraj | `(207, 207, 207)` | `#CFCFCF` |

Poznámka: `#2196F3` a `#DC150E` sú **ikonové** farby. Ako textový token by na bielom
pozadí neprešli WCAG 4,5:1, preto sú v téme použité iba v CSS pre boxy/ikony a textové
tokeny `info`/`crit` sú tmavšie.

## 3. Mapovanie na tokeny betterUIS

Téma používa rovnakých 12 tokenov ako ostatné témy (`P(bg0, bg, bg2, bg3, border,
text, muted, link, accent, info, warn, crit)`).

### Svetlý variant (primárny, podľa screenshotu)

| Token | HEX | Rola |
|---|---|---|
| `bg0` | `#f3e6ea` | jemný bordový nádych pod hlavičkou (samotná hlavička je override) |
| `bg` | `#ffffff` | biele pozadie stránky |
| `bg2` | `#fffdfa` | karty / formuláre |
| `bg3` | `#f2f2f2` | hover, hlavičky tabuliek, sivé pásy |
| `border` | `#d9d9d9` | jemné okraje |
| `text` | `#333333` | telo textu |
| `muted` | `#666666` | sekundárny text |
| `link` | `#831135` | bordové odkazy |
| `accent` | `#831135` | bordový akcent |
| `info` | `#1565c0` | tmavšia modrá pre text (kontrast) |
| `warn` | `#8a5a00` | tmavšia jantárová pre text (kontrast) |
| `crit` | `#b3261e` | tmavšia červená pre text (kontrast) |

### Tmavý variant (odvodený, screenshot je len svetlý)

| Token | HEX |
|---|---|
| `bg0` | `#3a0a1c` |
| `bg` | `#1b1315` |
| `bg2` | `#241a1d` |
| `bg3` | `#2f2226` |
| `border` | `#4a343a` |
| `text` | `#f5ecef` |
| `muted` | `#c9b3b8` |
| `link` | `#f0a3b8` |
| `accent` | `#c94d6e` |
| `info` | `#7fb8ff` |
| `warn` | `#e8b45a` |
| `crit` | `#ff8a7a` |

`radius: 0` a font `Verdana, Tahoma, "Segoe UI", sans-serif` približujú starý UIS
(ostré rohy, hustý bezpätkový text).

## 4. Implementácia

### `themes.js`

- Pridaná položka `og` do `THEMES` (za `oled`).
- Pole `bar: { color, text }` nastavuje UIS bordovú lištu (prebije `--accent-color`).
- `compute()` teraz vracia aj `theme: s.theme`.
- `applyVars()` nastavuje `root.dataset.buTheme = out.theme`, aby bolo možné robiť
  cielené CSS override iba pre túto tému.

### `base.css`

Blok `/* ===== OG AIS ... ===== */` (za `.zasadky` pravidlami) robí:

- hlavička `#header` / `.sd-header` → bordová `#831135`, text biely;
- warning boxy → krémová `#FFF1DD`, ľavý okraj `#DC150E`, text bordový;
- info boxy → žltá `#FFFFCC`, ľavý okraj `#2196F3`, text bordový;
- nadpisy `h1–h6` a `.sekce-nadpis` → bordová;
- hlavičky tabuliek → sivá `#F2F2F2` s bordovým textom;
- formulárové prvky → ostré rohy.

Pozn.: UIS niekedy dáva na box aj triedu `.box`; preto majú OG selektory
`.zasadky-warning[class]` / `.zasadky-info[class]`, aby prebili všeobecné
`div.box` pravidlo. Ak by v budúcnosti pribudol `.zasadky-crit`, treba ho
pridať rovnako.

Všetky override sú gated cez `html:not([data-bu-off])[data-bu-theme="og"]`, takže
ostatné témy sa nemenia.

### Vizuálny náhľad

- [`docs/og-preview.html`](og-preview.html) – statický náhľad (otvor v prehliadači).
- [`docs/og-preview.png`](og-preview.png) – screenshot náhľadu (Chrome headless).
- [`docs/og-uis-reference.png`](og-uis-reference.png) – pôvodný screenshot.

## 5. Kontrast

```bash
node tools/contrast-check.mjs
```

Výsledok: **0 porušení** (téma `og` je zahrnutá automaticky, lebo checker iteruje
`BU.THEMES`). Overované páry: `text`, `muted`, `link`, `info`, `warn`, `crit` proti
`bg`, `bg0`, `bg2`, `bg3`.

## 6. Použitie

1. `chrome://extensions` → reload rozšírenia (alebo Firefox `about:debugging`).
2. Nastavenia → **Obchod s témami** → **OG AIS**.
3. Režim: svetlý (primárny). Tmavý variant je odvodený.
4. Pre autentickejší OG vzhľad vypni v nastaveniach **„Vymeniť logo UIS za FEI“** –
   OG téma inak necháva logo z aktuálneho UIS.

## 7. Známe obmedzenia

- Screenshot je len svetlý; tmavý variant je interpretácia, nie 1:1 rekonštrukcia.
- Štruktúra starej hlavičky (logo STU, serifový nadpis „UNIVERSITY INFORMATION
  SYSTEM“) sa **nekopíruje** – betterUIS mení farby a charakter, nie DOM UIS.
- Ikony starého UIS (osoba, klipboard, info, priečinok, laboratórium, atóm) sú
  obrázky UIS; téma ich nahrádza len farebne, nie tvarovo.
- Presné selektory starého UIS nie sú overené živým dumpom (stará verzia už nie je
  dostupná); preto sú override postavené na selektoroch, ktoré používa aktuálny
  betterUIS (`#header`, `.sd-header`, `.zasadky-*`, `h1–h6`, `.sekce-nadpis`).
- Ak sa v novej UIS zmení štruktúra, treba doplniť selektory podľa `Ctrl+Shift+U`
  dumpu.

## 8. Checklist pre ďalšieho agenta

- [ ] Overiť `node tools/contrast-check.mjs` po akejkoľvek zmene palety.
- [ ] Skontrolovať, že `data-bu-theme="og"` sa nastavuje v `applyVars()`.
- [ ] Pri novej UIS štruktúre doplniť selektory do OG bloku v `base.css`.
- [ ] Ak pribudne svetlý/tmavý variant, doplniť obe palety do `THEMES.og`.
- [ ] Po zmene `themes.js` spustiť `npm test` a `npm run package`.
- [ ] Referenčný obrázok nechať v `docs/og-uis-reference.png` (nie v zip balíku).
PY