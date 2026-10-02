import { useEffect, useRef, useState, type FormEvent } from "react";

type BookmarkInlineEditProps = {
  title: string;
  url: string;
  initialField: "title" | "url";
  onSave: (title: string, url: string) => Promise<void>;
  onCancel: () => void;
};

export const BookmarkInlineEdit = ({ title, url, initialField, onSave, onCancel }: BookmarkInlineEditProps) => {
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftUrl, setDraftUrl] = useState(url);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const titleRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  const changed = draftTitle !== title || draftUrl !== url;

  useEffect(() => {
    const input = initialField === "url" ? urlRef.current : titleRef.current;
    input?.focus();
    input?.select();
  }, [initialField]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current || !changed) return;
    const nextUrl = draftUrl.trim();
    try {
      new URL(nextUrl);
    } catch {
      setError("Enter a valid URL including its scheme, e.g. https://example.com.");
      urlRef.current?.focus();
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(undefined);
    try {
      await onSave(draftTitle.trim(), nextUrl);
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save bookmark.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <form
      className="bookmark-inline-edit"
      aria-label="Edit bookmark"
      onSubmit={(event) => void save(event)}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          if (!savingRef.current) onCancel();
        }
      }}
    >
      <label>
        <span>Name</span>
        <input ref={titleRef} value={draftTitle} disabled={saving} onChange={(event) => { setDraftTitle(event.target.value); setError(undefined); }} />
      </label>
      <label>
        <span>URL</span>
        <input ref={urlRef} value={draftUrl} disabled={saving} spellCheck={false} onChange={(event) => { setDraftUrl(event.target.value); setError(undefined); }} />
      </label>
      <span className="inline-edit-actions">
        {changed ? <button className="inline-save" type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button> : null}
        <button type="button" disabled={saving} onClick={onCancel}>Cancel</button>
      </span>
      {error ? <span className="inline-edit-error" role="alert">{error}</span> : null}
    </form>
  );
};
