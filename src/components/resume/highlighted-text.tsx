import { Fragment } from "react";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Marca no texto as ocorrências dos termos (palavras-chave da vaga), como um
 * marca-texto. A busca ignora caixa e respeita limites de palavra.
 */
export function HighlightedText({ text, terms }: { text: string; terms?: string[] }) {
  const usable = (terms ?? []).map((term) => term.trim()).filter((term) => term.length > 1);
  if (!usable.length || !text) return <>{text}</>;

  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(${usable.sort((a, b) => b.length - a.length).map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}])`,
    "giu",
  );
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark key={index} className="rounded-[3px] bg-tape-soft px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}
