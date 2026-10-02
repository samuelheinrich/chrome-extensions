import type { DeadLinkFilter, DeadLinkResult, FlatBookmarkNode } from "../../types";

type DeadLinkPanelProps = {
  bookmarks: FlatBookmarkNode[];
  selectedCount: number;
  folderCount: number;
  checks: Record<string, DeadLinkResult>;
  filter: DeadLinkFilter;
  runningCount: number;
  permissionGranted: boolean;
  skipPrivateHosts: boolean;
  customTimeoutEnabled: boolean;
  timeoutSeconds: number;
  delete404Count: number;
  deleteTimeoutCount: number;
  onSkipPrivateHostsChange: (value: boolean) => void;
  onCustomTimeoutEnabledChange: (value: boolean) => void;
  onTimeoutSecondsChange: (value: number) => void;
  onFilterChange: (value: DeadLinkFilter) => void;
  onClearFilter: () => void;
  onClearScans: () => void;
  onDelete404: () => void;
  onDeleteTimeouts: () => void;
  onEnableChecks: () => void;
  onCheckAll: () => void;
  onCheckSelected: () => void;
  onCheckFolder: () => void;
};

const countByStatus = (checks: Record<string, DeadLinkResult>, status: DeadLinkResult["status"]) =>
  Object.values(checks).filter((check) => check.status === status).length;

const count404 = (checks: Record<string, DeadLinkResult>) =>
  Object.values(checks).filter((check) => check.status === "dead" && check.httpStatus === 404).length;

export const DeadLinkPanel = ({
  bookmarks,
  selectedCount,
  folderCount,
  checks,
  filter,
  runningCount,
  permissionGranted,
  skipPrivateHosts,
  customTimeoutEnabled,
  timeoutSeconds,
  delete404Count,
  deleteTimeoutCount,
  onSkipPrivateHostsChange,
  onCustomTimeoutEnabledChange,
  onTimeoutSecondsChange,
  onFilterChange,
  onClearFilter,
  onClearScans,
  onDelete404,
  onDeleteTimeouts,
  onEnableChecks,
  onCheckAll,
  onCheckSelected,
  onCheckFolder
}: DeadLinkPanelProps) => (
  <section className="side-card deadlink-card">
    <h2>Deadlink Checker</h2>
    <p>Checks bookmark URLs directly from your browser. No bookmark data is sent to Bookmark Wizard servers.</p>

    {!permissionGranted ? (
      <div className="permission-callout">
        <strong>Permission required</strong>
        <p>Deadlink checks need access to http/https bookmark targets. The permission is requested only when you use this tool.</p>
        <button onClick={onEnableChecks}>Enable deadlink checks</button>
      </div>
    ) : null}

    <div className="deadlink-settings">
      <label className="check-option">
        <input type="checkbox" checked={skipPrivateHosts} onChange={(event) => onSkipPrivateHostsChange(event.target.checked)} />
        Skip private/local hosts
      </label>
      <label className="check-option timeout-option">
        <input type="checkbox" checked={customTimeoutEnabled} onChange={(event) => onCustomTimeoutEnabledChange(event.target.checked)} />
        Custom timeout
        <input
          className="timeout-input"
          type="number"
          min="1"
          max="60"
          disabled={!customTimeoutEnabled}
          value={timeoutSeconds}
          onChange={(event) => onTimeoutSecondsChange(Number(event.target.value))}
        />
        sec
      </label>
    </div>

    <div className="deadlink-actions">
      <button disabled={runningCount > 0 || selectedCount === 0} onClick={onCheckSelected}>Check selected ({selectedCount})</button>
      <button disabled={runningCount > 0 || folderCount === 0} onClick={onCheckFolder}>Check folder ({folderCount})</button>
      <button disabled={runningCount > 0} onClick={onCheckAll}>{runningCount > 0 ? `${runningCount} checks running...` : `Check all (${bookmarks.length})`}</button>
    </div>

    <div className="deadlink-filter-row">
      <select value={filter} onChange={(event) => onFilterChange(event.target.value as DeadLinkFilter)}>
        <option value="all">Filter: all</option>
        <option value="scanned">Scanned only</option>
        <option value="ok">OK</option>
        <option value="404">404</option>
        <option value="timeout">Timeout</option>
        <option value="error">Error</option>
      </select>
      <button onClick={onClearFilter}>Clear filter</button>
    </div>

    <div className="deadlink-stats">
      <span>OK: {countByStatus(checks, "ok")}</span>
      <span>404: {count404(checks)}</span>
      <span>Timeout: {countByStatus(checks, "timeout")}</span>
      <span>Error: {countByStatus(checks, "error")}</span>
      <span>Dead: {countByStatus(checks, "dead")}</span>
      <span>Skipped: {countByStatus(checks, "skipped")}</span>
    </div>

    <div className="deadlink-danger-zone">
      <button onClick={onClearScans}>Clear scanned results</button>
      <button className="danger" disabled={delete404Count === 0} onClick={onDelete404}>Delete scanned 404 ({delete404Count})</button>
      <button className="danger" disabled={deleteTimeoutCount === 0} onClick={onDeleteTimeouts}>Delete scanned timeouts ({deleteTimeoutCount})</button>
    </div>
  </section>
);
