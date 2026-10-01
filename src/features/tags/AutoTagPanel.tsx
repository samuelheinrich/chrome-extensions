import type { TagScope, TagSuggestion } from "../../types";

type AutoTagPanelProps = {
  scope: TagScope;
  suggestions: TagSuggestion[];
  selectedIds: Set<string>;
  editedTags: Record<string, string>;
  allTags: string[];
  analyzedCount: number;
  applying: boolean;
  onScopeChange: (scope: TagScope) => void;
  onAnalyze: () => void;
  onToggleSuggestion: (id: string) => void;
  onToggleAll: () => void;
  onTagsChange: (id: string, value: string) => void;
  onAddExistingTag: (id: string, tag: string) => void;
  onApplySelected: () => void;
  onClear: () => void;
};

export const AutoTagPanel = ({
  scope,
  suggestions,
  selectedIds,
  editedTags,
  allTags,
  analyzedCount,
  applying,
  onScopeChange,
  onAnalyze,
  onToggleSuggestion,
  onToggleAll,
  onTagsChange,
  onAddExistingTag,
  onApplySelected,
  onClear
}: AutoTagPanelProps) => {
  const allSelected = suggestions.length > 0 && suggestions.every((suggestion) => selectedIds.has(suggestion.id));

  return (
    <section className="side-card tag-card">
      <div className="tag-header">
        <div>
          <h2>Auto Tags</h2>
          <p>Add searchable keywords without changing bookmark names.</p>
        </div>
      </div>

      <div className="tag-controls">
        <label>
          Scope
          <select value={scope} onChange={(event) => onScopeChange(event.target.value as TagScope)}>
            <option value="selected">Selected</option>
            <option value="folder">Current folder</option>
            <option value="folder-recursive">Current folder recursive</option>
            <option value="search">Search results</option>
            <option value="all">All bookmarks</option>
          </select>
        </label>
        <button onClick={onAnalyze}>Analyze tags</button>
      </div>

      <div className="tag-summary">
        <span>{analyzedCount} analyzed</span>
        <span>{suggestions.length} suggestions</span>
        <span>{selectedIds.size} selected</span>
      </div>

      <div className="tag-toolbar">
        <button disabled={suggestions.length === 0} onClick={onToggleAll}>{allSelected ? "Deselect all" : "Select all"}</button>
        <button disabled={suggestions.length === 0} onClick={onClear}>Clear</button>
      </div>

      {suggestions.length === 0 ? (
        <p className="empty-text">No tag suggestions yet. Choose a scope and run an analysis.</p>
      ) : (
        <div className="tag-suggestions">
          {suggestions.map((suggestion) => (
            <article key={suggestion.id} className={`tag-suggestion ${suggestion.confidence.toLowerCase()}`}>
              <label className="tag-select">
                <input type="checkbox" checked={selectedIds.has(suggestion.id)} onChange={() => onToggleSuggestion(suggestion.id)} />
              </label>
              <div className="tag-main">
                <strong>{suggestion.title}</strong>
                <input
                  value={editedTags[suggestion.id] ?? [...suggestion.existingTags, ...suggestion.suggestedTags].join(", ")}
                  onChange={(event) => onTagsChange(suggestion.id, event.target.value)}
                />
                {allTags.length > 0 ? (
                  <select value="" onChange={(event) => {
                    if (event.target.value) onAddExistingTag(suggestion.id, event.target.value);
                  }}>
                    <option value="">Add existing tag...</option>
                    {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                  </select>
                ) : null}
                <span className="tag-url">{suggestion.url}</span>
                <span className="tag-path">{suggestion.path}</span>
                <span className="tag-reason">{suggestion.confidence}: {suggestion.reason}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="tag-apply-bar">
        <button disabled={applying || selectedIds.size === 0} onClick={onApplySelected}>
          {applying ? "Applying..." : "Apply selected"}
        </button>
      </div>
    </section>
  );
};
