# Bookmark Wizard

Bookmark Wizard is a local Chrome extension for sorting, searching and maintaining Chrome bookmarks.

Bookmark Wizard is designed as a local-first tool: no account, no analytics and no Bookmark Wizard server upload of bookmark data.

## Development

```bash
npm install
npm run build
```

Load the generated `dist` directory in Chrome via `chrome://extensions` > Developer mode > Load unpacked.

## Current scope

- Explorer-style bookmark tree and current-folder view
- Create, rename, delete and move bookmarks or folders
- Edit bookmark names and URLs directly in a row or via right-click > Edit, with explicit Save and Cancel
- Drag and drop within Chrome's bookmark tree
- Full-text search across title, URL, folder path and tags
- Search operators including `tag:`, `site:`, `folder:`, `url:`, `title:` and `is:`
- QuickSearch toolbar popup with keyboard navigation and match highlighting
- Separate local tag storage, tag cloud and auto-tag suggestions
- Sorting suggestions based on domains and common networking keywords
- JSON backup export and import preview/apply, including tags
- User-initiated deadlink checks with optional host permissions
- Soft delete, undelete and short move undo

## Store readiness documents

- `PRIVACY.md`
- `SECURITY.md`
- `HELP.md`
- `STORE_SUBMISSION.md`

History statistics are planned after the first stable explorer version.
