# betterAIS

An unofficial extension for is.stuba.sk (AIS STU) for STU students and staff. It adds dark mode and color themes, faster table sorting, custom links in the header, email and schedule previews on the home page, and keyboard shortcuts. Beta version—use at your own risk.
Unofficial. Not affiliated with STU.

## Features

- Themes (10+), light/dark/auto mode, custom accent/link/radius/font
- Custom nickname and profile picture (file/URL/original)
- Custom links in header bar + presets
- CSS snippets
- Table-tools: sortable/filterable tables, CSV copy
- Globálne vyhľadávanie v AIS (Ctrl+K)
- Optional mail preview on home page (full width)
- Optional schedule preview on home page (full width)
- Kill-switch per page
- Diagnostics (Ctrl+Shift+U dump, Alt+Shift+I picker)
- Export/import settings, cross-device sync
- Experimental auto-update from GitHub

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

#makeaisgreatagain
