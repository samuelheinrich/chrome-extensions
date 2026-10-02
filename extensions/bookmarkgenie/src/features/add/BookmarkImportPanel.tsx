import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { BookmarkNode, FlatBookmarkNode } from "../../types";
import { displayTitle, isFolder } from "../../lib/bookmarkTree";
import { analyzeRename } from "../rename/analyzeRename";
import { parseBookmarkImportText, type ParsedBookmarkImport } from "./bookmarkImport";

type BookmarkImportPanelProps = {
  folders: FlatBookmarkNode[];
  roots?: BookmarkNode[];
  defaultFolderId: string;
  compact?: boolean;
  initialText?: string;
  titleSuggestions?: Record<string, string>;
  onImport: (folderId: string, bookmarks: ParsedBookmarkImport[]) => Promise<void>;
  onCreateFolder: (parentId: string, title: string) => Promise<string>;
};

const collectFolderIds = (nodes: BookmarkNode[] = []): string[] => nodes.flatMap((node) => isFolder(node) ? [node.id, ...collectFolderIds(node.children?.filter(isFolder))] : []);

const folderMatches = (node: BookmarkNode, query: string, folders: FlatBookmarkNode[]) => {
  if (!query) return true;
  const flat = folders.find((folder) => folder.id === node.id);
  return `${displayTitle(node)} ${flat?.path ?? ""}`.toLowerCase().includes(query);
};

const folderOrDescendantMatches = (node: BookmarkNode, query: string, folders: FlatBookmarkNode[]): boolean =>
  folderMatches(node, query, folders) || Boolean(node.children?.filter(isFolder).some((child) => folderOrDescendantMatches(child, query, folders)));

