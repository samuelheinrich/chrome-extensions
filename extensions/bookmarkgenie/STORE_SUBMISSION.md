# Chrome Web Store Submission Notes

## Single Purpose

Bookmark Wizard is a local bookmark manager for organizing, searching, tagging, cleaning, backing up, renaming, sorting and checking the health of Chrome bookmarks.

## Permission Justifications

- `bookmarks`: Required to read, create, rename, move, sort, soft-delete and restore Chrome bookmarks and bookmark folders.
- `storage`: Required to store local settings, local tag metadata, column layout preferences and local undo metadata for delete and move recovery.
- `tabs`: Required to open Bookmark Wizard, open bookmark URLs, and save the current page title/URL through the context menu action.
- `contextMenus`: Required for toolbar menu actions: Bulk import, Save this page and Search.
- Optional `http://*/*` and `https://*/*` host permissions: Requested only when the user starts the Deadlink Checker. Required to contact bookmark target URLs directly from the browser to determine whether they are reachable.

## Remote Code Declaration

No remote code is used. All executable code is bundled with the extension package.

## Data Use Summary

Bookmark data and tags are processed locally. Bookmark Wizard does not collect analytics, does not require an account and does not send bookmark data to Bookmark Wizard servers. Deadlink checks contact the target bookmark websites directly from the user's browser after user action and optional host permission approval.

## Store Assets Needed

- 128x128 PNG store icon.
- At least one 1280x800 screenshot, preferably 5.
- 440x280 small promo tile.
- Optional 1400x560 marquee promo tile.
- English and German detailed descriptions.

## Reviewer Test Instructions Draft

1. Load the extension and open QuickSearch from the toolbar icon.
2. Type a search term, use arrow keys to choose a result, and press Enter to open it.
3. Click `Open full view` to open the full Bookmark Wizard tab.
4. Use the folder tree and file browser to navigate bookmarks.
5. Select multiple items with checkboxes and Shift-select.
6. Use the `Tags` action to add, overwrite or clear local bookmark tags.
7. Drag selected items into a folder, then use `Undo move` or Ctrl/Command+Z within 10 seconds.
8. Delete an item, open the `Deleted` folder and restore it with `Undelete selected`.
9. Open the Deadlinks tab, click `Enable deadlink checks`, approve optional host permissions, then run `Check selected` or `Check folder`.
10. Use Backup to export a local JSON backup.
