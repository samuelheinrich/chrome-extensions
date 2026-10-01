import type { FlatBookmarkNode, TagSuggestion } from "../../types";
import { domainLabel, hostname } from "../../lib/normalizeUrl";
import { normalizeTag, normalizeTags } from "./tags";

const KEYWORD_TAGS: Array<{ tag: string; terms: string[] }> = [
  { tag: "wireless", terms: ["wireless", "wifi", "wi-fi", "wlan", "802.11", "ssid", "access point"] },
  { tag: "networking", terms: ["network", "routing", "switching", "router", "switch", "tcp", "dns", "dhcp"] },
  { tag: "security", terms: ["security", "firewall", "vpn", "zero trust", "oauth", "sso", "iam"] },
  { tag: "cloud", terms: ["aws", "azure", "gcp", "cloud", "kubernetes", "docker", "terraform"] },
  { tag: "docs", terms: ["docs", "documentation", "manual", "reference", "guide", "api"] },
  { tag: "tools", terms: ["tool", "calculator", "generator", "converter", "validator"] },
  { tag: "dev", terms: ["github", "gitlab", "typescript", "javascript", "react", "node", "developer"] }
];

const STOP_WORDS = new Set(["www", "com", "org", "net", "html", "index", "home", "page", "docs", "documentation", "en", "de", "the", "and", "for", "with"]);

const tokenTags = (value: string) => value
  .toLowerCase()
  .split(/[^a-z0-9]+/)
  .map(normalizeTag)
  .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));

const urlTags = (url: string) => {
  try {
    const parsed = new URL(url);
    const host = hostname(url);
    const domain = normalizeTag(domainLabel(url));
    const pathTags = tokenTags(parsed.pathname).slice(0, 3);
    const hostTags = host.split(".").map(normalizeTag).filter((tag) => tag.length >= 4 && !STOP_WORDS.has(tag));
    return normalizeTags([domain, ...hostTags, ...pathTags]);
  } catch {
    return [];
  }
};

export const analyzeTags = (nodes: FlatBookmarkNode[], knownTags: string[]): TagSuggestion[] => {
  const knownTagSet = new Set(knownTags.map(normalizeTag).filter(Boolean));

  return nodes
    .filter((node) => !node.isDeleted && !node.isFolder && node.url)
    .map((node) => {
      const haystack = `${node.title} ${node.url} ${node.path}`.toLowerCase();
      const keywordTags = KEYWORD_TAGS.filter((keyword) => keyword.terms.some((term) => haystack.includes(term))).map((keyword) => keyword.tag);
      const matchingKnownTags = [...knownTagSet].filter((tag) => haystack.includes(tag.replace(/-/g, " ")) || haystack.includes(tag));
      const folderTags = node.pathTitles.slice(-2).flatMap(tokenTags).slice(0, 2);
      const suggestedTags = normalizeTags([...keywordTags, ...matchingKnownTags, ...folderTags, ...urlTags(node.url ?? "")])
        .filter((tag) => !node.tags.includes(tag))
        .slice(0, 4);

      return {
        id: `tag:${node.id}`,
        bookmarkId: node.id,
        title: node.title,
        url: node.url ?? "",
        path: node.path,
        existingTags: node.tags,
        suggestedTags,
        reason: suggestedTags.length > 0 ? "Tags from URL, title, folder path and known tag matches." : "No new tag candidates found.",
        confidence: keywordTags.length > 0 || matchingKnownTags.length > 0 ? "High" : suggestedTags.length >= 3 ? "Medium" : "Low"
      } satisfies TagSuggestion;
    })
    .filter((suggestion) => suggestion.suggestedTags.length > 0)
    .sort((a, b) => {
      const confidenceOrder = { High: 0, Medium: 1, Low: 2 };
      return confidenceOrder[a.confidence] - confidenceOrder[b.confidence] || b.suggestedTags.length - a.suggestedTags.length || a.title.localeCompare(b.title);
    });
};
