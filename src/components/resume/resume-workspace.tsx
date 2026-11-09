"use client";

import { Check, FileText, History, Minus, PencilLine, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { emptyResume, type ResumeData } from "@/lib/domain/resume";
import { cn, formatBytes } from "@/lib/utils";
import { ResumeEditor } from "./resume-editor";
import { ResumeUploader } from "./resume-uploader";
import { ResumeView } from "./resume-view";

export interface ResumeSummaryProps {
  id: number;
  version: number;
  sourceType: "pdf" | "manual";
  sourceFileName: string | null;
  sourceFileSize: number | null;
  data: ResumeData;
  warnings: string[];
  createdAtLabel: string;
}

export interface ResumeVersionProps {
  id: number;
  version: number;
  isActive: boolean;
  sourceType: "pdf" | "manual";
  sourceFileName: string | null;
  createdAtLabel: string;
  jobsCount: number;
}

/** O que foi identificado no currículo, na mesma lista de itens que o sistema promete extrair. */
function Identified({ data }: { data: ResumeData }) {
  const contact = [data.personal.email, data.personal.phone, data.personal.location].filter(Boolean).length;
  const technical = data.skills.databases.length + data.skills.tools.length + data.skills.otherTechnical.length;
  const items: { label: string; count: number | null; ok: boolean }[] = [
    { label: "Nome e contato", count: null, ok: Boolean(data.personal.fullName) && contact > 0 },
    { label: "Resumo profissional", count: null, ok: Boolean(data.summary.trim()) },
    { label: "Formação acadêmica", count: data.education.length, ok: data.education.length > 0 },
    { label: "Experiências profissionais", count: data.experiences.length, ok: data.experiences.length > 0 },
    { label: "Conhecimentos técnicos", count: technical, ok: technical > 0 },
    { label: "Linguagens de programação", count: data.skills.programmingLanguages.length, ok: data.skills.programmingLanguages.length > 0 },
    { label: "Frameworks", count: data.skills.frameworks.length, ok: data.skills.frameworks.length > 0 },
    { label: "Cursos e certificações", count: data.certifications.length, ok: data.certifications.length > 0 },
    { label: "Projetos pessoais", count: data.projects.length, ok: data.projects.length > 0 },
  ];
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2.5 text-sm">
          <span
            className={cn(
              "grid size-5 place-items-center rounded-full",
              item.ok ? "bg-success-soft text-success" : "bg-surface-3 text-ink-3",
            )}
            aria-hidden
          >
            {item.ok ? <Check className="size-3" /> : <Minus className="size-3" />}
          </span>
          <span className={cn("flex-1", item.ok ? "text-ink" : "text-ink-3")}>{item.label}</span>
          {item.count !== null ? <span className="font-mono text-xs text-ink-3">{item.count}</span> : null}
          <span className="sr-only">{item.ok ? "identificado" : "não encontrado"}</span>
        </li>
      ))}
    </ul>
  );
}

