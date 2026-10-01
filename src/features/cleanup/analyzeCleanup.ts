import type { CleanupFinding, DeadLinkResult, FlatBookmarkNode } from "../../types";
import { normalizeUrl } from "../../lib/normalizeUrl";
import { isPrivateHost } from "../deadlinks/deadlinks";

const GENERIC_TITLES = new Set(["home", "homepage", "start", "startseite", "index", "login", "portal", "website"]);

const normalizedTitle = (value: string) => value.trim().toLowerCase().replace(/^www\./, "").replace(/\/$/, "");

const hostLabel = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

const isDomainRootBookmark = (bookmark: FlatBookmarkNode) => {
  if (!bookmark.url || isPrivateHost(bookmark.url)) return false;
  try {
    const url = new URL(bookmark.url);
    const pathIsRoot = url.pathname === "" || url.pathname === "/";
    return pathIsRoot && !url.search && !url.hash && !url.port;
  } catch {
    return false;
  }
};

const isLikelyGenericRootTitle = (bookmark: FlatBookmarkNode) => {
  if (!bookmark.url) return false;
  const title = normalizedTitle(bookmark.title);
  const host = hostLabel(bookmark.url);
  const baseDomain = host.split(".").slice(-2).join(".");
  const brand = baseDomain.split(".")[0];
  return GENERIC_TITLES.has(title) || title === host || title === baseDomain || title === brand;
};

const chooseDuplicateKeeper = (bookmarks: FlatBookmarkNode[]) =>
  [...bookmarks].sort((a, b) => {
    const depthDelta = b.pathTitles.length - a.pathTitles.length;
    if (depthDelta !== 0) return depthDelta;
    const titleDelta = b.title.length - a.title.length;
    if (titleDelta !== 0) return titleDelta;
    return (a.dateAdded ?? 0) - (b.dateAdded ?? 0);
  })[0];

export const analyzeCleanup = (flatNodes: FlatBookmarkNode[], checks: Record<string, DeadLinkResult>): CleanupFinding[] => {
  const bookmarks = flatNodes.filter((node) => !node.isFolder && node.url);
  const findings: CleanupFinding[] = [];

  for (const bookmark of bookmarks) {
    const check = checks[bookmark.id];
    if (!check || check.status === "checking" || check.status === "ok" || check.status === "redirect" || check.status === "skipped") continue;

    if (check.status === "dead" || check.status === "timeout" || check.status === "error") {
      findings.push({
        id: `deadlink:${bookmark.id}`,
        type: "deadlink",
        bookmarkId: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        path: bookmark.path,
        reason: check.httpStatus ? `Deadlink check: HTTP ${check.httpStatus}` : `Deadlink check: ${check.message}`,
        severity: check.httpStatus === 404 ? "high" : check.status === "timeout" ? "medium" : "low",
        suggestedAction: check.httpStatus === 404 ? "delete" : "review"
      });
    }
  }

  const duplicates = new Map<string, FlatBookmarkNode[]>();
  for (const bookmark of bookmarks) {
    const key = normalizeUrl(bookmark.url ?? "");
    duplicates.set(key, [...(duplicates.get(key) ?? []), bookmark]);
  }

  for (const [key, group] of duplicates.entries()) {
    if (group.length < 2) continue;
    const keeper = chooseDuplicateKeeper(group);
    for (const duplicate of group) {
      if (duplicate.id === keeper.id) continue;
      findings.push({
        id: `duplicate:${key}:${duplicate.id}`,
        type: "duplicate",
        bookmarkId: duplicate.id,
        title: duplicate.title,
        url: duplicate.url,
        path: duplicate.path,
        reason: `Duplicate URL. Suggested keep: ${keeper.title} (${keeper.path || "root"})`,
        severity: "medium",
        suggestedAction: "delete",
        groupId: `duplicate:${key}`
      });
    }
  }

  const specificBookmarkHosts = new Map<string, number>();
  for (const bookmark of bookmarks) {
    if (!bookmark.url || isDomainRootBookmark(bookmark)) continue;
    const host = hostLabel(bookmark.url);
    specificBookmarkHosts.set(host, (specificBookmarkHosts.get(host) ?? 0) + 1);
  }

  for (const bookmark of bookmarks) {
    if (!isDomainRootBookmark(bookmark) || !isLikelyGenericRootTitle(bookmark)) continue;
    const host = hostLabel(bookmark.url ?? "");
    const specificCount = specificBookmarkHosts.get(host) ?? 0;
    findings.push({
      id: `nonsense:${bookmark.id}`,
      type: "nonsense",
      bookmarkId: bookmark.id,
      title: bookmark.title,
      url: bookmark.url,
      path: bookmark.path,
      reason: specificCount > 0 ? `Generic domain-root bookmark; ${specificCount} more specific bookmark(s) exist for this host.` : "Generic domain-root bookmark with no subpage.",
      severity: specificCount > 0 ? "medium" : "low",
      suggestedAction: "review"
    });
  }

  return findings.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    const typeOrder = { deadlink: 0, duplicate: 1, nonsense: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity] || typeOrder[a.type] - typeOrder[b.type] || a.title.localeCompare(b.title);
  });
};
