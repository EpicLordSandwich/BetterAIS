// tools/lint-copy.mjs: UI texty nesmú obsahovať en/em pomlčku ani odkaz na "chat"
import { readFileSync } from 'node:fs';

const BAD = [/[\u2013\u2014]/, /\bchat(u|e)?\b/i];
const files = ['themes.js', 'fun-themes.js', 'options.html', 'options.js', 'content.js', 'popup.html', 'popup.js'];

let fails = 0;
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    for (const re of BAD) {
      if (re.test(line)) { console.log(`${f}:${i + 1}: ${line.trim()}`); fails++; }
    }
  });
}
console.log(fails ? `ZLYHALO: ${fails}` : 'VŠETKO OK');
process.exitCode = fails ? 1 : 0;