export function ResumeWorkspace({
  resume,
  versions,
  aiConfigured,
}: {
  resume: ResumeSummaryProps;
  versions: ResumeVersionProps[];
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"view" | "edit" | "replace" | "pdf">("view");
  const [draft, setDraft] = useState<ResumeData>(resume.data);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState<number | null>(null);

  async function save() {
    setSaving(true);
    try {
      await apiFetch(`/api/resume/${resume.id}`, { method: "PUT", body: JSON.stringify(draft) });
      toast("Alterações salvas no currículo original.");
      setMode("view");
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), "danger");
    } finally {
      setSaving(false);
    }
  }

  async function activate(id: number) {
    setActivating(id);
    try {
      await apiFetch(`/api/resume/${id}/activate`, { method: "POST" });
      toast("Versão restaurada como currículo em uso.");
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), "danger");
    } finally {
      setActivating(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">
        <Card>
          <div className="flex flex-wrap items-center gap-4 p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-ink-2">
              <FileText className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {resume.sourceFileName ?? "Preenchido manualmente"}
              </p>
              <p className="font-mono text-xs text-ink-3">
                Versão {resume.version} · {resume.createdAtLabel}
                {resume.sourceFileSize ? ` · ${formatBytes(resume.sourceFileSize)}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {resume.sourceType === "pdf" ? (
                <Button variant="secondary" size="sm" onClick={() => setMode(mode === "pdf" ? "view" : "pdf")}>
                  <FileText /> {mode === "pdf" ? "Ver dados extraídos" : "Ver PDF original"}
                </Button>
              ) : null}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setDraft(resume.data);
                  setMode("edit");
                }}
                disabled={mode === "edit"}
              >
                <PencilLine /> Editar dados
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setMode("replace")} disabled={mode === "replace"}>
                <RefreshCw /> Substituir currículo
              </Button>
            </div>
          </div>
        </Card>

        {resume.warnings.length && mode === "view" ? (
          <Notice tone="warning" title="Revise estes pontos da extração">
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {resume.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </Notice>
        ) : null}

        {mode === "replace" ? (
          <Card>
            <CardHeader
              title="Substituir currículo"
              description="Envie o PDF atualizado. Ele vira a nova fonte oficial para as próximas análises."
            />
            <CardBody>
              <ResumeUploader replacing aiConfigured={aiConfigured} onCancel={() => setMode("view")} onDone={() => setMode("view")} />
            </CardBody>
          </Card>
        ) : null}

        {mode === "pdf" ? (
          <Card className="overflow-hidden">
            <iframe
              title="PDF original do currículo"
              src={`/api/resume/${resume.id}/file`}
              className="h-[78vh] w-full bg-surface-2"
            />
          </Card>
        ) : null}

        {mode === "edit" ? (
          <div className="space-y-5">
            <ResumeEditor value={draft} onChange={setDraft} mode="base" />
            <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-line bg-surface/95 p-3 shadow-raised backdrop-blur">
              <p className="mr-auto text-xs text-ink-3">As personalizações já geradas não mudam; as próximas usarão estes dados.</p>
              <Button variant="ghost" onClick={() => setMode("view")} disabled={saving}>
                Descartar
              </Button>
              <Button onClick={save} loading={saving}>
                Salvar alterações
              </Button>
            </div>
          </div>
        ) : null}

        {mode === "view" || mode === "replace" ? (
          <Card>
            <CardBody className="sm:p-7">
              <ResumeView resume={resume.data} />
            </CardBody>
          </Card>
        ) : null}
      </div>

      <aside className="space-y-5">
        <Card>
          <CardHeader title="Informações identificadas" />
          <CardBody>
            <Identified data={mode === "edit" ? draft : resume.data} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Versões" description="Nada é apagado: cada envio vira uma versão." />
          <CardBody className="space-y-2">
            {versions.map((version) => (
              <div key={version.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
                <History className="size-4 shrink-0 text-ink-3" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    v{version.version} · {version.sourceFileName ?? "manual"}
                  </p>
                  <p className="font-mono text-[11px] text-ink-3">
                    {version.createdAtLabel} · {version.jobsCount} vaga(s)
                  </p>
                </div>
                {version.isActive ? (
                  <Badge tone="primary">Em uso</Badge>
                ) : (
                  <Button variant="ghost" size="sm" loading={activating === version.id} onClick={() => activate(version.id)}>
                    Usar
                  </Button>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      </aside>
    </div>
  );
}

/** Primeiro acesso: enviar o PDF ou preencher manualmente. */
export function ResumeOnboarding({ aiConfigured }: { aiConfigured: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [manual, setManual] = useState(false);
  const [draft, setDraft] = useState<ResumeData>(() => emptyResume());
  const [saving, setSaving] = useState(false);

  async function saveManual() {
    setSaving(true);
    try {
      await apiFetch("/api/resume/manual", { method: "POST", body: JSON.stringify(draft) });
      toast("Currículo salvo.");
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), "danger");
    } finally {
      setSaving(false);
    }
  }

  if (manual) {
    return (
      <div className="space-y-5">
        <ResumeEditor value={draft} onChange={setDraft} mode="base" />
        <div className="sticky bottom-4 z-10 flex justify-end gap-2 rounded-xl border border-line bg-surface/95 p-3 shadow-raised backdrop-blur">
          <Button variant="ghost" onClick={() => setManual(false)} disabled={saving}>
            Voltar
          </Button>
          <Button onClick={saveManual} loading={saving}>
            Salvar currículo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader
        title="Comece pelo seu currículo"
        description="Ele é a fonte oficial: a IA só reorganiza e reescreve o que estiver aqui, nunca acrescenta experiências ou competências."
      />
      <CardBody className="space-y-5">
        <ResumeUploader aiConfigured={aiConfigured} />
        <div className="flex items-center gap-3 text-xs text-ink-3">
          <span className="h-px flex-1 bg-line" />
          ou
          <span className="h-px flex-1 bg-line" />
        </div>
        <Button variant="secondary" onClick={() => setManual(true)}>
          Preencher manualmente
        </Button>
      </CardBody>
    </Card>
  );
}
