import type { FlatBookmarkNode, RenameSuggestion } from "../../types";

const MEANINGFUL_SUBDOMAINS = new Set(["blog", "community", "developer", "docs", "help", "learn", "support"]);
const NOISE_TOKENS = new Set(["a", "an", "article", "articles", "c", "category", "de", "doc", "docs", "en", "home", "html", "id", "index", "layouts", "p", "page", "post", "posts", "r", "t5", "td-p", "thread", "view"]);
const TOPIC_PREFIX_NOISE = new Set(["ap", "config", "configuration", "guide", "how", "howto", "network", "setup", "wlc", "wlan"]);
const CATEGORY_HINTS = new Set([
  "api", "azure", "cloud", "config", "configuration", "docs", "firewall", "github", "guide", "ios", "kubernetes", "linux", "network", "networking", "react", "routing", "security", "switching", "terraform", "typescript", "vpn", "wireless", "wlan"
]);

const cleanTitle = (value: string) => value.trim().replace(/\s+/g, " ");
const stripExtension = (value: string) => value.replace(/\.(xlsx?|docx?|pptx?|pdf|html?|aspx?|jsp|php|md)$/i, "");
const compactLabel = (value: string) => value.replace(/[-_]+/g, " ").trim().toLowerCase();
const keepSemanticToken = (value: string) => cleanTitle(stripExtension(value).replace(/%20/g, " "));
const unique = (values: string[]) => [...new Set(values.map(cleanTitle).filter(Boolean))];

const hostnameParts = (hostname: string) => hostname.replace(/^www\./, "").split(".").filter(Boolean);

const isNoiseToken = (token: string) => {
  const normalized = token.toLowerCase();
  return NOISE_TOKENS.has(normalized) || /^\d+$/.test(normalized) || /^[a-f0-9-]{12,}$/i.test(normalized) || normalized.length <= 1 || normalized.startsWith(":");
};

const getSourceVariants = (url: URL) => {
  const parts = hostnameParts(url.hostname);
  const lowerParts = parts.map((part) => part.toLowerCase());
  const domain = lowerParts.length > 1 ? lowerParts[lowerParts.length - 2] : lowerParts[0] ?? "";
  const tenant = lowerParts.length > 2 ? lowerParts[0] : "";
  const meaningful = lowerParts.slice(0, -2).filter((part) => MEANINGFUL_SUBDOMAINS.has(part));

  if (domain === "sharepoint" && tenant && tenant !== "www") {
    return unique([`sharepoint ${tenant}`, `${tenant} sharepoint`, tenant, "sharepoint"]);
  }

  return unique([[domain, ...meaningful].map(compactLabel).join(" "), domain]);
};

const splitPathTokens = (pathname: string) => pathname
  .split("/")
  .map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  })
  .map(keepSemanticToken)
  .filter(Boolean)
  .filter((part) => !isNoiseToken(part));

const isDomainRoot = (url: URL) => (url.pathname === "" || url.pathname === "/") && !url.search && !url.hash;

const categoryFromTokens = (tokens: string[], pathTitles: string[]) => {
  const direct = tokens.find((token) => CATEGORY_HINTS.has(token.toLowerCase()));
  if (direct) return direct;
  const fromFolder = [...pathTitles].reverse().find((title) => CATEGORY_HINTS.has(compactLabel(title)));
  if (fromFolder) return fromFolder;
  return tokens.length > 1 ? tokens[0] : "";
};

const topicFromTokens = (tokens: string[], category: string) => {
  const candidates = tokens.filter((token) => token !== category);
  const slug = candidates.sort((a, b) => b.length - a.length)[0];
  if (!slug) return "";
  const parts = slug.split("-").filter(Boolean);
  while (parts.length > 2 && TOPIC_PREFIX_NOISE.has(parts[0].toLowerCase())) parts.shift();
  return parts.join("-") || slug;
};

