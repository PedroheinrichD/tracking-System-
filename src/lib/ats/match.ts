import type { JobAnalysis, MatchAi, MatchResult, RequirementAssessment } from "@/lib/domain/job";
import { isQuoteInText } from "./evidence";
import { assessKeywords } from "./keywords";

/**
 * Consolida a avaliação da IA com verificações do código:
 * - todo requisito da vaga recebe uma avaliação (faltantes viram "não atendido");
 * - cada trecho de evidência é conferido no texto do currículo;
 * - "atendido" sem nenhuma evidência confirmada é rebaixado para "parcial";
 * - palavras-chave são reavaliadas de forma determinística.
 */
export function finalizeMatch(analysis: JobAnalysis, ai: MatchAi, resumeText: string): MatchResult {
  const aiById = new Map(ai.requirements.map((assessment) => [assessment.requirementId, assessment]));

  const requirements: RequirementAssessment[] = analysis.requirements.map((requirement) => {
    const assessment = aiById.get(requirement.id);
    if (!assessment) {
      return {
        requirementId: requirement.id,
        status: "nao_atendido",
        evidenceType: "nenhuma",
        evidence: [],
        explanation: "A IA não retornou avaliação para este requisito; considerado não atendido.",
        adjustment: "Avaliação ausente na resposta da IA.",
      };
    }

    const evidence = assessment.evidenceQuotes
      .map((quote) => quote.trim())
      .filter(Boolean)
      .slice(0, 3)
      .map((quote) => ({ quote, verified: isQuoteInText(quote, resumeText) }));
    const hasVerified = evidence.some((item) => item.verified);

    let status = assessment.status;
    let adjustment: string | null = null;
    if (status === "atendido" && !hasVerified) {
      status = "parcial";
      adjustment = "Rebaixado de “atendido” para “parcial”: a evidência citada não foi encontrada no currículo.";
    } else if (status === "parcial" && evidence.length > 0 && !hasVerified) {
      adjustment = "A evidência citada não foi localizada literalmente no currículo.";
    }

    return {
      requirementId: requirement.id,
      status,
      evidenceType: status === "nao_atendido" ? "nenhuma" : assessment.evidenceType,
      evidence,
      explanation: assessment.explanation.trim(),
      adjustment,
    };
  });

  return {
    requirements,
    keywords: assessKeywords(analysis.atsKeywords, resumeText, ai.keywords),
    strengths: ai.strengths.map((item) => item.trim()).filter(Boolean),
    improvements: ai.improvements.filter((item) => item.text.trim()),
    seniorityFit: ai.seniorityFit,
    overview: ai.overview.trim(),
  };
}
