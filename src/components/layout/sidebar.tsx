"use client";

import { BriefcaseBusiness, FileUser, Gauge, Menu, ScanSearch, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/", label: "Painel", icon: Gauge },
  { href: "/nova-analise", label: "Nova análise", icon: ScanSearch },
  { href: "/vagas", label: "Minhas vagas", icon: BriefcaseBusiness },
  { href: "/curriculo", label: "Meu currículo", icon: FileUser },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Navegação principal" className="space-y-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
              active ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-ink-2 hover:bg-surface-3 hover:text-ink",
            )}
          >
            {active ? <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-tape" /> : null}
            <Icon className={cn("size-[18px]", active ? "text-primary" : "text-ink-3 group-hover:text-ink-2")} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Lê a rota atual (dado de tempo de execução) para destacar o item ativo; fica dentro de <Suspense>. */
function ActiveNavLinks({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  return <NavLinks pathname={pathname} onNavigate={onNavigate} />;
}

/** Sidebar fixa no desktop; no celular vira barra superior + painel deslizante. */
export function Sidebar({ userSlot }: { userSlot: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-canvas/90 px-4 backdrop-blur lg:hidden">
        <Link href="/" aria-label="Ir para o painel">
          <Logo />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid size-10 place-items-center rounded-lg text-ink-2 hover:bg-surface-3"
          aria-label="Abrir menu"
          aria-expanded={open}
          aria-controls="app-sidebar"
        >
          <Menu className="size-5" />
        </button>
      </header>

      {open ? (
        <div className="fixed inset-0 z-40 bg-black/35 lg:hidden" onClick={() => setOpen(false)} aria-hidden />
      ) : null}

      <aside
        id="app-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-line bg-canvas px-4 pb-4 pt-5 transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-auto lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-8 flex items-center justify-between px-1">
          <Link href="/" aria-label="Ir para o painel" onClick={() => setOpen(false)}>
            <Logo />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-surface-3 lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <Suspense fallback={<NavLinks pathname="" />}>
          <ActiveNavLinks onNavigate={() => setOpen(false)} />
        </Suspense>

        <div className="mt-auto space-y-3 border-t border-line pt-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-ink-3">Tema</span>
            <ThemeToggle />
          </div>
          {userSlot}
        </div>
      </aside>
    </>
  );
}
