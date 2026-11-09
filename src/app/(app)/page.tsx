import { ArrowRight, BriefcaseBusiness, CalendarCheck, Gauge, Plus, Send } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TapeMini } from "@/components/ats/tape-measure";
import { StatusFunnel, TermBars } from "@/components/dashboard/bars";
import { ScoreStrip } from "@/components/dashboard/score-strip";
import { StatTile } from "@/components/dashboard/stat-tile";
import { WeeklyChart } from "@/components/dashboard/weekly-chart";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { requireUser } from "@/server/auth/dal";
import { listJobs } from "@/server/repositories/jobs";
import { getDashboardStats, hasActiveResume } from "@/server/repositories/stats";

export const metadata: Metadata = { title: "Painel" };

function Onboarding({ hasResume }: { hasResume: boolean }) {
  const steps = [
    {
      title: "Envie seu currículo original",
      text: "Em PDF. A IA identifica experiências, formação, competências e projetos; você revisa.",
      href: "/curriculo",
      cta: "Ir para Meu currículo",
      done: hasResume,
    },
    {
      title: "Analise uma vaga",
      text: "Cole o texto, envie prints ou o PDF do anúncio. Você vê requisitos, palavras-chave e a compatibilidade.",
      href: "/nova-analise",
      cta: "Nova análise",
      done: false,
    },
    {
      title: "Revise e baixe o PDF",
      text: "Compare original e personalizado, ajuste o que quiser e gere um PDF legível por ATS.",
      href: null,
      cta: null,
      done: false,
    },
  ];
  const next = steps.findIndex((step) => !step.done);

  return (
    <Card className="max-w-3xl">
      <CardHeader title="Primeiros passos" description="Três etapas até o primeiro currículo sob medida." />
      <CardBody>
        <ol className="space-y-4">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span
                className={
                  step.done
                    ? "grid size-7 shrink-0 place-items-center rounded-full bg-success-soft font-mono text-xs text-success"
                    : index === next
                      ? "grid size-7 shrink-0 place-items-center rounded-full bg-tape font-mono text-xs font-semibold text-tape-ink"
                      : "grid size-7 shrink-0 place-items-center rounded-full border border-line font-mono text-xs text-ink-3"
                }
              >
                {step.done ? "✓" : index + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-1.5 pb-1">
                <p className={step.done ? "text-sm font-medium text-ink-3 line-through" : "text-sm font-medium text-ink"}>
                  {step.title}
                </p>
                <p className="text-sm text-ink-2">{step.text}</p>
                {index === next && step.href ? (
                  <ButtonLink href={step.href} size="sm" className="mt-1">
                    {step.cta} <ArrowRight />
                  </ButtonLink>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}

async function DashboardContent() {
  const user = await requireUser();
  const [resumeExists, stats, recent] = await Promise.all([
    hasActiveResume(user.id),
    getDashboardStats(user.id, new Date()),
    listJobs(user.id, { sort: "recentes" }),
  ]);
  const firstName = user.name.split(/\s+/)[0];

  if (!resumeExists || stats.totalJobs === 0) {
    return (
      <div className="space-y-5">
        <p className="text-[15px] text-ink-2">Olá, {firstName}.</p>
        <Onboarding hasResume={resumeExists} />
      </div>
    );
  }

  const interviewRate = stats.appliedCount ? Math.round((stats.interviewCount / stats.appliedCount) * 100) : null;

  return (
    <div className="space-y-6">
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Vagas analisadas"
          icon={BriefcaseBusiness}
          value={stats.totalJobs}
          context={`${stats.analyzedThisWeek} nos últimos 7 dias`}
        />
        <StatTile
          label="Compatibilidade média"
          icon={Gauge}
          value={stats.averageScore ?? "—"}
          unit={stats.averageScore !== null ? "/100" : undefined}
          context={
            stats.averageTailoredGain !== null
              ? `${stats.averageTailoredGain >= 0 ? "+" : ""}${stats.averageTailoredGain} pontos em média com a personalização`
              : "Estimativa própria, não é nota oficial de ATS"
          }
        />
        <StatTile
          label="Candidaturas enviadas"
          icon={Send}
          value={stats.appliedCount}
          context={`${stats.byStatus.curriculo_preparado} com currículo pronto para enviar`}
        />
        <StatTile
          label="Entrevistas"
          icon={CalendarCheck}
          value={stats.interviewCount}
          context={interviewRate !== null ? `${interviewRate}% das candidaturas` : "Nenhuma candidatura enviada ainda"}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Atividade semanal" description="Últimas 10 semanas." />
          <CardBody>
            <WeeklyChart weeks={stats.weekly} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Candidaturas por status" description="Situação atual de cada vaga." />
          <CardBody>
            <StatusFunnel byStatus={stats.byStatus} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Onde suas vagas caem na fita"
          description="Compatibilidade estimada de cada vaga (versão personalizada, quando existe). Clique em um ponto para abrir a vaga."
        />
        <CardBody>
          <ScoreStrip points={stats.scores} />
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Lacunas mais frequentes"
            description="Palavras-chave pedidas pelas vagas que não estão no seu currículo."
          />
          <CardBody>
            {stats.topGaps.length ? (
              <TermBars items={stats.topGaps} caption="Lacunas mais frequentes" valueLabel="Vagas que pedem" />
            ) : (
              <p className="text-sm text-ink-3">Nenhuma lacuna recorrente.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Seus pontos fortes recorrentes"
            description="Palavras-chave das vagas que o seu currículo já cobre."
          />
          <CardBody>
            {stats.topMatched.length ? (
              <TermBars items={stats.topMatched} caption="Pontos fortes recorrentes" valueLabel="Vagas atendidas" />
            ) : (
              <p className="text-sm text-ink-3">Ainda sem dados suficientes.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Vagas recentes"
          actions={
            <Link href="/vagas" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Ver todas <ArrowRight className="size-3.5" />
            </Link>
          }
        />
        <CardBody className="pt-3">
          <ul className="divide-y divide-line">
            {recent.slice(0, 5).map((job) => (
              <li key={job.id}>
                <Link
                  href={`/vagas/${job.id}`}
                  prefetch={false}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 hover:text-primary"
                >
                  <span className="w-full min-w-0 sm:w-auto sm:flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{job.title ?? "Vaga sem título"}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {job.company ?? "Empresa não identificada"} · {formatDate(job.createdAt)}
                    </span>
                  </span>
                  <TapeMini value={job.tailoredScore ?? job.compatibilityScore} />
                  <StatusBadge status={job.status} />
                </Link>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Painel"
        description="Suas análises, a compatibilidade com cada vaga e o andamento das candidaturas."
        actions={
          <ButtonLink href="/nova-analise">
            <Plus /> Nova análise
          </ButtonLink>
        }
      />
      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-[118px] rounded-xl" />
              ))}
            </div>
            <SkeletonCard lines={6} />
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </>
  );
}
