import type { AtsKeyword, KeywordAssessment, MatchAi } from "@/lib/domain/job";
import { isQuoteInText } from "./evidence";
import { containsExact, findTerm, normalizeForMatch } from "./normalize";

function dedupeKeywords(keywords: AtsKeyword[]): AtsKeyword[] {
  const seen = new Set<string>();
  return keywords.filter((keyword) => {
    const key = normalizeForMatch(keyword.term).trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Avalia cada palavra-chave da vaga contra um texto de currículo.
 * 1) termo exato → "presente"; 2) variação/sinônimo conhecido → "equivalente";
 * 3) equivalência semântica apontada pela IA, desde que o trecho citado exista
 *    de fato no texto → "equivalente"; 4) caso contrário → "ausente".
 */
export function assessKeywords(
  keywords: AtsKeyword[],
  resumeText: string,
  aiKeywords: MatchAi["keywords"] = [],
): KeywordAssessment[] {
  const normalizedText = normalizeForMatch(resumeText);
  const aiByTerm = new Map(aiKeywords.map((keyword) => [normalizeForMatch(keyword.term).trim(), keyword]));

  return dedupeKeywords(keywords).map((keyword) => {
    const base = {
      term: keyword.term,
      variants: keyword.variants,
      priority: keyword.priority,
      category: keyword.category,
    };

    if (containsExact(normalizedText, keyword.term)) {
      return { ...base, status: "presente", matchedText: keyword.term, source: "texto" } satisfies KeywordAssessment;
    }

    const form = findTerm(normalizedText, keyword.term, keyword.variants);
    if (form) {
      return { ...base, status: "equivalente", matchedText: form, source: "texto" } satisfies KeywordAssessment;
    }

    const ai = aiByTerm.get(normalizeForMatch(keyword.term).trim());
    if (ai && ai.status !== "ausente" && ai.matchedText.trim() && isQuoteInText(ai.matchedText, resumeText)) {
      return { ...base, status: "equivalente", matchedText: ai.matchedText.trim(), source: "ia" } satisfies KeywordAssessment;
    }

    return { ...base, status: "ausente", matchedText: "", source: "nenhum" } satisfies KeywordAssessment;
  });
}

/**
 * Percentual de palavras-chave da vaga presentes com o termo EXATO — é o que um
 * ATS de busca literal encontra. Equivalentes não contam aqui (contam na nota).
 */
export function keywordCoverage(assessments: KeywordAssessment[]): number {
  if (!assessments.length) return 0;
  const exact = assessments.filter((assessment) => assessment.status === "presente").length;
  return Math.round((exact / assessments.length) * 100);
}
