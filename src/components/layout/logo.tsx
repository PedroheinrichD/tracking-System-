import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

/** Marca: ponta de fita métrica + nome em Plex Condensed. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect x="2" y="6" width="28" height="20" rx="4" fill="var(--tape)" />
      <rect x="2" y="22" width="28" height="4" rx="2" fill="var(--tape-edge)" />
      <g stroke="var(--tape-ink)" strokeWidth="1.6" strokeLinecap="round">
        <line x1="7" y1="6" x2="7" y2="16" />
        <line x1="11.5" y1="6" x2="11.5" y2="11" />
        <line x1="16" y1="6" x2="16" y2="16" />
        <line x1="20.5" y1="6" x2="20.5" y2="11" />
        <line x1="25" y1="6" x2="25" y2="16" />
      </g>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="leading-none">
        <span className="block font-display text-[19px] font-semibold tracking-tight text-ink">{APP_NAME}</span>
        <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">ATS pessoal</span>
      </span>
    </span>
  );
}
