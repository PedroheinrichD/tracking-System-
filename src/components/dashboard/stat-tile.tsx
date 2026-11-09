import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Indicador: rótulo, valor (Sans, algarismos proporcionais) e uma linha de contexto. */
export function StatTile({
  label,
  value,
  unit,
  context,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  context?: ReactNode;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-2">{label}</p>
        <Icon className="size-4 text-ink-3" aria-hidden />
      </div>
      <p className="mt-3 text-[32px] font-semibold leading-none tracking-tight text-ink">
        {value}
        {unit ? <span className="ml-1 text-base font-medium text-ink-3">{unit}</span> : null}
      </p>
      {context ? <p className="mt-2 text-xs text-ink-3">{context}</p> : null}
    </div>
  );
}
