import type { DeadLinkResult } from "../../types";

const DEFAULT_TIMEOUT_MS = 4000;
const SUPPORTED_PROTOCOLS = new Set(["http:", "https:"]);

const isPrivateIPv4 = (host: string) => {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const [, aRaw, bRaw] = match;
  const a = Number(aRaw);
  const b = Number(bRaw);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 127 || a === 169 && b === 254;
};

const isPrivateIPv6 = (host: string) => {
  const normalized = host.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
};

export const parseCheckableUrl = (value: string) => {
  try {
    const url = new URL(value);
    return SUPPORTED_PROTOCOLS.has(url.protocol) ? url : undefined;
  } catch {
    return undefined;
  }
};

export const isPrivateHost = (value: string) => {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "localhost" || host.endsWith(".local") || isPrivateIPv4(host) || isPrivateIPv6(host);
  } catch {
    return false;
  }
};

const result = (data: DeadLinkResult): DeadLinkResult => ({ ...data, checkedAt: new Date().toISOString() });

export const checkBookmarkUrl = async (url: string, skipPrivateHosts: boolean, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<DeadLinkResult> => {
  const parsedUrl = parseCheckableUrl(url);
  if (!parsedUrl) {
    return result({ status: "skipped", message: "Only http/https URLs can be checked." });
  }

  if (skipPrivateHosts && isPrivateHost(url)) {
    return result({ status: "skipped", message: "Private/local host skipped." });
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));

  try {
    let response = await fetch(parsedUrl.toString(), { method: "HEAD", redirect: "follow", signal: controller.signal, cache: "no-store" });
    if (response.status === 405 || response.status === 403) {
      response = await fetch(parsedUrl.toString(), { method: "GET", redirect: "follow", signal: controller.signal, cache: "no-store" });
    }

    if (response.status >= 200 && response.status < 300) {
      return result({ status: "ok", httpStatus: response.status, message: `OK ${response.status}` });
    }
    if (response.status >= 300 && response.status < 400) {
      return result({ status: "redirect", httpStatus: response.status, message: `Redirect ${response.status}` });
    }
    if (response.status >= 400) {
      return result({ status: "dead", httpStatus: response.status, message: `HTTP ${response.status}` });
    }
    return result({ status: "error", httpStatus: response.status, message: `Unexpected status ${response.status}` });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return result({ status: "timeout", message: "Timeout" });
    }
    return result({ status: "error", message: err instanceof Error ? err.message : "Request failed" });
  } finally {
    window.clearTimeout(timeout);
  }
};
