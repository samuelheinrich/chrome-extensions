export type ParsedBookmarkImport = {
  url: string;
  title: string;
};

const toHttpsUrl = (value: string) => {
  const trimmed = value.trim().replace(/^<|>$/g, "");
  if (!trimmed) return "";
  const withoutProtocol = trimmed.replace(/^https?:\/\//i, "");
  return `https://${withoutProtocol}`;
};

const titleFromUrl = (value: string) => {
  try {
    const url = new URL(value);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const path = pathParts[pathParts.length - 1]?.replace(/[-_]+/g, " ").replace(/\.[a-z0-9]+$/i, "");
    return path ? `${url.hostname.replace(/^www\./, "")}: ${path}` : url.hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
};

export const parseBookmarkImportText = (text: string): ParsedBookmarkImport[] => {
  const candidates = text
    .split(/[\s,]+/)
    .map(toHttpsUrl)
    .filter(Boolean);

  const unique = [...new Set(candidates)];
  return unique.flatMap((candidate) => {
    try {
      const url = new URL(candidate);
      if (!url.hostname.includes(".")) return [];
      return [{ url: url.toString(), title: titleFromUrl(url.toString()) }];
    } catch {
      return [];
    }
  });
};
