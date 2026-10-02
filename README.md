# Chrome Extensions

Eine Sammlung meiner Chrome-Erweiterungen. Jede Erweiterung liegt in einem eigenen Unterordner unter [`extensions/`](extensions/) und bringt ihre eigene Dokumentation mit.

| Erweiterung | Kurzbeschreibung | Download / Installation |
| --- | --- | --- |
| [Subnetter Tools](extensions/subnetter/) | IPv4-Subnetze berechnen, Netzwerke aufteilen und MAC-Adressen konvertieren. | [ZIP · v1.1.0](extensions/subnetter/dist/subnetter-tools-1.1.0.zip) |
| [Bookmark Wizard](extensions/bookmarkgenie/) | Bookmarks suchen, Namen und URLs bearbeiten, taggen, organisieren und sichern. | [Build und Installation](extensions/bookmarkgenie/README.md#installation) |

Installation, Funktionen, Beispiel-Screenshots und Entwicklung sind im [Subnetter-README](extensions/subnetter/README.md) und im [Bookmark-Wizard-README](extensions/bookmarkgenie/README.md) beschrieben. Die Subnetter-ZIP enthält eine deutsche Installationsanleitung; Bookmark Wizard wird vor dem Laden lokal gebaut.

## Lokal arbeiten

Dieses Repository ist der gemeinsame Arbeitsordner für die Erweiterungen, zum Beispiel unter `public/chrome-extensions`. Jede Erweiterung behält ihre eigenen Dateien, ihr Manifest, ihre Dokumentation und ihren Build. Andere Projekte im übergeordneten `public`-Ordner gehören nicht zu diesem Repository.

```sh
git clone https://github.com/samuelheinrich/chrome-extensions.git
cd chrome-extensions
```

Wenn bereits ein lokaler Clone vorhanden ist, stattdessen dort `git pull --ff-only` ausführen. Änderungen werden von diesem gemeinsamen Repository aus auf `main` committed und gepusht.

```text
chrome-extensions/
├── README.md
└── extensions/
    ├── bookmarkgenie/
    └── subnetter/
```

### Bookmark Wizard

Aus dem Repository-Hauptordner:

```sh
cd extensions/bookmarkgenie
npm install
npm run build
```

Unter `chrome://extensions` den Entwicklermodus aktivieren und **Entpackte Erweiterung laden** wählen. Den erzeugten Ordner `extensions/bookmarkgenie/dist/` auswählen. Nach Änderungen erneut bauen und die Erweiterung in Chrome neu laden.

### Subnetter Tools

Subnetter benötigt keinen Kompilierungsschritt. Unter `chrome://extensions` direkt den Ordner `extensions/subnetter/` laden. Alternativ das oben verlinkte ZIP entpacken und den darin enthaltenen Erweiterungsordner laden.

Aus dem Repository-Hauptordner lassen sich Tests und ZIP-Build ausführen:

```sh
node --test extensions/subnetter/test/ipcalc.test.js
python3 extensions/subnetter/build.py
```

## Übernahme bestehender Projekte

Bookmark Wizard wurde aus [samuelheinrich/bookmarkgenie](https://github.com/samuelheinrich/bookmarkgenie) einschließlich seiner bisherigen Git-Commits, Dokumentation und 14 Demo-Screenshots übernommen. Das frühere Repository dient als historische Referenz; die Weiterentwicklung findet hier unter `extensions/bookmarkgenie/` statt.

Die bisherigen separaten lokalen Ordner `public/bookmarkgenie` und `public/subnetter` bleiben zunächst als Sicherung erhalten. Sie werden nicht automatisch mit dem Sammel-Repository synchronisiert. Neue Änderungen deshalb ausschließlich in den Unterordnern von `public/chrome-extensions/extensions/` vornehmen.

Weitere Erweiterungen kommen als eigene Ordner unter `extensions/` hinzu und werden hier kurz vorgestellt.

Kontakt: [info@samuel-heinrich.ch](mailto:info@samuel-heinrich.ch)
