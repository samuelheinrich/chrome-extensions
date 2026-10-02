import { type CSSProperties, useDeferredValue, useEffect, useState } from "react";
import { BookmarkList } from "./features/explorer/BookmarkList";
import { BookmarkTree } from "./features/explorer/BookmarkTree";
import { BookmarkSearch } from "./features/search/BookmarkSearch";
import { SuggestionPanel } from "./features/suggestions/SuggestionPanel";
import { BackupPanel } from "./features/backup/BackupPanel";
import { DeadLinkPanel } from "./features/deadlinks/DeadLinkPanel";
import { CleanupPanel } from "./features/cleanup/CleanupPanel";
import { RenamePanel } from "./features/rename/RenamePanel";
import { AutoTagPanel } from "./features/tags/AutoTagPanel";
import { BookmarkImportPanel } from "./features/add/BookmarkImportPanel";
import { QuickSearchPanel } from "./features/add/QuickSearchPanel";
import { HelpPanel } from "./features/help/HelpPanel";
import { CommandPalette, type CommandItem } from "./components/CommandPalette";
import { Toasts, type ToastMessage } from "./components/Toasts";
import { t } from "./i18n";
import { analyzeBookmarks } from "./features/suggestions/analyzeBookmarks";
import { analyzeCleanup } from "./features/cleanup/analyzeCleanup";
import { analyzeRename } from "./features/rename/analyzeRename";
import { analyzeTags } from "./features/tags/analyzeTags";
import { smartSearchNodes } from "./features/search/smartSearch";
import { loadTagMap, parseTagInput, removeTagRecords, saveTagMap, setBookmarkTags, tagStats, type TagMap } from "./features/tags/tags";
import { createBookmark, createFolder, getBookmarkTree, moveNode, openBookmark, removeNode, renameNode, updateBookmark } from "./extension/bookmarks";
import { addDeletedBatch, loadDeleteHistory, removeDeletedRecords, type DeleteHistory } from "./extension/deleteHistory";
import { hasDeadlinkHostPermission, requestDeadlinkHostPermission } from "./extension/permissions";
import { checkBookmarkUrl } from "./features/deadlinks/deadlinks";
import { createBackupPayload, downloadBackup } from "./features/backup/backup";
import type { BookmarkNode, CleanupFinding, CleanupFindingType, DeadLinkFilter, DeadLinkResult, FlatBookmarkNode, InspectorPanel, RenameScope, RenameSuggestion, SortScope, SortSuggestion, TagScope, TagSuggestion, ViewMode } from "./types";
import { DELETED_FOLDER_TITLE, canMoveNode, displayTitle, findDeletedFolder, findNode, flattenBookmarks, getFolderChildren, getPathToNode, isNodeInsideFolder } from "./lib/bookmarkTree";
import "./styles/app.css";

const quickMode = new URLSearchParams(window.location.search).get("quick");
const quickParams = new URLSearchParams(window.location.search);

const normalizeHttpsUrl = (value: string) => {
  try {
    return new URL(`https://${value.trim().replace(/^https?:\/\//i, "")}`).toString();
  } catch {
    return "";
  }
};

const firstFolderId = (roots: BookmarkNode[]) => roots[0]?.children?.[0]?.id ?? roots[0]?.id ?? "0";

type CheckTarget = { id: string; url: string };
type TagEditMode = "add" | "overwrite" | "clear";

type MoveUndo = {
  id: number;
  expiresAt: number;
  items: Array<{ id: string; parentId: string; index?: number; title: string }>;
};

const collectCheckTargets = (node?: BookmarkNode): CheckTarget[] => {
  if (!node) return [];
  if (node.url) return [{ id: node.id, url: node.url }];
  return (node.children ?? []).flatMap(collectCheckTargets);
};

const collectNodeIds = (node?: BookmarkNode): string[] => node ? [node.id, ...(node.children ?? []).flatMap(collectNodeIds)] : [];

const uniqueTargets = (targets: CheckTarget[]) => [...new Map(targets.map((target) => [target.id, target])).values()];

const DEFAULT_TIMEOUT_SECONDS = 4;
const DEFAULT_COLUMN_WIDTHS = [34, 330, 470, 145, 90, 135];
const COLUMN_WIDTHS_KEY = "bookmarkWizardColumnWidths";
const EMPTY_DELETE_HISTORY: DeleteHistory = { items: {}, lastDeletedIds: [] };
const MOVE_UNDO_MS = 10_000;
const DEADLINK_CONCURRENCY = 6;

const flatNodesForTargets = (flatNodes: FlatBookmarkNode[], targets: CheckTarget[]) => {
  const targetIds = new Set(targets.map((target) => target.id));
  return flatNodes.filter((node) => targetIds.has(node.id));
};

const savedColumnWidths = () => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(COLUMN_WIDTHS_KEY) ?? "null") as unknown;
    if (!Array.isArray(parsed) || parsed.length !== DEFAULT_COLUMN_WIDTHS.length || parsed.some((value) => typeof value !== "number" || !Number.isFinite(value))) return DEFAULT_COLUMN_WIDTHS;
    return parsed.map((value, index) => Math.max(index === 1 ? 160 : 70, value));
  } catch {
    return DEFAULT_COLUMN_WIDTHS;
  }
};

