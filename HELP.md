# Bookmark Wizard Help

## Quick Start

1. Open QuickSearch from the Chrome toolbar, or open the full Bookmark Wizard tab from QuickSearch.
2. Use the folder tree on the left to navigate.
3. Use the middle file browser to open folders, copy bookmark URLs, rename items or drag items into folders.
4. Use the right-side tools for deadlink checks, backups, sorting, cleanup, rename, tags and bulk import.

## QuickSearch

- Type directly after clicking the toolbar icon.
- Use `ArrowUp` and `ArrowDown` to move through results.
- Press `Enter` to open the active result.
- Click `Open full view` to continue in the full tab view.

## Edit Bookmarks

- Click a bookmark row, its name or its URL, or choose `Edit` from the right-click menu.
- Edit the name and URL; `Save` appears when you make changes.
- Click `Save` or press `Enter` to save. Click `Cancel` or press `Escape` to discard changes.
- URLs must include a scheme, for example `https://example.com`.
- Use `Open` and `Copy` to open the bookmark or copy its URL.
- Editing works in Details, List and search results. Tags stay attached to the bookmark.

## Selection

- Use checkboxes to select multiple bookmarks or folders.
- Select one item, hold `Shift`, then select another item to select the visible range.
- Drag a selected item to move all selected top-level items together.

## Drag And Drop Undo

- After a drag move, use `Undo move` or `Ctrl/Command + Z` within 10 seconds.
- Drops into the same folder are ignored to avoid accidental reordering.

## Delete And Restore

- Delete first moves items into the `Deleted` folder.
- Use `Undo delete` to restore the latest deleted batch.
- In the `Deleted` folder, select items and click `Undelete selected` to restore them to their previous folder when possible.
- Deleting from inside `Deleted` is permanent.

## Deadlink Checker

- Deadlink checks only run when you click a check button.
- Bookmark Wizard requests optional HTTP/HTTPS host permissions the first time you use deadlink checks.
- URLs are contacted directly from your browser. Bookmark Wizard does not send bookmark URLs to Bookmark Wizard servers.
- Private and local hosts are skipped by default.

## Search Operators

- `site:example.com` filters by hostname.
- `tag:vpn` filters by tag.
- `folder:work` filters by folder path.
- `title:vpn` filters by bookmark title.
- `url:sharepoint` filters by URL.
- `is:dead`, `is:404`, `is:timeout`, `is:ok`, `is:unchecked` filter by scan state.

Plain search looks across title, URL, folder path and tags. Tag matches are ranked first.

## Tags

- Tags are stored separately from bookmark titles.
- Use the `Tags` button on one bookmark or a multi-selection to add, overwrite or clear tags.
- Use the `Tags` tool to generate editable tag suggestions.
- Use the tag cloud in the header for quick `tag:` searches.

## Backup

- Export creates a local JSON backup download.
- Import previews the backup before applying it.

---

# Bookmark Wizard Hilfe

## Schnellstart

1. Oeffne QuickSearch ueber die Chrome-Toolbar, oder oeffne daraus die volle Bookmark-Wizard-Ansicht.
2. Navigiere links im Ordnerbaum.
3. Nutze den mittleren Filebrowser zum Oeffnen, Kopieren, Umbenennen und Verschieben.
4. Nutze rechts die Tools fuer Deadlink-Checks, Backup, Sortierung, Cleanup, Rename, Tags und Bulk Import.

## Bookmarks Bearbeiten

- Klicke in eine Bookmark-Zeile, auf den Namen oder die URL, oder waehle `Edit` im Rechtsklickmenue.
- Bearbeite Name und URL; bei Aenderungen erscheint `Save`.
- Speichere mit `Save` oder `Enter`. Verwirf Aenderungen mit `Cancel` oder `Escape`.
- URLs brauchen ein Schema, zum Beispiel `https://example.com`.
- Nutze `Open` zum Oeffnen und `Copy` zum Kopieren der URL.
- Bearbeiten funktioniert in Details, List und Suchergebnissen. Tags bleiben am Bookmark erhalten.

## Auswahl

- Nutze Checkboxen fuer Mehrfachauswahl.
- Markiere ein Element, halte `Shift` und markiere ein weiteres Element, um alle sichtbaren Elemente dazwischen auszuwaehlen.
- Ziehe ein markiertes Element, um alle markierten Top-Level-Elemente gemeinsam zu verschieben.

## Drag & Drop Undo

- Nach einem Drag-Move kannst du innerhalb von 10 Sekunden `Undo move` oder `Ctrl/Command + Z` nutzen.
- Drops in denselben Ordner werden ignoriert, damit nichts versehentlich umsortiert wird.

## Loeschen Und Wiederherstellen

- Loeschen verschiebt Elemente zuerst in den `Deleted`-Ordner.
- `Undo delete` stellt den letzten geloeschten Batch wieder her.
- Im `Deleted`-Ordner kannst du Elemente markieren und mit `Undelete selected` wiederherstellen.
- Loeschen innerhalb von `Deleted` ist permanent.

## Deadlink-Checker

- Deadlink-Checks laufen nur, wenn du aktiv auf einen Check-Button klickst.
- Bookmark Wizard fragt optionale HTTP/HTTPS-Hostrechte beim ersten Deadlink-Check an.
- URLs werden direkt aus deinem Browser kontaktiert. Bookmark Wizard sendet Bookmark-URLs nicht an eigene Server.
- Private und lokale Hosts werden standardmaessig uebersprungen.

## Suchoperatoren

- `site:example.com` filtert nach Hostname.
- `tag:vpn` filtert nach Tag.
- `folder:work` filtert nach Ordnerpfad.
- `title:vpn` filtert nach Bookmark-Titel.
- `url:sharepoint` filtert nach URL.
- `is:dead`, `is:404`, `is:timeout`, `is:ok`, `is:unchecked` filtern nach Scan-Status.

Normale Suche durchsucht Titel, URL, Ordnerpfad und Tags. Tag-Treffer werden zuerst gerankt.

## Tags

- Tags werden separat von Bookmark-Titeln gespeichert.
- Nutze den `Tags`-Button auf einem Bookmark oder einer Mehrfachauswahl, um Tags hinzuzufuegen, zu ueberschreiben oder zu loeschen.
- Nutze das `Tags`-Tool fuer editierbare Auto-Tag-Vorschlaege.
- Nutze die Tag Cloud im Header fuer schnelle `tag:`-Suchen.

## Backup

- Export erstellt ein lokales JSON-Backup.
- Import zeigt eine Vorschau, bevor Daten angewendet werden.
- Tags sind im JSON-Backup enthalten und werden beim Import auf neue Bookmark-IDs gemappt.
