"use client";

import { FileText, ImageIcon, UploadCloud, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { cn, formatBytes } from "@/lib/utils";

export interface DropzoneProps {
  accept: string[];
  multiple?: boolean;
  maxFiles?: number;
  maxBytes: number;
  files: File[];
  onFilesChange: (files: File[]) => void;
  title: string;
  hint: string;
  disabled?: boolean;
  compact?: boolean;
}

function matchesAccept(file: File, accept: string[]): boolean {
  const name = file.name.toLowerCase();
  return accept.some((type) =>
    type.startsWith(".") ? name.endsWith(type) : file.type === type || (type.endsWith("/*") && file.type.startsWith(type.slice(0, -1))),
  );
}

/** Área de upload com arrastar-e-soltar, validação imediata e lista dos arquivos escolhidos. */
export function Dropzone({
  accept,
  multiple = false,
  maxFiles = 1,
  maxBytes,
  files,
  onFilesChange,
  title,
  hint,
  disabled,
  compact,
}: DropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addFiles(incoming: FileList | File[]) {
    setError(null);
    const list = Array.from(incoming);
    const accepted: File[] = [];
    for (const file of list) {
      if (!matchesAccept(file, accept)) {
        setError(`“${file.name}” não é um formato aceito.`);
        continue;
      }
      if (file.size > maxBytes) {
        setError(`“${file.name}” passa do limite de ${formatBytes(maxBytes)}.`);
        continue;
      }
      accepted.push(file);
    }
    const next = multiple ? [...files, ...accepted] : accepted.slice(0, 1);
    if (next.length > maxFiles) setError(`Envie no máximo ${maxFiles} arquivo(s).`);
    onFilesChange(next.slice(0, maxFiles));
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) addFiles(event.dataTransfer.files);
        }}
        className={cn(
          "chalk-border flex cursor-pointer flex-col items-center justify-center rounded-xl bg-surface-2 text-center transition-colors",
          compact ? "gap-1.5 px-4 py-5" : "gap-2 px-6 py-9",
          dragging && "border-primary bg-primary-soft",
          disabled && "cursor-not-allowed opacity-60",
          "focus-within:border-primary hover:border-ink-3",
        )}
      >
        <UploadCloud className={cn("text-ink-3", compact ? "size-5" : "size-7")} aria-hidden />
        <span className="text-sm font-medium text-ink">{title}</span>
        <span className="text-xs text-ink-3">{hint}</span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="sr-only"
          accept={accept.join(",")}
          multiple={multiple}
          disabled={disabled}
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>

      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {files.length ? (
        <ul className="space-y-1.5">
          {files.map((file, index) => {
            const Icon = file.type.startsWith("image/") ? ImageIcon : FileText;
            return (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              >
                <Icon className="size-4 shrink-0 text-ink-3" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <span className="font-mono text-xs text-ink-3">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onFilesChange(files.filter((_, position) => position !== index))}
                  className="rounded p-0.5 text-ink-3 hover:text-danger"
                  aria-label={`Remover ${file.name}`}
                >
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
