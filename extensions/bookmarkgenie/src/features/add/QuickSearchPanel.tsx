import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { FlatBookmarkNode } from "../../types";
import { smartSearchFlatNodes } from "../search/smartSearch";

type QuickSearchPanelProps = {
  bookmarks: FlatBookmarkNode[];
  onOpen: (url: string) => void;
  onOpenFull: (query: string) => void;
};

const searchHighlightTerms = (query: string) => query
  .toLowerCase()
  .split(/\s+/)
  .filter(Boolean)
  .map((term) => {
    const index = term.indexOf(":");
    return index > 0 ? term.slice(index + 1) : term;
  })
  .filter(Boolean)
  .sort((a, b) => b.length - a.length);

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlightText = (value: string | undefined, terms: string[]) => {
  if (!value || terms.length === 0) return value ?? "";
  const pattern = new RegExp(`(${terms.map(escapeRegex).join("|")})`, "ig");
  const parts = value.split(pattern).filter(Boolean);
  return parts.map((part, index): ReactNode => terms.some((term) => part.toLowerCase() === term) ? <mark key={`${part}-${index}`}>{part}</mark> : part);
};

export const QuickSearchPanel = ({ bookmarks, onOpen, onOpenFull }: QuickSearchPanelProps) => {
  const [query, setQuery] = useState("");
  const [popupSize, setPopupSize] = useState({ width: 620, height: 680 });
  const [activeIndex, setActiveIndex] = useState(0);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const results = smartSearchFlatNodes(bookmarks, query, {}, 25).filter((bookmark) => bookmark.url);
  const highlightTerms = searchHighlightTerms(query);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.windows?.getCurrent) return;
    chrome.windows.getCurrent((browserWindow) => {
      const width = Math.max(520, Math.round((browserWindow.width ?? 2600) * 0.2));
      const height = Math.max(620, Math.round((browserWindow.height ?? 760) * 0.9));
      setPopupSize({ width, height });
    });
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, results.length - 1)));
  }, [results.length]);

  useEffect(() => {
    resultRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const openActiveResult = () => {
    const url = results[activeIndex]?.url;
    if (url) onOpen(url);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (results.length === 0) return;
      setActiveIndex((current) => Math.min(results.length - 1, current + 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length === 0) return;
      setActiveIndex((current) => Math.max(0, current - 1));
    }
    if (event.key === "Enter" && results.length > 0) {
      event.preventDefault();
      openActiveResult();
    }
  };

  const style = {
    "--quick-popup-width": `${popupSize.width}px`,
    "--quick-popup-height": `${popupSize.height}px`
  } as CSSProperties;

  return (
    <section className="quick-card quick-search-card" style={style} onKeyDown={handleKeyDown}>
      <div className="quick-search-top">
        <div className="quick-search-brand">
          <img src="/logo.png" alt="Bookmark Wizard" />
          <button onClick={() => onOpenFull(query)}>Open full view</button>
        </div>
        <div className="quick-search-input-area">
          <h1>Bookmark Wizard Search</h1>
          <input autoFocus value={query} placeholder="Search title, URL, path or tag:vpn..." onChange={(event) => setQuery(event.target.value)} />
        </div>
      </div>
      <div className="quick-results">
        {results.map((bookmark, index) => (
          <button
            key={bookmark.id}
            ref={(element) => { resultRefs.current[index] = element; }}
            className={index === activeIndex ? "active" : ""}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => bookmark.url && onOpen(bookmark.url)}
          >
            <strong>{highlightText(bookmark.title, highlightTerms)}</strong>
            {bookmark.tags.length > 0 ? <span>{bookmark.tags.map((tag) => <span key={tag} className="quick-tag">#{highlightText(tag, highlightTerms)} </span>)}</span> : null}
            <span>{highlightText(bookmark.url, highlightTerms)}</span>
            <span>{highlightText(bookmark.path, highlightTerms)}</span>
          </button>
        ))}
      </div>
    </section>
  );
};
