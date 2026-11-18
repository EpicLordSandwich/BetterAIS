# betterAIS

Browser extension (Chrome/Firefox, MV3) for [is.stuba.sk](https://is.stuba.sk): themes, dark/light mode, CSS snippets, command palette (Ctrl+K), table-tools, custom links, grades dashboard, optional mail preview.

Unofficial. Not affiliated with STU.

## Install (sideload)

1. Download the latest release zip.
2. Chrome: `chrome://extensions` → Developer mode → Load unpacked (extracted folder).
3. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → `manifest.json`.

## Privacy

Everything runs locally in the browser. Settings are stored in `chrome.storage` (local + sync for cross-device). The extension does **not** send browsing data to any server. The optional experimental update check contacts GitHub only when enabled and triggered manually from settings.

The optional mail preview reads the AIS inbox list from the same site (`/auth/posta/slozka.pl`) using your existing login session, shows it on the main page, and caches the last list locally. It never opens, deletes or sends messages and uploads nothing.

## Development

```
npm test            # node --test tools/tests/ + contrast check
node --check *.js   # syntax check
```

No build step. Runtime is plain JS/CSS/HTML.

## License

Free to use (see LICENSE).