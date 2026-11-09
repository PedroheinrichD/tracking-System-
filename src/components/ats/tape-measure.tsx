import { clamp, cn } from "@/lib/utils";

export function scoreLabel(value: number): string {
  if (value >= 85) return "Muito alta";
  if (value >= 70) return "Alta";
  if (value >= 50) return "Moderada";
  return "Baixa";
}

const TICKS = {
  backgroundImage: [
    "linear-gradient(to right, var(--tape-ink) 0 1.5px, transparent 1.5px)",
    "linear-gradient(to right, var(--tape-ink) 0 1px, transparent 1px)",
    "linear-gradient(to right, var(--tape-ink) 0 1px, transparent 1px)",
  ].join(","),
  backgroundSize: "10% 15px, 5% 10px, 1% 6px",
  backgroundRepeat: "repeat-x",
} as const;

/**
 * Fita métrica de compatibilidade (0–100). Elemento de assinatura da interface:
 * a parte medida fica em amarelo de fita; o restante, esmaecido. `before`
 * marca a pontuação do currículo original quando há versão personalizada.
 */
export function TapeMeasure({
  value,
  before,
  label = "Compatibilidade estimada",
}: {
  value: number;
  before?: number | null;
  label?: string;
}) {
  const v = clamp(Math.round(value), 0, 100);
  const b = before === null || before === undefined ? null : clamp(Math.round(before), 0, 100);
  const inset = (percent: number) => `calc(0.75rem + (100% - 1.5rem) * ${percent / 100})`;

  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      aria-label={label}
      aria-valuetext={`${v} de 100${b !== null ? `; currículo original: ${b}` : ""}`}
      className="relative select-none pb-8 pt-12"
    >
      {/* Valor medido */}
      <div className="absolute top-0 -translate-x-1/2 transition-[left] duration-700 ease-out" style={{ left: inset(v) }}>
        <div className="relative rounded-md bg-ink px-2 py-1 text-canvas shadow-raised">
          <span className="font-mono text-lg font-semibold tabular-nums leading-none">{v}</span>
          <span className="ml-0.5 font-mono text-[11px] opacity-70">/100</span>
          <span aria-hidden className="absolute left-1/2 top-full -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent border-t-ink" />
        </div>
      </div>

      {/* Corpo da fita */}
      <div className="relative h-11 overflow-hidden rounded-[5px] bg-tape shadow-[inset_0_-4px_0_var(--tape-edge)]">
        <div className="absolute inset-y-0 left-3 right-3" style={TICKS}>
          <span aria-hidden className="absolute right-0 top-0 h-[15px] w-[1.5px] bg-tape-ink" />
          {Array.from({ length: 11 }, (_, index) => index * 10).map((mark) => (
            <span
              key={mark}
              aria-hidden
              className={cn(
                "absolute bottom-1.5 font-mono text-[10px] font-medium leading-none text-tape-ink",
                mark === 0 ? "translate-x-0.5" : mark === 100 ? "-translate-x-full" : "-translate-x-1/2",
                mark % 20 !== 0 && "max-sm:hidden",
              )}
              style={{ left: `${mark}%` }}
            >
              {mark}
            </span>
          ))}
        </div>
        {/* Trecho não medido, esmaecido */}
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 transition-[left] duration-700 ease-out"
          style={{ left: inset(v), background: "color-mix(in oklab, var(--surface) 64%, transparent)" }}
        />
        {/* Linha de leitura */}
        <span
          aria-hidden
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-tape-ink transition-[left] duration-700 ease-out"
          style={{ left: inset(v) }}
        />
      </div>

      {/* Marcador do currículo original */}
      {b !== null ? (
        <div className="absolute bottom-0 -translate-x-1/2 text-center" style={{ left: inset(b) }}>
          <span aria-hidden className="mx-auto block size-0 border-x-[5px] border-b-[7px] border-x-transparent border-b-ink-3" />
          <span className="mt-0.5 block whitespace-nowrap font-mono text-[10.5px] text-ink-3">original {b}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Versão compacta para listas e tabelas. */
export function TapeMini({ value, className }: { value: number | null; className?: string }) {
  if (value === null) return <span className="font-mono text-xs text-ink-3">—</span>;
  const v = clamp(Math.round(value), 0, 100);
  return (
    <span className={cn("inline-flex items-center gap-2", className)} title={`Compatibilidade estimada: ${v}/100`}>
      <span className="relative h-2 w-20 overflow-hidden rounded-[3px] bg-surface-3" aria-hidden>
        <span className="absolute inset-y-0 left-0 bg-tape" style={{ width: `${v}%` }} />
        <span
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: "linear-gradient(to right, var(--tape-ink) 0 1px, transparent 1px)",
            backgroundSize: "10% 100%",
          }}
        />
      </span>
      <span className="w-7 font-mono text-[13px] font-medium tabular-nums text-ink">{v}</span>
    </span>
  );
}
