"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useLayoutEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { THEME_STORAGE_KEY, type ThemePreference } from "./theme-script";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "dark" || value === "system" ? value : "light";
  } catch {
    return "light";
  }
}

function apply(preference: ThemePreference) {
  const dark =
    preference === "dark" || (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Tema claro", icon: Sun },
  { value: "dark", label: "Tema escuro", icon: Moon },
  { value: "system", label: "Seguir o sistema", icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  // No servidor e na hidratação vale "light"; em seguida o React lê a preferência salva sem erro de hidratação.
  const preference = useSyncExternalStore(subscribe, readPreference, () => "light" as ThemePreference);

  // Reaplica após o remount do modo estrito em desenvolvimento e acompanha mudanças do sistema.
  useLayoutEffect(() => {
    apply(preference);
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => apply("system");
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [preference]);

  function choose(value: ThemePreference) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // armazenamento indisponível: o tema vale só para esta visita
    }
    apply(value);
    listeners.forEach((listener) => listener());
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className={cn("inline-flex rounded-lg border border-line bg-surface-2 p-0.5", className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={preference === value}
          aria-label={label}
          title={label}
          onClick={() => choose(value)}
          className={cn(
            "grid size-7 place-items-center rounded-md text-ink-3 transition-colors hover:text-ink",
            preference === value && "bg-surface text-ink shadow-sm",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}
