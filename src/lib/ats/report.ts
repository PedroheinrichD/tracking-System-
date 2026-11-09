import type { JobAnalysis, KeywordAssessment, MatchAi, MatchResult } from "@/lib/domain/job";
import {
  DEFAULT_SECTION_ORDER,
  SKILL_CATEGORIES,
  sectionHasContent,
  type ResumeData,
  type SectionKey,
  type TailoredResume,
} from "@/lib/domain/resume";
import type {
  AutoFix,
  BlockedItem,
  FidelityWarning,
  Reorganization,
  TailorAi,
  TailoringReport,
  VerificationInfo,
} from "@/lib/domain/tailoring";
import { listTextFields } from "@/lib/resume/fields";
import { resumeToText } from "@/lib/resume/text";
import { assessKeywords, keywordCoverage } from "./keywords";
import { containsExact, containsTerm, normalizeForMatch, sameTerm } from "./normalize";
import { computeScore } from "./score";

/** Equivalências semânticas já verificadas na compatibilidade, reaproveitadas para o texto personalizado. */
export function semanticEquivalents(keywords: KeywordAssessment[]): MatchAi["keywords"] {
  return keywords
    .filter((keyword) => keyword.source === "ia")
    .map((keyword) => ({ term: keyword.term, status: "equivalente" as const, matchedText: keyword.matchedText }));
}

/**
 * Palavras-chave no currículo personalizado. Termos que o original não sustenta
 * (ausentes na compatibilidade) continuam contando como ausentes, mesmo que
 * apareçam no texto: a métrica não pode premiar uma afirmação sem respaldo.
 */
export function assessTailoredKeywords(tailored: TailoredResume, keywords: KeywordAssessment[]): KeywordAssessment[] {
  const unsupported = new Set(
    keywords.filter((keyword) => keyword.status === "ausente").map((keyword) => normalizeForMatch(keyword.term).trim()),
  );
  return assessKeywords(keywords, resumeToText(tailored), semanticEquivalents(keywords)).map((keyword) =>
    unsupported.has(normalizeForMatch(keyword.term).trim())
      ? { ...keyword, status: "ausente" as const, matchedText: "", source: "nenhum" as const }
      : keyword,
  );
}

/**
 * Pontuação do currículo personalizado: os requisitos não mudam (os fatos são
 * os mesmos); só a cobertura de palavras-chave é recalculada sobre o novo texto.
 */
export function computeTailoredScore(analysis: JobAnalysis, match: MatchResult, tailored: TailoredResume): number {
  return computeScore(analysis.requirements, match.requirements, assessTailoredKeywords(tailored, match.keywords)).total;
}

function orderChanges<T extends { id: string }>(
  section: SectionKey,
  before: T[],
  after: T[],
  label: (item: T) => string,
): Reorganization["moved"] {
  const afterIds = after.map((item) => item.id);
  const keptBefore = before.map((item) => item.id).filter((id) => afterIds.includes(id));
  const moved: Reorganization["moved"] = [];
  after.forEach((item, to) => {
    const from = keptBefore.indexOf(item.id);
    if (from !== -1 && from !== to) moved.push({ section, label: label(item), from: from + 1, to: to + 1 });
  });
  return moved;
}

export function computeReorganization(base: ResumeData, tailored: TailoredResume): Reorganization {
  const sectionOrderBefore = DEFAULT_SECTION_ORDER.filter((key) => sectionHasContent(base, key));
  const moved = [
    ...orderChanges("projects", base.projects, tailored.projects, (project) => project.name || "Projeto"),
    ...orderChanges("certifications", base.certifications, tailored.certifications, (item) => item.name || "Curso"),
  ];

  const omitted: Reorganization["omitted"] = [];
  for (const project of base.projects) {
    if (!tailored.projects.some((item) => item.id === project.id)) {
      omitted.push({ section: "projects", label: project.name || "Projeto", itemId: project.id });
    }
  }
  for (const certification of base.certifications) {
    if (!tailored.certifications.some((item) => item.id === certification.id)) {
      omitted.push({ section: "certifications", label: certification.name || "Curso", itemId: certification.id });
    }
  }
  // Uma competência só conta como omitida se sumiu do currículo inteiro
  // (renomear "Scrum" para "Metodologias ágeis (Scrum)" não é omissão).
  const tailoredSkills = SKILL_CATEGORIES.flatMap((category) => tailored.skills[category]);
  const tailoredText = normalizeForMatch(resumeToText(tailored));
  for (const category of SKILL_CATEGORIES) {
    for (const skill of base.skills[category]) {
      const kept =
        tailoredSkills.some((item) => sameTerm(item, skill) || sameTerm(skill, item)) || containsTerm(tailoredText, skill);
      if (!kept) omitted.push({ section: "skills", label: skill, itemId: null });
    }
  }

  // Competências que subiram de posição dentro da categoria.
  const skillsPromoted: string[] = [];
  for (const category of SKILL_CATEGORIES) {
    const before = base.skills[category];
    tailored.skills[category].forEach((skill, to) => {
      const from = before.findIndex((item) => sameTerm(item, skill) || sameTerm(skill, item));
      if (from > to) skillsPromoted.push(skill);
    });
  }

  return {
    sectionOrderBefore,
    sectionOrderAfter: tailored.sectionOrder,
    moved,
    omitted,
    skillsPromoted: skillsPromoted.slice(0, 12),
  };
}

