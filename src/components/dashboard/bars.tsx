import type { ReactNode } from "react";
import { APPLICATION_STATUSES, STATUS_META, type ApplicationStatus } from "@/lib/constants";
import { ChartTable } from "./chart-table";

/** Barras horizontais de uma série (uma só cor), valor na ponta da barra. */
function HorizontalBars({
  rows,
  caption,
  valueLabel,
}: {
  rows: { key: string; label: ReactNode; text: string; value: number; hint: string }[];
  caption: string;
  valueLabel: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div>
      <ul className="space-y-2.5">
        {rows.map((row) => (
          <li key={row.key} className="grid grid-cols-[minmax(0,148px)_minmax(0,1fr)] items-center gap-3" title={row.hint}>
            <span className="min-w-0 truncate text-[13px] text-ink-2">{row.label}</span>
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-3.5 rounded-r-[4px] bg-series-1"
                style={{ width: row.value ? `calc((100% - 2.5rem) * ${row.value / max})` : 0 }}
              />
              <span className="font-mono text-xs tabular-nums text-ink">{row.value}</span>
            </span>
          </li>
        ))}
      </ul>
      <ChartTable caption={caption} columns={["Item", valueLabel]} rows={rows.map((row) => [row.text, row.value])} />
    </div>
  );
}

export function StatusFunnel({ byStatus }: { byStatus: Record<ApplicationStatus, number> }) {
  return (
    <HorizontalBars
      caption="Vagas por status da candidatura"
      valueLabel="Vagas"
      rows={APPLICATION_STATUSES.map((status) => ({
        key: status,
        text: STATUS_META[status].label,
        hint: STATUS_META[status].hint,
        value: byStatus[status],
        label: (
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: `var(--status-${status})` }} />
            {STATUS_META[status].label}
          </span>
        ),
      }))}
    />
  );
}

export function TermBars({ items, caption, valueLabel }: { items: { term: string; count: number }[]; caption: string; valueLabel: string }) {
  return (
    <HorizontalBars
      caption={caption}
      valueLabel={valueLabel}
      rows={items.map((item) => ({
        key: item.term,
        text: item.term,
        hint: `${item.term}: ${item.count} vaga(s)`,
        value: item.count,
        label: <span className="font-mono text-xs text-ink">{item.term}</span>,
      }))}
    />
  );
}
