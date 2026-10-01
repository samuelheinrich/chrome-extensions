import { useEffect, useState } from "react";
import type { BookmarkNode } from "../../types";
import { displayTitle, getPathToNode, isFolder } from "../../lib/bookmarkTree";
import { RenameInput } from "./RenameInput";

type BookmarkTreeProps = {
  roots: BookmarkNode[];
  selectedFolderId: string;
  editingId?: string;
  onSelectFolder: (id: string) => void;
  onRenameStart: (id: string) => void;
  onRenameCancel: () => void;
  onRenameSave: (id: string, title: string) => void;
  onDropNode: (draggedId: string, targetFolderId: string) => void;
  onDragStart: (id: string) => void;
};

type TreeNodeProps = BookmarkTreeProps & {
  node: BookmarkNode;
  depth: number;
  expandedIds: Set<string>;
  onToggleExpanded: (id: string) => void;
};

const collectFolderIds = (nodes: BookmarkNode[]): string[] => nodes.flatMap((node) => [node.id, ...(node.children ? collectFolderIds(node.children.filter(isFolder)) : [])]);

const TreeNode = ({ node, depth, expandedIds, onToggleExpanded, ...props }: TreeNodeProps) => {
  if (!isFolder(node)) return null;

  const selected = node.id === props.selectedFolderId;
  const expanded = expandedIds.has(node.id);
  const hasChildren = Boolean(node.children?.some(isFolder));

  return (
    <li>
      <div
        className={`tree-row ${selected ? "selected" : ""}`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        draggable={node.parentId !== undefined}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", node.id);
          props.onDragStart(node.id);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const draggedId = event.dataTransfer.getData("text/plain");
          if (draggedId) props.onDropNode(draggedId, node.id);
        }}
        onClick={() => props.onSelectFolder(node.id)}
        onDoubleClick={() => props.onRenameStart(node.id)}
      >
        <button
          className="tree-toggle"
          disabled={!hasChildren}
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpanded(node.id);
          }}
        >
          {hasChildren ? expanded ? "-" : "+" : ""}
        </button>
        {props.editingId === node.id ? (
          <RenameInput
            value={displayTitle(node)}
            onCancel={props.onRenameCancel}
            onSave={(title) => props.onRenameSave(node.id, title)}
          />
        ) : (
          <span className="node-title">{displayTitle(node)}</span>
        )}
      </div>
      {expanded ? (
        <ul>
          {node.children?.filter(isFolder).map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} expandedIds={expandedIds} onToggleExpanded={onToggleExpanded} {...props} />
          ))}
        </ul>
      ) : null}
    </li>
  );
};

export const BookmarkTree = (props: BookmarkTreeProps) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const selectedPathIds = getPathToNode(props.roots, props.selectedFolderId).map((node) => node.id);
    setExpandedIds((current) => current.size === 0 ? new Set(collectFolderIds(props.roots)) : new Set([...current, ...selectedPathIds]));
  }, [props.roots, props.selectedFolderId]);

  return (
    <nav className="tree-panel" aria-label="Bookmark folders">
      <div className="tree-toolbar">
        <span>Folders</span>
        <div>
          <button onClick={() => setExpandedIds(new Set(collectFolderIds(props.roots)))}>Open all</button>
          <button onClick={() => setExpandedIds(new Set(getPathToNode(props.roots, props.selectedFolderId).map((node) => node.id)))}>Close all</button>
        </div>
      </div>
      <ul className="tree-list">
        {props.roots.map((root) => (
          <TreeNode
            key={root.id}
            node={root}
            depth={0}
            expandedIds={expandedIds}
            onToggleExpanded={(id) => {
              setExpandedIds((current) => {
                const next = new Set(current);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            {...props}
          />
        ))}
      </ul>
    </nav>
  );
};
