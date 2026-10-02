const openApp = async () => {
  const url = chrome.runtime.getURL("index.html");
  const tabs = await chrome.tabs.query({ url });
  const existing = tabs[0];

  if (existing?.id) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId) await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }

  await chrome.tabs.create({ url });
};

const msg = (name: string, fallback: string) => chrome.i18n?.getMessage(name) || fallback;

const openQuickWindow = async (mode: "import" | "search", params = "") => {
  await chrome.windows.create({
    url: chrome.runtime.getURL(`index.html?quick=${mode}${params}`),
    type: "popup",
    width: mode === "import" ? 680 : 620,
    height: mode === "import" ? 620 : 520,
    focused: true
  });
};

const setupContextMenus = () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "quick-import",
      title: msg("contextQuickImport", "Bulk import"),
      contexts: ["action"]
    });
    chrome.contextMenus.create({
      id: "save-this-page",
      title: msg("contextSaveThisPage", "Save this page"),
      contexts: ["action"]
    });
    chrome.contextMenus.create({
      id: "quick-search",
      title: msg("contextSearch", "Search"),
      contexts: ["action"]
    });
  });
};

chrome.action.onClicked.addListener(() => {
  void openQuickWindow("search");
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "_execute_action") void openApp();
});

chrome.runtime.onInstalled.addListener(setupContextMenus);
chrome.runtime.onStartup.addListener(setupContextMenus);

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === "quick-import") void openQuickWindow("import");
  if (info.menuItemId === "save-this-page") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ? `&url=${encodeURIComponent(tab.url)}` : "";
    const title = tab?.title ? `&title=${encodeURIComponent(tab.title)}` : "";
    void openQuickWindow("import", `${url}${title}`);
  }
  if (info.menuItemId === "quick-search") void openQuickWindow("search");
});