const fileTokenFromQuery = (url: URL) => {
  const file = url.searchParams.get("file") || url.searchParams.get("filename") || url.searchParams.get("name");
  return file ? keepSemanticToken(file) : "";
};

const sharePointTokens = (url: URL) => {
  const path = url.pathname.split("/").filter(Boolean).map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  });
  const siteIndex = path.findIndex((part) => part.toLowerCase() === "sites" || part.toLowerCase() === "teams");
  const site = siteIndex >= 0 ? keepSemanticToken(path[siteIndex + 1] ?? "") : "";
  const file = fileTokenFromQuery(url);
  return { site, file };
};

const buildVariants = (url: URL, bookmark: FlatBookmarkNode) => {
  const sources = getSourceVariants(url);

  if (url.hostname.toLowerCase().includes("sharepoint.com")) {
    const { site, file } = sharePointTokens(url);
    const topicFull = unique([site, file]).join(" ");
    return unique([
      sources[0] && topicFull ? `${sources[0]}: ${topicFull}` : "",
      sources[0] && file ? `${sources[0]}: ${file}` : "",
      sources[1] && topicFull ? `${sources[1]}: ${topicFull}` : "",
      sources[2] && topicFull ? `${sources[2]}: ${topicFull}` : "",
      sources[0] && site && file ? `${sources[0]}: ${site} | ${file}` : ""
    ]);
  }

  if (isDomainRoot(url)) return unique(sources.map((source) => `${source}: homepage`));

  const tokens = splitPathTokens(url.pathname);
  const category = categoryFromTokens(tokens, bookmark.pathTitles);
  const topic = topicFromTokens(tokens, category);
  const source = sources[0] ?? "";

  return unique([
    source && category && topic ? `${source}: ${category} | ${topic}` : "",
    source && topic ? `${source}: ${topic}` : "",
    source && category && topic ? `${source}: ${category} ${topic}` : "",
    sources[1] && category && topic ? `${sources[1]}: ${category} | ${topic}` : "",
    cleanTitle(bookmark.title)
  ]);
};

const confidenceFor = (url: URL, variants: string[]) => {
  if (url.hostname.toLowerCase().includes("sharepoint.com") && variants.length > 1) return "High";
  if (variants[0]?.includes(" | ")) return "High";
  if (variants.length > 1) return "Medium";
  return "Low";
};

export const analyzeRename = (nodes: FlatBookmarkNode[]): RenameSuggestion[] => nodes
  .filter((node) => !node.isDeleted && !node.isFolder && node.url)
  .map((node) => {
    try {
      const url = new URL(node.url ?? "");
      const variants = buildVariants(url, node);
      return {
        id: `rename:${node.id}`,
        bookmarkId: node.id,
        currentTitle: node.title,
        suggestedTitle: variants[0] ?? cleanTitle(node.title),
        variants,
        url: node.url ?? "",
        path: node.path,
        confidence: confidenceFor(url, variants),
        reason: variants.length > 1 ? "Multiple naming combinations from host, path and query parameters." : "Single fallback naming suggestion."
      } satisfies RenameSuggestion;
    } catch {
      const fallback = cleanTitle(node.title);
      return {
        id: `rename:${node.id}`,
        bookmarkId: node.id,
        currentTitle: node.title,
        suggestedTitle: fallback,
        variants: [fallback],
        url: node.url ?? "",
        path: node.path,
        confidence: "Low",
        reason: "Invalid URL; keeping cleaned current title."
      } satisfies RenameSuggestion;
    }
  })
  .filter((suggestion) => suggestion.suggestedTitle && suggestion.suggestedTitle !== suggestion.currentTitle.trim())
  .sort((a, b) => {
    const confidenceOrder = { High: 0, Medium: 1, Low: 2 };
    return confidenceOrder[a.confidence] - confidenceOrder[b.confidence] || a.suggestedTitle.localeCompare(b.suggestedTitle);
  });
