import type { BookmarkNode } from "../types";

export type DeletedOrigin = {
  parentId: string;
  index?: number;
  title: string;
  deletedAt: number;
};

export type DeleteHistory = {
  items: Record<string, DeletedOrigin>;
  lastDeletedIds: string[];
};

const STORAGE_KEY = "bookmarkGenieDeleteHistory";
const emptyHistory = (): DeleteHistory => ({ items: {}, lastDeletedIds: [] });

const hasStorageApi = () => typeof chrome !== "undefined" && Boolean(chrome.storage?.local);

export const loadDeleteHistory = () =>
  new Promise<DeleteHistory>((resolve) => {
    if (!hasStorageApi()) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      try {
        resolve(raw ? { ...emptyHistory(), ...JSON.parse(raw) } : emptyHistory());
      } catch {
        resolve(emptyHistory());
      }
      return;
    }

    chrome.storage.local.get(STORAGE_KEY, (result) => {
      resolve({ ...emptyHistory(), ...(result[STORAGE_KEY] as DeleteHistory | undefined) });
    });
  });

export const saveDeleteHistory = (history: DeleteHistory) =>
  new Promise<void>((resolve, reject) => {
    if (!hasStorageApi()) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      resolve();
      return;
    }

    chrome.storage.local.set({ [STORAGE_KEY]: history }, () => {
      const lastError = chrome.runtime?.lastError;
      if (lastError) reject(new Error(lastError.message));
      else resolve();
    });
  });

export const addDeletedBatch = async (history: DeleteHistory, nodes: BookmarkNode[]) => {
  const deletedAt = Date.now();
  const next: DeleteHistory = {
    items: { ...history.items },
    lastDeletedIds: nodes.map((node) => node.id)
  };

  nodes.forEach((node) => {
    if (!node.parentId) return;
    next.items[node.id] = {
      parentId: node.parentId,
      index: node.index,
      title: node.title || "Untitled",
      deletedAt
    };
  });

  await saveDeleteHistory(next);
  return next;
};

export const removeDeletedRecords = async (history: DeleteHistory, ids: string[]) => {
  const idSet = new Set(ids);
  const next: DeleteHistory = {
    items: Object.fromEntries(Object.entries(history.items).filter(([id]) => !idSet.has(id))),
    lastDeletedIds: history.lastDeletedIds.filter((id) => !idSet.has(id))
  };
  await saveDeleteHistory(next);
  return next;
};
