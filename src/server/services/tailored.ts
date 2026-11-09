import "server-only";
import { runFidelityRules } from "@/lib/ats/guardrails";
import { carryVerifierWarnings, computeTailoredScore, refreshReport } from "@/lib/ats/report";
import type { TailoredResume } from "@/lib/domain/resume";
import { buildResumeFileName } from "@/lib/pdf/filename";
import { execute } from "@/server/db";
import { ApiError, notFound } from "@/server/http";
import { renderResumePdf } from "@/server/pdf/render";
import { getJob, updateJobStatus, type JobRecord } from "@/server/repositories/jobs";
import {
  getLatestTailored,
  saveEditedContent,
  setTailoredPdf,
  type TailoredRecord,
} from "@/server/repositories/tailored";
import { deleteFile, getFileForUser, saveFile } from "@/server/storage/files";

export async function loadJobWithTailored(
  jobId: number,
  userId: number,
): Promise<{ job: JobRecord; tailored: TailoredRecord }> {
  const job = await getJob(jobId, userId);
  if (!job) throw notFound("Vaga não encontrada.");
  const tailored = await getLatestTailored(jobId, userId);
  if (!tailored) throw new ApiError(404, "Esta vaga ainda não tem currículo personalizado.", "sem_personalizacao");
  return { job, tailored };
}

/**
 * Salva a edição do usuário. Nada é corrigido automaticamente (o autor agora é
 * o candidato), mas as regras de fidelidade geram alertas quando algo novo não
 * existe no currículo original.
 */
export async function saveTailoredEdits(jobId: number, userId: number, content: TailoredResume) {
  const { job, tailored } = await loadJobWithTailored(jobId, userId);
  const keywords = job.match?.keywords ?? [];
  const base = tailored.baseSnapshot;

  // Dados pessoais vêm sempre do original, exceto título e localização.
  const safeContent: TailoredResume = {
    ...content,
    personal: {
      ...content.personal,
      fullName: base.personal.fullName,
      email: base.personal.email,
      phone: base.personal.phone,
      links: base.personal.links,
    },
  };

  const rules = runFidelityRules(base, safeContent, keywords, { autoFix: false });
  const report = refreshReport(
    {
      ...tailored.report,
      warnings: [...carryVerifierWarnings(tailored.report.warnings, tailored.aiContent, safeContent), ...rules.warnings],
    },
    base,
    safeContent,
    keywords,
  );

  await saveEditedContent(tailored.id, userId, safeContent, report);
  if (job.analysis && job.match) {
    await execute("UPDATE jobs SET tailored_score = ? WHERE id = ?", [
      computeTailoredScore(job.analysis, job.match, safeContent),
      job.id,
    ]);
  }
  return { report };
}

export async function restoreAiVersion(jobId: number, userId: number) {
  const { tailored } = await loadJobWithTailored(jobId, userId);
  return saveTailoredEdits(jobId, userId, tailored.aiContent);
}

export function pdfFileNameFor(job: JobRecord, tailored: TailoredRecord): string {
  return buildResumeFileName(tailored.content.personal.fullName, job.title ?? job.analysis?.title, tailored.content.language);
}

export async function renderTailoredPdf(jobId: number, userId: number) {
  const { job, tailored } = await loadJobWithTailored(jobId, userId);
  const buffer = await renderResumePdf(tailored.content, job.title ?? job.analysis?.title ?? "Currículo");
  return { buffer, fileName: pdfFileNameFor(job, tailored) };
}

/** Gera o PDF final, guarda o arquivo e marca a vaga como "Currículo preparado". */
export async function finalizeTailoredPdf(jobId: number, userId: number) {
  const { job, tailored } = await loadJobWithTailored(jobId, userId);
  const fileName = pdfFileNameFor(job, tailored);
  const buffer = await renderResumePdf(tailored.content, job.title ?? job.analysis?.title ?? "Currículo");

  const stored = await saveFile({ userId, purpose: "tailored_pdf", buffer, type: "pdf", originalName: fileName });
  const previousFileId = tailored.pdfFileId;
  await setTailoredPdf(tailored.id, stored.id);
  if (previousFileId) {
    const previous = await getFileForUser(previousFileId, userId);
    if (previous) await deleteFile(previous);
  }
  if (job.status === "analisada") await updateJobStatus(job.id, userId, "curriculo_preparado");
  return { fileName, fileId: stored.id };
}
