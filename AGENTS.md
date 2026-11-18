# AGENTS.md — betterAIS

Browser extension (Chrome/Firefox, MV3) for `is.stuba.sk`. Themes, dark/light mode, CSS snippets, command palette (Ctrl+K), table-tools, custom links, grades dashboard.

## Stack
- Vanilla JS, CSS, HTML (no framework/bundler)
- Runtime files at repo root
- Tests: `node --test tools/tests/`

## Commands
- `npm test` (in repo root): all tests + contrast check
- `node --check *.js` syntax check
- `node tools/contrast-check.mjs` WCAG 4.5:1
- `npm run package` (Windows/powershell) bundle

## Conventions
- CSS via theme variables `--bg`, `--text`, `--accent`, ... (computed in `themes.js` → `compute()`).
- Theme = `P(bg0,bg,bg2,bg3,border,text,muted,link,accent,info,warn,crit)` for dark/light.
- Colors `#rrggbb`, contrast >= 4.5:1 (verify via contrast-check).
- Relative links to own site (never absolute self-links).
- Secrets never in code.
- Storage keys must not change (`bu`, `bu-avatar-shot`, `bu:cache`, `bu:off`).

## Design principles
- Consistency across settings: everything driven by theme CSS variables.
- Content is product: tables, forms, schedule. Design serves data readability.
- One accent, only for links, focus ring, primary button, active item.
- System font stack, sentence case, no uppercase except small labels.
- One radius from theme (`--radius`), `--radius-sm` for inputs, pill only for badges.
- Motion: `transition: background-color .12s, border-color .12s`; respect `prefers-reduced-motion`.
- Accessibility: visible focus states, WCAG 4.5:1.

## Work style
- One problem = one commit. Messages in Slovak, English prefix: `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
- Commit messages must be professional and concise: no slang, no emojis, no filler. Subject ≤ 72 chars; body only when necessary.
- Test first, then fix. `npm test` must be green before commit.
- Stage only your files, never `git add -A`.
- `git pull --ff-only` before work/push.
- No new runtime dependencies, no new UIS selectors without maintainer dump.

## Files
```
themes.js, content.js, base.css, options.html/js/css, popup.html/js,
text-utils.js, grades.js, background.js, manifest*.json
tools/  tests, contrast-check, package.ps1
```