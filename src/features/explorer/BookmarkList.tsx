import { useEffect, useState, type CSSProperties } from "react";
import type { BookmarkNode, DeadLinkResult, FlatBookmarkNode, ViewMode } from "../../types";
import { displayTitle, isFolder } from "../../lib/bookmarkTree";
import { RenameInput } from "./RenameInput";
import { BookmarkInlineEdit } from "./BookmarkInlineEdit";
import type { TagMap } from "../tags/tags";

type BookmarkListProps = {
  nodes: BookmarkNode[];
  searchResults: FlatBookmarkNode[];
  searchMode: boolean;
  selectedFolderId: string;
  editingId?: string;
  viewMode: ViewMode;
  selectedIds: Set<string>;
  allVisibleSelected: boolean;
  columnWidths: number[];
  checksDisabled?: boolean;
  linkChecks: Record<string, DeadLinkResult>;
  tagMap: TagMap;
  onOpenFolder: (id: string) => void;
  onOpenBookmark: (url: string) => void;
  onCopyBookmark: (url: string) => void;
  onOpenPath: (folderId: string) => void;
  onRenameStart: (id: string) => void;
  onRenameCancel: () => void;
  onRenameSave: (id: string, title: string) => void;
  onEditSave: (id: string, title: string, url: string) => Promise<void>;
  onCreateFolder: (parentId: string) => void;
  onDelete: (node: BookmarkNode) => void;
  onDeleteById: (id: string) => void;
  onDeleteSelected: () => void;
  onEditTags: (id: string) => void;
  onCheckLink: (id: string, url: string) => void;
  onToggleSelected: (id: string, orderedIds: string[], shiftKey: boolean) => void;
  onToggleSelectAll: () => void;
  onColumnResize: (index: number, width: number) => void;
  onDropNode: (draggedId: string, targetFolderId: string) => void;
  onDragStart: (id: string) => void;
};

const statusLabel = (result?: DeadLinkResult) => {
  if (!result) return "";
  if (result.status === "checking") return "Checking";
  return result.message;
};

const stop = (event: React.MouseEvent) => event.stopPropagation();

const resizeColumn = (event: React.PointerEvent, index: number, startWidth: number, onColumnResize: (index: number, width: number) => void) => {
  event.preventDefault();
  const startX = event.clientX;
  const onMove = (moveEvent: PointerEvent) => onColumnResize(index, startWidth + moveEvent.clientX - startX);
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
};

type ContextMenuState = {
  x: number;
  y: number;
  node?: BookmarkNode | FlatBookmarkNode;
  folder: boolean;
};

