"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { STATUS_META, type ApplicationStatus } from "@/lib/constants";
import { ChartTable } from "./chart-table";

interface ScorePoint {
  id: number;
  title: string;
  company: string | null;
  score: number;
  status: ApplicationStatus;
}

const DOT = 12;
const ROW = 15;

/**
 * Onde cada vaga cai na fita de compatibilidade (0–100). Pontos empilham quando
 * as notas são próximas; a linha vertical marca a média.
 */
export function ScoreStrip({ points }: { points: ScorePoint[] }) {
  const [active, setActive] = useState<number | null>(null);

  const placed = useMemo(() => {
    const stacks = new Map<number, number>();
    return [...points]
      .sort((a, b) => a.score - b.score)
      .map((point) => {
        const bucket = Math.round(point.score / 3);
        const level = stacks.get(bucket) ?? 0;
        stacks.set(bucket, level + 1);
        return { ...point, level };
      });
  }, [points]);

  const levels = Math.max(1, ...placed.map((point) => point.level + 1));
  const height = levels * ROW + 10;
  const average = points.length ? Math.round(points.reduce((sum, point) => sum + point.score, 0) / points.length) : 0;
  const position = (score: number) => `calc(0.5rem + (100% - 1rem) * ${score / 100})`;

  return (
    <div>
      <div className="relative" style={{ height: height + 34 }}>
        {/* Escala (fita) */}
        <div className="absolute inset-x-0 bottom-0 h-7 rounded-[4px] bg-surface-3">
          <div
            aria-hidden
            className="absolute inset-y-0 left-2 right-2"
            style={{
              backgroundImage:
                "linear-gradient(to right, var(--ink-3) 0 1px, transparent 1px), linear-gradient(to right, var(--line-strong) 0 1px, transparent 1px)",
              backgroundSize: "10% 9px, 2% 5px",
              backgroundRepeat: "repeat-x",
            }}
          >
            {[0, 20, 40, 60, 80, 100].map((mark) => (
              <span
                key={mark}
                className="absolute bottom-1 -translate-x-1/2 font-mono text-[10px] tabular-nums text-ink-3"
                style={{ left: `${mark}%` }}
              >
                {mark}
              </span>
            ))}
          </div>
        </div>

        {/* Média */}
        {points.length ? (
          <div className="absolute bottom-7 top-0 w-px bg-ink-3" style={{ left: position(average) }} aria-hidden>
            <span className="absolute -top-0.5 left-1.5 whitespace-nowrap font-mono text-[10px] text-ink-2">média {average}</span>
          </div>
        ) : null}

        {/* Pontos */}
        {placed.map((point) => (
          <Link
            key={point.id}
            href={`/vagas/${point.id}`}
            prefetch={false}
            onMouseEnter={() => setActive(point.id)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(point.id)}
            onBlur={() => setActive(null)}
            aria-label={`${point.title}${point.company ? `, ${point.company}` : ""}: compatibilidade ${point.score}`}
            className="group absolute grid size-6 -translate-x-1/2 place-items-center rounded-full outline-none"
            style={{ left: position(point.score), bottom: 28 + 4 + point.level * ROW - 6 }}
          >
            <span
              aria-hidden
              className="block rounded-full bg-series-1 ring-2 ring-surface transition-transform group-hover:scale-125 group-focus-visible:scale-125"
              style={{ width: DOT, height: DOT }}
            />
            {active === point.id ? (
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full z-10 mb-1.5 w-max max-w-64 rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs shadow-raised"
              >
                <span className="block font-medium text-ink">{point.title}</span>
                {point.company ? <span className="block text-ink-3">{point.company}</span> : null}
                <span className="mt-1 block text-ink-2">
                  Compatibilidade <b className="font-medium tabular-nums text-ink">{point.score}</b> · {STATUS_META[point.status].label}
                </span>
              </span>
            ) : null}
          </Link>
        ))}
      </div>

      <ChartTable
        caption="Compatibilidade por vaga"
        columns={["Vaga", "Empresa", "Compatibilidade", "Status"]}
        rows={[...points]
          .sort((a, b) => b.score - a.score)
          .map((point) => [point.title, point.company ?? "—", point.score, STATUS_META[point.status].label])}
      />
    </div>
  );
}
