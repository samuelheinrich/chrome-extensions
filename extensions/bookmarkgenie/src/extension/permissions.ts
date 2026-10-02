const DEADLINK_ORIGINS = ["http://*/*", "https://*/*"];

const hasPermissionsApi = () => typeof chrome !== "undefined" && Boolean(chrome.permissions);

const callbackApi = <T>(run: (done: (value: T) => void) => void) =>
  new Promise<T>((resolve, reject) => {
    run((value) => {
      const lastError = chrome.runtime?.lastError;
      if (lastError) reject(new Error(lastError.message));
      else resolve(value);
    });
  });

export const hasDeadlinkHostPermission = async () => {
  if (!hasPermissionsApi()) return true;
  return callbackApi<boolean>((done) => chrome.permissions.contains({ origins: DEADLINK_ORIGINS }, done));
};

export const requestDeadlinkHostPermission = async () => {
  if (!hasPermissionsApi()) return true;
  return callbackApi<boolean>((done) => chrome.permissions.request({ origins: DEADLINK_ORIGINS }, done));
};
