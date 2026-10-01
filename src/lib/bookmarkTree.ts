import type { BookmarkNode, FlatBookmarkNode } from "../types";
import type { TagMap } from "../features/tags/tags";

const ROOT_TITLES = new Set(["", "Bookmarks bar", "Other bookmarks", "Mobile bookmarks"]);
export const DELETED_FOLDER_TITLE = "Deleted";

export const isFolder = (node: BookmarkNode) => Boolean(node.children);

export const displayTitle = (node: BookmarkNode) => node.title || "Untitled";

export const flattenBookmarks = (roots: BookmarkNode[], tagMap: TagMap = {}): FlatBookmarkNode[] => {
  const flat: FlatBookmarkNode[] = [];

  const visit = (node: BookmarkNode, pathTitles: string[], isDeletedParent: boolean) => {
    const nextPathTitles = ROOT_TITLES.has(node.title) ? pathTitles : [...pathTitles, displayTitle(node)];
    const isDeleted = isDeletedParent || (isFolder(node) && node.title === DELETED_FOLDER_TITLE);
    flat.push({
      id: node.id,
      parentId: node.parentId,
      title: displayTitle(node),
      url: node.url,
      path: nextPathTitles.join(" / "),
      pathTitles: nextPathTitles,
      tags: tagMap[node.id] ?? [],
      isFolder: isFolder(node),
      isDeleted,
      dateAdded: node.dateAdded,
      children: node.children
    });

    node.children?.forEach((child) => visit(child, nextPathTitles, isDeleted));
  };

  roots.forEach((root) => visit(root, [], false));
  return flat;
};

export const findNode = (roots: BookmarkNode[], id: string): BookmarkNode | undefined => {
  const stack = [...roots];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    if (node.id === id) return node;
    if (node.children) stack.push(...node.children);
  }
  return undefined;
};

export const getFolderChildren = (roots: BookmarkNode[], folderId: string) => findNode(roots, folderId)?.children ?? [];

export const findDeletedFolder = (roots: BookmarkNode[]) => {
  const flatDeleted = flattenBookmarks(roots).find((node) => node.isFolder && node.title === DELETED_FOLDER_TITLE && node.parentId);
  return flatDeleted ? findNode(roots, flatDeleted.id) : undefined;
};

export const getPathToNode = (roots: BookmarkNode[], id: string) => {
  const path: BookmarkNode[] = [];

  const visit = (node: BookmarkNode): boolean => {
    path.push(node);
    if (node.id === id) return true;
    for (const child of node.children ?? []) {
      if (visit(child)) return true;
    }
    path.pop();
    return false;
  };

  for (const root of roots) {
    if (visit(root)) return path.filter((node) => node.title);
  }
  return [];
};

export const isNodeInsideFolder = (roots: BookmarkNode[], nodeId: string, folderId?: string) => {
  if (!folderId) return false;
  return getPathToNode(roots, nodeId).some((node) => node.id === folderId);
};

export const canMoveNode = (roots: BookmarkNode[], draggedId: string, targetFolderId: string) => {
  if (draggedId === targetFolderId) return false;

  const dragged = findNode(roots, draggedId);
  const target = findNode(roots, targetFolderId);
  if (!dragged || !target || !target.children) return false;

  const containsTarget = (node: BookmarkNode): boolean =>
    node.id === targetFolderId || Boolean(node.children?.some(containsTarget));

  return !containsTarget(dragged);
};

export const searchableText = (node: FlatBookmarkNode) => [node.title, node.url, node.path, node.tags.join(" ")].filter(Boolean).join(" ").toLowerCase();
