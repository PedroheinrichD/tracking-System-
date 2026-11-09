"use client";

import { OctagonAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <span className="grid size-12 place-items-center rounded-xl bg-danger-soft text-danger">
        <OctagonAlert className="size-5" aria-hidden />
      </span>
      <h1 className="text-lg font-semibold text-ink">Não foi possível carregar esta página</h1>
      <p className="text-sm text-ink-2">
        Verifique se o banco de dados está em execução e tente novamente.
        {error.digest ? <span className="mt-1 block font-mono text-xs text-ink-3">código: {error.digest}</span> : null}
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
