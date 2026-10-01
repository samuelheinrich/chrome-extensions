import { useEffect, useState } from "react";

export type CommandItem = {
  id: string;
  title: string;
  subtitle?: string;
  keywords?: string;
  onRun: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  commands: CommandItem[];
  onClose: () => void;
};

export const CommandPalette = ({ open, commands, onClose }: CommandPaletteProps) => {
  const [query, setQuery] = useState("");
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results = terms.length === 0
    ? commands
    : commands.filter((command) => {
      const haystack = `${command.title} ${command.subtitle ?? ""} ${command.keywords ?? ""}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  if (!open) return null;

  const run = (command: CommandItem) => {
    command.onRun();
    onClose();
  };

  return (
    <div className="command-backdrop" onMouseDown={onClose}>
      <section className="command-palette" onMouseDown={(event) => event.stopPropagation()}>
        <input
          autoFocus
          value={query}
          placeholder="Type a command..."
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
            if (event.key === "Enter" && results[0]) run(results[0]);
          }}
        />
        <div className="command-results">
          {results.slice(0, 12).map((command) => (
            <button key={command.id} onClick={() => run(command)}>
              <strong>{command.title}</strong>
              {command.subtitle ? <span>{command.subtitle}</span> : null}
            </button>
          ))}
        </div>
        <div className="command-hint">Enter runs first result. Esc closes. Shortcut: Cmd/Ctrl+K.</div>
      </section>
    </div>
  );
};
