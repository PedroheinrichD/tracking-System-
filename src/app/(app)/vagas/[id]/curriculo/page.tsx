import { ArrowLeft, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TapeMini } from "@/components/ats/tape-measure";
import { PageHeader } from "@/components/layout/page-header";
import { ReviewWorkspace } from "@/components/review/review-workspace";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton";
import { PIPELINE_DONE } from "@/lib/constants";
import { buildResumeFileName } from "@/lib/pdf/filename";
import { formatDateTime } from "@/lib/utils";
import { isAiConfigured } from "@/server/ai/client";
import { requireUser } from "@/server/auth/dal";
import { getJob } from "@/server/repositories/jobs";
import { getLatestTailored } from "@/server/repositories/tailored";

export const metadata: Metadata = { title: "Currículo personalizado" };

type Props = { params: Promise<{ id: string }> };

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-xs text-ink-3">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

async function ReviewContent({ params }: Props) {
  const user = await requireUser();
  const jobId = Number((await params).id);
  if (!Number.isInteger(jobId) || jobId <= 0) notFound();
  const job = await getJob(jobId, user.id);
  if (!job) notFound();
  const tailored = await getLatestTailored(job.id, user.id);
  const title = job.title ?? job.analysis?.title ?? "Vaga";

  const header = (
    <PageHeader
      eyebrow={
        <Link href={`/vagas/${job.id}`} className="inline-flex items-center gap-1 hover:text-ink">
          <ArrowLeft className="size-3.5" /> {title}
        </Link>
      }
      title="Currículo personalizado"
      description={[title, job.company].filter(Boolean).join(" · ")}
    />
  );

  if (!tailored) {
    return (
      <>
        {header}
        <EmptyState
          icon={FileText}
          title="Ainda não há currículo personalizado"
          description="Gere a versão personalizada na página da vaga, depois da análise de compatibilidade."
          action={<ButtonLink href={`/vagas/${job.id}`}>Ir para a vaga</ButtonLink>}
        />
      </>
    );
  }

  const verifiedOk = tailored.report.verification?.status === "concluida";
  const keywordTerms = (job.match?.keywords ?? []).filter((keyword) => keyword.status !== "ausente").map((keyword) => keyword.term);

  return (
    <>
      {header}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Compatibilidade (original → personalizado)">
          <div className="flex flex-wrap items-center gap-2">
            <TapeMini value={job.compatibilityScore} />
            <span className="text-ink-3">→</span>
            <TapeMini value={job.tailoredScore} />
          </div>
        </Stat>
        <Stat label="Termos exatos da vaga">
          <p className="font-mono text-lg font-semibold tabular-nums text-ink">
            {tailored.report.keywordCoverage?.before ?? 0}% → {tailored.report.keywordCoverage?.after ?? 0}%
          </p>
        </Stat>
        <Stat label="Verificação de fidelidade">
          <p className={verifiedOk ? "text-sm font-medium text-success" : "text-sm font-medium text-warning"}>
            {verifiedOk
              ? `Concluída · ${tailored.report.autoFixes?.length ?? 0} correção(ões)`
              : job.pipelineCompleted < PIPELINE_DONE
                ? "Pendente — conclua na página da vaga"
                : "Pendente"}
          </p>
        </Stat>
        <Stat label="Status da candidatura">
          <StatusBadge status={job.status} />
        </Stat>
      </div>

      <ReviewWorkspace
        jobId={job.id}
        original={tailored.baseSnapshot}
        content={tailored.content}
        report={tailored.report}
        keywordTerms={keywordTerms}
        pdfFileName={buildResumeFileName(tailored.content.personal.fullName, title, tailored.content.language)}
        pdfGeneratedLabel={tailored.pdfGeneratedAt ? formatDateTime(tailored.pdfGeneratedAt) : null}
        aiConfigured={isAiConfigured()}
      />
    </>
  );
}

export default function ReviewPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={10} />
        </div>
      }
    >
      <ReviewContent {...props} />
    </Suspense>
  );
}
