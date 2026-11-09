"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    // Recarga completa (recomendada pelo Next para logout): limpa o estado do cliente preservado entre navegações.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className="grid size-8 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-50"
      aria-label="Sair"
      title="Sair"
    >
      <LogOut className="size-4" />
    </button>
  );
}
