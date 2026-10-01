import type { SortScope, SortSuggestion } from "../../types";

type SuggestionPanelProps = {
  suggestions: SortSuggestion[];
  selectedFolderTitle: string;
  scope: SortScope;
  analyzedCount: number;
  selectedSuggestionIds: Set<string>;
  previewId?: string;
  itemSelections: Record<string, Set<string>>;
  targetFolderNames: Record<string, string>;
  backupBeforeApply: boolean;
  applying: boolean;
  onScopeChange: (scope: SortScope) => void;
  onAnalyze: () => void;
  onToggleSuggestion: (id: string) => void;
  onPreview: (id: string) => void;
  onTogglePreviewItem: (suggestionId: string, itemId: string) => void;
  onTargetFolderNameChange: (suggestionId: string, value: string) => void;
  onBackupBeforeApplyChange: (value: boolean) => void;
  onApplySuggestion: (suggestion: SortSuggestion) => void;
  onApplySelected: () => void;
};

export const SuggestionPanel = ({
  suggestions,
  selectedFolderTitle,
  scope,
  analyzedCount,
  selectedSuggestionIds,
  previewId,
  itemSelections,
  targetFolderNames,
  backupBeforeApply,
  applying,
  onScopeChange,
  onAnalyze,
  onToggleSuggestion,
  onPreview,
  onTogglePreviewItem,
  onTargetFolderNameChange,
  onBackupBeforeApplyChange,
  onApplySuggestion,
  onApplySelected
}: SuggestionPanelProps) => {
  const preview = suggestions.find((suggestion) => suggestion.id === previewId) ?? suggestions[0];
  const selectedMoveCount = suggestions
    .filter((suggestion) => selectedSuggestionIds.has(suggestion.id))
    .reduce((count, suggestion) => count + (itemSelections[suggestion.id]?.size ?? 0), 0);

  return (
    <section className="side-card sort-workflow-card">
      <div className="sort-header">
        <div>
          <h2>Sort</h2>
          <p>Target base: "{selectedFolderTitle}"</p>
        </div>
      </div>

      <div className="sort-controls">
        <label>
          Scope
          <select value={scope} onChange={(event) => onScopeChange(event.target.value as SortScope)}>
            <option value="current">Current folder</option>
            <option value="selected">Selected</option>
            <option value="search">Search results</option>
            <option value="all">All bookmarks</option>
          </select>
        </label>
        <button onClick={onAnalyze}>Analyze</button>
      </div>

      <div className="sort-summary">
        <span>{analyzedCount} analyzed</span>
        <span>{suggestions.length} suggestions</span>
        <span>{selectedMoveCount} selected moves</span>
      </div>

      {suggestions.length === 0 ? (
        <p className="empty-text">Run an analysis first. Then select, preview and apply suggestions.</p>
      ) : (
        <div className="sort-suggestion-list">
          {suggestions.map((suggestion) => (
            <article key={suggestion.id} className={`sort-suggestion-row ${preview?.id === suggestion.id ? "active" : ""}`}>
              <label>
                <input type="checkbox" checked={selectedSuggestionIds.has(suggestion.id)} onChange={() => onToggleSuggestion(suggestion.id)} />
              </label>
              <button className="sort-suggestion-main" onClick={() => onPreview(suggestion.id)} title={suggestion.reason}>
                <strong>{suggestion.label}</strong>
                <span>{suggestion.type} / {suggestion.confidence} / {suggestion.bookmarkIds.length}</span>
              </button>
            </article>
          ))}
        </div>
      )}

      {preview ? (
        <div className="sort-preview">
          <div className="sort-preview-title">
            <strong>Preview: {preview.label}</strong>
            <span>{itemSelections[preview.id]?.size ?? 0}/{preview.items.length}</span>
          </div>
          <label className="target-folder-input">
            Target folder
            <input
              value={targetFolderNames[preview.id] ?? preview.folderName}
              onChange={(event) => onTargetFolderNameChange(preview.id, event.target.value)}
            />
          </label>
          <div className="sort-preview-table">
            {preview.items.map((item) => (
              <label key={item.id} className="sort-preview-row">
                <input
                  type="checkbox"
                  checked={itemSelections[preview.id]?.has(item.id) ?? false}
                  onChange={() => onTogglePreviewItem(preview.id, item.id)}
                />
                <span className="sort-preview-name">{item.title}</span>
                <span className="sort-preview-url">{item.url}</span>
                <span className="sort-preview-path">{item.path}</span>
              </label>
            ))}
          </div>
          <button disabled={applying || (itemSelections[preview.id]?.size ?? 0) === 0} onClick={() => onApplySuggestion(preview)}>
            {applying ? "Applying..." : "Apply preview"}
          </button>
        </div>
      ) : null}

      <div className="sort-apply-bar">
        <label className="check-option">
          <input type="checkbox" checked={backupBeforeApply} onChange={(event) => onBackupBeforeApplyChange(event.target.checked)} />
          Backup before apply
        </label>
        <button disabled={applying || selectedSuggestionIds.size === 0 || selectedMoveCount === 0} onClick={onApplySelected}>
          {applying ? "Applying..." : "Apply selected"}
        </button>
      </div>
    </section>
  );
};
