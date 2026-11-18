// tools/lint-css.mjs: v base.css a options.css nesmie byť číselná hodnota padding/margin/font-size/border-radius mimo stupníc
import { readFileSync } from 'node:fs';

const SCALES = new Set(['4px','8px','12px','16px','24px','13px','14px','16px','20px','1.25','1.5']);
const RE = /(padding|margin|font-size|border-radius)\s*:\s*([^;]+);/g;
let fails = 0;
for (const f of ['base.css', 'options.css']) {
  const css = readFileSync(f, 'utf8');
  let m;
  while ((m = RE.exec(css)) !== null) {
    const val = m[2].trim();
    // povolíme var(--...) a auto/inherit/none
    if (val.startsWith('var(') || val === 'auto' || val === 'inherit' || val === 'none' || val === '0') continue;
    // rozlož zložené hodnoty (napr. "8px 12px")
    for (const part of val.split(/\s+/)) {
      if (!part) continue;
      if (part.startsWith('var(') || part === 'auto' || part === 'inherit' || part === 'none' || part === '0') continue;
      if (!SCALES.has(part)) { console.log(`${f}: ${m[1]}: ${val}`); fails++; break; }
    }
  }
}
console.log(fails ? `ZLYHALO: ${fails}` : 'VŠETKO OK');
process.exitCode = fails ? 1 : 0;