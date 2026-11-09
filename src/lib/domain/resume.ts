import { z } from "zod";

/**
 * Estrutura do currículo usada em todo o sistema: currículo original (base),
 * versões personalizadas, editor e gerador de PDF.
 * Campos ausentes são strings vazias ou listas vazias, nunca null.
 */

export const SECTION_KEYS = [
  "summary",
  "skills",
  "experience",
  "projects",
  "education",
  "certifications",
  "languages",
  "additional",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const DEFAULT_SECTION_ORDER: SectionKey[] = [...SECTION_KEYS];

export const SKILL_CATEGORIES = [
  "programmingLanguages",
  "frameworks",
  "databases",
  "tools",
  "otherTechnical",
  "softSkills",
] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const CERTIFICATION_KINDS = ["curso", "certificacao"] as const;

const text = (max: number) => z.string().max(max).default("");
const list = (itemMax: number, maxItems: number) => z.array(z.string().max(itemMax)).max(maxItems).default([]);
const itemId = z.string().min(1).max(40);

export const LinkSchema = z.object({
  label: text(60),
  url: text(300),
});

export const PersonalSchema = z.object({
  fullName: text(120),
  headline: text(200),
  email: text(160),
  phone: text(60),
  location: text(120),
  links: z.array(LinkSchema).max(8).default([]),
});

export const ExperienceSchema = z.object({
  id: itemId,
  company: text(160),
  role: text(160),
  employmentType: text(60),
  location: text(120),
  startDate: text(40),
  endDate: text(40),
  current: z.boolean().default(false),
  description: text(2500),
  highlights: list(700, 30),
  technologies: list(80, 50),
});

export const EducationSchema = z.object({
  id: itemId,
  institution: text(200),
  degree: text(160),
  field: text(160),
  startDate: text(40),
  endDate: text(40),
  status: text(60),
  details: text(1000),
});

export const CertificationSchema = z.object({
  id: itemId,
  name: text(200),
  issuer: text(160),
  date: text(40),
  workload: text(40),
  url: text(300),
  kind: z.enum(CERTIFICATION_KINDS).default("curso"),
});

export const ProjectSchema = z.object({
  id: itemId,
  name: text(160),
  description: text(2500),
  highlights: list(700, 20),
  technologies: list(80, 50),
  url: text(300),
  startDate: text(40),
  endDate: text(40),
});

export const SkillsSchema = z.object({
  programmingLanguages: list(80, 60),
  frameworks: list(80, 60),
  databases: list(80, 60),
  tools: list(80, 60),
  otherTechnical: list(120, 60),
  softSkills: list(120, 40),
});

export const SpokenLanguageSchema = z.object({
  name: text(60),
  level: text(80),
});

export const ResumeDataSchema = z.object({
  language: text(10),
  personal: PersonalSchema.prefault({}),
  summary: text(3000),
  experiences: z.array(ExperienceSchema).max(40).default([]),
  education: z.array(EducationSchema).max(20).default([]),
  certifications: z.array(CertificationSchema).max(60).default([]),
  projects: z.array(ProjectSchema).max(30).default([]),
  skills: SkillsSchema.prefault({}),
  languages: z.array(SpokenLanguageSchema).max(12).default([]),
  additionalInfo: list(500, 20),
});

export const TailoredResumeSchema = ResumeDataSchema.extend({
  sectionOrder: z.array(z.enum(SECTION_KEYS)).max(SECTION_KEYS.length).default(DEFAULT_SECTION_ORDER),
});

export type ResumeLink = z.infer<typeof LinkSchema>;
export type Personal = z.infer<typeof PersonalSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Certification = z.infer<typeof CertificationSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Skills = z.infer<typeof SkillsSchema>;
export type SpokenLanguage = z.infer<typeof SpokenLanguageSchema>;
export type ResumeData = z.infer<typeof ResumeDataSchema>;
export type TailoredResume = z.infer<typeof TailoredResumeSchema>;

export function emptyResume(language = "pt-BR"): ResumeData {
  return ResumeDataSchema.parse({ language });
}

type PathKey = string | number;

function setAtPath(target: unknown, path: PathKey[], update: (value: unknown) => unknown): void {
  let cursor = target as Record<PathKey, unknown>;
  for (let index = 0; index < path.length - 1; index += 1) {
    const next = cursor?.[path[index]];
    if (next === null || typeof next !== "object") return;
    cursor = next as Record<PathKey, unknown>;
  }
  const last = path[path.length - 1];
  if (cursor && last in cursor) cursor[last] = update(cursor[last]);
}

/**
 * Valida dados de currículo vindos da IA: textos e listas acima do limite são
 * cortados em vez de rejeitar a extração inteira.
 */
export function parseResumeLenient(raw: unknown): ResumeData {
  const copy = structuredClone(raw);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = ResumeDataSchema.safeParse(copy);
    if (result.success) return result.data;
    let fixed = false;
    for (const issue of result.error.issues) {
      if (issue.code !== "too_big") continue;
      const limit = Number(issue.maximum);
      setAtPath(copy, issue.path as PathKey[], (value) => {
        if (typeof value === "string" || Array.isArray(value)) {
          fixed = true;
          return value.slice(0, limit);
        }
        return value;
      });
    }
    if (!fixed) throw result.error;
  }
  return ResumeDataSchema.parse(copy);
}

/** Lê dados vindos do banco com tolerância: campos faltantes recebem os valores padrão. */
export function coerceResume(value: unknown): ResumeData {
  const parsed = ResumeDataSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : emptyResume();
}

export function coerceTailored(value: unknown): TailoredResume {
  const parsed = TailoredResumeSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : { ...emptyResume(), sectionOrder: DEFAULT_SECTION_ORDER };
}

/** Seções do currículo que têm conteúdo (para ordenação e exibição). */
export function sectionHasContent(resume: ResumeData, section: SectionKey): boolean {
  switch (section) {
    case "summary":
      return resume.summary.trim().length > 0;
    case "skills":
      return SKILL_CATEGORIES.some((category) => resume.skills[category].length > 0);
    case "experience":
      return resume.experiences.length > 0;
    case "projects":
      return resume.projects.length > 0;
    case "education":
      return resume.education.length > 0;
    case "certifications":
      return resume.certifications.length > 0;
    case "languages":
      return resume.languages.length > 0;
    case "additional":
      return resume.additionalInfo.length > 0;
  }
}

export function allSkills(resume: ResumeData): string[] {
  return SKILL_CATEGORIES.flatMap((category) => resume.skills[category]);
}