export const BookmarkImportPanel = ({ folders, roots, defaultFolderId, compact, initialText = "", titleSuggestions = {}, onImport, onCreateFolder }: BookmarkImportPanelProps) => {
  const [folderId, setFolderId] = useState(defaultFolderId);
  const [folderFilter, setFolderFilter] = useState("");
  const [text, setText] = useState(initialText);
  const [newFolderName, setNewFolderName] = useState("");
  const [editedTitles, setEditedTitles] = useState<Record<string, string>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [smartNamingEnabled, setSmartNamingEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const selectedFolder = folders.find((folder) => folder.id === folderId);
  const rawParsed = parseBookmarkImportText(text);
  const smartTitleSuggestions = Object.fromEntries(analyzeRename(rawParsed.map((bookmark, index) => ({
    id: `import:${index}`,
    title: titleSuggestions[bookmark.url] ?? bookmark.title,
    url: bookmark.url,
    path: selectedFolder?.path ?? "",
    pathTitles: selectedFolder?.pathTitles ?? [],
    tags: [],
    isFolder: false,
    isDeleted: false
  }))).map((suggestion) => [suggestion.url, suggestion.suggestedTitle]));
  const parsed = rawParsed.map((bookmark) => ({
    ...bookmark,
    title: editedTitles[bookmark.url] ?? (smartNamingEnabled ? smartTitleSuggestions[bookmark.url] : undefined) ?? titleSuggestions[bookmark.url] ?? bookmark.title
  }));
  const pathFolders = (selectedFolder?.pathTitles ?? [])
    .map((title, index, pathTitles) => folders.find((folder) => folder.title === title && folder.pathTitles.length === index + 1 && pathTitles.slice(0, index + 1).join(" / ") === folder.path))
    .filter((folder): folder is FlatBookmarkNode => Boolean(folder));
  const targetPathFolders = pathFolders.length > 0 ? pathFolders : selectedFolder ? [selectedFolder] : [];
  const query = folderFilter.trim().toLowerCase();

  useEffect(() => {
    setExpandedIds(new Set(collectFolderIds(roots)));
  }, [roots]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderFolderTree = (nodes: BookmarkNode[] = [], depth = 0): ReactNode[] => nodes.filter(isFolder).flatMap((node) => {
    if (!folderOrDescendantMatches(node, query, folders)) return [];
    const folderChildren = node.children?.filter(isFolder) ?? [];
    const expanded = query ? true : expandedIds.has(node.id);
    const active = node.id === folderId;

    return [
      <div key={node.id} className={`folder-tree-row ${active ? "active" : ""}`} style={{ "--folder-depth": depth } as CSSProperties}>
        <button className="folder-tree-toggle" disabled={folderChildren.length === 0} onClick={() => toggleExpanded(node.id)}>{folderChildren.length === 0 ? "" : expanded ? "-" : "+"}</button>
        <button className="folder-tree-select" onClick={() => setFolderId(node.id)}>
          <span className="folder-tree-icon" />
          <strong>{displayTitle(node)}</strong>
          <span>{folders.find((folder) => folder.id === node.id)?.path}</span>
        </button>
      </div>,
      ...(expanded ? renderFolderTree(folderChildren, depth + 1) : [])
    ];
  });
  const folderTreeRows = renderFolderTree(roots);

  return (
      <section className={`side-card import-card ${compact ? "compact-import-card" : ""}`}>
        <h2>{compact ? "Bulk import" : "Add bookmarks"}</h2>
      <p>Paste URLs, choose a target folder and import. Missing protocols are normalized to https://.</p>

      <div className="import-target-section">
        <label className="folder-filter">
          Folder search
          <input value={folderFilter} placeholder="Search folders..." onChange={(event) => setFolderFilter(event.target.value)} />
        </label>

        <div className="import-folder-nav">
          <span>Target:</span>
          {targetPathFolders.map((folder, index) => (
            <button key={folder.id} onClick={() => setFolderId(folder.id)}>{index > 0 ? "/ " : ""}{folder.title}</button>
          ))}
        </div>

        <div className="add-folder-row">
          <input value={newFolderName} placeholder="New folder in selected target..." onChange={(event) => setNewFolderName(event.target.value)} />
          <button
            disabled={!newFolderName.trim() || !folderId}
            onClick={async () => {
              const id = await onCreateFolder(folderId, newFolderName.trim());
              setFolderId(id);
              setNewFolderName("");
            }}
          >
            Add folder
          </button>
        </div>

        <div className="folder-tree-list">
          {folderTreeRows.length > 0 ? folderTreeRows : <div className="folder-tree-empty">No matching folders</div>}
        </div>
      </div>

      <div className="import-input-section">
        <label className="import-textarea">
          URLs
          <textarea value={text} placeholder="cisco.com\ncommunity.cisco.com/t5/wireless/..." onChange={(event) => setText(event.target.value)} />
        </label>

        <label className="check-option smart-naming-toggle">
          <input type="checkbox" checked={smartNamingEnabled} onChange={(event) => setSmartNamingEnabled(event.target.checked)} />
          Smart naming suggestions
        </label>

        <div className="import-preview-bar">
          <span>{parsed.length} valid URL(s)</span>
          <button
            disabled={busy || parsed.length === 0 || !folderId}
            onClick={async () => {
              setBusy(true);
              setMessage(undefined);
              try {
                await onImport(folderId, parsed);
                setText("");
                setMessage(`Imported ${parsed.length} bookmark(s).`);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Importing..." : "Import"}
          </button>
        </div>

        {parsed.length > 0 ? (
          <div className="import-preview-list">
            {parsed.slice(0, compact ? 5 : 10).map((bookmark) => (
              <label key={bookmark.url} className="import-preview-item">
                <input value={bookmark.title} onChange={(event) => setEditedTitles((current) => ({ ...current, [bookmark.url]: event.target.value }))} />
                <span>{bookmark.url}</span>
              </label>
            ))}
          </div>
        ) : null}
        {message ? <p className="success-text">{message}</p> : null}
      </div>
    </section>
  );
};
