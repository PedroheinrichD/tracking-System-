import { ArrowLeft, Download, ExternalLink, FileText, ImageIcon, ScanSearch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CompatibilityPanel } from "@/components/jobs/compatibility-panel";
import { DeleteJobButton, JobDetailsForm, StatusSelect } from "@/components/jobs/job-controls";
import { JobAnalysisView } from "@/components/jobs/job-analysis-view";
import { PipelineCard } from "@/components/jobs/pipeline-card";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton";
import { MATCH_DONE, PIPELINE_DONE, SENIORITY_LABELS, WORK_MODEL_LABELS } from "@/lib/constants";
import { cn, formatBytes, formatDate, formatDateTime } from "@/lib/utils";
import { isAiConfigured } from "@/server/ai/client";
import { requireUser } from "@/server/auth/dal";
import { getJob, getStatusHistory, listJobFiles } from "@/server/repositories/jobs";
import { getLatestTailored } from "@/server/repositories/tailored";

export const metadata: Metadata = { title: "Vaga" };

const TABS = [
  { key: "compatibilidade", label: "Compatibilidade" },
  { key: "analise", label: "Análise da vaga" },
  { key: "descricao", label: "Descrição original" },
  { key: "acompanhamento", label: "Acompanhamento" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function JobContent({ params, searchParams }: Props) {
  const user = await requireUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const jobId = Number(id);
  if (!Number.isInteger(jobId) || jobId <= 0) notFound();

  const job = await getJob(jobId, user.id);
  if (!job) notFound();
  const [files, history, tailored] = await Promise.all([
    listJobFiles(job.id, user.id),
    getStatusHistory(job.id, user.id),
    getLatestTailored(job.id, user.id),
  ]);

  const requested = typeof query.aba === "string" ? query.aba : "compatibilidade";
  const tab: TabKey = TABS.some((item) => item.key === requested) ? (requested as TabKey) : "compatibilidade";
  const title = job.title ?? job.analysis?.title ?? "Vaga sem título";
  const meta = [
    job.company,
    job.seniority ? SENIORITY_LABELS[job.seniority] : null,
    job.workModel && job.workModel !== "nao_informado" ? WORK_MODEL_LABELS[job.workModel] : null,
    job.location,
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/vagas" className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft className="size-3.5" /> Minhas vagas
          </Link>
        }
        title={title}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {meta.length ? <span>{meta.join(" · ")}</span> : null}
            <span className="font-mono text-xs text-ink-3">analisada em {formatDate(job.createdAt)}</span>
          </span>
        }
        actions={
          <>
            <StatusSelect jobId={job.id} status={job.status} className="w-52" />
            {tailored ? (
              <ButtonLink href={`/vagas/${job.id}/curriculo`}>
                <FileText /> Currículo personalizado
              </ButtonLink>
            ) : null}
            {tailored?.pdfFileId ? (
              <a
                href={`/api/jobs/${job.id}/tailored/pdf/final`}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-2"
              >
                <Download className="size-4" /> PDF
              </a>
            ) : null}
          </>
        }
      />

      <div className="mb-6 space-y-4">
        {job.pipelineCompleted < PIPELINE_DONE || job.pipelineRunning ? (
          <PipelineCard
            jobId={job.id}
            completed={job.pipelineCompleted}
            running={job.pipelineRunning}
            failedStep={job.pipelineFailedStep}
            error={job.pipelineError}
            aiConfigured={isAiConfigured()}
          />
        ) : null}
      </div>

      <nav aria-label="Seções da vaga" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={`/vagas/${job.id}?aba=${item.key}`}
            scroll={false}
            aria-current={tab === item.key ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
              tab === item.key ? "border-primary text-ink" : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {tab === "compatibilidade" ? (
        job.analysis && job.match && job.score && job.pipelineCompleted >= MATCH_DONE ? (
          <CompatibilityPanel
            analysis={job.analysis}
            match={job.match}
            score={job.score}
            tailoredScore={job.pipelineCompleted >= PIPELINE_DONE ? job.tailoredScore : null}
          />
        ) : (
          <EmptyState
            icon={ScanSearch}
            title="Compatibilidade ainda não calculada"
            description="Conclua a análise da vaga para ver requisitos atendidos, palavras-chave e a pontuação."
          />
        )
      ) : null}

      {tab === "analise" ? (
        job.analysis ? (
          <JobAnalysisView analysis={job.analysis} />
        ) : (
          <EmptyState icon={ScanSearch} title="A vaga ainda não foi analisada" />
        )
      ) : null}

      {tab === "descricao" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Card>
            <CardHeader title="Texto da vaga" description="Texto usado na análise (colado e/ou lido das imagens e do PDF)." />
            <CardBody>
              {job.descriptionText || job.inputText ? (
                <div className="max-h-[70vh] overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-4 text-sm leading-relaxed text-ink">
                  {job.descriptionText ?? job.inputText}
                </div>
              ) : (
                <p className="text-sm text-ink-3">O texto ainda não foi extraído.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Arquivos enviados" />
            <CardBody className="space-y-2">
              {files.length ? (
                files.map((file) => (
                  <a
                    key={file.id}
                    href={`/api/jobs/${job.id}/files/${file.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-sm hover:bg-surface-2"
                  >
                    {file.mimeType.startsWith("image/") ? (
                      <ImageIcon className="size-4 shrink-0 text-ink-3" aria-hidden />
                    ) : (
                      <FileText className="size-4 shrink-0 text-ink-3" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1 truncate text-ink">{file.originalName}</span>
                    <span className="font-mono text-xs text-ink-3">{formatBytes(file.sizeBytes)}</span>
                  </a>
                ))
              ) : (
                <p className="text-sm text-ink-3">Nenhum arquivo: a vaga foi colada como texto.</p>
              )}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === "acompanhamento" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Histórico de status" />
            <CardBody>
              <ol className="relative space-y-4 border-l border-line pl-5">
                {history.map((entry, index) => (
                  <li key={index} className="relative">
                    <span
                      aria-hidden
                      className="absolute -left-[25px] top-1 size-2.5 rounded-full ring-4 ring-surface"
                      style={{ backgroundColor: `var(--status-${entry.toStatus})` }}
                    />
                    <StatusBadge status={entry.toStatus} />
                    <p className="mt-1 font-mono text-xs text-ink-3">{formatDateTime(entry.changedAt)}</p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Dados e anotações"
              actions={
                job.jobUrl ? (
                  <a href={job.jobUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    Abrir anúncio <ExternalLink className="size-3.5" />
                  </a>
                ) : null
              }
            />
            <CardBody className="space-y-6">
              <JobDetailsForm jobId={job.id} company={job.company} title={job.title} jobUrl={job.jobUrl} notes={job.notes} />
              <div className="border-t border-line pt-4">
                <DeleteJobButton jobId={job.id} label={title} />
              </div>
            </CardBody>
          </Card>
        </div>
      ) : null}
    </>
  );
}

export default function JobPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={8} />
        </div>
      }
    >
      <JobContent {...props} />
    </Suspense>
  );
}
