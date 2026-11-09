import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? <div className="text-[13px] text-ink-3">{eyebrow}</div> : null}
        <h1 className="font-display text-[28px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-[32px]">
          {title}
        </h1>
        {description ? <p className="max-w-2xl text-[15px] leading-relaxed text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
