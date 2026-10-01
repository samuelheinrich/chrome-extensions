const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term"
]);

export const normalizeUrl = (value: string) => {
  try {
    const url = new URL(value);
    url.hash = "";
    url.protocol = "https:";
    url.hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    for (const param of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(param.toLowerCase())) url.searchParams.delete(param);
    }
    const normalized = url.toString();
    return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  } catch {
    return value.trim().toLowerCase();
  }
};

export const domainLabel = (value: string) => {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    const parts = host.split(".").filter(Boolean);
    const candidate = parts.length > 1 ? parts[parts.length - 2] : parts[0];
    return candidate ? candidate[0].toUpperCase() + candidate.slice(1) : host;
  } catch {
    return "Unknown";
  }
};

export const hostname = (value: string) => {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};
