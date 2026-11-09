import type { ReactNode } from "react";
import { STATUS_META, type ApplicationStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "tape";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-3 text-ink-2",
  primary: "bg-primary-soft text-primary-ink",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  tape: "bg-tape-soft text-tape-soft-ink",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium leading-5 [&_svg]:size-3.5",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Status da candidatura: ponto colorido + rótulo (a cor nunca é a única informação). */
export function StatusBadge({ status, className }: { status: ApplicationStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-0.5 text-xs font-medium leading-5 text-ink",
        className,
      )}
    >
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{ backgroundColor: `var(--status-${status})` }}
      />
      {STATUS_META[status].label}
    </span>
  );
}
