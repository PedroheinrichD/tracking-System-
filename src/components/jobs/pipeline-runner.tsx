"use client";

import { Check, CircleDashed, OctagonAlert, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Elapsed } from "@/components/ui/elapsed";
import { apiFetch, ApiClientError, errorMessage } from "@/lib/api-client";
import { PIPELINE_STEP_META, PIPELINE_STEPS, type PipelineStep } from "@/lib/constants";
import { cn } from "@/lib/utils";

type StepStatus = "done" | "running" | "pending" | "failed" | "skipped";

interface JobState {
  pipelineCompleted: number;
  pipelineRunning: PipelineStep | null;
  pipelineFailedStep: PipelineStep | null;
  pipelineError: string | null;
}

/**
 * Executa as etapas do pipeline em sequência, uma requisição por etapa.
 * O progresso exibido é o real: cada etapa só aparece concluída quando o
 * servidor confirma. Em caso de falha, é possível retomar da etapa que parou.
 */
export function PipelineRunner({
  jobId,
  initialCompleted,
  until,
  autoStart = true,
  rerunFrom,
  onFinished,
  onStepDone,
}: {
  jobId: number;
  initialCompleted: number;
  /** Executa até esta quantidade de etapas concluídas (3 = até a compatibilidade, 5 = tudo). */
  until: number;
  autoStart?: boolean;
  /** Reexecuta a partir desta etapa (ex.: gerar novamente a personalização). */
  rerunFrom?: PipelineStep;
  onFinished?: () => void;
  onStepDone?: (step: PipelineStep, completed: number) => void;
}) {
  const startIndex = rerunFrom ? PIPELINE_STEPS.indexOf(rerunFrom) : initialCompleted;
  const [completed, setCompleted] = useState(startIndex);
  const [running, setRunning] = useState<PipelineStep | null>(null);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [failure, setFailure] = useState<{ step: PipelineStep; message: string } | null>(null);
  const started = useRef(false);

  const waitWhileRunning = useCallback(
    async (step: PipelineStep) => {
      // Outra aba (ou uma requisição anterior) já está executando esta etapa: acompanha até terminar.
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const state = await apiFetch<JobState>(`/api/jobs/${jobId}`);
        if (state.pipelineRunning !== step) return state;
      }
    },
    [jobId],
  );

  const run = useCallback(
    async (from: number) => {
      setFailure(null);
      for (let index = from; index < until; index += 1) {
        const step = PIPELINE_STEPS[index];
        setRunning(step);
        setStartedAt(Date.now());
        try {
          const result = await apiFetch<{ pipelineCompleted: number }>(`/api/jobs/${jobId}/pipeline/${step}`, {
            method: "POST",
          });
          setCompleted(result.pipelineCompleted);
          onStepDone?.(step, result.pipelineCompleted);
        } catch (error) {
          if (error instanceof ApiClientError && error.code === "etapa_em_andamento") {
            try {
              const state = await waitWhileRunning(step);
              if (state.pipelineFailedStep === step) {
                setFailure({ step, message: state.pipelineError ?? "A etapa falhou." });
                setRunning(null);
                return;
              }
              setCompleted(state.pipelineCompleted);
              index = state.pipelineCompleted - 1;
              continue;
            } catch (pollError) {
              setFailure({ step, message: errorMessage(pollError) });
              setRunning(null);
              return;
            }
          }
          setFailure({ step, message: errorMessage(error) });
          setRunning(null);
          return;
        }
      }
      setRunning(null);
      onFinished?.();
    },
    [jobId, until, onFinished, onStepDone, waitWhileRunning],
  );

  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    void run(startIndex);
  }, [autoStart, run, startIndex]);

  function statusOf(step: PipelineStep, index: number): StepStatus {
    if (failure?.step === step) return "failed";
    if (running === step) return "running";
    if (index >= until) return "skipped";
    if (index < completed) return "done";
    return "pending";
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-1">
        {PIPELINE_STEPS.map((step, index) => {
          const status = statusOf(step, index);
          if (status === "skipped") return null;
          return (
            <li
              key={step}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5",
                status === "running" && "bg-surface-2",
                status === "failed" && "bg-danger-soft",
              )}
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border",
                  status === "done" && "border-success/30 bg-success-soft text-success",
                  status === "running" && "border-primary/40 bg-primary-soft text-primary",
                  status === "pending" && "border-line text-ink-3",
                  status === "failed" && "border-danger/40 bg-surface text-danger",
                )}
                aria-hidden
              >
                {status === "done" ? (
                  <Check className="size-3.5" />
                ) : status === "failed" ? (
                  <OctagonAlert className="size-3.5" />
                ) : status === "running" ? (
                  <span className="size-2 animate-pulse rounded-full bg-primary" />
                ) : (
                  <CircleDashed className="size-3.5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm", status === "pending" ? "text-ink-3" : "text-ink", status === "running" && "font-medium")}>
                  {status === "running" ? PIPELINE_STEP_META[step].running : PIPELINE_STEP_META[step].label}
                </p>
                {status === "running" ? <div className="mt-2 h-0.5 w-full max-w-64 stitch-running" aria-hidden /> : null}
                {status === "failed" ? <p className="mt-0.5 text-xs text-danger">{failure?.message}</p> : null}
              </div>
              {status === "running" ? <Elapsed since={startedAt} /> : null}
              <span className="sr-only">
                {status === "done" ? "concluída" : status === "running" ? "em andamento" : status === "failed" ? "falhou" : "pendente"}
              </span>
            </li>
          );
        })}
      </ol>

      {failure ? (
        <Button variant="secondary" onClick={() => run(PIPELINE_STEPS.indexOf(failure.step))}>
          <RotateCcw /> Tentar novamente a partir de “{PIPELINE_STEP_META[failure.step].label}”
        </Button>
      ) : null}

      {!autoStart && !running && !failure && completed < until ? (
        <Button onClick={() => run(completed)}>Continuar</Button>
      ) : null}
    </div>
  );
}
