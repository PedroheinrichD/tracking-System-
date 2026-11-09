"use client";

import { X } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Lista de termos (competências, tecnologias). Enter, vírgula ou Tab adicionam;
 * colar uma lista separada por vírgulas adiciona todos de uma vez.
 */
export function TagInput({
  value,
  onChange,
  placeholder = "Digite e pressione Enter",
  label,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  label: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const items = raw
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!items.length) return;
    const existing = new Set(value.map((item) => item.toLowerCase()));
    const next = [...value];
    for (const item of items) {
      if (!existing.has(item.toLowerCase())) {
        next.push(item);
        existing.add(item.toLowerCase());
      }
    }
    onChange(next);
    setDraft("");
  }

  return (
    <div
      className={cn(
        "flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2 py-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25",
        disabled && "opacity-60",
      )}
    >
      {value.map((item, index) => (
        <span
          key={`${item}-${index}`}
          className="inline-flex items-center gap-1 rounded-md bg-surface-3 py-0.5 pl-2 pr-1 font-mono text-xs text-ink"
        >
          {item}
          {!disabled ? (
            <button
              type="button"
              onClick={() => onChange(value.filter((_, position) => position !== index))}
              className="rounded p-0.5 text-ink-3 hover:text-danger"
              aria-label={`Remover ${item}`}
            >
              <X className="size-3" />
            </button>
          ) : null}
        </span>
      ))}
      <input
        id={id}
        aria-label={label}
        disabled={disabled}
        value={draft}
        placeholder={value.length ? "" : placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            add(draft);
          } else if (event.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => add(draft)}
        onPaste={(event) => {
          const text = event.clipboardData.getData("text");
          if (/[,;\n]/.test(text)) {
            event.preventDefault();
            add(text);
          }
        }}
        className="h-7 min-w-32 flex-1 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-ink-3"
      />
    </div>
  );
}
