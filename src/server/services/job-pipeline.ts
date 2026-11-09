import "server-only";
import { applyVerifierIssues, mergeTailoredResume, runFidelityRules } from "@/lib/ats/guardrails";
import { finalizeMatch } from "@/lib/ats/match";
import { normalizeForMatch } from "@/lib/ats/normalize";
import { buildTailoringReport, computeTailoredScore, refreshReport } from "@/lib/ats/report";
import { computeScore } from "@/lib/ats/score";
import { LIMITS, OUTPUT_LANGUAGES, PIPELINE_STEP_META, PIPELINE_STEPS, type PipelineStep } from "@/lib/constants";
import type { JobAnalysis, JobAnalysisAi } from "@/lib/domain/job";
import { resolveLocale } from "@/lib/domain/labels";
import type { TailoringReport } from "@/lib/domain/tailoring";
import { resumeToText } from "@/lib/resume/text";
import { getModel } from "@/server/ai/client";
import {
  analyzeJobPosting,
  assessCompatibility,
  tailorResume,
  transcribeJobPosting,
  verifyTailoredResume,
} from "@/server/ai/tasks";
import { fit, toJson, withTransaction } from "@/server/db";
import { ApiError, notFound } from "@/server/http";
import { hasUsefulText, readPdfText } from "@/server/pdf/extract";
import { enforceAiRateLimit } from "@/server/rate-limit";
import {
  attachFileToJob,
  claimPipelineStep,
  completePipelineStep,
  createJob,
  failPipelineStep,
  getJob,
  listJobFiles,
  type JobRecord,
} from "@/server/repositories/jobs";
import { getActiveResume, getResumeById } from "@/server/repositories/resumes";
import { createTailored, getLatestTailored, saveVerification } from "@/server/repositories/tailored";
import {
  deleteFile,
  detectFileType,
  getFileForUser,
  readFileContent,
  saveFile,
  type DetectedType,
  type StoredFile,
} from "@/server/storage/files";

// ── Criação da vaga a partir do formulário ──────────────────────────────────

function textField(form: FormData, name: string, max: number): string | null {
  const value = form.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function isFile(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" && value !== null && "arrayBuffer" in value && value.size > 0;
}

function validateUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    // tratado abaixo
  }
  throw new ApiError(400, "O link da vaga precisa começar com http:// ou https://.", "link_invalido");
}

export async function createJobFromForm(userId: number, form: FormData): Promise<number> {
  const resume = await getActiveResume(userId);
  if (!resume) {
    throw new ApiError(409, "Cadastre seu currículo em “Meu Currículo” antes de analisar vagas.", "sem_curriculo");
  }

  const text = textField(form, "text", LIMITS.jobTextChars + 1);
  if (text && text.length > LIMITS.jobTextChars) {
    throw new ApiError(413, "A descrição da vaga é longa demais (máximo de 30 mil caracteres).", "texto_grande");
  }
  const company = textField(form, "company", 190);
  const title = textField(form, "title", 190);
  const jobUrl = validateUrl(textField(form, "url", 1000));
  const languageInput = textField(form, "language", 10) ?? "auto";
  const outputLanguage = OUTPUT_LANGUAGES.some((option) => option.value === languageInput) ? languageInput : "auto";

  const images = form.getAll("images").filter(isFile);
  const pdfEntry = form.get("pdf");
  const pdf = isFile(pdfEntry) ? pdfEntry : null;

  if (!text && !images.length && !pdf) {
    throw new ApiError(400, "Cole a descrição da vaga ou envie uma imagem ou PDF do anúncio.", "sem_conteudo");
  }
  if (images.length > LIMITS.jobImages) {
    throw new ApiError(400, `Envie no máximo ${LIMITS.jobImages} imagens por vaga.`, "imagens_demais");
  }

  const imageBuffers: { buffer: Buffer; type: DetectedType; name: string }[] = [];
  for (const image of images) {
    if (image.size > LIMITS.jobImageBytes) {
      throw new ApiError(413, `A imagem “${image.name}” passa de 3,5 MB. Reduza ou recorte o print.`, "imagem_grande");
    }
    const buffer = Buffer.from(await image.arrayBuffer());
    const type = detectFileType(buffer);
    if (type !== "png" && type !== "jpeg" && type !== "webp") {
      throw new ApiError(415, `“${image.name}” não é uma imagem PNG, JPG ou WEBP.`, "tipo_invalido");
    }
    imageBuffers.push({ buffer, type, name: image.name });
  }

  let pdfBuffer: Buffer | null = null;
  let pdfText: string | null = null;
  if (pdf) {
    if (pdf.size > LIMITS.jobPdfBytes) throw new ApiError(413, "O PDF da vaga deve ter no máximo 10 MB.", "pdf_grande");
    pdfBuffer = Buffer.from(await pdf.arrayBuffer());
    if (detectFileType(pdfBuffer) !== "pdf") throw new ApiError(415, "O arquivo da vaga não é um PDF válido.", "tipo_invalido");
    const extracted = await readPdfText(pdfBuffer, { maxPages: LIMITS.jobPdfPages, label: "PDF da vaga" });
    pdfText = hasUsefulText(extracted.text) ? extracted.text : null;
  }

  const saved: StoredFile[] = [];
  try {
    for (const image of imageBuffers) {
      saved.push(await saveFile({ userId, purpose: "job_image", buffer: image.buffer, type: image.type, originalName: image.name }));
    }
    if (pdfBuffer && pdf) {
      saved.push(await saveFile({ userId, purpose: "job_pdf", buffer: pdfBuffer, type: "pdf", originalName: pdf.name }));
    }
    return await withTransaction(async (connection) => {
      const jobId = await createJob(
        {
          userId,
          baseResumeId: resume.id,
          company,
          title,
          jobUrl,
          inputText: text,
          extractedText: pdfText,
          outputLanguage,
        },
        connection,
      );
      for (const [position, file] of saved.entries()) await attachFileToJob(jobId, file.id, position, connection);
      return jobId;
    });
  } catch (error) {
    for (const file of saved) await deleteFile(file).catch(() => undefined);
    throw error;
  }
}

