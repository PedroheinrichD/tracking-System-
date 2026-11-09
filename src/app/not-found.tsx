import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="grid size-12 place-items-center rounded-xl border border-line bg-surface text-ink-2">
        <SearchX className="size-5" aria-hidden />
      </span>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Página não encontrada</h1>
      <p className="max-w-sm text-sm text-ink-2">O endereço não existe ou o item foi excluído.</p>
      <ButtonLink href="/">Voltar ao painel</ButtonLink>
    </div>
  );
}
