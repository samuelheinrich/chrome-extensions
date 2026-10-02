const dictionaries = {
  en: {
    featureExplorer: "Explorer with drag and drop, folders, search and split view",
    featureQuick: "Bulk Import/Search, Save this page and soft delete",
    featureTools: "Deadlink checks, cleanup, sorting, auto-rename and backup",
    helpTitle: "Help & Privacy",
    helpIntro: "Bookmark Wizard is a local bookmark manager. It reads and changes Chrome bookmarks only when you use its tools.",
    helpShortcuts: "Shortcuts",
    helpShortcutCommand: "Command palette: Ctrl/Command + K",
    helpShortcutUndo: "Undo last drag move: Ctrl/Command + Z within 10 seconds",
    helpSelection: "Selection",
    helpSelectionText: "Use checkboxes for multi-select. Select one item, hold Shift, then select another item to select the visible range.",
    helpDeadlinks: "Deadlink checker",
    helpDeadlinksText: "Deadlink checks are user-initiated. Bookmark URLs are contacted directly from your browser; they are not sent to Bookmark Wizard servers. Private and local hosts are skipped by default.",
    helpDelete: "Delete and restore",
    helpDeleteText: "Deletes move items into the Deleted folder first. Use Undo delete or Undelete selected to restore them to their previous folder when possible.",
    helpBackup: "Backups",
    helpBackupText: "JSON backups are created locally as downloads. Review imported backups before applying them.",
    helpLanguage: "Current language"
  },
  de: {
    featureExplorer: "Explorer mit Drag & Drop, Ordnern, Suche und Splitview",
    featureQuick: "Bulk Import/Search, Save this page und Soft-Delete",
    featureTools: "Deadlink-Check, Cleanup, Sorter, Auto-Rename und Backup",
    helpTitle: "Hilfe & Datenschutz",
    helpIntro: "Bookmark Wizard ist ein lokaler Bookmark-Manager. Chrome-Lesezeichen werden nur gelesen oder geaendert, wenn du die jeweiligen Werkzeuge nutzt.",
    helpShortcuts: "Tastenkombinationen",
    helpShortcutCommand: "Command Palette: Ctrl/Command + K",
    helpShortcutUndo: "Letzten Drag-Move rueckgaengig machen: Ctrl/Command + Z innerhalb von 10 Sekunden",
    helpSelection: "Auswahl",
    helpSelectionText: "Nutze Checkboxen fuer Mehrfachauswahl. Markiere ein Element, halte Shift und markiere ein weiteres Element, um alle sichtbaren Elemente dazwischen auszuwaehlen.",
    helpDeadlinks: "Deadlink-Checker",
    helpDeadlinksText: "Deadlink-Checks werden nur durch Nutzeraktion gestartet. Bookmark-URLs werden direkt aus deinem Browser kontaktiert und nicht an Bookmark-Wizard-Server gesendet. Private und lokale Hosts werden standardmaessig uebersprungen.",
    helpDelete: "Loeschen und Wiederherstellen",
    helpDeleteText: "Loeschen verschiebt Elemente zuerst in den Deleted-Ordner. Nutze Undo delete oder Undelete selected, um sie wenn moeglich am alten Ort wiederherzustellen.",
    helpBackup: "Backups",
    helpBackupText: "JSON-Backups werden lokal als Download erstellt. Importierte Backups koennen vor dem Anwenden geprueft werden.",
    helpLanguage: "Aktuelle Sprache"
  }
} as const;

export type Locale = keyof typeof dictionaries;
export type MessageKey = keyof typeof dictionaries.en;

export const getLocale = (): Locale => "en";

export const t = (key: MessageKey, locale = getLocale()) => dictionaries[locale][key] ?? dictionaries.en[key];
