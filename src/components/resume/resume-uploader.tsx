"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/ui/dropzone";
import { Elapsed } from "@/components/ui/elapsed";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { LIMITS } from "@/lib/constants";

export function ResumeUploader({
  replacing = false,
  aiConfigured,
  onCancel,
  onDone,
}: {
  replacing?: boolean;
  aiConfigured: boolean;
  onCancel?: () => void;
  onDone?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    if (!files[0]) return;
    setError(null);
    setStartedAt(Date.now());
    const form = new FormData();
    form.append("file", files[0]);
    try {
      await apiFetch("/api/resume", { method: "POST", body: form });
      toast(replacing ? "Nova versão do currículo importada." : "Currículo importado. Revise os dados extraídos.");
      setFiles([]);
      onDone?.();
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setStartedAt(null);
    }
  }

  const busy = startedAt !== null;

  return (
    <div className="space-y-4">
      {!aiConfigured ? (
        <Notice tone="warning" title="IA não configurada">
          A leitura automática do PDF usa IA. Defina ANTHROPIC_API_KEY no arquivo .env.local e reinicie o servidor — ou
          preencha os dados manualmente.
        </Notice>
      ) : null}

      <Dropzone
        accept={["application/pdf", ".pdf"]}
        maxBytes={LIMITS.resumePdfBytes}
        files={files}
        onFilesChange={setFiles}
        disabled={busy}
        title={replacing ? "Arraste o novo PDF ou clique para escolher" : "Arraste seu currículo em PDF ou clique para escolher"}
        hint="PDF de até 5 MB e 10 páginas. PDFs escaneados também funcionam."
      />

      {replacing ? (
        <p className="text-xs text-ink-3">
          A versão atual fica guardada no histórico. Vagas já analisadas continuam ligadas à versão que usaram.
        </p>
      ) : null}

      {busy ? (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3">
          <div className="h-0.5 flex-1 stitch-running" aria-hidden />
          <span className="text-sm text-ink-2">Lendo o PDF e identificando as seções</span>
          <Elapsed since={startedAt} />
        </div>
      ) : null}

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="flex flex-wrap gap-2">
        <Button onClick={upload} disabled={!files.length || !aiConfigured} loading={busy}>
          {replacing ? "Importar nova versão" : "Importar currículo"}
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
