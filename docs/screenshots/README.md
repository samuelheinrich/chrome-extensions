# Demo-Screenshots

Die PNG-Dateien wurden mit der tatsächlichen React-Oberfläche von Bookmark Wizard aufgenommen. Alle Bookmarks stammen aus [demo-bookmarks.json](../demo-bookmarks.json); ihre Adressen verwenden fiktive `.example`-Domains. Linkprüfungen verwenden simulierte Antworten für OK, 404 und Timeout.

Das Skript startet eine eigene, temporäre Browser-Sitzung und stellt eine simulierte Chrome-API bereit. Es greift weder auf ein vorhandenes Chrome-Profil noch auf persönliche Bookmarks zu und ruft keine Bookmark-Zielseiten auf. Die Produktoberfläche wird für die Aufnahmen nicht verändert.

## Aufnahmen reproduzieren

Installiere das optionale Aufnahme-Werkzeug lokal; es wird nicht als Abhängigkeit der Erweiterung gespeichert:

```bash
npm install
npm install --no-save --package-lock=false playwright
```

Starte die Anwendung in einem Terminal:

```bash
npm run dev -- --host 127.0.0.1
```

Führe das Skript in einem zweiten Terminal aus:

```bash
node scripts/capture-screenshots.cjs
```

Auf macOS verwendet es standardmäßig `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Mit `CHROME_PATH` lässt sich eine andere Chrome-Installation angeben. Auf anderen Systemen kannst du den mit Playwright verwendeten Browser installieren:

```bash
npx playwright install chromium
node scripts/capture-screenshots.cjs
```

`SCREENSHOT_BASE_URL` überschreibt bei Bedarf die Standardadresse `http://127.0.0.1:5173`. Das Skript erzeugt die 14 PNG-Dateien in diesem Ordner und prüft auf Laufzeitfehler.
