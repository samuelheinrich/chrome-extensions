import type { BackupPayload, BookmarkNode } from "../../types";
import { createBookmark, createFolder } from "../../extension/bookmarks";
import { normalizeTags, type TagMap } from "../tags/tags";

const BACKUP_APP_NAME = "Bookmark Wizard";
const LEGACY_BACKUP_APP_NAME = "BookmarkGenie";

export const createBackupPayload = (roots: BookmarkNode[], tags: TagMap = {}): BackupPayload => ({
  exportedAt: new Date().toISOString(),
  app: BACKUP_APP_NAME,
  version: 1,
  roots,
  tags
});

export const downloadBackup = (payload: BackupPayload) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bookmark-wizard-backup-${payload.exportedAt.slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

export const parseBackupFile = async (file: File): Promise<BackupPayload> => {
  const text = await file.text();
  const parsed = JSON.parse(text) as BackupPayload;
  if (![BACKUP_APP_NAME, LEGACY_BACKUP_APP_NAME].includes(parsed.app) || parsed.version !== 1 || !Array.isArray(parsed.roots)) {
    throw new Error("Invalid Bookmark Wizard backup file.");
  }
  return parsed;
};

const importNode = async (node: BookmarkNode, parentId: string, tags: TagMap, importedTags: TagMap) => {
  if (node.url) {
    const bookmark = await createBookmark(parentId, node.title || node.url, node.url);
    const nodeTags = normalizeTags(tags[node.id] ?? []);
    if (nodeTags.length > 0) importedTags[bookmark.id] = nodeTags;
    return;
  }

  const folder = await createFolder(parentId, node.title || "Imported folder");
  for (const child of node.children ?? []) {
    await importNode(child, folder.id, tags, importedTags);
  }
};

export const importBackupIntoFolder = async (payload: BackupPayload, parentId: string) => {
  const container = await createFolder(parentId, `Bookmark Wizard import ${new Date().toLocaleString()}`);
  const importedTags: TagMap = {};
  for (const root of payload.roots) {
    for (const child of root.children ?? []) {
      await importNode(child, container.id, payload.tags ?? {}, importedTags);
    }
  }
  return { container, importedTags };
};
