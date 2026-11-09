"use client";

import { CheckCircle2, OctagonAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "danger";
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<((message: string, tone?: ToastTone) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const show = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = nextId.current++;
      setItems((current) => [...current.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), tone === "danger" ? 7000 : 4000);
    },
    [dismiss],
  );
  const value = useMemo(() => show, [show]);

  return (
    <ToastContext value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:items-end"
      >
        {items.map((item) => {
          const Icon = item.tone === "success" ? CheckCircle2 : OctagonAlert;
          return (
            <div
              key={item.id}
              role={item.tone === "danger" ? "alert" : "status"}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink shadow-raised"
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", item.tone === "success" ? "text-success" : "text-danger")} aria-hidden />
              <p className="flex-1">{item.message}</p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="-mr-1 rounded p-0.5 text-ink-3 hover:text-ink"
                aria-label="Fechar aviso"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast precisa estar dentro de ToastProvider");
  return context;
}
