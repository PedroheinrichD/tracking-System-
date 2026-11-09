"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChartTable } from "./chart-table";

interface Week {
  weekStart: string;
  analyzed: number;
  applied: number;
}

function niceMax(value: number): number {
  if (value <= 4) return 4;
  if (value <= 10) return Math.ceil(value / 2) * 2;
  if (value <= 50) return Math.ceil(value / 5) * 5;
  return Math.ceil(value / 10) * 10;
}

function weekLabel(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

const PLOT_HEIGHT = 168;

/**
 * Colunas agrupadas por semana: vagas analisadas × candidaturas enviadas.
 * Duas séries → legenda sempre visível; valores no tooltip (hover ou foco) e na tabela.
 */
export function WeeklyChart({ weeks }: { weeks: Week[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(1, ...weeks.flatMap((week) => [week.analyzed, week.applied])));
  const ticks = [0, max / 2, max];
  const empty = weeks.every((week) => week.analyzed === 0 && week.applied === 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-series-1" /> Vagas analisadas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-series-2" /> Candidaturas enviadas
        </span>
      </div>

      <div className="relative flex gap-2">
        {/* Eixo Y */}
        <div className="relative w-6 shrink-0" style={{ height: PLOT_HEIGHT }} aria-hidden>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2 font-mono text-[10px] tabular-nums text-ink-3"
              style={{ top: `${100 - (tick / max) * 100}%` }}
            >
              {tick}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: PLOT_HEIGHT }}>
            {ticks.map((tick) => (
              <span
                key={tick}
                aria-hidden
                className="absolute inset-x-0 h-px bg-line"
                style={{ top: `${100 - (tick / max) * 100}%` }}
              />
            ))}
            <div className="absolute inset-0 flex">
              {weeks.map((week, index) => (
                <div
                  key={week.weekStart}
                  tabIndex={0}
                  role="img"
                  aria-label={`Semana de ${weekLabel(week.weekStart)}: ${week.analyzed} vaga(s) analisada(s), ${week.applied} candidatura(s)`}
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  className="relative flex min-w-0 flex-1 items-end justify-center gap-0.5 outline-none focus-visible:bg-surface-3/60"
                >
                  {active === index ? <span aria-hidden className="absolute inset-0 rounded-md bg-surface-3/70" /> : null}
                  {[
                    { value: week.analyzed, color: "bg-series-1" },
                    { value: week.applied, color: "bg-series-2" },
                  ].map((bar, barIndex) => (
                    <span
                      key={barIndex}
                      aria-hidden
                      className={cn("relative w-[min(12px,32%)] rounded-t-[4px]", bar.color)}
                      style={{ height: bar.value ? `${(bar.value / max) * 100}%` : 0 }}
                    />
                  ))}
                  {active === index ? (
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full z-10 mb-2 w-max rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-raised"
                    >
                      <p className="mb-1 font-medium text-ink">Semana de {weekLabel(week.weekStart)}</p>
                      <p className="flex items-center gap-1.5 text-ink-2">
                        <span aria-hidden className="size-2 rounded-[2px] bg-series-1" />
                        Analisadas <b className="ml-auto pl-3 font-medium tabular-nums text-ink">{week.analyzed}</b>
                      </p>
                      <p className="flex items-center gap-1.5 text-ink-2">
                        <span aria-hidden className="size-2 rounded-[2px] bg-series-2" />
                        Candidaturas <b className="ml-auto pl-3 font-medium tabular-nums text-ink">{week.applied}</b>
                      </p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          {/* Colunas minmax(0,1fr): os rótulos podem transbordar a própria célula sem alargar o gráfico. */}
          <div
            className="mt-2 grid"
            style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
            aria-hidden
          >
            {weeks.map((week, index) => (
              <span
                key={week.weekStart}
                className={cn(
                  "justify-self-center whitespace-nowrap font-mono text-[10px] tabular-nums text-ink-3",
                  index % 2 === 1 && "max-sm:invisible",
                )}
              >
                {weekLabel(week.weekStart)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {empty ? <p className="mt-3 text-xs text-ink-3">Nenhuma atividade nas últimas 10 semanas.</p> : null}
      <ChartTable
        caption="Vagas analisadas e candidaturas por semana"
        columns={["Semana de", "Analisadas", "Candidaturas"]}
        rows={weeks.map((week) => [weekLabel(week.weekStart), week.analyzed, week.applied])}
      />
    </div>
  );
}