// ── Execução das etapas ─────────────────────────────────────────────────────

export async function runPipelineStep(jobId: number, userId: number, step: PipelineStep): Promise<JobRecord> {
  const job = await getJob(jobId, userId);
  if (!job) throw notFound("Vaga não encontrada.");

  const index = PIPELINE_STEPS.indexOf(step);
  if (job.pipelineCompleted < index) {
    const previous = PIPELINE_STEP_META[PIPELINE_STEPS[job.pipelineCompleted]].label;
    throw new ApiError(409, `Conclua a etapa “${previous}” antes desta.`, "etapa_fora_de_ordem");
  }
  const needsAi = step !== "leitura" || (await readingNeedsAi(job));
  if (needsAi) enforceAiRateLimit(userId);

  if (!(await claimPipelineStep(jobId, userId, step))) {
    throw new ApiError(409, "Já existe uma etapa em andamento para esta vaga. Aguarde a conclusão.", "etapa_em_andamento");
  }

  try {
    if (step === "leitura") await stepReading(job);
    else if (step === "analise") await stepAnalysis(job);
    else if (step === "compatibilidade") await stepCompatibility(job);
    else if (step === "personalizacao") await stepTailoring(job);
    else await stepVerification(job);
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Erro inesperado nesta etapa. Tente novamente.";
    if (!(error instanceof ApiError)) console.error(`[pipeline] falha na etapa ${step} da vaga ${jobId}:`, error);
    await failPipelineStep(jobId, step, message);
    throw error;
  }

  const updated = await getJob(jobId, userId);
  if (!updated) throw notFound("Vaga não encontrada.");
  return updated;
}

async function readingNeedsAi(job: JobRecord): Promise<boolean> {
  const files = await listJobFiles(job.id, job.userId);
  return files.some((file) => file.purpose === "job_image") || (files.some((file) => file.purpose === "job_pdf") && !job.extractedText);
}

async function loadFile(fileId: number, userId: number): Promise<{ file: StoredFile; buffer: Buffer }> {
  const file = await getFileForUser(fileId, userId);
  if (!file) throw new ApiError(410, "Um anexo da vaga não foi encontrado.", "anexo_ausente");
  return { file, buffer: await readFileContent(file) };
}