/**
 * Palavras-chave da vaga cujo termo exato passou a aparecer no currículo
 * personalizado (no original havia apenas um equivalente).
 */
export function computeKeywordsAdded(
  base: ResumeData,
  tailored: TailoredResume,
  keywords: KeywordAssessment[],
): string[] {
  const baseNorm = normalizeForMatch(resumeToText(base));
  const tailoredNorm = normalizeForMatch(resumeToText(tailored));
  return keywords
    .filter((keyword) => keyword.status !== "ausente")
    .filter((keyword) => !containsExact(baseNorm, keyword.term) && containsExact(tailoredNorm, keyword.term))
    .map((keyword) => keyword.term);
}

export function pendingVerification(): VerificationInfo {
  return { status: "pendente", issuesFound: 0, checkedAt: null, error: null, summary: "" };
}

/** Lacunas: as apontadas pela IA + palavras-chave de prioridade alta ausentes que ela não citou. */
function mergeMissingSkills(ai: TailorAi["missingSkills"], keywords: KeywordAssessment[]): TailoringReport["missingSkills"] {
  const result = ai
    .filter((item) => item.skill.trim())
    .map((item) => ({ skill: item.skill.trim(), importance: item.importance, note: item.note.trim() }));
  for (const keyword of keywords) {
    if (keyword.status !== "ausente" || keyword.priority !== "alta") continue;
    if (result.some((item) => sameTerm(item.skill, keyword.term) || sameTerm(keyword.term, item.skill))) continue;
    result.push({
      skill: keyword.term,
      importance: "obrigatorio",
      note: "Palavra-chave importante da vaga que não aparece no seu currículo; não foi adicionada.",
    });
  }
  return result;
}

export function buildTailoringReport(input: {
  base: ResumeData;
  tailored: TailoredResume;
  ai: TailorAi;
  model: string;
  outputLanguage: string;
  translated: boolean;
  blocked: BlockedItem[];
  autoFixes: AutoFix[];
  warnings: FidelityWarning[];
  keywords: KeywordAssessment[];
}): TailoringReport {
  return {
    model: input.model,
    generatedAt: new Date().toISOString(),
    outputLanguage: input.outputLanguage,
    translated: input.translated,
    keywordsUsed: input.ai.keywordsUsed.map((keyword) => keyword.trim()).filter(Boolean),
    keywordsAdded: computeKeywordsAdded(input.base, input.tailored, input.keywords),
    keywordCoverage: {
      before: keywordCoverage(input.keywords),
      after: keywordCoverage(assessTailoredKeywords(input.tailored, input.keywords)),
      total: input.keywords.length,
    },
    missingSkills: mergeMissingSkills(input.ai.missingSkills, input.keywords),
    changes: input.ai.changes.filter((change) => change.description.trim()),
    reorganization: computeReorganization(input.base, input.tailored),
    blocked: input.blocked,
    autoFixes: input.autoFixes,
    warnings: input.warnings,
    verification: pendingVerification(),
    suggestions: input.ai.suggestions.map((suggestion) => suggestion.trim()).filter(Boolean),
  };
}

/** Recalcula as partes do relatório que dependem do conteúdo (após verificação ou edição). */
export function refreshReport(
  report: TailoringReport,
  base: ResumeData,
  content: TailoredResume,
  keywords: KeywordAssessment[],
): TailoringReport {
  return {
    ...report,
    keywordsAdded: computeKeywordsAdded(base, content, keywords),
    keywordCoverage: {
      before: keywordCoverage(keywords),
      after: keywordCoverage(assessTailoredKeywords(content, keywords)),
      total: keywords.length,
    },
    reorganization: computeReorganization(base, content),
  };
}

/** Mantém alertas do verificador cujo campo não foi alterado pelo usuário. */
export function carryVerifierWarnings(
  warnings: FidelityWarning[],
  aiContent: TailoredResume,
  content: TailoredResume,
): FidelityWarning[] {
  const aiTexts = new Map(listTextFields(aiContent).map((field) => [field.path, field.text]));
  const currentTexts = new Map(listTextFields(content).map((field) => [field.path, field.text]));
  return warnings.filter(
    (warning) => warning.source === "verificacao_ia" && aiTexts.get(warning.path) === currentTexts.get(warning.path),
  );
}
