import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "chalk-border flex flex-col items-center rounded-xl bg-surface-2 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="mb-4 grid size-11 place-items-center rounded-lg border border-line bg-surface text-ink-2">
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-1.5 max-w-md text-sm text-ink-2">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
