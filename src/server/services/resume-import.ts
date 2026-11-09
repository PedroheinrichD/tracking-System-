import "server-only";
import { LIMITS } from "@/lib/constants";
import { parseResumeLenient, SKILL_CATEGORIES, type ResumeData } from "@/lib/domain/resume";
import { getModel } from "@/server/ai/client";
import type { ExtractedResume } from "@/server/ai/schemas";
import { extractResumeFromPdf } from "@/server/ai/tasks";
import { ApiError } from "@/server/http";
import { readPdfText } from "@/server/pdf/extract";
import { createResumeVersion } from "@/server/repositories/resumes";
import { deleteFile, detectFileType, saveFile } from "@/server/storage/files";

function cleanList(values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => value.replace(/^[\s•▪◦·\-–—*]+/, "").trim())
    .filter((value) => {
      const key = value.toLowerCase();
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Converte a extração da IA no formato interno, atribuindo ids estáveis pelo código. */
export function toResumeData(extracted: ExtractedResume): ResumeData {
  const skills = Object.fromEntries(
    SKILL_CATEGORIES.map((category) => [category, cleanList(extracted.skills[category])]),
  ) as ResumeData["skills"];

  return parseResumeLenient({
    language: extracted.language.trim() || "pt-BR",
    personal: {
      ...extracted.personal,
      links: extracted.personal.links.filter((link) => link.url.trim()),
    },
    summary: extracted.summary.trim(),
    experiences: extracted.experiences.map((experience, index) => ({
      ...experience,
      id: `exp-${index + 1}`,
      highlights: cleanList(experience.highlights),
      technologies: cleanList(experience.technologies),
    })),
    education: extracted.education.map((education, index) => ({ ...education, id: `edu-${index + 1}` })),
    certifications: extracted.certifications.map((certification, index) => ({ ...certification, id: `cert-${index + 1}` })),
    projects: extracted.projects.map((project, index) => ({
      ...project,
      id: `proj-${index + 1}`,
      highlights: cleanList(project.highlights),
      technologies: cleanList(project.technologies),
    })),
    skills,
    languages: extracted.languages.filter((language) => language.name.trim()),
    additionalInfo: cleanList(extracted.additionalInfo),
  });
}

function looksLikeResume(data: ResumeData): boolean {
  const skillCount = SKILL_CATEGORIES.reduce((total, category) => total + data.skills[category].length, 0);
  return Boolean(
    data.personal.fullName.trim() ||
      data.experiences.length ||
      data.education.length ||
      data.projects.length ||
      skillCount > 0,
  );
}

/**
 * Importa um currículo em PDF como nova versão ativa:
 * valida o arquivo → extrai o texto localmente → a IA estrutura os dados a partir
 * do PDF (inclusive escaneado) → salva arquivo e versão. Nada é gravado se falhar.
 */
export async function importResumePdf(userId: number, file: File): Promise<number> {
  if (file.size === 0) throw new ApiError(400, "O arquivo enviado está vazio.", "arquivo_vazio");
  if (file.size > LIMITS.resumePdfBytes) {
    throw new ApiError(413, "O currículo deve ter no máximo 5 MB.", "arquivo_grande");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (detectFileType(buffer) !== "pdf") {
    throw new ApiError(415, "Envie o currículo em formato PDF.", "tipo_invalido");
  }

  const { text } = await readPdfText(buffer, { maxPages: LIMITS.resumePdfPages, label: "PDF do currículo" });
  const extracted = await extractResumeFromPdf({ userId, pdf: buffer });
  const data = toResumeData(extracted);
  if (!looksLikeResume(data)) {
    throw new ApiError(
      422,
      "Não encontramos informações de currículo neste PDF. Confira o arquivo ou preencha os dados manualmente.",
      "sem_conteudo",
    );
  }

  const stored = await saveFile({ userId, purpose: "resume_source", buffer, type: "pdf", originalName: file.name });
  try {
    return await createResumeVersion({
      userId,
      sourceType: "pdf",
      sourceFileId: stored.id,
      rawText: text || null,
      data,
      extracted: data,
      warnings: cleanList(extracted.warnings),
      model: getModel(),
    });
  } catch (error) {
    await deleteFile(stored);
    throw error;
  }
}
