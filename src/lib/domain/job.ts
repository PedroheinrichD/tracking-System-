import { z } from "zod";

/**
 * Schemas das respostas estruturadas da IA sobre vagas e compatibilidade, e os
 * tipos armazenados depois do pós-processamento feito pelo código.
 * Os schemas de IA não usam defaults/opcionais: todo campo é obrigatório no JSON
 * gerado (exigência das saídas estruturadas), com "" ou [] quando não houver dado.
 */

export const SENIORITY_VALUES = [
  "estagio",
  "junior",
  "pleno",
  "senior",
  "especialista",
  "gestao",
  "nao_informado",
] as const;
export const WORK_MODEL_VALUES = ["remoto", "hibrido", "presencial", "nao_informado"] as const;
export const REQUIREMENT_CATEGORIES = [
  "tecnico",
  "comportamental",
  "experiencia",
  "formacao",
  "idioma",
  "certificacao",
  "outro",
] as const;
export const IMPORTANCE_VALUES = ["obrigatorio", "desejavel"] as const;
export const KEYWORD_PRIORITIES = ["alta", "media", "baixa"] as const;
export const KEYWORD_CATEGORIES = [
  "tecnologia",
  "ferramenta",
  "metodologia",
  "competencia_tecnica",
  "competencia_comportamental",
  "certificacao",
  "formacao",
  "cargo",
  "dominio",
  "idioma",
  "outro",
] as const;
export const REQUIREMENT_STATUSES = ["atendido", "parcial", "nao_atendido"] as const;
export const EVIDENCE_TYPES = ["profissional", "projeto", "formacao", "curso", "declarado", "nenhuma"] as const;
export const KEYWORD_MATCH_STATUSES = ["presente", "equivalente", "ausente"] as const;

export type Importance = (typeof IMPORTANCE_VALUES)[number];
export type KeywordPriority = (typeof KEYWORD_PRIORITIES)[number];
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
export type KeywordMatchStatus = (typeof KEYWORD_MATCH_STATUSES)[number];

// ── Análise da vaga ──────────────────────────────────────────────────────────

export const JobAnalysisAiSchema = z.object({
  title: z.string().describe("Cargo exatamente como aparece na vaga"),
  company: z.string().describe("Nome da empresa contratante; vazio se não informado"),
  seniority: z.enum(SENIORITY_VALUES),
  seniorityEvidence: z.string().describe("Trecho ou raciocínio curto que justifica o nível"),
  location: z.string(),
  workModel: z.enum(WORK_MODEL_VALUES),
  employmentType: z.string().describe("CLT, PJ, estágio, temporário…; vazio se não informado"),
  summary: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(
    z.object({
      description: z.string(),
      category: z.enum(REQUIREMENT_CATEGORIES),
      importance: z.enum(IMPORTANCE_VALUES),
      keywords: z.array(z.string()),
    }),
  ),
  technologies: z.array(z.object({ name: z.string(), importance: z.enum(IMPORTANCE_VALUES) })),
  technicalSkills: z.array(z.string()),
  softSkills: z.array(z.string()),
  experienceRequired: z.string(),
  minYearsExperience: z.number().nullable(),
  educationRequired: z.string(),
  languagesRequired: z.array(z.string()),
  differentials: z.array(z.string()),
  atsKeywords: z.array(
    z.object({
      term: z.string(),
      variants: z.array(z.string()),
      priority: z.enum(KEYWORD_PRIORITIES),
      category: z.enum(KEYWORD_CATEGORIES),
    }),
  ),
  postingLanguage: z.string().describe('Idioma do anúncio, ex.: "pt-BR", "en"'),
  suspiciousContent: z.array(z.string()),
});
export type JobAnalysisAi = z.infer<typeof JobAnalysisAiSchema>;

export type JobRequirement = JobAnalysisAi["requirements"][number] & { id: string };
export type AtsKeyword = JobAnalysisAi["atsKeywords"][number];
export type JobAnalysis = Omit<JobAnalysisAi, "requirements"> & { requirements: JobRequirement[] };

// ── Compatibilidade ─────────────────────────────────────────────────────────

export const MatchAiSchema = z.object({
  requirements: z.array(
    z.object({
      requirementId: z.string(),
      status: z.enum(REQUIREMENT_STATUSES),
      evidenceType: z.enum(EVIDENCE_TYPES),
      evidenceQuotes: z.array(z.string()),
      explanation: z.string(),
    }),
  ),
  keywords: z.array(
    z.object({
      term: z.string(),
      status: z.enum(KEYWORD_MATCH_STATUSES),
      matchedText: z.string(),
    }),
  ),
  strengths: z.array(z.string()),
  improvements: z.array(z.object({ kind: z.enum(["redacao", "lacuna"]), text: z.string() })),
  seniorityFit: z.object({
    assessment: z.enum(["abaixo", "compativel", "acima", "indefinido"]),
    explanation: z.string(),
  }),
  overview: z.string(),
});
export type MatchAi = z.infer<typeof MatchAiSchema>;

export interface EvidenceQuote {
  quote: string;
  verified: boolean;
}

export interface RequirementAssessment {
  requirementId: string;
  status: RequirementStatus;
  evidenceType: EvidenceType;
  evidence: EvidenceQuote[];
  explanation: string;
  /** Preenchido quando o código ajustou o status sugerido pela IA. */
  adjustment: string | null;
}

export interface KeywordAssessment {
  term: string;
  variants: string[];
  priority: KeywordPriority;
  category: AtsKeyword["category"];
  status: KeywordMatchStatus;
  matchedText: string;
  /** "texto": encontrado pelo código; "ia": equivalência semântica confirmada no texto. */
  source: "texto" | "ia" | "nenhum";
}

export interface MatchResult {
  requirements: RequirementAssessment[];
  keywords: KeywordAssessment[];
  strengths: string[];
  improvements: MatchAi["improvements"];
  seniorityFit: MatchAi["seniorityFit"];
  overview: string;
}

export interface CountSummary {
  total: number;
  met: number;
  partial: number;
  notMet: number;
}

export interface ScoreBreakdown {
  total: number;
  weights: { requirements: number; keywords: number };
  requirements: {
    score: number;
    points: number;
    maxPoints: number;
    mandatory: CountSummary;
    preferred: CountSummary;
  } | null;
  keywords: {
    score: number;
    points: number;
    maxPoints: number;
    total: number;
    present: number;
    equivalent: number;
    missing: number;
  } | null;
}
