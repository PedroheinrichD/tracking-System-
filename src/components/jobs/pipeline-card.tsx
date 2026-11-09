"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { MATCH_DONE, PIPELINE_DONE, PIPELINE_STEP_META, type PipelineStep } from "@/lib/constants";
import { PipelineRunner } from "./pipeline-runner";

/**
 * Situação do pipeline na página da vaga: continuar uma análise interrompida,
 * gerar o currículo personalizado ou gerar uma nova versão.
 */
export function PipelineCard({
  jobId,
  completed,
  running,
  failedStep,
  error,
  aiConfigured,
}: {
  jobId: number;
  completed: number;
  running: PipelineStep | null;
  failedStep: PipelineStep | null;
  error: string | null;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState<null | { until: number; rerunFrom?: PipelineStep }>(
    running ? { until: completed < MATCH_DONE ? MATCH_DONE : PIPELINE_DONE } : null,
  );

  if (active) {
    return (
      <Card>
        <CardHeader title={active.rerunFrom ? "Gerando nova versão" : "Processando a vaga"} />
        <CardBody>
          <PipelineRunner
            jobId={jobId}
            initialCompleted={completed}
            until={active.until}
            rerunFrom={active.rerunFrom}
            onFinished={() => {
              setActive(null);
              if (active.until === PIPELINE_DONE) router.push(`/vagas/${jobId}/curriculo`);
              router.refresh();
            }}
          />
        </CardBody>
      </Card>
    );
  }

  if (completed < MATCH_DONE) {
    return (
      <Card>
        <CardHeader
          title="Análise incompleta"
          description="A vaga foi salva, mas nem todas as etapas terminaram."
        />
        <CardBody className="space-y-4">
          {failedStep ? (
            <Notice tone="danger" title={`Falha em “${PIPELINE_STEP_META[failedStep].label}”`}>
              {error}
            </Notice>
          ) : null}
          <Button onClick={() => setActive({ until: MATCH_DONE })} disabled={!aiConfigured}>
            Continuar análise
          </Button>
        </CardBody>
      </Card>
    );
  }

  if (completed < PIPELINE_DONE) {
    const tailoringStarted = completed > MATCH_DONE;
    return (
      <Card className="border-primary/30">
        <CardBody className="flex flex-wrap items-center gap-4">
          <span className="grid size-10 place-items-center rounded-lg bg-primary-soft text-primary" aria-hidden>
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">
              {tailoringStarted ? "Verificação de fidelidade pendente" : "Gerar o currículo personalizado para esta vaga"}
            </p>
            <p className="text-sm text-ink-2">
              {failedStep
                ? `A etapa “${PIPELINE_STEP_META[failedStep].label}” falhou: ${error ?? "tente novamente"}`
                : tailoringStarted
                  ? "A versão personalizada existe, mas ainda não passou pelo revisor independente."
                  : "Uma nova versão, só com informações verdadeiras do seu currículo, revisada por um segundo modelo."}
            </p>
          </div>
          <Button onClick={() => setActive({ until: PIPELINE_DONE })} disabled={!aiConfigured}>
            {tailoringStarted ? "Concluir verificação" : "Gerar currículo"}
          </Button>
        </CardBody>
      </Card>
    );
  }

  // Pipeline completo: gerar uma nova versão fica na tela de revisão do currículo.
  return null;
}
