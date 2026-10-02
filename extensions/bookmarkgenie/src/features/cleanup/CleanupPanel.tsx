import type { CleanupFinding, CleanupFindingType } from "../../types";

type CleanupPanelProps = {
  findings: CleanupFinding[];
  selectedFindingIds: Set<string>;
  onAnalyze: () => void;
  onToggleFinding: (id: string) => void;
  onToggleType: (type: CleanupFindingType) => void;
  onDeleteSelected: () => void;
  onDismissSelected: () => void;
  onClear: () => void;
};

const LABELS: Record<CleanupFindingType, string> = {
  deadlink: "Dead links",
  duplicate: "Duplicates",
  nonsense: "Nonsense"
};

const groupedFindings = (findings: CleanupFinding[]) =>
  (["deadlink", "duplicate", "nonsense"] as CleanupFindingType[]).map((type) => ({
    type,
    label: LABELS[type],
    findings: findings.filter((finding) => finding.type === type)
  }));

export const CleanupPanel = ({
  findings,
  selectedFindingIds,
  onAnalyze,
  onToggleFinding,
  onToggleType,
  onDeleteSelected,
  onDismissSelected,
  onClear
}: CleanupPanelProps) => {
  const selectedCount = findings.filter((finding) => selectedFindingIds.has(finding.id)).length;

  return (
    <section className="side-card cleanup-card">
      <div className="cleanup-header">
        <div>
          <h2>Cleanup</h2>
          <p>Finds dead links, duplicates and simple root-domain bookmarks.</p>
        </div>
        <button onClick={onAnalyze}>Run scan</button>
      </div>

      <div className="cleanup-summary">
        <span>Total: {findings.length}</span>
        <span>Selected: {selectedCount}</span>
      </div>

      {findings.length === 0 ? (
        <p className="empty-text">No cleanup results yet. Dead links are reused from existing deadlink checks.</p>
      ) : (
        <div className="cleanup-groups">
          {groupedFindings(findings).map((group) => {
            const selectedInGroup = group.findings.filter((finding) => selectedFindingIds.has(finding.id)).length;
            return (
              <section key={group.type} className="cleanup-group">
                <div className="cleanup-group-title">
                  <button disabled={group.findings.length === 0} onClick={() => onToggleType(group.type)}>
                    {selectedInGroup === group.findings.length && group.findings.length > 0 ? "Deselect" : "Select"}
                  </button>
                  <strong>{group.label}</strong>
                  <span>{group.findings.length}</span>
                </div>
                <div className="cleanup-findings">
                  {group.findings.map((finding) => (
                    <label key={finding.id} className={`cleanup-finding ${finding.severity}`}>
                      <input type="checkbox" checked={selectedFindingIds.has(finding.id)} onChange={() => onToggleFinding(finding.id)} />
                      <span className="cleanup-finding-main">
                        <strong>{finding.title}</strong>
                        <span>{finding.reason}</span>
                        <span>{finding.url}</span>
                        <span>{finding.path}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="cleanup-actions">
        <button className="danger" disabled={selectedCount === 0} onClick={onDeleteSelected}>Delete selected ({selectedCount})</button>
        <button disabled={selectedCount === 0} onClick={onDismissSelected}>Dismiss selected</button>
        <button disabled={findings.length === 0} onClick={onClear}>Clear results</button>
      </div>
    </section>
  );
};
