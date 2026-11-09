import { diffWords } from "diff";

/**
 * Diferença palavra a palavra entre o texto original e o personalizado:
 * trechos novos em marca-texto, trechos removidos riscados.
 */
export function DiffText({ before, after }: { before: string; after: string }) {
  if (before === after) return <>{after}</>;
  if (!before.trim()) {
    return <mark className="rounded-[3px] bg-tape-soft px-0.5 text-inherit">{after}</mark>;
  }
  const changes = diffWords(before, after);
  return (
    <>
      {changes.map((change, index) => {
        if (change.added) {
          return (
            <mark key={index} className="rounded-[3px] bg-tape-soft px-0.5 text-inherit">
              {change.value}
            </mark>
          );
        }
        if (change.removed) {
          return (
            <del key={index} className="text-ink-3 decoration-danger/60">
              {change.value}
            </del>
          );
        }
        return <span key={index}>{change.value}</span>;
      })}
    </>
  );
}
