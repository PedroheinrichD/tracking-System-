import type {
  CountSummary,
  Importance,
  JobRequirement,
  KeywordAssessment,
  KeywordMatchStatus,
  KeywordPriority,
  RequirementAssessment,
  RequirementStatus,
  ScoreBreakdown,
} from "@/lib/domain/job";

/**
 * Pontuação de compatibilidade (estimativa própria, não é a nota de nenhum ATS):
 *
 *   total = 70% × requisitos + 30% × palavras-chave
 *
 * Requisitos: obrigatório vale 3 pontos, desejável vale 1;
 *   atendido = 100% do peso, parcial = 50%, não atendido = 0.
 * Palavras-chave: prioridade alta = 3, média = 2, baixa = 1;
 *   presente = 100%, equivalente = 75%, ausente = 0.
 */
export const SCORE_WEIGHTS = { requirements: 0.7, keywords: 0.3 } as const;
export const IMPORTANCE_POINTS: Record<Importance, number> = { obrigatorio: 3, desejavel: 1 };
export const STATUS_FACTOR: Record<RequirementStatus, number> = { atendido: 1, parcial: 0.5, nao_atendido: 0 };
export const PRIORITY_POINTS: Record<KeywordPriority, number> = { alta: 3, media: 2, baixa: 1 };
export const KEYWORD_FACTOR: Record<KeywordMatchStatus, number> = { presente: 1, equivalente: 0.75, ausente: 0 };

function emptyCount(): CountSummary {
  return { total: 0, met: 0, partial: 0, notMet: 0 };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function computeScore(
  requirements: JobRequirement[],
  assessments: RequirementAssessment[],
  keywords: KeywordAssessment[],
): ScoreBreakdown {
  const byId = new Map(assessments.map((assessment) => [assessment.requirementId, assessment]));

  let requirementPart: ScoreBreakdown["requirements"] = null;
  if (requirements.length) {
    const mandatory = emptyCount();
    const preferred = emptyCount();
    let points = 0;
    let maxPoints = 0;
    for (const requirement of requirements) {
      const status = byId.get(requirement.id)?.status ?? "nao_atendido";
      const weight = IMPORTANCE_POINTS[requirement.importance];
      maxPoints += weight;
      points += weight * STATUS_FACTOR[status];
      const bucket = requirement.importance === "obrigatorio" ? mandatory : preferred;
      bucket.total += 1;
      if (status === "atendido") bucket.met += 1;
      else if (status === "parcial") bucket.partial += 1;
      else bucket.notMet += 1;
    }
    requirementPart = {
      score: Math.round((points / maxPoints) * 100),
      points: round1(points),
      maxPoints,
      mandatory,
      preferred,
    };
  }

  let keywordPart: ScoreBreakdown["keywords"] = null;
  if (keywords.length) {
    let points = 0;
    let maxPoints = 0;
    for (const keyword of keywords) {
      const weight = PRIORITY_POINTS[keyword.priority];
      maxPoints += weight;
      points += weight * KEYWORD_FACTOR[keyword.status];
    }
    keywordPart = {
      score: Math.round((points / maxPoints) * 100),
      points: round1(points),
      maxPoints,
      total: keywords.length,
      present: keywords.filter((keyword) => keyword.status === "presente").length,
      equivalent: keywords.filter((keyword) => keyword.status === "equivalente").length,
      missing: keywords.filter((keyword) => keyword.status === "ausente").length,
    };
  }

  let total = 0;
  if (requirementPart && keywordPart) {
    total =
      SCORE_WEIGHTS.requirements * requirementPart.score + SCORE_WEIGHTS.keywords * keywordPart.score;
  } else if (requirementPart) {
    total = requirementPart.score;
  } else if (keywordPart) {
    total = keywordPart.score;
  }

  return {
    total: Math.round(total),
    weights: { ...SCORE_WEIGHTS },
    requirements: requirementPart,
    keywords: keywordPart,
  };
}
