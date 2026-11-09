import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "warning" | "danger";

const styles: Record<Tone, { box: string; icon: typeof Info }> = {
  info: { box: "border-line bg-surface-2 text-ink", icon: Info },
  success: { box: "border-success/25 bg-success-soft text-ink", icon: CheckCircle2 },
  warning: { box: "border-warning/30 bg-warning-soft text-ink", icon: AlertTriangle },
  danger: { box: "border-danger/30 bg-danger-soft text-ink", icon: OctagonAlert },
};

const iconColor: Record<Tone, string> = {
  info: "text-ink-2",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export function Notice({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon } = styles[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", box, className)}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", iconColor[tone])} aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="text-ink-2">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}
