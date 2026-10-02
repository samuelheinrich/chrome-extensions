# Agent Notes

## Project

Bookmark Wizard is a local-first Chrome extension for managing Chrome bookmarks. Bookmark data stays local; the app uses the Chrome bookmarks API and local extension storage.

## Current Architecture

- React/Vite frontend in `src/`.
- Chrome extension manifest in `public/manifest.json`.
- Bookmark API wrappers in `src/extension/bookmarks.ts`.
- Bookmark tree helpers in `src/lib/bookmarkTree.ts`.
- Shared search logic in `src/features/search/smartSearch.ts`.
- Tag persistence and helpers in `src/features/tags/tags.ts`.
- Auto-tag suggestions in `src/features/tags/analyzeTags.ts` and `AutoTagPanel.tsx`.
- Quick toolbar popup uses `index.html?quick=search` via manifest `action.default_popup`.

## Important Behavior

- Tags are stored separately in `chrome.storage.local`, not appended to bookmark titles.
- Tags are included in JSON backups and remapped when imported.
- Search supports full text plus operators: `tag:`, `site:`, `domain:`, `folder:`, `path:`, `url:`, `title:`, `name:`, `is:`.
- Tag matches rank highest in search results.
- In QuickSearch, `ArrowUp` and `ArrowDown` move the active result; `Enter` opens it.
- A trailing space after a plain term requires a boundary after that term, e.g. `sso ` should not match `networklessons`.
- Deleting from normal folders soft-deletes to `Deleted`; deleting inside `Deleted` is permanent.

## Build And Verify

```bash
npm run build
```

Load `dist/` in Chrome via `chrome://extensions` in developer mode.

## Working Rules

- Keep changes small and local to the feature.
- Do not store tags in bookmark titles unless explicitly requested.
- Preserve local-first behavior; do not add network services or analytics.
- Use `chrome.storage.local` for local extension state that must survive reloads.
