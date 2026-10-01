import type { FlatBookmarkNode, SortSuggestion } from "../../types";
import { domainLabel, hostname } from "../../lib/normalizeUrl";

const KEYWORDS: Array<{ label: string; folderName: string; terms: string[] }> = [
  { label: "Wireless", folderName: "wireless", terms: ["wireless", "wifi", "wi-fi", "wlan", "802.11", "access point", "ssid"] },
  { label: "Networking", folderName: "networking", terms: ["network", "routing", "switching", "router", "switch", "tcp", "ip", "dns", "dhcp"] },
  { label: "Security", folderName: "security", terms: ["security", "firewall", "vpn", "zero trust", "iam", "oauth", "sso"] },
  { label: "Cloud", folderName: "cloud", terms: ["aws", "azure", "gcp", "cloud", "kubernetes", "docker", "terraform"] },
  { label: "Docs", folderName: "docs", terms: ["docs", "documentation", "manual", "reference", "guide", "api"] },
  { label: "Tools", folderName: "tools", terms: ["tool", "calculator", "generator", "converter", "validator"] }
];

const numberedFolderName = (index: number, name: string) => `${String(index + 1).padStart(2, "0")}_${name}`;

const suggestionItems = (nodes: FlatBookmarkNode[]) =>
  nodes.map((node) => ({
    id: node.id,
    title: node.title,
    url: node.url,
    path: node.path
  }));

export const analyzeBookmarks = (flatNodes: FlatBookmarkNode[]): SortSuggestion[] => {
  const bookmarks = flatNodes.filter((node) => !node.isFolder && node.url);
  const suggestions: SortSuggestion[] = [];

  const byHost = new Map<string, FlatBookmarkNode[]>();
  for (const bookmark of bookmarks) {
    const host = hostname(bookmark.url ?? "");
    if (!host) continue;
    byHost.set(host, [...(byHost.get(host) ?? []), bookmark]);
  }

  const domainSuggestions = [...byHost.entries()]
    .filter(([, nodes]) => nodes.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 8);

  domainSuggestions.forEach(([host, nodes], index) => {
    const label = domainLabel(nodes[0].url ?? host);
    suggestions.push({
      id: `domain:${host}`,
      label,
      reason: `${nodes.length} Bookmarks von ${host}`,
      folderName: numberedFolderName(index, label.toLowerCase().replace(/[^a-z0-9]+/g, "_")),
      bookmarkIds: nodes.map((node) => node.id),
      type: "domain",
      confidence: nodes.length >= 6 ? "High" : "Medium",
      items: suggestionItems(nodes)
    });
  });

  KEYWORDS.forEach((keyword, keywordIndex) => {
    const matches = bookmarks.filter((node) => {
      const haystack = `${node.title} ${node.url} ${node.path}`.toLowerCase();
      return keyword.terms.some((term) => haystack.includes(term));
    });

    if (matches.length >= 3) {
      suggestions.push({
        id: `keyword:${keyword.folderName}`,
        label: keyword.label,
        reason: `${matches.length} Bookmarks passen zu Keywords: ${keyword.terms.slice(0, 4).join(", ")}`,
        folderName: numberedFolderName(domainSuggestions.length + keywordIndex, keyword.folderName),
        bookmarkIds: matches.map((node) => node.id),
        type: "keyword",
        confidence: matches.length >= 8 ? "High" : matches.length >= 5 ? "Medium" : "Low",
        items: suggestionItems(matches)
      });
    }
  });

  return suggestions.sort((a, b) => b.bookmarkIds.length - a.bookmarkIds.length).slice(0, 12);
};
