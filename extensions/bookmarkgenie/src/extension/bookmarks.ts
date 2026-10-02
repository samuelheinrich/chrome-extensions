import type { BookmarkNode, MoveTarget } from "../types";

const hasBookmarksApi = () => typeof chrome !== "undefined" && Boolean(chrome.bookmarks);

const callbackApi = <T>(run: (done: (value: T) => void) => void) =>
  new Promise<T>((resolve, reject) => {
    if (!hasBookmarksApi()) {
      reject(new Error("Chrome bookmark API is only available inside the extension."));
      return;
    }

    run((value) => {
      const lastError = chrome.runtime?.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve(value);
    });
  });

export const getBookmarkTree = () => callbackApi<BookmarkNode[]>((done) => chrome.bookmarks.getTree(done));

export const createFolder = (parentId: string, title: string, index?: number) =>
  callbackApi<BookmarkNode>((done) => chrome.bookmarks.create({ parentId, title, index }, done));

export const createBookmark = (parentId: string, title: string, url: string, index?: number) =>
  callbackApi<BookmarkNode>((done) => chrome.bookmarks.create({ parentId, title, url, index }, done));

export const renameNode = (id: string, title: string) =>
  callbackApi<BookmarkNode>((done) => chrome.bookmarks.update(id, { title }, done));

export const updateBookmark = (id: string, title: string, url: string) =>
  callbackApi<BookmarkNode>((done) => chrome.bookmarks.update(id, { title, url }, done));

export const moveNode = (id: string, target: MoveTarget) =>
  callbackApi<BookmarkNode>((done) => chrome.bookmarks.move(id, target, done));

export const removeNode = (node: BookmarkNode) =>
  callbackApi<void>((done) => {
    if (node.children) {
      chrome.bookmarks.removeTree(node.id, done);
      return;
    }
    chrome.bookmarks.remove(node.id, done);
  });

export const openBookmark = (url: string) =>
  new Promise<void>((resolve, reject) => {
    if (typeof chrome === "undefined" || !chrome.tabs) {
      window.open(url, "_blank", "noopener,noreferrer");
      resolve();
      return;
    }

    chrome.tabs.create({ url }, () => {
      const lastError = chrome.runtime?.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve();
    });
  });
