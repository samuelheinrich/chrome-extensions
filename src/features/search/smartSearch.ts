import type { DeadLinkResult, FlatBookmarkNode } from "../../types";
import { flattenBookmarks, searchableText } from "../../lib/bookmarkTree";
import type { BookmarkNode } from "../../types";
import type { TagMap } from "../tags/tags";

const normalize = (value: string) => value.toLowerCase().trim();

type PlainSearchTerm = {
  value: string;
  requireEndBoundary: boolean;
};

const isSearchBoundary = (value: string | undefined) => !value || !/[a-z0-9]/i.test(value);

const includesSearchTerm = (value: string, term: PlainSearchTerm) => {
  if (!term.requireEndBoundary) return value.includes(term.value);
  let index = value.indexOf(term.value);
  while (index >= 0) {
    if (isSearchBoundary(value[index + term.value.length])) return true;
    index = value.indexOf(term.value, index + 1);
  }
  return false;
};

const hostMatches = (url: string | undefined, value: string) => {
  if (!url) return false;
  try {
    return new URL(url).hostname.toLowerCase().includes(value);
  } catch {
    return false;
  }
};

const isStatusMatch = (node: FlatBookmarkNode, checks: Record<string, DeadLinkResult>, value: string) => {
  const check = checks[node.id];
  if (value === "unchecked") return !check;
  if (!check) return false;
  if (value === "404") return check.status === "dead" && check.httpStatus === 404;
  if (value === "dead") return check.status === "dead" || check.status === "error";
  return check.status === value;
};

const scoreNode = (node: FlatBookmarkNode, plainTerms: PlainSearchTerm[], tagTerms: string[]) => {
  const title = normalize(node.title);
  const url = normalize(node.url ?? "");
  const path = normalize(node.path);
  const tags = node.tags.map(normalize);
  const scoredTerms = [...tagTerms.map((value) => ({ value, requireEndBoundary: false })), ...plainTerms];
  return scoredTerms.reduce((score, term) => {
    if (tags.some((tag) => tag === term.value)) return score + 160;
    if (tags.some((tag) => includesSearchTerm(tag, term))) return score + 135;
    if (url.startsWith(term.value) && (!term.requireEndBoundary || isSearchBoundary(url[term.value.length]))) return score + 100;
    if (includesSearchTerm(url, term)) return score + 85;
    if (title.startsWith(term.value) && (!term.requireEndBoundary || isSearchBoundary(title[term.value.length]))) return score + 75;
    if (includesSearchTerm(title, term)) return score + 55;
    if (includesSearchTerm(path, term)) return score + 15;
    return score;
  }, 0);
};

const matchesPlainTerm = (node: FlatBookmarkNode, term: PlainSearchTerm) => {
  const values = [node.title, node.url ?? "", node.path, ...node.tags].map((value) => value.toLowerCase());
  return values.some((value) => includesSearchTerm(value, term));
};

export const smartSearchFlatNodes = (nodes: FlatBookmarkNode[], query: string, checks: Record<string, DeadLinkResult> = {}, limit = 150) => {
  const rawTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (rawTerms.length === 0) return [];

  const operators = rawTerms.flatMap((term) => {
    const index = term.indexOf(":");
    return index > 0 ? [{ key: term.slice(0, index), value: term.slice(index + 1) }] : [];
  });
  const lastPlainTerm = [...rawTerms].reverse().find((term) => !term.includes(":"));
  const plainTerms = rawTerms
    .filter((term) => !term.includes(":"))
    .map((term) => ({ value: term, requireEndBoundary: /\s$/.test(query) && term === lastPlainTerm }));
  const tagTerms = operators.filter((operator) => operator.key === "tag" || operator.key === "tags").map((operator) => operator.value);

  return nodes
    .filter((node) => !node.isDeleted && node.parentId)
    .filter((node) => operators.every((operator) => {
      if (operator.key === "site" || operator.key === "domain") return hostMatches(node.url, operator.value);
      if (operator.key === "folder" || operator.key === "path") return node.path.toLowerCase().includes(operator.value);
      if (operator.key === "url") return (node.url ?? "").toLowerCase().includes(operator.value);
      if (operator.key === "title" || operator.key === "name") return node.title.toLowerCase().includes(operator.value);
      if (operator.key === "tag" || operator.key === "tags") return node.tags.some((tag) => tag.includes(operator.value));
      if (operator.key === "is") return isStatusMatch(node, checks, operator.value);
      return searchableText(node).includes(`${operator.key}:${operator.value}`);
    }))
    .filter((node) => plainTerms.every((term) => matchesPlainTerm(node, term)))
    .map((node) => ({ node, score: scoreNode(node, plainTerms, tagTerms) }))
    .sort((a, b) => b.score - a.score || a.node.title.localeCompare(b.node.title))
    .map(({ node }) => node)
    .slice(0, limit);
};

export const smartSearchNodes = (roots: BookmarkNode[], query: string, checks: Record<string, DeadLinkResult>, tagMap: TagMap = {}) => {
  return smartSearchFlatNodes(flattenBookmarks(roots, tagMap), query, checks, 150);
};
