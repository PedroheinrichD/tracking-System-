"use client";

import { Download, Eye, FileCheck2, PencilLine, RotateCcw, Sparkles, SplitSquareHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PipelineRunner } from "@/components/jobs/pipeline-runner";
import { ResumeEditor } from "@/components/resume/resume-editor";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { PIPELINE_DONE } from "@/lib/constants";
import type { ResumeData, TailoredResume } from "@/lib/domain/resume";
import type { TailoringReport } from "@/lib/domain/tailoring";
import { cn } from "@/lib/utils";
import { ComparisonView } from "./comparison-view";
import { ReportPanel } from "./report-panel";

type Tab = "comparacao" | "editar" | "previa";

const TABS: { key: Tab; label: string; icon: typeof Eye }[] = [
  { key: "comparacao", label: "Comparação", icon: SplitSquareHorizontal },
  { key: "editar", label: "Editar", icon: PencilLine },
  { key: "previa", label: "Pré-visualizar PDF", icon: Eye },
];

export function ReviewWorkspace({
  jobId,
  original,
  content,
  report: initialReport,
  keywordTerms,
  pdfFileName,
  pdfGeneratedLabel,
  aiConfigured,
}: {
  jobId: number;
  original: ResumeData;
  content: TailoredResume;
  report: TailoringReport;
  keywordTerms: string[];
  pdfFileName: string;
  pdfGeneratedLabel: string | null;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("comparacao");
  const [draft, setDraft] = useState<TailoredResume>(content);
  const [dirty, setDirty] = useState(false);
  const [report, setReport] = useState(initialReport);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [previewVersion, setPreviewVersion] = useState(0);
  const downloadRef = useRef<HTMLAnchorElement>(null);

  // Quando o servidor envia uma versão nova (restaurar/gerar de novo), substitui o rascunho se não houver edição pendente.
  const [lastContent, setLastContent] = useState(content);
  const [lastReport, setLastReport] = useState(initialReport);
  if (content !== lastContent) {
    setLastContent(content);
    if (!dirty) {
      setDraft(content);
      setEditorKey((key) => key + 1);
    }
  }
  if (initialReport !== lastReport) {
    setLastReport(initialReport);
    setReport(initialReport);
  }

  const highWarnings = report.warnings.filter((warning) => warning.severity === "alta");

  async function save(): Promise<boolean> {
    setSaving(true);
    try {
      const result = await apiFetch<{ report: TailoringReport }>(`/api/jobs/${jobId}/tailored`, {
        method: "PUT",
        body: JSON.stringify({ content: draft }),
      });
      setReport(result.report);
      setDirty(false);
      setPreviewVersion((version) => version + 1);
      router.refresh();
      return true;
    } catch (error) {
      toast(errorMessage(error), "danger");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function restore() {
    setRestoring(true);
    try {
      const result = await apiFetch<{ report: TailoringReport }>(`/api/jobs/${jobId}/tailored`, { method: "POST" });
      setReport(result.report);
      setDirty(false);
      setPreviewVersion((version) => version + 1);
      toast("Versão gerada pela IA restaurada.");
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), "danger");
    } finally {
      setRestoring(false);
    }
  }

  async function generatePdf() {
    if (dirty && !(await save())) return;
    setGenerating(true);
    try {
      const result = await apiFetch<{ fileName: string; downloadUrl: string }>(`/api/jobs/${jobId}/tailored/pdf`, {
        method: "POST",
      });
      if (downloadRef.current) {
        downloadRef.current.href = result.downloadUrl;
        downloadRef.current.download = result.fileName;
        downloadRef.current.click();
      }
      toast(`PDF gerado: ${result.fileName}`);
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), "danger");
    } finally {
      setGenerating(false);
    }
  }

  const generateButton = (
    <Button loading={generating || saving} onClick={highWarnings.length ? undefined : generatePdf}>
      <FileCheck2 /> Gerar PDF
    </Button>
  );

  return (
    <div className="space-y-6">
      <a ref={downloadRef} className="hidden" aria-hidden tabIndex={-1} />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2">
        <div role="tablist" aria-label="Modo de revisão" className="flex flex-1 flex-wrap gap-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                tab === key ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
              {key === "editar" && dirty ? <span className="size-1.5 rounded-full bg-tape-edge" aria-label="alterações não salvas" /> : null}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pdfGeneratedLabel ? (
            <a
              href={`/api/jobs/${jobId}/tailored/pdf/final`}
              className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink-2 hover:bg-surface-3 hover:text-ink"
              title={`Gerado em ${pdfGeneratedLabel}`}
            >
              <Download className="size-4" /> Último PDF
            </a>
          ) : null}
          {highWarnings.length ? (
            <ConfirmButton
              trigger={generateButton}
              title="Há alertas de fidelidade sem revisão"
              description={
                <>
                  {highWarnings.length} trecho(s) citam algo que não aparece no seu currículo original. Revise na aba
                  Editar antes de enviar o currículo a uma empresa. Gerar o PDF mesmo assim?
                </>
              }
              confirmLabel="Gerar mesmo assim"
              tone="primary"
              onConfirm={generatePdf}
            />
          ) : (
            generateButton
          )}
        </div>
      </div>

      {regenerating ? (
        <Card>
          <CardHeader title="Gerando nova versão" description="A versão atual continua salva no histórico do banco." />
          <CardBody>
            <PipelineRunner
              jobId={jobId}
              initialCompleted={PIPELINE_DONE}
              until={PIPELINE_DONE}
              rerunFrom="personalizacao"
              onFinished={() => {
                setRegenerating(false);
                setDirty(false);
                router.refresh();
              }}
            />
          </CardBody>
        </Card>
      ) : null}

      {tab === "comparacao" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader
              title="Original × personalizado"
              description="Trechos novos aparecem em marca-texto; removidos, riscados."
            />
            <CardBody>
              <ComparisonView original={original} tailored={draft} keywordTerms={keywordTerms} />
            </CardBody>
          </Card>
          <ReportPanel report={report} />
        </div>
      ) : null}

      {tab === "editar" ? (
        <div className="space-y-5">
          <Notice tone="info">
            Você é o autor final. Se acrescentar algo que não está no currículo original, o sistema vai alertar — atualize
            também o original se a informação for verdadeira.
          </Notice>
          <ResumeEditor
            key={editorKey}
            value={draft}
            mode="tailored"
            onChange={(next) => {
              setDraft(next);
              setDirty(true);
            }}
          />
          <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-line bg-surface/95 p-3 shadow-raised backdrop-blur">
            <ConfirmButton
              trigger={
                <Button variant="ghost" disabled={saving || restoring}>
                  <RotateCcw /> Restaurar versão da IA
                </Button>
              }
              title="Descartar suas edições?"
              description="O currículo volta ao texto gerado e verificado pela IA."
              confirmLabel="Restaurar"
              loading={restoring}
              onConfirm={restore}
            />
            <span className="mr-auto text-xs text-ink-3">{dirty ? "Alterações não salvas" : "Tudo salvo"}</span>
            <Button
              onClick={async () => {
                if (await save()) toast("Alterações salvas.");
              }}
              loading={saving}
              disabled={!dirty}
            >
              Salvar alterações
            </Button>
          </div>
        </div>
      ) : null}

      {tab === "previa" ? (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="font-mono text-xs text-ink-2">{pdfFileName}</p>
            {dirty ? <p className="text-xs text-warning">Salve as alterações para vê-las no PDF.</p> : null}
          </div>
          <iframe
            key={previewVersion}
            title="Pré-visualização do currículo personalizado"
            src={`/api/jobs/${jobId}/tailored/pdf?v=${previewVersion}`}
            className="h-[82vh] w-full bg-surface-2"
          />
        </Card>
      ) : null}

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" disabled={!aiConfigured || regenerating} onClick={() => setRegenerating(true)}>
          <Sparkles /> Gerar nova versão com a IA
        </Button>
      </div>
    </div>
  );
}
