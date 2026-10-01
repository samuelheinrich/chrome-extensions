import { useState } from "react";
import type { BackupPayload, BookmarkNode } from "../../types";
import { createBackupPayload, downloadBackup, importBackupIntoFolder, parseBackupFile } from "./backup";
import { saveTagMap, type TagMap } from "../tags/tags";

type BackupPanelProps = {
  roots: BookmarkNode[];
  selectedFolderId: string;
  tagMap: TagMap;
  onTagsImported: (tags: TagMap) => void;
  onImported: () => void;
};

export const BackupPanel = ({ roots, selectedFolderId, tagMap, onTagsImported, onImported }: BackupPanelProps) => {
  const [payload, setPayload] = useState<BackupPayload>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  return (
      <section className="side-card">
        <h2>Backup</h2>
      <p>Export a local JSON backup before larger sorting, cleanup or rename actions.</p>
      <div className="backup-actions">
        <button onClick={() => downloadBackup(createBackupPayload(roots, tagMap))}>Export JSON</button>
        <label className="file-button">
          Import JSON
          <input
            type="file"
            accept="application/json"
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              setError(undefined);
              try {
                setPayload(await parseBackupFile(file));
              } catch (err) {
                setError(err instanceof Error ? err.message : "Import failed.");
              }
            }}
          />
        </label>
      </div>
      {payload ? (
        <div className="import-preview">
          <strong>Import ready</strong>
          <span>{payload.exportedAt}</span>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(undefined);
              try {
                const result = await importBackupIntoFolder(payload, selectedFolderId);
                if (Object.keys(result.importedTags).length > 0) {
                  await saveTagMap({ ...tagMap, ...result.importedTags });
                  onTagsImported(result.importedTags);
                }
                setPayload(undefined);
                onImported();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Import failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Importing..." : "Import into current folder"}
          </button>
        </div>
      ) : null}
      {error ? <p className="error-text">{error}</p> : null}
    </section>
  );
};
