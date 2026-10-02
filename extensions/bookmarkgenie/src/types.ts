export type BookmarkNode = chrome.bookmarks.BookmarkTreeNode;

export type FlatBookmarkNode = {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  path: string;
  pathTitles: string[];
  tags: string[];
  isFolder: boolean;
  isDeleted: boolean;
  dateAdded?: number;
  children?: BookmarkNode[];
};

export type MoveTarget = {
  parentId: string;
  index?: number;
};

export type SortSuggestion = {
  id: string;
  label: string;
  reason: string;
  folderName: string;
  bookmarkIds: string[];
  type: "domain" | "keyword";
  confidence: "High" | "Medium" | "Low";
  items: SortSuggestionItem[];
};

export type SortSuggestionItem = {
  id: string;
  title: string;
  url?: string;
  path: string;
};

export type SortScope = "current" | "selected" | "search" | "all";

export type TagScope = "selected" | "folder" | "folder-recursive" | "search" | "all";

export type ViewMode = "list" | "details";

export type InspectorPanel = "deadlinks" | "backup" | "sort" | "cleanup" | "rename" | "tags" | "add" | "help";

export type RenameScope = "selected" | "folder" | "folder-recursive" | "all";

export type RenameSuggestion = {
  id: string;
  bookmarkId: string;
  currentTitle: string;
  suggestedTitle: string;
  variants: string[];
  url: string;
  path: string;
  confidence: "High" | "Medium" | "Low";
  reason: string;
};

export type DeadLinkFilter = "all" | "scanned" | "ok" | "404" | "timeout" | "error";

export type DeadLinkStatus = "idle" | "checking" | "ok" | "redirect" | "dead" | "timeout" | "skipped" | "error";

export type DeadLinkResult = {
  status: DeadLinkStatus;
  message: string;
  checkedAt?: string;
  httpStatus?: number;
};

export type CleanupFindingType = "deadlink" | "duplicate" | "nonsense";

export type CleanupFinding = {
  id: string;
  type: CleanupFindingType;
  bookmarkId: string;
  title: string;
  url?: string;
  path: string;
  reason: string;
  severity: "high" | "medium" | "low";
  suggestedAction: "delete" | "review" | "keep";
  groupId?: string;
};

export type BackupPayload = {
  exportedAt: string;
  app: "Bookmark Wizard";
  version: 1;
  roots: BookmarkNode[];
  tags?: Record<string, string[]>;
};

export type TagSuggestion = {
  id: string;
  bookmarkId: string;
  title: string;
  url: string;
  path: string;
  existingTags: string[];
  suggestedTags: string[];
  reason: string;
  confidence: "High" | "Medium" | "Low";
};
