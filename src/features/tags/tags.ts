import type { FlatBookmarkNode } from "../../types";

export type TagMap = Record<string, string[]>;

const STORAGE_KEY = "bookmarkGenieTags";

const hasStorageApi = () => typeof chrome !== "undefined" && Boolean(chrome.storage?.local);

export const normalizeTag = (value: string) => value
  .trim()
  .toLowerCase()
  .replace(/^#+/, "")
  .replace(/\s+/g, "-")
  .replace(/[^a-z0-9._-]/g, "")
  .replace(/^-+|-+$/g, "");

export const normalizeTags = (values: string[]) => [...new Set(values.map(normalizeTag).filter(Boolean))].sort((a, b) => a.localeCompare(b));

export const parseTagInput = (value: string) => normalizeTags(value.split(/[,\n]+/));

export const loadTagMap = () =>
  new Promise<TagMap>((resolve) => {
    if (!hasStorageApi()) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      try {
        const parsed = raw ? JSON.parse(raw) as TagMap : {};
        resolve(Object.fromEntries(Object.entries(parsed).map(([id, tags]) => [id, normalizeTags(tags ?? [])])));
      } catch {
        resolve({});
      }
      return;
    }

    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const parsed = (result[STORAGE_KEY] as TagMap | undefined) ?? {};
      resolve(Object.fromEntries(Object.entries(parsed).map(([id, tags]) => [id, normalizeTags(tags ?? [])])));
    });
  });

export const saveTagMap = (tagMap: TagMap) =>
  new Promise<void>((resolve, reject) => {
    const compact = Object.fromEntries(Object.entries(tagMap).map(([id, tags]) => [id, normalizeTags(tags)]).filter(([, tags]) => tags.length > 0));

    if (!hasStorageApi()) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
      resolve();
      return;
    }

    chrome.storage.local.set({ [STORAGE_KEY]: compact }, () => {
      const lastError = chrome.runtime?.lastError;
      if (lastError) reject(new Error(lastError.message));
      else resolve();
    });
  });

export const setBookmarkTags = async (tagMap: TagMap, id: string, tags: string[]) => {
  const normalized = normalizeTags(tags);
  const next = { ...tagMap };
  if (normalized.length === 0) delete next[id];
  else next[id] = normalized;
  await saveTagMap(next);
  return next;
};

export const removeTagRecords = async (tagMap: TagMap, ids: string[]) => {
  const idSet = new Set(ids);
  const next = Object.fromEntries(Object.entries(tagMap).filter(([id]) => !idSet.has(id)));
  await saveTagMap(next);
  return next;
};

export const tagStats = (nodes: FlatBookmarkNode[]) => {
  const counts = new Map<string, number>();
  nodes.filter((node) => !node.isDeleted && !node.isFolder && node.url).forEach((node) => {
    node.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
  });
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
};