export const BookmarkList = ({ nodes, searchResults, searchMode, viewMode, selectedIds, allVisibleSelected, columnWidths, checksDisabled, linkChecks, tagMap, ...props }: BookmarkListProps) => {
  const visible = searchMode ? searchResults : nodes;
  const visibleIds = visible.filter((node) => node.parentId).map((node) => node.id);
  const emptyText = searchMode ? "No search results" : "This folder is empty";
  const gridTemplateColumns = `${columnWidths[0]}px ${columnWidths[1]}px ${columnWidths[2]}px ${columnWidths[3]}px ${columnWidths[4]}px ${columnWidths[5]}px`;
  const tableStyle = { "--file-columns": gridTemplateColumns, "--selection-column": `${columnWidths[0]}px` } as CSSProperties;
  const [contextMenu, setContextMenu] = useState<ContextMenuState>();
  const [inlineEdit, setInlineEdit] = useState<{ id: string; field: "title" | "url" }>();

  useEffect(() => {
    if (inlineEdit && (props.editingId || !visible.some((node) => node.id === inlineEdit.id))) {
      setInlineEdit(undefined);
    }
  }, [inlineEdit, props.editingId, visible]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(undefined);
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  const beginDrag = (event: React.DragEvent, id: string) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
    props.onDragStart(id);
  };

  const beginEdit = (id: string, field: "title" | "url" = "title") => {
    props.onRenameCancel();
    setInlineEdit((current) => current ?? { id, field });
  };

  const handlePrimaryClick = (folder: boolean, id: string, url?: string, field: "title" | "url" = "title") => {
    if (folder) props.onOpenFolder(id);
    else if (url) beginEdit(id, field);
  };

  const renderEditor = (node: BookmarkNode | FlatBookmarkNode) => (
    <BookmarkInlineEdit
      key={node.id}
      title={node.title}
      url={node.url ?? ""}
      initialField={inlineEdit?.field ?? "title"}
      onSave={(title, url) => props.onEditSave(node.id, title, url)}
      onCancel={() => setInlineEdit(undefined)}
    />
  );

  const openContextMenu = (event: React.MouseEvent, node?: BookmarkNode | FlatBookmarkNode, folder = false) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, node, folder });
  };

  const contextTargetFolderId = contextMenu?.folder && contextMenu.node?.id ? contextMenu.node.id : props.selectedFolderId;
  const contextSelectionDelete = Boolean(contextMenu?.node?.id && selectedIds.has(contextMenu.node.id) && selectedIds.size > 1);
  const tagsFor = (node: BookmarkNode | FlatBookmarkNode) => "tags" in node ? node.tags : tagMap[node.id] ?? [];

  return (
    <div
      className={`list-panel ${viewMode === "details" ? "details-mode" : "list-mode"}`}
      onDragOver={(event) => event.preventDefault()}
      onContextMenu={(event) => openContextMenu(event)}
      onDrop={(event) => {
        event.preventDefault();
        const draggedId = event.dataTransfer.getData("text/plain");
        if (draggedId) props.onDropNode(draggedId, props.selectedFolderId);
      }}
    >
      <div className="list-meta">{searchMode ? `${searchResults.length} result(s)` : `${nodes.length} item(s) in folder`}</div>

      {viewMode === "details" ? (
        <div className="file-table" role="table" style={tableStyle}>
          <div className="file-table-head" role="row">
            <label className="select-cell table-select-all" title="Select all visible">
              <input type="checkbox" checked={allVisibleSelected} onChange={props.onToggleSelectAll} />
            </label>
            {["Name", "URL", searchMode ? "Pfad" : "Typ", "Status", "Aktionen"].map((label, offset) => (
              <span key={label} className="resizable-head-cell">
                {label}
                {offset < 4 ? <button className="column-resizer" onPointerDown={(event) => resizeColumn(event, offset + 1, columnWidths[offset + 1], props.onColumnResize)} aria-label={`Resize ${label}`} /> : null}
              </span>
            ))}
          </div>
          <div className="file-table-body">
            {visible.map((node) => {
              const folder = "isFolder" in node ? node.isFolder : isFolder(node);
              const title = "path" in node ? node.title : displayTitle(node);
              const url = node.url;
              const editing = !folder && inlineEdit?.id === node.id;
              const tags = tagsFor(node);
              const rowStyle = { "--row-indent": `${"pathTitles" in node ? Math.max(0, node.pathTitles.length - 1) * 12 : 0}px` } as CSSProperties;
              return (
                <div
                  key={node.id}
                  className={`file-row ${folder ? "folder-row" : "bookmark-row"} ${selectedIds.has(node.id) ? "selected" : ""} ${editing ? "editing-bookmark" : ""}`}
                  style={rowStyle}
                  draggable={!editing && node.parentId !== undefined}
                  onClick={() => handlePrimaryClick(folder, node.id, url)}
                  onContextMenu={(event) => openContextMenu(event, node, folder)}
                  onDragStart={(event) => beginDrag(event, node.id)}
                  onDragOver={(event) => {
                    if (folder) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    if (!folder) return;
                    event.preventDefault();
                    const draggedId = event.dataTransfer.getData("text/plain");
                    if (draggedId) props.onDropNode(draggedId, node.id);
                  }}
                >
                  <label className="select-cell" onClick={stop}>
                    <input type="checkbox" checked={selectedIds.has(node.id)} readOnly onClick={(event) => props.onToggleSelected(node.id, visibleIds, event.shiftKey)} />
                  </label>
                  {editing ? renderEditor(node) : (
                    <>
                      <span className="name-cell">
                        <span className={`file-icon ${folder ? "folder-icon" : "url-icon"}`} draggable={node.parentId !== undefined} onDragStart={(event) => beginDrag(event, node.id)}>{folder ? "" : "URL"}</span>
                        {props.editingId === node.id ? (
                          <RenameInput value={title} onCancel={props.onRenameCancel} onSave={(next) => props.onRenameSave(node.id, next)} />
                        ) : (
                          <span className="name-stack">
                            <span className="name-button" title={url ? "Click to edit bookmark" : "Open folder"} draggable={node.parentId !== undefined} onDragStart={(event) => beginDrag(event, node.id)} onClick={(event) => {
                              event.stopPropagation();
                              handlePrimaryClick(folder, node.id, url);
                            }}>{title}</span>
                            {tags.length > 0 ? <span className="tag-chip-row">{tags.map((tag) => <span key={tag} className="tag-chip">{tag}</span>)}</span> : null}
                          </span>
                        )}
                      </span>
                      <span className="url-cell" title={url ? "Click to edit URL" : undefined} onClick={(event) => {
                        event.stopPropagation();
                        handlePrimaryClick(folder, node.id, url, "url");
                      }}>{url || ""}</span>
                      <span className="muted-cell">
                        {"path" in node && node.parentId ? (
                          <button className="path-button" title="Show this folder" onClick={(event) => {
                            event.stopPropagation();
                            props.onOpenPath(node.parentId ?? props.selectedFolderId);
                          }}>{node.path}</button>
                        ) : folder ? "Folder" : "Bookmark"}
                      </span>
                      <span className={`status-cell ${linkChecks[node.id]?.status ?? ""}`}>{url ? statusLabel(linkChecks[node.id]) : ""}</span>
                      <span className="row-actions" onClick={stop}>
                        {url ? <button onClick={() => props.onOpenBookmark(url)}>Open</button> : null}
                        {url ? <button onClick={() => props.onCopyBookmark(url)}>Copy</button> : null}
                        {url && !checksDisabled ? <button onClick={() => props.onCheckLink(node.id, url)}>Check</button> : null}
                        {url ? <button onClick={() => props.onEditTags(node.id)}>Tags</button> : null}
                        <button onClick={() => folder ? props.onRenameStart(node.id) : beginEdit(node.id)}>{folder ? "Rename" : "Edit"}</button>
                        <button className="danger" onClick={() => ("path" in node ? props.onDeleteById(node.id) : props.onDelete(node))}>Delete</button>
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="file-list">
          {visible.map((node) => {
            const folder = "isFolder" in node ? node.isFolder : isFolder(node);
            const title = "path" in node ? node.title : displayTitle(node);
            const url = node.url;
            const editing = !folder && inlineEdit?.id === node.id;
            const tags = tagsFor(node);
            const rowStyle = { "--row-indent": `${"pathTitles" in node ? Math.max(0, node.pathTitles.length - 1) * 12 : 0}px` } as CSSProperties;
            return (
              <div
                key={node.id}
                className={`file-list-row ${folder ? "folder-row" : "bookmark-row"} ${selectedIds.has(node.id) ? "selected" : ""} ${editing ? "editing-bookmark" : ""}`}
                style={rowStyle}
                draggable={!editing && node.parentId !== undefined}
                onClick={() => handlePrimaryClick(folder, node.id, url)}
                onContextMenu={(event) => openContextMenu(event, node, folder)}
                onDragStart={(event) => beginDrag(event, node.id)}
                onDragOver={(event) => {
                  if (folder) event.preventDefault();
                }}
                onDrop={(event) => {
                  if (!folder) return;
                  event.preventDefault();
                  const draggedId = event.dataTransfer.getData("text/plain");
                  if (draggedId) props.onDropNode(draggedId, node.id);
                }}
              >
                <label className="select-cell" onClick={stop}>
                  <input type="checkbox" checked={selectedIds.has(node.id)} readOnly onClick={(event) => props.onToggleSelected(node.id, visibleIds, event.shiftKey)} />
                </label>
                {editing ? renderEditor(node) : (
                  <>
                    <span className={`file-icon ${folder ? "folder-icon" : "url-icon"}`} draggable={node.parentId !== undefined} onDragStart={(event) => beginDrag(event, node.id)}>{folder ? "" : "URL"}</span>
                    <span className="row-main">
                      {props.editingId === node.id ? (
                        <RenameInput value={title} onCancel={props.onRenameCancel} onSave={(next) => props.onRenameSave(node.id, next)} />
                      ) : (
                        <span className="name-button" title={url ? "Click to edit bookmark" : "Open folder"} draggable={node.parentId !== undefined} onDragStart={(event) => beginDrag(event, node.id)} onClick={(event) => {
                          event.stopPropagation();
                          handlePrimaryClick(folder, node.id, url);
                        }}>{title}</span>
                      )}
                      {tags.length > 0 ? <span className="tag-chip-row">{tags.map((tag) => <span key={tag} className="tag-chip">{tag}</span>)}</span> : null}
                      <span className="row-subtitle" title={url ? "Click to edit URL" : undefined} onClick={(event) => {
                        event.stopPropagation();
                        handlePrimaryClick(folder, node.id, url, "url");
                      }}>{url ? statusLabel(linkChecks[node.id]) || url : "Folder"}</span>
                    </span>
                    <span className="row-actions" onClick={stop}>
                      {url ? <button onClick={() => props.onOpenBookmark(url)}>Open</button> : null}
                      {url ? <button onClick={() => props.onCopyBookmark(url)}>Copy</button> : null}
                      {url && !checksDisabled ? <button onClick={() => props.onCheckLink(node.id, url)}>Check</button> : null}
                      {url ? <button onClick={() => props.onEditTags(node.id)}>Tags</button> : null}
                      <button onClick={() => folder ? props.onRenameStart(node.id) : beginEdit(node.id)}>{folder ? "Rename" : "Edit"}</button>
                      <button className="danger" onClick={() => ("path" in node ? props.onDeleteById(node.id) : props.onDelete(node))}>Delete</button>
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {visible.length === 0 ? <div className="empty-folder">{emptyText}</div> : null}
      {contextMenu ? (
        <div className="file-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
          {contextMenu.node ? <div className="context-title">{contextMenu.node.title || "Untitled"}</div> : <div className="context-title">Current folder</div>}
          <button onClick={() => {
            props.onCreateFolder(contextTargetFolderId);
            setContextMenu(undefined);
          }}>{contextMenu.folder ? "New folder inside" : "New folder"}</button>
          {contextMenu.node ? <button onClick={() => {
            if (contextMenu.folder) props.onRenameStart(contextMenu.node?.id ?? "");
            else beginEdit(contextMenu.node?.id ?? "");
            setContextMenu(undefined);
          }}>{contextMenu.folder ? "Rename" : "Edit"}</button> : null}
          {contextMenu.node?.url ? <>
            <button onClick={() => {
              props.onOpenBookmark(contextMenu.node!.url!);
              setContextMenu(undefined);
            }}>Open</button>
            <button onClick={() => {
              props.onCopyBookmark(contextMenu.node!.url!);
              setContextMenu(undefined);
            }}>Copy URL</button>
          </> : null}
          {contextMenu.node?.url ? <button onClick={() => {
            props.onEditTags(contextMenu.node?.id ?? "");
            setContextMenu(undefined);
          }}>Tags</button> : null}
          {contextMenu.node ? <button className="danger" onClick={() => {
            if (contextSelectionDelete) props.onDeleteSelected();
            else if ("path" in contextMenu.node!) props.onDeleteById(contextMenu.node!.id);
            else props.onDelete(contextMenu.node as BookmarkNode);
            setContextMenu(undefined);
          }}>{contextSelectionDelete ? `Delete selected (${selectedIds.size})` : "Delete"}</button> : null}
        </div>
      ) : null}
    </div>
  );
};
