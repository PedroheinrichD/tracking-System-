import { NextResponse } from "next/server";
import { PIPELINE_STEPS, type PipelineStep } from "@/lib/constants";
import { requireApiUser } from "@/server/auth/dal";
import { notFound, parseId, route } from "@/server/http";
import { runPipelineStep } from "@/server/services/job-pipeline";

/**
 * Executa uma etapa do pipeline de IA. Cada etapa é uma requisição separada:
 * o progresso na tela é real e uma falha pode ser retomada a partir da etapa que parou.
 */
export const POST = route<{ id: string; step: string }>(async (_request, { params }) => {
  const user = await requireApiUser();
  const { id, step } = await params;
  if (!(PIPELINE_STEPS as readonly string[]).includes(step)) throw notFound("Etapa desconhecida.");

  const job = await runPipelineStep(parseId(id), user.id, step as PipelineStep);
  return NextResponse.json({
    pipelineCompleted: job.pipelineCompleted,
    compatibilityScore: job.compatibilityScore,
    tailoredScore: job.tailoredScore,
    title: job.title,
    company: job.company,
  });
});
