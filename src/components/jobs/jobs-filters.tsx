"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Input, Select } from "@/components/ui/field";
import { APPLICATION_STATUSES, STATUS_META, type ApplicationStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Filtros da lista de vagas, guardados na URL (dá para compartilhar e voltar com o navegador). */
export function JobsFilters({ counts, total }: { counts: Record<ApplicationStatus, number>; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const status = params.get("status");
  const sort = params.get("ordem") ?? "recentes";

  function update(next: Record<string, string | null>) {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    startTransition(() => router.replace(`${pathname}${query.size ? `?${query}` : ""}`, { scroll: false }));
  }

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (search === current) return;
    const timer = window.setTimeout(() => update({ q: search.trim() || null }), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className={cn("space-y-3 transition-opacity", pending && "opacity-70")}>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input
            type="search"
            aria-label="Buscar por cargo ou empresa"
            placeholder="Buscar por cargo ou empresa"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select aria-label="Ordenar" value={sort} onChange={(event) => update({ ordem: event.target.value })} className="w-48">
          <option value="recentes">Mais recentes</option>
          <option value="antigas">Mais antigas</option>
          <option value="compatibilidade">Maior compatibilidade</option>
        </Select>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por status">
        <button
          type="button"
          onClick={() => update({ status: null })}
          aria-pressed={!status}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[13px] transition-colors",
            !status ? "border-ink bg-ink text-canvas" : "border-line bg-surface text-ink-2 hover:text-ink",
          )}
        >
          Todas <span className="font-mono text-[11px] opacity-70">{total}</span>
        </button>
        {APPLICATION_STATUSES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => update({ status: status === option ? null : option })}
            aria-pressed={status === option}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[13px] transition-colors",
              status === option ? "border-ink bg-ink text-canvas" : "border-line bg-surface text-ink-2 hover:text-ink",
            )}
          >
            <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: `var(--status-${option})` }} />
            {STATUS_META[option].label}
            <span className="font-mono text-[11px] opacity-70">{counts[option]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
