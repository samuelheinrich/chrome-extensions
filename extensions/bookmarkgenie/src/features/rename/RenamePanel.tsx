import type { RenameScope, RenameSuggestion } from "../../types";

type RenamePanelProps = {
  scope: RenameScope;
  suggestions: RenameSuggestion[];
  selectedIds: Set<string>;
  editedTitles: Record<string, string>;
  variantIndexes: Record<string, number>;
  backupBeforeApply: boolean;
  applying: boolean;
  analyzedCount: number;
  onScopeChange: (scope: RenameScope) => void;
  onAnalyze: () => void;
  onToggleSuggestion: (id: string) => void;
  onToggleAll: () => void;
  onVariantChange: (id: string, index: number) => void;
  onTitleChange: (id: string, title: string) => void;
  onBackupBeforeApplyChange: (value: boolean) => void;
  onApplySelected: () => void;
  onClear: () => void;
};

export const RenamePanel = ({
  scope,
  suggestions,
  selectedIds,
  editedTitles,
  variantIndexes,
  backupBeforeApply,
  applying,
  analyzedCount,
  onScopeChange,
  onAnalyze,
  onToggleSuggestion,
  onToggleAll,
  onVariantChange,
  onTitleChange,
  onBackupBeforeApplyChange,
  onApplySelected,
  onClear
}: RenamePanelProps) => {
  const allSelected = suggestions.length > 0 && suggestions.every((suggestion) => selectedIds.has(suggestion.id));

  return (
    <section className="side-card rename-card">
      <div className="rename-header">
        <div>
          <h2>Auto Renamer</h2>
          <p>Creates consistent names from domains, paths and URL slugs.</p>
        </div>
      </div>

      <div className="rename-controls">
        <label>
          Scope
          <select value={scope} onChange={(event) => onScopeChange(event.target.value as RenameScope)}>
            <option value="selected">Selected</option>
            <option value="folder">Current folder</option>
            <option value="folder-recursive">Current folder recursive</option>
            <option value="all">All bookmarks</option>
          </select>
        </label>
        <button onClick={onAnalyze}>Analyze names</button>
      </div>

      <div className="rename-summary">
        <span>{analyzedCount} analyzed</span>
        <span>{suggestions.length} suggestions</span>
        <span>{selectedIds.size} selected</span>
      </div>

      <div className="rename-toolbar">
        <button disabled={suggestions.length === 0} onClick={onToggleAll}>{allSelected ? "Deselect all" : "Select all"}</button>
        <button disabled={suggestions.length === 0} onClick={onClear}>Clear</button>
      </div>

      {suggestions.length === 0 ? (
        <p className="empty-text">No suggestions yet. Choose a scope and start an analysis.</p>
      ) : (
        <div className="rename-suggestions">
          {suggestions.map((suggestion) => (
            <article key={suggestion.id} className={`rename-suggestion ${suggestion.confidence.toLowerCase()}`}>
              <label className="rename-select">
                <input type="checkbox" checked={selectedIds.has(suggestion.id)} onChange={() => onToggleSuggestion(suggestion.id)} />
              </label>
              <div className="rename-main">
                <span className="rename-current">Current: {suggestion.currentTitle}</span>
                <input
                  value={editedTitles[suggestion.id] ?? suggestion.suggestedTitle}
                  onChange={(event) => onTitleChange(suggestion.id, event.target.value)}
                />
                {suggestion.variants.length > 1 ? (
                  <label className="rename-variant-slider">
                    <span>Variant {((variantIndexes[suggestion.id] ?? 0) + 1)} / {suggestion.variants.length}</span>
                    <input
                      type="range"
                      min="0"
                      max={suggestion.variants.length - 1}
                      step="1"
                      value={variantIndexes[suggestion.id] ?? 0}
                      onChange={(event) => onVariantChange(suggestion.id, Number(event.target.value))}
                    />
                  </label>
                ) : null}
                <span className="rename-url">{suggestion.url}</span>
                <span className="rename-path">{suggestion.path}</span>
                <span className="rename-reason">{suggestion.confidence}: {suggestion.reason}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="rename-apply-bar">
        <label className="check-option">
          <input type="checkbox" checked={backupBeforeApply} onChange={(event) => onBackupBeforeApplyChange(event.target.checked)} />
          Backup before apply
        </label>
        <button disabled={applying || selectedIds.size === 0} onClick={onApplySelected}>
          {applying ? "Applying..." : "Apply selected"}
        </button>
      </div>
    </section>
  );
};