export default function App() {
  const [roots, setRoots] = useState<BookmarkNode[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("0");
  const [query, setQuery] = useState(quickParams.get("q") ?? "");
  const [editingId, setEditingId] = useState<string>();
  const [draggedId, setDraggedId] = useState<string>();
  const [viewMode, setViewMode] = useState<ViewMode>("details");
  const [columnWidths, setColumnWidths] = useState(savedColumnWidths);
  const [inspectorWidth, setInspectorWidth] = useState(330);
  const [inspectorPanel, setInspectorPanel] = useState<InspectorPanel>("deadlinks");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionAnchorId, setSelectionAnchorId] = useState<string>();
  const [sortScope, setSortScope] = useState<SortScope>("current");
  const [sortSuggestions, setSortSuggestions] = useState<SortSuggestion[]>([]);
  const [sortAnalyzedCount, setSortAnalyzedCount] = useState(0);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<Set<string>>(new Set());
  const [previewSuggestionId, setPreviewSuggestionId] = useState<string>();
  const [sortItemSelections, setSortItemSelections] = useState<Record<string, Set<string>>>({});
  const [sortTargetNames, setSortTargetNames] = useState<Record<string, string>>({});
  const [backupBeforeSortApply, setBackupBeforeSortApply] = useState(true);
  const [sortApplying, setSortApplying] = useState(false);
  const [cleanupFindings, setCleanupFindings] = useState<CleanupFinding[]>([]);
  const [selectedCleanupFindingIds, setSelectedCleanupFindingIds] = useState<Set<string>>(new Set());
  const [renameScope, setRenameScope] = useState<RenameScope>("selected");
  const [renameSuggestions, setRenameSuggestions] = useState<RenameSuggestion[]>([]);
  const [selectedRenameSuggestionIds, setSelectedRenameSuggestionIds] = useState<Set<string>>(new Set());
  const [renameEditedTitles, setRenameEditedTitles] = useState<Record<string, string>>({});
  const [renameVariantIndexes, setRenameVariantIndexes] = useState<Record<string, number>>({});
  const [renameAnalyzedCount, setRenameAnalyzedCount] = useState(0);
  const [backupBeforeRenameApply, setBackupBeforeRenameApply] = useState(true);
  const [renameApplying, setRenameApplying] = useState(false);
  const [tagMap, setTagMap] = useState<TagMap>({});
  const [tagScope, setTagScope] = useState<TagScope>("selected");
  const [tagSuggestions, setTagSuggestions] = useState<TagSuggestion[]>([]);
  const [selectedTagSuggestionIds, setSelectedTagSuggestionIds] = useState<Set<string>>(new Set());
  const [tagEditedValues, setTagEditedValues] = useState<Record<string, string>>({});
  const [tagAnalyzedCount, setTagAnalyzedCount] = useState(0);
  const [tagApplying, setTagApplying] = useState(false);
  const [tagEditIds, setTagEditIds] = useState<string[]>([]);
  const [tagEditMode, setTagEditMode] = useState<TagEditMode>("add");
  const [tagEditValue, setTagEditValue] = useState("");
  const [linkChecks, setLinkChecks] = useState<Record<string, DeadLinkResult>>({});
  const [deadLinkFilter, setDeadLinkFilter] = useState<DeadLinkFilter>("all");
  const [runningChecks, setRunningChecks] = useState(0);
  const [skipPrivateHosts, setSkipPrivateHosts] = useState(true);
  const [customTimeoutEnabled, setCustomTimeoutEnabled] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState(DEFAULT_TIMEOUT_SECONDS);
  const [deadlinkPermissionGranted, setDeadlinkPermissionGranted] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [deleteHistory, setDeleteHistory] = useState<DeleteHistory>(EMPTY_DELETE_HISTORY);
  const [pendingMoveUndo, setPendingMoveUndo] = useState<MoveUndo>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const deferredQuery = useDeferredValue(query);
  const selectedFolder = findNode(roots, selectedFolderId);
  const selectedFolderTitle = selectedFolder ? displayTitle(selectedFolder) : "Current folder";
  const currentNodes = getFolderChildren(roots, selectedFolderId);
  const flatNodes = flattenBookmarks(roots, tagMap);
  const activeFlatNodes = flatNodes.filter((node) => !node.isDeleted);
  const deletedFolder = findDeletedFolder(roots);
  const deletedFolderId = deletedFolder?.id;
  const isDeletedView = Boolean(deletedFolderId && isNodeInsideFolder(roots, selectedFolderId, deletedFolderId));
  const searchResults = smartSearchNodes(roots, deferredQuery, linkChecks, tagMap);
  const searchableBookmarks = activeFlatNodes.filter((node) => !node.isFolder && node.url);
  const importFolders = activeFlatNodes.filter((node) => node.isFolder && node.parentId);
  const breadcrumb = getPathToNode(roots, selectedFolderId);
  const searchMode = deferredQuery.trim().length > 0;

  const matchesDeadLinkFilter = (id: string, url?: string) => {
    if (deadLinkFilter === "all") return true;
    if (!url) return false;
    const check = linkChecks[id];
    if (!check) return false;
    if (deadLinkFilter === "scanned") return check.status !== "checking";
    if (deadLinkFilter === "404") return check.status === "dead" && check.httpStatus === 404;
    return check.status === deadLinkFilter;
  };

  const filteredCurrentNodes = currentNodes.filter((node) => isDeletedView || matchesDeadLinkFilter(node.id, node.url));
  const filteredSearchResults = searchResults.filter((node) => matchesDeadLinkFilter(node.id, node.url));
  const visibleNodes = searchMode ? [...filteredSearchResults, ...filteredCurrentNodes] : filteredCurrentNodes;
  const visibleIds = visibleNodes.filter((node) => node.parentId).map((node) => node.id);
  const searchVisibleIds = filteredSearchResults.filter((node) => node.parentId).map((node) => node.id);
  const folderVisibleIds = filteredCurrentNodes.filter((node) => node.parentId).map((node) => node.id);
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const allSearchVisibleSelected = searchVisibleIds.length > 0 && searchVisibleIds.every((id) => selectedIds.has(id));
  const allFolderVisibleSelected = folderVisibleIds.length > 0 && folderVisibleIds.every((id) => selectedIds.has(id));
  const folderCheckTargets = isDeletedView ? [] : uniqueTargets(collectCheckTargets(selectedFolder));
  const selectedCheckTargets = uniqueTargets([...selectedIds]
    .filter((id) => !isNodeInsideFolder(roots, id, deletedFolderId))
    .flatMap((id) => collectCheckTargets(findNode(roots, id))));
  const scanned404Targets = searchableBookmarks.filter((bookmark) => linkChecks[bookmark.id]?.status === "dead" && linkChecks[bookmark.id]?.httpStatus === 404);
  const scannedTimeoutTargets = searchableBookmarks.filter((bookmark) => linkChecks[bookmark.id]?.status === "timeout");
  const undoDeleteCount = deleteHistory.lastDeletedIds.filter((id) => isNodeInsideFolder(roots, id, deletedFolderId)).length;
  const selectedDeletedCount = [...selectedIds].filter((id) => isNodeInsideFolder(roots, id, deletedFolderId) && id !== deletedFolderId).length;
  const moveUndoAvailable = Boolean(pendingMoveUndo && pendingMoveUndo.expiresAt > Date.now());
  const popularTags = tagStats(activeFlatNodes).slice(0, 18);
  const allKnownTags = [...new Set(Object.values(tagMap).flat())].sort((a, b) => a.localeCompare(b));
  const tagEditNodes = tagEditIds.map((id) => findNode(roots, id)).filter((node): node is BookmarkNode => Boolean(node?.url));

  const sortScopeNodes = () => {
    if (sortScope === "current") return flatNodesForTargets(flatNodes, folderCheckTargets);
    if (sortScope === "selected") return flatNodesForTargets(flatNodes, selectedCheckTargets);
    if (sortScope === "search") return searchResults;
    return activeFlatNodes;
  };

  const renameScopeNodes = () => {
    if (renameScope === "selected") return flatNodesForTargets(activeFlatNodes, selectedCheckTargets);
    if (renameScope === "folder") {
      const childIds = new Set(currentNodes.map((node) => node.id));
      return activeFlatNodes.filter((node) => childIds.has(node.id));
    }
    if (renameScope === "folder-recursive") return flatNodesForTargets(activeFlatNodes, folderCheckTargets);
    return activeFlatNodes;
  };

  const tagScopeNodes = () => {
    if (tagScope === "selected") return flatNodesForTargets(activeFlatNodes, selectedCheckTargets);
    if (tagScope === "folder") {
      const childIds = new Set(currentNodes.map((node) => node.id));
      return activeFlatNodes.filter((node) => childIds.has(node.id));
    }
    if (tagScope === "folder-recursive") return flatNodesForTargets(activeFlatNodes, folderCheckTargets);
    if (tagScope === "search") return searchResults;
    return activeFlatNodes;
  };

  const ensureDeletedFolder = async () => {
    const existing = findDeletedFolder(roots);
    if (existing) return existing;
    return createFolder(firstFolderId(roots), DELETED_FOLDER_TITLE);
  };

  const writableSelectedFolderId = () => selectedFolder?.children ? selectedFolder.id : firstFolderId(roots);

  const handleColumnResize = (index: number, width: number) => {
    setColumnWidths((current) => {
      const next = current.map((value, currentIndex) => currentIndex === index ? Math.max(index === 1 ? 160 : 70, width) : value);
      window.localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearTransientStateForIds = (ids: string[]) => {
    const idSet = new Set(ids);
    setLinkChecks((current) => {
      const next = { ...current };
      idSet.forEach((id) => delete next[id]);
      return next;
    });
    setCleanupFindings((current) => current.filter((finding) => !idSet.has(finding.bookmarkId)));
    setSelectedCleanupFindingIds((current) => new Set([...current].filter((id) => cleanupFindings.some((finding) => finding.id === id && !idSet.has(finding.bookmarkId)))));
  };

  const refresh = async () => {
    setError(undefined);
    const tree = await getBookmarkTree();
    setRoots(tree);
    setSelectedFolderId((current) => (findNode(tree, current)?.children ? current : firstFolderId(tree)));
    setSelectedIds((current) => new Set([...current].filter((id) => findNode(tree, id))));
  };

  const showToast = (message: string, type: ToastMessage["type"] = "info") => {
    const id = Date.now() + Math.round(Math.random() * 1000);
    setToasts((current) => [...current, { id, message, type }].slice(-4));
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3500);
  };

  const storeDeletedBatch = async (nodes: BookmarkNode[], baseHistory = deleteHistory) => {
    const nextHistory = await addDeletedBatch(baseHistory, nodes.filter((node) => Boolean(node.parentId)));
    setDeleteHistory(nextHistory);
    return nextHistory;
  };

  const clearDeletedRecords = async (ids: string[], baseHistory = deleteHistory) => {
    const nextHistory = await removeDeletedRecords(baseHistory, ids);
    setDeleteHistory(nextHistory);
    return nextHistory;
  };

  const handleImportBookmarks = async (folderId: string, bookmarks: Array<{ title: string; url: string }>) => {
    for (const bookmark of bookmarks) {
      await createBookmark(folderId, bookmark.title, bookmark.url);
    }
    await refresh();
    showToast(`Imported ${bookmarks.length} bookmark(s)`, "success");
  };

  const handleCreateImportFolder = async (parentId: string, title: string) => {
    const parent = findNode(roots, parentId);
    const folder = await createFolder(parent?.children ? parent.id : writableSelectedFolderId(), title);
    await refresh();
    showToast(`Created folder "${title}"`, "success");
    return folder.id;
  };

  useEffect(() => {
    Promise.all([refresh(), loadDeleteHistory().then(setDeleteHistory), loadTagMap().then(setTagMap)])
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load bookmarks."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void hasDeadlinkHostPermission().then(setDeadlinkPermissionGranted).catch(() => setDeadlinkPermissionGranted(false));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleCreateFolder = async () => {
    const targetTitle = selectedFolder ? displayTitle(selectedFolder) : "selected folder";
    const title = window.prompt(`New folder in "${targetTitle}"`, "New folder")?.trim();
    if (!title) return;
    await createFolder(writableSelectedFolderId(), title);
    await refresh();
    showToast(`Created folder "${title}"`, "success");
  };

  const handleCreateFolderIn = async (parentId: string) => {
    const parent = findNode(roots, parentId);
    const targetId = parent?.children ? parent.id : writableSelectedFolderId();
    const targetTitle = parent?.children ? displayTitle(parent) : selectedFolderTitle;
    const title = window.prompt(`New folder in "${targetTitle}"`, "New folder")?.trim();
    if (!title) return;
    await createFolder(targetId, title);
    await refresh();
    showToast(`Created folder "${title}"`, "success");
  };

  const resizeInspector = (event: React.PointerEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = inspectorWidth;
    const onMove = (moveEvent: PointerEvent) => setInspectorWidth(Math.min(680, Math.max(260, startWidth - (moveEvent.clientX - startX))));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleRename = async (id: string, title: string) => {
    setEditingId(undefined);
    await renameNode(id, title);
    await refresh();
    showToast("Renamed item", "success");
  };

  const handleEditBookmark = async (id: string, title: string, url: string) => {
    const previousUrl = findNode(roots, id)?.url;
    await updateBookmark(id, title, url);
    if (previousUrl !== url) clearTransientStateForIds([id]);
    await refresh();
    showToast("Saved bookmark", "success");
  };

  const handleDelete = async (node: BookmarkNode) => {
    if (!node.parentId) return;
    const label = displayTitle(node);
    if (deletedFolderId && node.id === deletedFolderId) {
      window.alert(`The ${DELETED_FOLDER_TITLE} folder cannot be deleted from here. Select items inside it to delete permanently.`);
      return;
    }

    if (isNodeInsideFolder(roots, node.id, deletedFolderId)) {
      const message = node.children ? `Permanently delete folder "${label}" and all children?` : `Permanently delete bookmark "${label}"?`;
      if (!window.confirm(message)) return;
      await removeNode(node);
      await clearDeletedRecords(collectNodeIds(node));
      setTagMap(await removeTagRecords(tagMap, collectNodeIds(node)));
      clearTransientStateForIds(collectNodeIds(node));
      showToast(`Permanently deleted "${label}"`, "warning");
    } else {
      const message = node.children ? `Move folder "${label}" and all children to ${DELETED_FOLDER_TITLE}?` : `Move bookmark "${label}" to ${DELETED_FOLDER_TITLE}?`;
      if (!window.confirm(message)) return;
      const deleted = await ensureDeletedFolder();
      await storeDeletedBatch([node]);
      await moveNode(node.id, { parentId: deleted.id });
      clearTransientStateForIds(collectNodeIds(node));
      showToast(`Moved "${label}" to ${DELETED_FOLDER_TITLE}`, "success");
    }
    await refresh();
  };

  const handleDeleteById = async (id: string) => {
    const node = findNode(roots, id);
    if (node) await handleDelete(node);
  };

  const topLevelSelectedNodes = () =>
    [...selectedIds]
      .map((id) => findNode(roots, id))
      .filter((node): node is BookmarkNode => Boolean(node?.parentId))
      .filter((node) => !getPathToNode(roots, node.id).some((ancestor) => ancestor.id !== node.id && selectedIds.has(ancestor.id)));

  const restoreDeletedIds = async (ids: string[]) => {
    const nodes = ids
      .map((id) => findNode(roots, id))
      .filter((node): node is BookmarkNode => Boolean(node?.parentId && node.id !== deletedFolderId && isNodeInsideFolder(roots, node.id, deletedFolderId)))
      .filter((node, _index, list) => !getPathToNode(roots, node.id).some((ancestor) => ancestor.id !== node.id && list.some((candidate) => candidate.id === ancestor.id)));

    if (nodes.length === 0) {
      showToast("Nothing to restore", "warning");
      return;
    }

    for (const node of nodes) {
      const origin = deleteHistory.items[node.id];
      const originalParent = origin ? findNode(roots, origin.parentId) : undefined;
      const targetParent = originalParent?.children && !isNodeInsideFolder(roots, originalParent.id, deletedFolderId) ? originalParent : findNode(roots, firstFolderId(roots));
      const parentId = targetParent?.id ?? firstFolderId(roots);
      const index = origin?.index !== undefined && targetParent?.children && origin.index <= targetParent.children.length ? origin.index : undefined;
      await moveNode(node.id, { parentId, index });
    }

    const restoredIds = nodes.flatMap(collectNodeIds);
    await clearDeletedRecords(restoredIds);
    setSelectedIds((current) => new Set([...current].filter((id) => !restoredIds.includes(id))));
    setSelectionAnchorId(undefined);
    await refresh();
    showToast(`Restored ${nodes.length} item(s)`, "success");
  };

  const handleUndoLastDelete = async () => {
    await restoreDeletedIds(deleteHistory.lastDeletedIds);
  };

  const handleUndeleteSelected = async () => {
    await restoreDeletedIds([...selectedIds]);
  };

  const handleDeleteSelected = async () => {
    const nodes = topLevelSelectedNodes();
    if (nodes.length === 0) return;
    const deletableNodes = nodes.filter((node) => node.id !== deletedFolderId);
    const permanentCount = deletableNodes.filter((node) => isNodeInsideFolder(roots, node.id, deletedFolderId)).length;
    const softCount = deletableNodes.length - permanentCount;
    if (!window.confirm(`${softCount ? `Move ${softCount} selected item(s) to ${DELETED_FOLDER_TITLE}. ` : ""}${permanentCount ? `Permanently delete ${permanentCount} selected item(s).` : ""}\n\nFolders include all children.`)) return;
    const deleted = softCount ? await ensureDeletedFolder() : undefined;
    const softDeletedNodes = deletableNodes.filter((node) => !isNodeInsideFolder(roots, node.id, deletedFolderId));
    let nextHistory = deleteHistory;
    if (softDeletedNodes.length > 0) nextHistory = await storeDeletedBatch(softDeletedNodes, nextHistory);
    const permanentlyDeletedIds: string[] = [];
    for (const node of deletableNodes) {
      if (isNodeInsideFolder(roots, node.id, deletedFolderId)) {
        permanentlyDeletedIds.push(...collectNodeIds(node));
        await removeNode(node);
      }
      else if (deleted) await moveNode(node.id, { parentId: deleted.id });
    }
    if (permanentlyDeletedIds.length > 0) await clearDeletedRecords(permanentlyDeletedIds, nextHistory);
    if (permanentlyDeletedIds.length > 0) setTagMap(await removeTagRecords(tagMap, permanentlyDeletedIds));
    clearTransientStateForIds(deletableNodes.flatMap(collectNodeIds));
    setSelectedIds(new Set());
    setSelectionAnchorId(undefined);
    await refresh();
    showToast(`${deletableNodes.length} selected item(s) processed`, "success");
  };

  const toggleSelected = (id: string, orderedIds: string[], shiftKey: boolean) => {
    if (shiftKey && selectionAnchorId) {
      const anchorIndex = orderedIds.indexOf(selectionAnchorId);
      const targetIndex = orderedIds.indexOf(id);
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const [start, end] = anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
        const rangeIds = orderedIds.slice(start, end + 1);
        setSelectedIds((current) => new Set([...current, ...rangeIds]));
        return;
      }
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectionAnchorId(id);
  };

  const toggleSelectAllVisible = () => {
    toggleSelectIds(visibleIds);
  };

  const toggleSelectIds = (ids: string[]) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected = ids.length > 0 && ids.every((id) => next.has(id));
      ids.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
    setSelectionAnchorId(ids[0]);
  };

  const handleCopyBookmark = (url: string) => {
    if (!url) return;
    void navigator.clipboard?.writeText(url).catch(() => undefined);
    showToast("Copied URL", "success");
  };

  const handleDropNode = async (sourceId: string, targetFolderId: string) => {
    setDraggedId(undefined);
    const sourceNodes = selectedIds.has(sourceId) ? topLevelSelectedNodes() : [findNode(roots, sourceId)].filter((node): node is BookmarkNode => Boolean(node?.parentId));
    const movableNodes = sourceNodes.filter((node) => node.id !== deletedFolderId && node.parentId !== targetFolderId && canMoveNode(roots, node.id, targetFolderId));
    if (movableNodes.length === 0) {
      showToast("Cannot move item there", "warning");
      return;
    }

    const undo: MoveUndo = {
      id: Date.now(),
      expiresAt: Date.now() + MOVE_UNDO_MS,
      items: movableNodes.map((node) => ({ id: node.id, parentId: node.parentId ?? firstFolderId(roots), index: node.index, title: displayTitle(node) }))
    };

    for (const node of movableNodes) {
      await moveNode(node.id, { parentId: targetFolderId });
    }
    setPendingMoveUndo(undo);
    await refresh();
    showToast(`Moved ${movableNodes.length} item(s). Ctrl+Z undo for 10s`, "success");
  };

  const handleUndoMove = async () => {
    if (!pendingMoveUndo || pendingMoveUndo.expiresAt <= Date.now()) {
      setPendingMoveUndo(undefined);
      showToast("Move undo expired", "warning");
      return;
    }

    const items = [...pendingMoveUndo.items].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    for (const item of items) {
      const node = findNode(roots, item.id);
      if (!node?.parentId) continue;
      const originalParent = findNode(roots, item.parentId);
      const parentId = originalParent?.children ? originalParent.id : firstFolderId(roots);
      const index = item.index !== undefined && originalParent?.children && item.index <= originalParent.children.length ? item.index : undefined;
      await moveNode(item.id, { parentId, index });
    }

    setPendingMoveUndo(undefined);
    await refresh();
    showToast(`Undid move of ${items.length} item(s)`, "success");
  };

  useEffect(() => {
    if (!pendingMoveUndo) return;
    const timeout = window.setTimeout(() => {
      setPendingMoveUndo((current) => current?.id === pendingMoveUndo.id ? undefined : current);
    }, Math.max(0, pendingMoveUndo.expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [pendingMoveUndo]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (!isTyping && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        void handleUndoMove();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingMoveUndo, roots]);

  const handleAnalyzeSort = () => {
    const sourceNodes = sortScopeNodes();
    const nextSuggestions = analyzeBookmarks(sourceNodes);
    setSortAnalyzedCount(sourceNodes.filter((node) => !node.isFolder && node.url).length);
    setSortSuggestions(nextSuggestions);
    setSelectedSuggestionIds(new Set(nextSuggestions.map((suggestion) => suggestion.id)));
    setPreviewSuggestionId(nextSuggestions[0]?.id);
    setSortItemSelections(Object.fromEntries(nextSuggestions.map((suggestion) => [suggestion.id, new Set(suggestion.bookmarkIds)])));
    setSortTargetNames(Object.fromEntries(nextSuggestions.map((suggestion) => [suggestion.id, suggestion.folderName])));
    showToast(`Found ${nextSuggestions.length} sort suggestion(s)`, "info");
  };

  const toggleSortSuggestion = (id: string) => {
    setSelectedSuggestionIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSortItem = (suggestionId: string, itemId: string) => {
    setSortItemSelections((current) => {
      const nextSelection = new Set(current[suggestionId] ?? []);
      if (nextSelection.has(itemId)) nextSelection.delete(itemId);
      else nextSelection.add(itemId);
      return { ...current, [suggestionId]: nextSelection };
    });
  };

  const ensureTargetFolder = async (title: string) => {
    const existing = selectedFolder?.children?.find((node) => node.children && node.title === title);
    if (existing) return existing;
    return createFolder(selectedFolderId, title);
  };

  const applySortSuggestions = async (suggestionsToApply: SortSuggestion[]) => {
    const operations = suggestionsToApply.flatMap((suggestion) => {
      const selectedItemIds = sortItemSelections[suggestion.id] ?? new Set<string>();
      const targetFolder = (sortTargetNames[suggestion.id] ?? suggestion.folderName).trim();
      return [...selectedItemIds].map((bookmarkId) => ({ suggestion, bookmarkId, targetFolder }));
    }).filter((operation) => operation.targetFolder);

    if (operations.length === 0) return;
    const summary = operations.slice(0, 35).map((operation) => {
      const item = operation.suggestion.items.find((candidate) => candidate.id === operation.bookmarkId);
      return `${item?.title ?? operation.bookmarkId}\n-> ${operation.targetFolder}`;
    }).join("\n\n");
    const extra = operations.length > 35 ? `\n\n...and ${operations.length - 35} more` : "";
    if (!window.confirm(`Apply ${operations.length} bookmark move(s)?\n\n${summary}${extra}`)) return;

    setSortApplying(true);
    try {
      if (backupBeforeSortApply) downloadBackup(createBackupPayload(roots, tagMap));
      const folderCache = new Map<string, BookmarkNode>();
      for (const operation of operations) {
        const node = findNode(roots, operation.bookmarkId);
        if (!node?.url) continue;
        let folder = folderCache.get(operation.targetFolder);
        if (!folder) {
          folder = await ensureTargetFolder(operation.targetFolder);
          folderCache.set(operation.targetFolder, folder);
        }
        await moveNode(operation.bookmarkId, { parentId: folder.id });
      }
      await refresh();
      setSortSuggestions([]);
      setSelectedSuggestionIds(new Set());
      setPreviewSuggestionId(undefined);
      showToast(`Applied ${operations.length} move(s)`, "success");
    } finally {
      setSortApplying(false);
    }
  };

  const handleAnalyzeRename = () => {
    const sourceNodes = renameScopeNodes();
    const suggestions = analyzeRename(sourceNodes);
    setRenameAnalyzedCount(sourceNodes.filter((node) => !node.isFolder && node.url).length);
    setRenameSuggestions(suggestions);
    setSelectedRenameSuggestionIds(new Set(suggestions.filter((suggestion) => suggestion.confidence !== "Low").map((suggestion) => suggestion.id)));
    setRenameEditedTitles(Object.fromEntries(suggestions.map((suggestion) => [suggestion.id, suggestion.suggestedTitle])));
    setRenameVariantIndexes(Object.fromEntries(suggestions.map((suggestion) => [suggestion.id, 0])));
    showToast(`Found ${suggestions.length} rename suggestion(s)`, "info");
  };

  const toggleRenameSuggestion = (id: string) => {
    setSelectedRenameSuggestionIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllRenameSuggestions = () => {
    setSelectedRenameSuggestionIds((current) => {
      const allSelected = renameSuggestions.length > 0 && renameSuggestions.every((suggestion) => current.has(suggestion.id));
      return allSelected ? new Set() : new Set(renameSuggestions.map((suggestion) => suggestion.id));
    });
  };

  const handleApplyRenameSelected = async () => {
    const operations = renameSuggestions
      .filter((suggestion) => selectedRenameSuggestionIds.has(suggestion.id))
      .map((suggestion) => ({
        ...suggestion,
        nextTitle: (renameEditedTitles[suggestion.id] ?? suggestion.suggestedTitle).trim()
      }))
      .filter((suggestion) => suggestion.nextTitle && suggestion.nextTitle !== suggestion.currentTitle.trim());

    if (operations.length === 0) return;
    const summary = operations.slice(0, 40).map((operation) => `${operation.currentTitle}\n-> ${operation.nextTitle}`).join("\n\n");
    const extra = operations.length > 40 ? `\n\n...and ${operations.length - 40} more` : "";
    if (!window.confirm(`Rename ${operations.length} bookmark(s)?\n\n${summary}${extra}`)) return;

    setRenameApplying(true);
    try {
      if (backupBeforeRenameApply) downloadBackup(createBackupPayload(roots, tagMap));
      for (const operation of operations) {
        const node = findNode(roots, operation.bookmarkId);
        if (node?.url && !isNodeInsideFolder(roots, node.id, deletedFolderId)) {
          await renameNode(node.id, operation.nextTitle);
        }
      }
      await refresh();
      setRenameSuggestions([]);
      setSelectedRenameSuggestionIds(new Set());
      setRenameEditedTitles({});
      setRenameVariantIndexes({});
      showToast(`Renamed ${operations.length} bookmark(s)`, "success");
    } finally {
      setRenameApplying(false);
    }
  };

  const handleAnalyzeTags = () => {
    const sourceNodes = tagScopeNodes();
    const suggestions = analyzeTags(sourceNodes, allKnownTags);
    setTagAnalyzedCount(sourceNodes.filter((node) => !node.isFolder && node.url).length);
    setTagSuggestions(suggestions);
    setSelectedTagSuggestionIds(new Set(suggestions.map((suggestion) => suggestion.id)));
    setTagEditedValues(Object.fromEntries(suggestions.map((suggestion) => [suggestion.id, [...suggestion.existingTags, ...suggestion.suggestedTags].join(", ")])));
    showToast(`Found ${suggestions.length} tag suggestion(s)`, "info");
  };

  const toggleTagSuggestion = (id: string) => {
    setSelectedTagSuggestionIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllTagSuggestions = () => {
    setSelectedTagSuggestionIds((current) => {
      const allSelected = tagSuggestions.length > 0 && tagSuggestions.every((suggestion) => current.has(suggestion.id));
      return allSelected ? new Set() : new Set(tagSuggestions.map((suggestion) => suggestion.id));
    });
  };

  const addExistingTagToSuggestion = (id: string, tag: string) => {
    const suggestion = tagSuggestions.find((candidate) => candidate.id === id);
    const currentValue = tagEditedValues[id] ?? (suggestion ? [...suggestion.existingTags, ...suggestion.suggestedTags].join(", ") : "");
    setTagEditedValues((current) => ({ ...current, [id]: parseTagInput(`${currentValue},${tag}`).join(", ") }));
  };

  const handleApplyTagsSelected = async () => {
    const operations = tagSuggestions
      .filter((suggestion) => selectedTagSuggestionIds.has(suggestion.id))
      .map((suggestion) => ({ suggestion, tags: parseTagInput(tagEditedValues[suggestion.id] ?? [...suggestion.existingTags, ...suggestion.suggestedTags].join(", ")) }))
      .filter((operation) => findNode(roots, operation.suggestion.bookmarkId)?.url);

    if (operations.length === 0) return;
    if (!window.confirm(`Apply tags to ${operations.length} bookmark(s)?`)) return;

    setTagApplying(true);
    try {
      let nextTagMap = tagMap;
      for (const operation of operations) {
        nextTagMap = await setBookmarkTags(nextTagMap, operation.suggestion.bookmarkId, operation.tags);
      }
      setTagMap(nextTagMap);
      setTagSuggestions([]);
      setSelectedTagSuggestionIds(new Set());
      setTagEditedValues({});
      showToast(`Tagged ${operations.length} bookmark(s)`, "success");
    } finally {
      setTagApplying(false);
    }
  };

  const handleEditBookmarkTags = (id: string) => {
    const targetIds = selectedIds.has(id) && selectedIds.size > 1 ? [...selectedIds] : [id];
    const bookmarkIds = targetIds.filter((targetId) => Boolean(findNode(roots, targetId)?.url));
    if (bookmarkIds.length === 0) return;
    setTagEditIds(bookmarkIds);
    setTagEditMode("add");
    setTagEditValue("");
  };

  const handleApplyTagEdit = async () => {
    if (tagEditNodes.length === 0) return;
    const inputTags = parseTagInput(tagEditValue);
    if (tagEditMode !== "clear" && inputTags.length === 0) return;

    let nextTagMap = tagMap;
    for (const node of tagEditNodes) {
      const nextTags = tagEditMode === "clear" ? [] : tagEditMode === "overwrite" ? inputTags : parseTagInput([...(nextTagMap[node.id] ?? []), ...inputTags].join(","));
      nextTagMap = await setBookmarkTags(nextTagMap, node.id, nextTags);
    }
    setTagMap(nextTagMap);
    setTagEditIds([]);
    setTagEditValue("");
    setTagEditMode("add");
    showToast(`Updated tags for ${tagEditNodes.length} bookmark(s)`, "success");
  };

  const handleCheckLink = async (id: string, url: string) => {
    setRunningChecks((count) => count + 1);
    const checking: DeadLinkResult = { status: "checking", message: "Checking..." };
    setLinkChecks((current) => ({ ...current, [id]: checking }));
    try {
      const timeoutMs = (customTimeoutEnabled ? Math.max(1, timeoutSeconds) : DEFAULT_TIMEOUT_SECONDS) * 1000;
      const check = await checkBookmarkUrl(url, skipPrivateHosts, timeoutMs);
      setLinkChecks((current) => current[id] === checking ? { ...current, [id]: check } : current);
    } finally {
      setRunningChecks((count) => Math.max(0, count - 1));
    }
  };

  const ensureDeadlinkPermission = async () => {
    if (deadlinkPermissionGranted) return true;
    const granted = await requestDeadlinkHostPermission();
    setDeadlinkPermissionGranted(granted);
    if (!granted) showToast("Deadlink checks need permission to contact bookmark URLs", "warning");
    return granted;
  };

  const handleCheckTargets = async (targets: CheckTarget[]) => {
    const unique = uniqueTargets(targets);
    if (unique.length === 0) return;
    if (!await ensureDeadlinkPermission()) return;

    for (let index = 0; index < unique.length; index += DEADLINK_CONCURRENCY) {
      const batch = unique.slice(index, index + DEADLINK_CONCURRENCY);
      await Promise.all(batch.map((target) => handleCheckLink(target.id, target.url)));
    }
    showToast(`Checked ${unique.length} bookmark(s)`, "success");
  };

  const handleEnableDeadlinkChecks = async () => {
    if (await ensureDeadlinkPermission()) showToast("Deadlink checks enabled", "success");
  };

  const handleCheckAllLinks = async () => {
    await handleCheckTargets(searchableBookmarks.flatMap((bookmark) => bookmark.url ? [{ id: bookmark.id, url: bookmark.url }] : []));
  };

  const handleDeleteScannedTargets = async (label: string, targets: typeof searchableBookmarks) => {
    if (targets.length === 0) return;
    const list = targets.map((target) => `${target.title}\n${target.url}`).join("\n\n");
    if (!window.confirm(`Move ${targets.length} scanned ${label} bookmark(s) to ${DELETED_FOLDER_TITLE}?\n\n${list}`)) return;
    const deleted = await ensureDeletedFolder();
    const nodesToDelete = targets
      .map((target) => findNode(roots, target.id))
      .filter((node): node is BookmarkNode => Boolean(node));
    await storeDeletedBatch(nodesToDelete);

    for (const node of nodesToDelete) {
      await moveNode(node.id, { parentId: deleted.id });
    }

    setLinkChecks((current) => {
      const next = { ...current };
      targets.forEach((target) => delete next[target.id]);
      return next;
    });
    setSelectedIds((current) => {
      const next = new Set(current);
      targets.forEach((target) => next.delete(target.id));
      return next;
    });
    await refresh();
    showToast(`Moved ${nodesToDelete.length} scanned ${label} bookmark(s) to ${DELETED_FOLDER_TITLE}`, "success");
  };

  const handleAnalyzeCleanup = () => {
    const findings = analyzeCleanup(activeFlatNodes, linkChecks);
    setCleanupFindings(findings);
    setSelectedCleanupFindingIds(new Set(findings.filter((finding) => finding.suggestedAction === "delete").map((finding) => finding.id)));
    showToast(`Found ${findings.length} cleanup finding(s)`, "info");
  };

  const toggleCleanupFinding = (id: string) => {
    setSelectedCleanupFindingIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCleanupType = (type: CleanupFindingType) => {
    const ids = cleanupFindings.filter((finding) => finding.type === type).map((finding) => finding.id);
    setSelectedCleanupFindingIds((current) => {
      const next = new Set(current);
      const allSelected = ids.length > 0 && ids.every((id) => next.has(id));
      ids.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const selectedCleanupFindings = () => cleanupFindings.filter((finding) => selectedCleanupFindingIds.has(finding.id));

  const handleDismissCleanupSelected = () => {
    setCleanupFindings((current) => current.filter((finding) => !selectedCleanupFindingIds.has(finding.id)));
    setSelectedCleanupFindingIds(new Set());
  };

  const handleDeleteCleanupSelected = async () => {
    const findings = selectedCleanupFindings();
    if (findings.length === 0) return;
    const uniqueByBookmarkId = [...new Map(findings.map((finding) => [finding.bookmarkId, finding])).values()];
    const list = uniqueByBookmarkId.map((finding) => `${finding.title}\n${finding.url}\n${finding.reason}`).join("\n\n");
    if (!window.confirm(`Move ${uniqueByBookmarkId.length} cleanup bookmark(s) to ${DELETED_FOLDER_TITLE}?\n\n${list}`)) return;
    const deleted = await ensureDeletedFolder();
    const nodesToDelete = uniqueByBookmarkId
      .map((finding) => findNode(roots, finding.bookmarkId))
      .filter((node): node is BookmarkNode => Boolean(node));
    await storeDeletedBatch(nodesToDelete);

    for (const node of nodesToDelete) {
      await moveNode(node.id, { parentId: deleted.id });
    }

    const deletedIds = new Set(uniqueByBookmarkId.map((finding) => finding.bookmarkId));
    setCleanupFindings((current) => current.filter((finding) => !deletedIds.has(finding.bookmarkId)));
    setSelectedCleanupFindingIds(new Set());
    setLinkChecks((current) => {
      const next = { ...current };
      deletedIds.forEach((id) => delete next[id]);
      return next;
    });
    setSelectedIds((current) => {
      const next = new Set(current);
      deletedIds.forEach((id) => next.delete(id));
      return next;
    });
    await refresh();
    showToast(`Moved ${nodesToDelete.length} cleanup bookmark(s) to ${DELETED_FOLDER_TITLE}`, "success");
  };

  const commands: CommandItem[] = [
    {
      id: "focus-search",
      title: "Focus search",
      subtitle: "Use operators: tag:vpn site:cisco.com folder:wireless is:dead title:vpn url:sharepoint",
      keywords: "google search operator find filter",
      onRun: () => document.querySelector<HTMLInputElement>(".search-box input")?.focus()
    },
    { id: "add", title: "Add bookmarks", subtitle: "Open bulk import", keywords: "quick import urls", onRun: () => setInspectorPanel("add") },
    { id: "deadlinks", title: "Deadlink checker", subtitle: "Open deadlink tools", keywords: "404 timeout check", onRun: () => setInspectorPanel("deadlinks") },
    { id: "cleanup", title: "Run cleanup scan", subtitle: "Deadlinks, duplicates, nonsense bookmarks", keywords: "duplicates clean", onRun: () => { setInspectorPanel("cleanup"); handleAnalyzeCleanup(); } },
    { id: "sort", title: "Sort assistant", subtitle: "Analyze sort suggestions", keywords: "organize folders", onRun: () => setInspectorPanel("sort") },
    { id: "rename", title: "Auto rename", subtitle: "Analyze naming suggestions", keywords: "names normalize", onRun: () => setInspectorPanel("rename") },
    { id: "tags", title: "Auto tags", subtitle: "Analyze and apply bookmark tags", keywords: "tag keywords labels", onRun: () => setInspectorPanel("tags") },
    { id: "backup", title: "Backup / import", subtitle: "Export or import JSON backup", keywords: "restore", onRun: () => setInspectorPanel("backup") },
    { id: "help", title: "Help & privacy", subtitle: "Shortcuts, deadlink privacy and restore behavior", keywords: "about docs support privacy", onRun: () => setInspectorPanel("help") },
    { id: "new-folder", title: "New folder", subtitle: `Create in ${selectedFolderTitle}`, keywords: "create directory", onRun: () => void handleCreateFolder() },
    { id: "undo-move", title: "Undo last move", subtitle: moveUndoAvailable ? `${pendingMoveUndo?.items.length ?? 0} item(s), Ctrl+Z` : "Available for 10s after drag & drop", keywords: "drag drop restore ctrl z", onRun: () => void handleUndoMove() },
    { id: "undo-delete", title: "Undo delete", subtitle: `${undoDeleteCount} item(s) from last delete`, keywords: "restore undelete trash deleted", onRun: () => void handleUndoLastDelete() },
    { id: "undelete-selected", title: "Undelete selected", subtitle: `${selectedDeletedCount} selected in ${DELETED_FOLDER_TITLE}`, keywords: "restore trash deleted", onRun: () => void handleUndeleteSelected() },
    { id: "clear-selection", title: "Clear selection", subtitle: `${selectedIds.size} selected`, keywords: "deselect reset", onRun: () => { setSelectedIds(new Set()); setSelectionAnchorId(undefined); } },
    { id: "details-view", title: "Details view", subtitle: "Show table columns", keywords: "list table", onRun: () => setViewMode("details") },
    { id: "list-view", title: "List view", subtitle: "Compact rows", keywords: "compact", onRun: () => setViewMode("list") },
    { id: "check-folder", title: "Check current folder", subtitle: `${folderCheckTargets.length} bookmark(s)`, keywords: "deadlink folder", onRun: () => { setInspectorPanel("deadlinks"); void handleCheckTargets(folderCheckTargets); } }
  ];

  if (loading) return <div className="center-state">Loading bookmarks...</div>;

  if (error) {
    return (
      <div className="center-state error-state">
        <h1>Bookmark Wizard</h1>
        <p>{error}</p>
        <p>Build the extension and load the `dist` folder in Chrome at `chrome://extensions`.</p>
      </div>
    );
  }

  const openFullView = (searchQuery: string) => {
    const params = searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery.trim())}` : "";
    const url = typeof chrome !== "undefined" && chrome.runtime?.getURL ? chrome.runtime.getURL(`index.html${params}`) : `index.html${params}`;
    if (typeof chrome !== "undefined" && chrome.tabs?.create) void chrome.tabs.create({ url });
    else window.open(url, "_blank", "noopener,noreferrer");
    window.close();
  };

  if (quickMode === "import") {
    const initialUrl = quickParams.get("url") ?? "";
    const normalizedInitialUrl = initialUrl ? normalizeHttpsUrl(initialUrl) : "";
    const initialTitle = quickParams.get("title") ?? "";
    return (
      <div className="quick-shell">
        <BookmarkImportPanel
          folders={importFolders}
          roots={roots}
          defaultFolderId={selectedFolderId}
          compact
          initialText={initialUrl}
          titleSuggestions={normalizedInitialUrl && initialTitle ? { [normalizedInitialUrl]: initialTitle } : {}}
          onImport={handleImportBookmarks}
          onCreateFolder={handleCreateImportFolder}
        />
      </div>
    );
  }

  if (quickMode === "search") {
    return (
      <div className="quick-shell quick-search-shell">
        <QuickSearchPanel bookmarks={searchableBookmarks} onOpen={(url) => void openBookmark(url)} onOpenFull={openFullView} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">
          <img src="/logo.png" alt="Bookmark Wizard" />
          <div>
            <span className="brand-title">Bookmark Wizard</span>
            <ul className="feature-summary" aria-label="Bookmark Wizard features">
              <li>{t("featureExplorer")}</li>
              <li>{t("featureQuick")}</li>
              <li>{t("featureTools")}</li>
            </ul>
          </div>
        </div>
        <div className="search-area">
          <BookmarkSearch value={query} onChange={setQuery} autoFocus />
          {popularTags.length > 0 ? (
            <div className="tag-cloud" aria-label="Popular tags">
              {popularTags.map((entry) => (
                <button key={entry.tag} onClick={() => setQuery(`tag:${entry.tag}`)}>{entry.tag}({entry.count})</button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="topbar-actions">
          <button title={`Create folder in ${selectedFolderTitle}`} onClick={handleCreateFolder}>New folder</button>
          <button disabled={!moveUndoAvailable} onClick={() => void handleUndoMove()}>Undo move</button>
          <button disabled={undoDeleteCount === 0} onClick={() => void handleUndoLastDelete()}>Undo delete ({undoDeleteCount})</button>
          <button onClick={() => void refresh()}>Refresh</button>
        </div>
      </header>

      <main className="workspace" style={{ "--inspector-width": `${inspectorWidth}px` } as CSSProperties}>
        <BookmarkTree
          roots={roots}
          selectedFolderId={selectedFolderId}
          editingId={editingId}
          onSelectFolder={setSelectedFolderId}
          onRenameStart={setEditingId}
          onRenameCancel={() => setEditingId(undefined)}
          onRenameSave={handleRename}
          onDropNode={handleDropNode}
          onDragStart={setDraggedId}
        />

        <section className="content-panel">
          <div className="filebar">
            <div className="breadcrumb">
              {breadcrumb.map((node, index) => (
                <button key={node.id} onClick={() => setSelectedFolderId(node.id)}>
                  {index > 0 ? "/ " : ""}{displayTitle(node)}
                </button>
              ))}
            </div>
            <div className="filebar-actions">
              <button className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}>List</button>
              <button className={viewMode === "details" ? "active" : ""} onClick={() => setViewMode("details")}>Details</button>
              {isDeletedView ? <button disabled={selectedDeletedCount === 0} onClick={() => void handleUndeleteSelected()}>Undelete selected ({selectedDeletedCount})</button> : null}
              <button className="danger" disabled={selectedIds.size === 0} onClick={() => void handleDeleteSelected()}>Delete selected ({selectedIds.size})</button>
              <button disabled={selectedIds.size === 0} onClick={() => { setSelectedIds(new Set()); setSelectionAnchorId(undefined); }}>Clear selection</button>
            </div>
          </div>
          {draggedId ? <div className="drop-hint">Drop on a folder to move it.</div> : null}
          {searchMode ? (
            <div className="split-view">
              <section className="split-pane search-pane">
                <div className="split-title">Search results stay open</div>
                <BookmarkList
                  nodes={[]}
                  searchResults={filteredSearchResults}
                  searchMode={true}
                  selectedFolderId={selectedFolderId}
                  editingId={editingId}
                  viewMode={viewMode}
                  selectedIds={selectedIds}
                  allVisibleSelected={allSearchVisibleSelected}
                  columnWidths={columnWidths}
                  checksDisabled={false}
                  linkChecks={linkChecks}
                  tagMap={tagMap}
                  onOpenFolder={setSelectedFolderId}
                  onOpenBookmark={(url) => void openBookmark(url)}
                  onCopyBookmark={handleCopyBookmark}
                  onOpenPath={setSelectedFolderId}
                  onRenameStart={setEditingId}
                  onRenameCancel={() => setEditingId(undefined)}
                  onRenameSave={handleRename}
                  onEditSave={handleEditBookmark}
                  onCreateFolder={(parentId) => void handleCreateFolderIn(parentId)}
                  onDelete={handleDelete}
                  onDeleteById={(id) => void handleDeleteById(id)}
                  onDeleteSelected={() => void handleDeleteSelected()}
                  onEditTags={(id) => void handleEditBookmarkTags(id)}
                  onCheckLink={(id, url) => void handleCheckLink(id, url)}
                  onToggleSelected={toggleSelected}
                  onToggleSelectAll={() => toggleSelectIds(searchVisibleIds)}
                  onColumnResize={handleColumnResize}
                  onDropNode={handleDropNode}
                  onDragStart={setDraggedId}
                />
              </section>
              <section className="split-pane folder-pane">
                <div className="split-title split-breadcrumb">
                  <span>Folder content:</span>
                  {breadcrumb.map((node, index) => (
                    <button key={node.id} onClick={() => setSelectedFolderId(node.id)}>
                      {index > 0 ? "/ " : ""}{displayTitle(node)}
                    </button>
                  ))}
                </div>
                <BookmarkList
                  nodes={filteredCurrentNodes}
                  searchResults={[]}
                  searchMode={false}
                  selectedFolderId={selectedFolderId}
                  editingId={editingId}
                  viewMode={viewMode}
                  selectedIds={selectedIds}
                  allVisibleSelected={allFolderVisibleSelected}
                  columnWidths={columnWidths}
                  checksDisabled={isDeletedView}
                  linkChecks={linkChecks}
                  tagMap={tagMap}
                  onOpenFolder={setSelectedFolderId}
                  onOpenBookmark={(url) => void openBookmark(url)}
                  onCopyBookmark={handleCopyBookmark}
                  onOpenPath={setSelectedFolderId}
                  onRenameStart={setEditingId}
                  onRenameCancel={() => setEditingId(undefined)}
                  onRenameSave={handleRename}
                  onEditSave={handleEditBookmark}
                  onCreateFolder={(parentId) => void handleCreateFolderIn(parentId)}
                  onDelete={handleDelete}
                  onDeleteById={(id) => void handleDeleteById(id)}
                  onDeleteSelected={() => void handleDeleteSelected()}
                  onEditTags={(id) => void handleEditBookmarkTags(id)}
                  onCheckLink={(id, url) => void handleCheckLink(id, url)}
                  onToggleSelected={toggleSelected}
                  onToggleSelectAll={() => toggleSelectIds(folderVisibleIds)}
                  onColumnResize={handleColumnResize}
                  onDropNode={handleDropNode}
                  onDragStart={setDraggedId}
                />
              </section>
            </div>
          ) : (
            <BookmarkList
              nodes={filteredCurrentNodes}
              searchResults={[]}
              searchMode={false}
              selectedFolderId={selectedFolderId}
              editingId={editingId}
              viewMode={viewMode}
              selectedIds={selectedIds}
              allVisibleSelected={allVisibleSelected}
              columnWidths={columnWidths}
              checksDisabled={isDeletedView}
              linkChecks={linkChecks}
              tagMap={tagMap}
              onOpenFolder={setSelectedFolderId}
              onOpenBookmark={(url) => void openBookmark(url)}
              onCopyBookmark={handleCopyBookmark}
              onOpenPath={setSelectedFolderId}
              onRenameStart={setEditingId}
              onRenameCancel={() => setEditingId(undefined)}
              onRenameSave={handleRename}
              onEditSave={handleEditBookmark}
              onCreateFolder={(parentId) => void handleCreateFolderIn(parentId)}
              onDelete={handleDelete}
              onDeleteById={(id) => void handleDeleteById(id)}
              onDeleteSelected={() => void handleDeleteSelected()}
              onEditTags={(id) => void handleEditBookmarkTags(id)}
              onCheckLink={(id, url) => void handleCheckLink(id, url)}
              onToggleSelected={toggleSelected}
              onToggleSelectAll={toggleSelectAllVisible}
              onColumnResize={handleColumnResize}
              onDropNode={handleDropNode}
              onDragStart={setDraggedId}
            />
          )}
        </section>

        <div className="inspector-resizer" onPointerDown={resizeInspector} title="Resize side panel" />
        <aside className="inspector-panel">
          <div className="inspector-tabs" role="tablist" aria-label="Tools">
            <button className={inspectorPanel === "deadlinks" ? "active" : ""} onClick={() => setInspectorPanel("deadlinks")}>Deadlinks</button>
            <button className={inspectorPanel === "backup" ? "active" : ""} onClick={() => setInspectorPanel("backup")}>Backup</button>
            <button className={inspectorPanel === "sort" ? "active" : ""} onClick={() => setInspectorPanel("sort")}>Sort</button>
            <button className={inspectorPanel === "cleanup" ? "active" : ""} onClick={() => setInspectorPanel("cleanup")}>Cleanup</button>
            <button className={inspectorPanel === "rename" ? "active" : ""} onClick={() => setInspectorPanel("rename")}>Rename</button>
            <button className={inspectorPanel === "tags" ? "active" : ""} onClick={() => setInspectorPanel("tags")}>Tags</button>
            <button className={inspectorPanel === "add" ? "active" : ""} onClick={() => setInspectorPanel("add")}>Add</button>
            <button className={inspectorPanel === "help" ? "active" : ""} onClick={() => setInspectorPanel("help")}>Help</button>
          </div>
          {inspectorPanel === "deadlinks" ? (
            <DeadLinkPanel
              bookmarks={searchableBookmarks}
              selectedCount={selectedCheckTargets.length}
              folderCount={folderCheckTargets.length}
              checks={linkChecks}
              filter={deadLinkFilter}
              runningCount={runningChecks}
              permissionGranted={deadlinkPermissionGranted}
              skipPrivateHosts={skipPrivateHosts}
              customTimeoutEnabled={customTimeoutEnabled}
              timeoutSeconds={timeoutSeconds}
              delete404Count={scanned404Targets.length}
              deleteTimeoutCount={scannedTimeoutTargets.length}
              onSkipPrivateHostsChange={setSkipPrivateHosts}
              onCustomTimeoutEnabledChange={setCustomTimeoutEnabled}
              onTimeoutSecondsChange={(value) => setTimeoutSeconds(Number.isFinite(value) ? Math.min(60, Math.max(1, value)) : DEFAULT_TIMEOUT_SECONDS)}
              onFilterChange={setDeadLinkFilter}
              onClearFilter={() => setDeadLinkFilter("all")}
              onClearScans={() => setLinkChecks({})}
              onDelete404={() => void handleDeleteScannedTargets("404", scanned404Targets)}
              onDeleteTimeouts={() => void handleDeleteScannedTargets("timeout", scannedTimeoutTargets)}
              onEnableChecks={() => void handleEnableDeadlinkChecks()}
              onCheckAll={() => void handleCheckAllLinks()}
              onCheckSelected={() => void handleCheckTargets(selectedCheckTargets)}
              onCheckFolder={() => void handleCheckTargets(folderCheckTargets)}
            />
          ) : null}
          {inspectorPanel === "backup" ? <BackupPanel roots={roots} selectedFolderId={selectedFolderId} tagMap={tagMap} onTagsImported={(importedTags) => setTagMap((current) => ({ ...current, ...importedTags }))} onImported={() => void refresh()} /> : null}
          {inspectorPanel === "sort" ? (
            <SuggestionPanel
              suggestions={sortSuggestions}
              selectedFolderTitle={selectedFolderTitle}
              scope={sortScope}
              analyzedCount={sortAnalyzedCount}
              selectedSuggestionIds={selectedSuggestionIds}
              previewId={previewSuggestionId}
              itemSelections={sortItemSelections}
              targetFolderNames={sortTargetNames}
              backupBeforeApply={backupBeforeSortApply}
              applying={sortApplying}
              onScopeChange={setSortScope}
              onAnalyze={handleAnalyzeSort}
              onToggleSuggestion={toggleSortSuggestion}
              onPreview={setPreviewSuggestionId}
              onTogglePreviewItem={toggleSortItem}
              onTargetFolderNameChange={(suggestionId, value) => setSortTargetNames((current) => ({ ...current, [suggestionId]: value }))}
              onBackupBeforeApplyChange={setBackupBeforeSortApply}
              onApplySuggestion={(suggestion) => void applySortSuggestions([suggestion])}
              onApplySelected={() => void applySortSuggestions(sortSuggestions.filter((suggestion) => selectedSuggestionIds.has(suggestion.id)))}
            />
          ) : null}
          {inspectorPanel === "cleanup" ? (
            <CleanupPanel
              findings={cleanupFindings}
              selectedFindingIds={selectedCleanupFindingIds}
              onAnalyze={handleAnalyzeCleanup}
              onToggleFinding={toggleCleanupFinding}
              onToggleType={toggleCleanupType}
              onDeleteSelected={() => void handleDeleteCleanupSelected()}
              onDismissSelected={handleDismissCleanupSelected}
              onClear={() => {
                setCleanupFindings([]);
                setSelectedCleanupFindingIds(new Set());
              }}
            />
          ) : null}
          {inspectorPanel === "rename" ? (
            <RenamePanel
              scope={renameScope}
              suggestions={renameSuggestions}
              selectedIds={selectedRenameSuggestionIds}
              editedTitles={renameEditedTitles}
              variantIndexes={renameVariantIndexes}
              backupBeforeApply={backupBeforeRenameApply}
              applying={renameApplying}
              analyzedCount={renameAnalyzedCount}
              onScopeChange={setRenameScope}
              onAnalyze={handleAnalyzeRename}
              onToggleSuggestion={toggleRenameSuggestion}
              onToggleAll={toggleAllRenameSuggestions}
              onVariantChange={(id, index) => {
                const suggestion = renameSuggestions.find((candidate) => candidate.id === id);
                const title = suggestion?.variants[index];
                setRenameVariantIndexes((current) => ({ ...current, [id]: index }));
                if (title) setRenameEditedTitles((current) => ({ ...current, [id]: title }));
              }}
              onTitleChange={(id, title) => setRenameEditedTitles((current) => ({ ...current, [id]: title }))}
              onBackupBeforeApplyChange={setBackupBeforeRenameApply}
              onApplySelected={() => void handleApplyRenameSelected()}
              onClear={() => {
                setRenameSuggestions([]);
                setSelectedRenameSuggestionIds(new Set());
                setRenameEditedTitles({});
                setRenameVariantIndexes({});
                setRenameAnalyzedCount(0);
              }}
            />
          ) : null}
          {inspectorPanel === "tags" ? (
            <AutoTagPanel
              scope={tagScope}
              suggestions={tagSuggestions}
              selectedIds={selectedTagSuggestionIds}
              editedTags={tagEditedValues}
              allTags={allKnownTags}
              analyzedCount={tagAnalyzedCount}
              applying={tagApplying}
              onScopeChange={setTagScope}
              onAnalyze={handleAnalyzeTags}
              onToggleSuggestion={toggleTagSuggestion}
              onToggleAll={toggleAllTagSuggestions}
              onTagsChange={(id, value) => setTagEditedValues((current) => ({ ...current, [id]: value }))}
              onAddExistingTag={addExistingTagToSuggestion}
              onApplySelected={() => void handleApplyTagsSelected()}
              onClear={() => {
                setTagSuggestions([]);
                setSelectedTagSuggestionIds(new Set());
                setTagEditedValues({});
                setTagAnalyzedCount(0);
              }}
            />
          ) : null}
          {inspectorPanel === "add" ? (
            <BookmarkImportPanel
              folders={importFolders}
              roots={roots}
              defaultFolderId={selectedFolderId}
              onImport={handleImportBookmarks}
              onCreateFolder={handleCreateImportFolder}
            />
          ) : null}
          {inspectorPanel === "help" ? <HelpPanel /> : null}
        </aside>
      </main>
      {tagEditNodes.length > 0 ? (
        <div className="modal-backdrop" onClick={() => setTagEditIds([])}>
          <section className="tag-edit-modal" onClick={(event) => event.stopPropagation()}>
            <div className="tag-edit-header">
              <div>
                <h2>Edit Tags</h2>
                <p>{tagEditNodes.length === 1 ? displayTitle(tagEditNodes[0]) : `${tagEditNodes.length} selected bookmarks`}</p>
              </div>
              <button onClick={() => setTagEditIds([])}>Close</button>
            </div>

            <div className="tag-edit-current">
              <span>Current tags</span>
              <div className="tag-chip-row">
                {[...new Set(tagEditNodes.flatMap((node) => tagMap[node.id] ?? []))].map((tag) => <span key={tag} className="tag-chip">{tag}</span>)}
                {tagEditNodes.every((node) => (tagMap[node.id] ?? []).length === 0) ? <span className="muted-inline">No tags yet</span> : null}
              </div>
            </div>

            <div className="tag-edit-modes" role="radiogroup" aria-label="Tag edit mode">
              <label className={tagEditMode === "add" ? "active" : ""}>
                <input type="radio" checked={tagEditMode === "add"} onChange={() => setTagEditMode("add")} />
                Add tags
              </label>
              <label className={tagEditMode === "overwrite" ? "active" : ""}>
                <input type="radio" checked={tagEditMode === "overwrite"} onChange={() => setTagEditMode("overwrite")} />
                Overwrite tags
              </label>
              <label className={tagEditMode === "clear" ? "active" : ""}>
                <input type="radio" checked={tagEditMode === "clear"} onChange={() => setTagEditMode("clear")} />
                Clear tags
              </label>
            </div>

            {tagEditMode === "clear" ? (
              <p className="warning-note">This removes all tags from the selected bookmark(s).</p>
            ) : (
              <label className="tag-edit-input">
                Tags, comma separated
                <input autoFocus value={tagEditValue} placeholder="vpn, docs, cloud" onChange={(event) => setTagEditValue(event.target.value)} />
              </label>
            )}

            {allKnownTags.length > 0 && tagEditMode !== "clear" ? (
              <div className="tag-edit-known">
                <span>Existing tags</span>
                <div>
                  {allKnownTags.slice(0, 40).map((tag) => (
                    <button key={tag} onClick={() => setTagEditValue((current) => parseTagInput(`${current},${tag}`).join(", "))}>{tag}</button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="tag-edit-actions">
              <button onClick={() => setTagEditIds([])}>Cancel</button>
              <button className={tagEditMode === "clear" ? "danger" : ""} disabled={tagEditMode !== "clear" && parseTagInput(tagEditValue).length === 0} onClick={() => void handleApplyTagEdit()}>
                {tagEditMode === "add" ? "Add tags" : tagEditMode === "overwrite" ? "Overwrite tags" : "Clear tags"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <CommandPalette open={commandOpen} commands={commands} onClose={() => setCommandOpen(false)} />
      <Toasts toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
    </div>
  );
}
