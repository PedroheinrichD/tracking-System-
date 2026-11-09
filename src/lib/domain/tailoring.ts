import { z } from "zod";
import { IMPORTANCE_VALUES, type Importance } from "./job";
import { SECTION_KEYS, type SectionKey } from "./resume";

/**
 * Resposta da IA na personalização. A IA não devolve o currículo inteiro: ela
 * referencia os itens do original pelos ids e só fornece o que pode mudar
 * (textos, ordem, seleção). Fatos (empresa, cargo, datas, formação) são
 * copiados do original pelo código.
 */
const SkillsAiSchema = z.object({
  programmingLanguages: z.array(z.string()),
  frameworks: z.array(z.string()),
  databases: z.array(z.string()),
  tools: z.array(z.string()),
  otherTechnical: z.array(z.string()),
  softSkills: z.array(z.string()),
});

const RewrittenItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  highlights: z.array(z.string()),
  technologies: z.array(z.string()),
});

export const TailorAiSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  sectionOrder: z.array(z.enum(SECTION_KEYS)),
  experiences: z.array(RewrittenItemSchema),
  projects: z.array(RewrittenItemSchema),
  certificationIds: z.array(z.string()),
  skills: SkillsAiSchema,
  translations: z.object({
    location: z.string(),
    experiences: z.array(
      z.object({
        id: z.string(),
        role: z.string(),
        employmentType: z.string(),
        location: z.string(),
        startDate: z.string(),
        endDate: z.string(),
      }),
    ),
    education: z.array(
      z.object({
        id: z.string(),
        degree: z.string(),
        field: z.string(),
        status: z.string(),
        details: z.string(),
        startDate: z.string(),
        endDate: z.string(),
      }),
    ),
    certifications: z.array(z.object({ id: z.string(), name: z.string(), workload: z.string(), date: z.string() })),
    projects: z.array(z.object({ id: z.string(), name: z.string(), startDate: z.string(), endDate: z.string() })),
    languages: z.array(z.object({ name: z.string(), level: z.string() })),
    additionalInfo: z.array(z.string()),
  }),
  keywordsUsed: z.array(z.string()),
  missingSkills: z.array(
    z.object({ skill: z.string(), importance: z.enum(IMPORTANCE_VALUES), note: z.string() }),
  ),
  changes: z.array(z.object({ section: z.enum(SECTION_KEYS), itemId: z.string(), description: z.string() })),
  suggestions: z.array(z.string()),
});
export type TailorAi = z.infer<typeof TailorAiSchema>;

export const FIDELITY_SEVERITIES = ["alta", "media", "baixa"] as const;
export type FidelitySeverity = (typeof FIDELITY_SEVERITIES)[number];

export const VerifyAiSchema = z.object({
  issues: z.array(
    z.object({
      path: z.string(),
      claim: z.string(),
      reason: z.string(),
      severity: z.enum(FIDELITY_SEVERITIES),
      fixedText: z.string(),
    }),
  ),
  summary: z.string(),
});
export type VerifyAi = z.infer<typeof VerifyAiSchema>;

// ── Relatório salvo junto com cada versão personalizada ─────────────────────

export interface BlockedItem {
  kind: "competencia" | "tecnologia" | "item";
  value: string;
  location: string;
  reason: string;
}

export interface AutoFix {
  path: string;
  label: string;
  before: string;
  after: string;
  reason: string;
  source: "verificacao_ia" | "regra";
}

export interface FidelityWarning {
  path: string;
  label: string;
  message: string;
  severity: FidelitySeverity;
  source: "verificacao_ia" | "regra" | "edicao";
}

export interface Reorganization {
  sectionOrderBefore: SectionKey[];
  sectionOrderAfter: SectionKey[];
  moved: { section: SectionKey; label: string; from: number; to: number }[];
  omitted: { section: SectionKey; label: string; itemId: string | null }[];
  skillsPromoted: string[];
}

export interface VerificationInfo {
  status: "pendente" | "concluida" | "falhou";
  issuesFound: number;
  checkedAt: string | null;
  error: string | null;
  summary: string;
}

export interface TailoringReport {
  model: string;
  generatedAt: string;
  outputLanguage: string;
  translated: boolean;
  keywordsUsed: string[];
  keywordsAdded: string[];
  keywordCoverage: { before: number; after: number; total: number };
  missingSkills: { skill: string; importance: Importance; note: string }[];
  changes: { section: SectionKey; itemId: string; description: string }[];
  reorganization: Reorganization;
  blocked: BlockedItem[];
  autoFixes: AutoFix[];
  warnings: FidelityWarning[];
  verification: VerificationInfo;
  suggestions: string[];
}
