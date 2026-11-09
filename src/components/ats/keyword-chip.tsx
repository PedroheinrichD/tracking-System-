import { Check, Plus } from "lucide-react";
import type { KeywordAssessment } from "@/lib/domain/job";
import { cn } from "@/lib/utils";

const PRIORITY_LABEL = { alta: "prioridade alta", media: "prioridade média", baixa: "prioridade baixa" } as const;

/**
 * Palavra-chave em fonte mono (é assim que um ATS "lê" os termos).
 * Encontrada: fundo petróleo suave; equivalente: "≈" e o termo encontrado;
 * ausente: borda tracejada (marca de giz: ainda não está no currículo).
 */
export function KeywordChip({ keyword }: { keyword: KeywordAssessment }) {
  const priorityDot = keyword.priority === "alta" ? "bg-ink" : keyword.priority === "media" ? "bg-ink-3" : "bg-line-strong";
  const title =
    keyword.status === "presente"
      ? `Presente no currículo · ${PRIORITY_LABEL[keyword.priority]}`
      : keyword.status === "equivalente"
        ? `Equivalente no currículo: “${keyword.matchedText}” · ${PRIORITY_LABEL[keyword.priority]}`
        : `Ausente no currículo · ${PRIORITY_LABEL[keyword.priority]}`;

  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[12px] leading-none",
        keyword.status === "presente" && "bg-primary-soft text-primary-ink",
        keyword.status === "equivalente" && "bg-primary-soft/60 text-primary-ink",
        keyword.status === "ausente" && "chalk-border text-ink-2",
      )}
    >
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", priorityDot)} />
      {keyword.status === "presente" ? <Check className="size-3 shrink-0" aria-hidden /> : null}
      {keyword.status === "equivalente" ? <span aria-hidden>≈</span> : null}
      <span className="truncate">{keyword.term}</span>
      <span className="sr-only">
        ({keyword.status === "ausente" ? "ausente" : keyword.status}, {PRIORITY_LABEL[keyword.priority]})
      </span>
    </span>
  );
}

/** Palavra-chave que passou a constar no currículo personalizado (marca-texto). */
export function AddedKeywordChip({ term }: { term: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-tape-soft px-2 py-1 font-mono text-[12px] leading-none text-tape-soft-ink">
      <Plus className="size-3" aria-hidden />
      {term}
    </span>
  );
}