/** Etapa 1: obtém o texto da vaga (texto colado, PDF com texto e/ou transcrição das imagens). */
async function stepReading(job: JobRecord): Promise<void> {
  const files = await listJobFiles(job.id, job.userId);
  const imageFiles = files.filter((file) => file.purpose === "job_image");
  const pdfFile = files.find((file) => file.purpose === "job_pdf");
  const pdfText = job.extractedText && hasUsefulText(job.extractedText) ? job.extractedText : null;

  let transcribed: string | null = null;
  if (imageFiles.length || (pdfFile && !pdfText)) {
    const images = [];
    for (const imageFile of imageFiles) {
      const { file, buffer } = await loadFile(imageFile.id, job.userId);
      images.push({ buffer, mime: file.mimeType as "image/png" | "image/jpeg" | "image/webp" });
    }
    const pdf = pdfFile && !pdfText ? (await loadFile(pdfFile.id, job.userId)).buffer : null;
    const transcription = await transcribeJobPosting({ userId: job.userId, jobId: job.id, images, pdf });
    if (!transcription.isJobPosting && !job.inputText && !pdfText) {
      throw new ApiError(
        422,
        "O conteúdo enviado não parece ser um anúncio de vaga. Confira as imagens ou cole o texto da vaga.",
        "nao_e_vaga",
      );
    }
    transcribed = transcription.text.trim() || null;
  }

  const extracted = [pdfText, transcribed].filter(Boolean).join("\n\n");
  const description = [job.inputText, extracted].filter(Boolean).join("\n\n---\n\n").trim();
  if (!hasUsefulText(description, 40)) {
    throw new ApiError(422, "Não foi possível obter o texto da vaga. Cole a descrição no campo de texto.", "sem_texto");
  }
  await completePipelineStep(job.id, "leitura", {
    extracted_text: extracted || null,
    description_text: description,
  });
}

function cleanStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter((value) => {
      const key = normalizeForMatch(value).trim();
      if (!value || !key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Ids estáveis para requisitos e limpeza de duplicatas nas palavras-chave. */
export function normalizeAnalysis(ai: JobAnalysisAi): JobAnalysis {
  const seen = new Set<string>();
  const atsKeywords = ai.atsKeywords
    .map((keyword) => ({
      ...keyword,
      term: keyword.term.trim(),
      variants: cleanStrings(keyword.variants).filter(
        (variant) => normalizeForMatch(variant).trim() !== normalizeForMatch(keyword.term).trim(),
      ),
    }))
    .filter((keyword) => {
      const key = normalizeForMatch(keyword.term).trim();
      if (!keyword.term || !key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 40);

  return {
    ...ai,
    title: ai.title.trim(),
    company: ai.company.trim(),
    responsibilities: cleanStrings(ai.responsibilities),
    technicalSkills: cleanStrings(ai.technicalSkills),
    softSkills: cleanStrings(ai.softSkills),
    differentials: cleanStrings(ai.differentials),
    languagesRequired: cleanStrings(ai.languagesRequired),
    suspiciousContent: cleanStrings(ai.suspiciousContent),
    requirements: ai.requirements
      .filter((requirement) => requirement.description.trim())
      .map((requirement, index) => ({
        ...requirement,
        id: `req-${index + 1}`,
        description: requirement.description.trim(),
        keywords: cleanStrings(requirement.keywords),
      })),
    atsKeywords,
  };
}

/** Etapa 2: análise da vaga. A IA vê apenas a vaga, nunca o currículo. */
async function stepAnalysis(job: JobRecord): Promise<void> {
  if (!job.descriptionText) throw new ApiError(409, "A vaga ainda não foi lida.", "sem_texto");
  const ai = await analyzeJobPosting({
    userId: job.userId,
    jobId: job.id,
    description: job.descriptionText,
    hints: { company: job.company, title: job.title },
  });
  const analysis = normalizeAnalysis(ai);
  await completePipelineStep(job.id, "analise", {
    analysis_json: toJson(analysis),
    title: job.title ?? fit(analysis.title, 190),
    company: job.company ?? fit(analysis.company, 190),
    seniority: fit(analysis.seniority, 30),
    location: fit(analysis.location, 190),
    work_model: fit(analysis.workModel, 30),
    match_json: null,
    score_json: null,
    compatibility_score: null,
    tailored_score: null,
  });
}

async function loadBaseResume(job: JobRecord) {
  const resume = await getResumeById(job.baseResumeId, job.userId);
  if (!resume) throw new ApiError(409, "A versão do currículo usada nesta vaga não foi encontrada.", "sem_curriculo");
  return resume;
}

/** Etapa 3: compatibilidade, com evidências conferidas e pontuação calculada pelo código. */
async function stepCompatibility(job: JobRecord): Promise<void> {
  if (!job.analysis) throw new ApiError(409, "A vaga ainda não foi analisada.", "sem_analise");
  const resume = await loadBaseResume(job);
  const ai = await assessCompatibility({ userId: job.userId, jobId: job.id, analysis: job.analysis, resume: resume.data });
  const match = finalizeMatch(job.analysis, ai, resumeToText(resume.data));
  const score = computeScore(job.analysis.requirements, match.requirements, match.keywords);
  await completePipelineStep(job.id, "compatibilidade", {
    match_json: toJson(match),
    score_json: toJson(score),
    compatibility_score: score.total,
    tailored_score: null,
  });
}

export function resolveOutputLanguage(choice: string | null, baseLanguage: string): string {
  if (!choice || choice === "auto") return resolveLocale(baseLanguage || "pt-BR");
  return resolveLocale(choice);
}

/** Etapa 4: personalização + salvaguardas determinísticas. Gera uma nova versão (ainda não verificada). */
async function stepTailoring(job: JobRecord): Promise<void> {
  if (!job.analysis || !job.match) throw new ApiError(409, "Calcule a compatibilidade antes de personalizar.", "sem_compatibilidade");
  const resume = await loadBaseResume(job);
  const base = resume.data;
  const outputLanguage = resolveOutputLanguage(job.outputLanguage, base.language);

  const ai = await tailorResume({
    userId: job.userId,
    jobId: job.id,
    base,
    analysis: job.analysis,
    match: job.match,
    outputLanguage,
  });
  const merged = mergeTailoredResume({ base, ai, outputLanguage, keywords: job.match.keywords });
  const ruled = runFidelityRules(base, merged.resume, job.match.keywords, { autoFix: true });
  const report = buildTailoringReport({
    base,
    tailored: ruled.resume,
    ai,
    model: getModel(),
    outputLanguage,
    translated: resolveLocale(outputLanguage) !== resolveLocale(base.language),
    blocked: merged.blocked,
    autoFixes: ruled.autoFixes,
    warnings: ruled.warnings,
    keywords: job.match.keywords,
  });

  await createTailored({
    jobId: job.id,
    userId: job.userId,
    baseResumeId: resume.id,
    baseSnapshot: base,
    content: ruled.resume,
    report,
    language: outputLanguage,
  });
  await completePipelineStep(job.id, "personalizacao", {
    tailored_score: computeTailoredScore(job.analysis, job.match, ruled.resume),
  });
}

/** Etapa 5: revisor independente + correções + regras finais. */
async function stepVerification(job: JobRecord): Promise<void> {
  if (!job.analysis || !job.match) throw new ApiError(409, "Calcule a compatibilidade antes de verificar.", "sem_compatibilidade");
  const tailored = await getLatestTailored(job.id, job.userId);
  if (!tailored) throw new ApiError(409, "Gere o currículo personalizado antes da verificação.", "sem_personalizacao");
  const base = tailored.baseSnapshot;

  const result = await verifyTailoredResume({ userId: job.userId, jobId: job.id, base, tailored: tailored.aiContent });
  const verified = applyVerifierIssues(base, tailored.aiContent, result.issues);
  const ruled = runFidelityRules(base, verified.resume, job.match.keywords, { autoFix: true });
  const finalContent = ruled.resume;
  const content = tailored.editedAt ? tailored.content : finalContent;

  const report: TailoringReport = refreshReport(
    {
      ...tailored.report,
      autoFixes: [...tailored.report.autoFixes, ...verified.autoFixes, ...ruled.autoFixes],
      warnings: [...verified.warnings, ...ruled.warnings],
      verification: {
        status: "concluida",
        issuesFound: result.issues.length,
        checkedAt: new Date().toISOString(),
        error: null,
        summary: result.summary.trim(),
      },
    },
    base,
    content,
    job.match.keywords,
  );

  await saveVerification(tailored.id, { aiContent: finalContent, content, report });
  await completePipelineStep(job.id, "verificacao", {
    tailored_score: computeTailoredScore(job.analysis, job.match, content),
  });
}
