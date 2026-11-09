import { BriefcaseBusiness, ChevronRight, Download, Plus, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TapeMini } from "@/components/ats/tape-measure";
import { JobsFilters } from "@/components/jobs/jobs-filters";
import { StatusSelect } from "@/components/jobs/job-controls";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { APPLICATION_STATUSES, PIPELINE_DONE, type ApplicationStatus } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { requireUser } from "@/server/auth/dal";
import { countJobsByStatus, listJobs, type JobSummary } from "@/server/repositories/jobs";

export const metadata: Metadata = { title: "Minhas vagas" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function first(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function PipelineHint({ job }: { job: JobSummary }) {
  if (job.pipelineRunning) return <Badge tone="primary">Processando</Badge>;
  if (job.pipelineFailedStep) return <Badge tone="danger">Etapa com erro</Badge>;
  if (job.pipelineCompleted < 3) return <Badge tone="warning">Análise incompleta</Badge>;
  if (job.pipelineCompleted < PIPELINE_DONE) return <Badge>Sem currículo personalizado</Badge>;
  return null;
}

function Scores({ job }: { job: JobSummary }) {
  return (
    <div className="flex flex-col gap-1">
      <TapeMini value={job.compatibilityScore} />
      {job.tailoredScore !== null && job.compatibilityScore !== null && job.tailoredScore !== job.compatibilityScore ? (
        <span className="font-mono text-[11px] text-ink-3">
          personalizado {job.tailoredScore} ({job.tailoredScore > job.compatibilityScore ? "+" : ""}
          {job.tailoredScore - job.compatibilityScore})
        </span>
      ) : null}
    </div>
  );
}

async function JobsList({ searchParams }: Props) {
  const user = await requireUser();
  const query = await searchParams;
  const statusParam = first(query.status);
  const status = APPLICATION_STATUSES.includes(statusParam as ApplicationStatus) ? (statusParam as ApplicationStatus) : null;
  const sortParam = first(query.ordem);
  const sort = sortParam === "antigas" || sortParam === "compatibilidade" ? sortParam : "recentes";
  const search = first(query.q);

  const [jobs, counts] = await Promise.all([listJobs(user.id, { status, search, sort }), countJobsByStatus(user.id)]);
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  if (total === 0) {
    return (
      <EmptyState
        icon={BriefcaseBusiness}
        title="Nenhuma vaga analisada ainda"
        description="Cada vaga que você analisar fica aqui, com a compatibilidade, o currículo personalizado e o status da candidatura."
        action={
          <ButtonLink href="/nova-analise">
            <Plus /> Analisar a primeira vaga
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <JobsFilters counts={counts} total={total} />

      {jobs.length === 0 ? (
        <EmptyState icon={SearchX} title="Nenhuma vaga com estes filtros" description="Ajuste a busca ou o status selecionado." />
      ) : (
        <>
          {/* Tabela (telas médias e grandes) */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col />
                <col className="w-36" />
                <col className="w-48" />
                <col className="w-56" />
                <col className="w-24" />
              </colgroup>
              <thead>
                <tr className="border-b border-line bg-surface-2 text-xs text-ink-3">
                  <th scope="col" className="px-5 py-3 font-medium">Vaga</th>
                  <th scope="col" className="px-3 py-3 font-medium">Analisada em</th>
                  <th scope="col" className="px-3 py-3 font-medium">Compatibilidade</th>
                  <th scope="col" className="px-3 py-3 font-medium">Status</th>
                  <th scope="col" className="w-24 px-3 py-3 font-medium">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {jobs.map((job) => (
                  <tr key={job.id} className="group align-middle hover:bg-surface-2/60">
                    <td className="max-w-0 px-5 py-3.5">
                      <Link href={`/vagas/${job.id}`} prefetch={false} className="block min-w-0">
                        <span className="block truncate font-medium text-ink group-hover:text-primary">
                          {job.title ?? "Vaga sem título"}
                        </span>
                        <span className="flex items-center gap-2 truncate text-xs text-ink-3">
                          {job.company ?? "Empresa não identificada"}
                          <PipelineHint job={job} />
                        </span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 font-mono text-xs text-ink-2">{formatDate(job.createdAt)}</td>
                    <td className="px-3 py-3.5">
                      <Scores job={job} />
                    </td>
                    <td className="px-3 py-3.5">
                      <StatusSelect jobId={job.id} status={job.status} size="sm" className="w-48" />
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {job.hasPdf ? (
                          <a
                            href={`/api/jobs/${job.id}/tailored/pdf/final`}
                            className="grid size-8 place-items-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink"
                            aria-label={`Baixar PDF do currículo para ${job.title ?? "a vaga"}`}
                            title="Baixar PDF"
                          >
                            <Download className="size-4" />
                          </a>
                        ) : null}
                        <Link
                          href={`/vagas/${job.id}`}
                          prefetch={false}
                          className="grid size-8 place-items-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink"
                          aria-label={`Abrir ${job.title ?? "vaga"}`}
                        >
                          <ChevronRight className="size-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Cartões (celular) */}
          <ul className="space-y-3 md:hidden">
            {jobs.map((job) => (
              <li key={job.id}>
                <Card className="space-y-3 p-4">
                  <Link href={`/vagas/${job.id}`} prefetch={false} className="block">
                    <p className="font-medium text-ink">{job.title ?? "Vaga sem título"}</p>
                    <p className="text-xs text-ink-3">
                      {job.company ?? "Empresa não identificada"} · {formatDate(job.createdAt)}
                    </p>
                  </Link>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Scores job={job} />
                    <PipelineHint job={job} />
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusSelect jobId={job.id} status={job.status} size="sm" className="flex-1" />
                    {job.hasPdf ? (
                      <a
                        href={`/api/jobs/${job.id}/tailored/pdf/final`}
                        className="grid size-8 place-items-center rounded-md border border-line text-ink-2"
                        aria-label="Baixar PDF"
                      >
                        <Download className="size-4" />
                      </a>
                    ) : null}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-3">
            Mostrando {jobs.length} de {total} vaga(s).
          </p>
        </>
      )}
    </div>
  );
}

export default function JobsPage(props: Props) {
  return (
    <>
      <PageHeader
        title="Minhas vagas"
        description="Histórico de análises e candidaturas. Atualize o status conforme o processo avança."
        actions={
          <ButtonLink href="/nova-analise">
            <Plus /> Nova análise
          </ButtonLink>
        }
      />
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <SkeletonCard lines={6} />
          </div>
        }
      >
        <JobsList {...props} />
      </Suspense>
    </>
  );
}
