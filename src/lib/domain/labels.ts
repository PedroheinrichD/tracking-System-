import type { SectionKey, SkillCategory } from "./resume";

export type ResumeLocale = "pt-BR" | "en" | "es";

export function resolveLocale(language: string | null | undefined): ResumeLocale {
  const value = (language ?? "").toLowerCase();
  if (value.startsWith("en")) return "en";
  if (value.startsWith("es")) return "es";
  return "pt-BR";
}

export const SECTION_LABELS: Record<ResumeLocale, Record<SectionKey, string>> = {
  "pt-BR": {
    summary: "Resumo profissional",
    skills: "Competências",
    experience: "Experiência profissional",
    projects: "Projetos",
    education: "Formação acadêmica",
    certifications: "Cursos e certificações",
    languages: "Idiomas",
    additional: "Informações adicionais",
  },
  en: {
    summary: "Professional summary",
    skills: "Skills",
    experience: "Professional experience",
    projects: "Projects",
    education: "Education",
    certifications: "Courses and certifications",
    languages: "Languages",
    additional: "Additional information",
  },
  es: {
    summary: "Resumen profesional",
    skills: "Competencias",
    experience: "Experiencia profesional",
    projects: "Proyectos",
    education: "Formación académica",
    certifications: "Cursos y certificaciones",
    languages: "Idiomas",
    additional: "Información adicional",
  },
};

export const SKILL_LABELS: Record<ResumeLocale, Record<SkillCategory, string>> = {
  "pt-BR": {
    programmingLanguages: "Linguagens de programação",
    frameworks: "Frameworks e bibliotecas",
    databases: "Bancos de dados",
    tools: "Ferramentas e plataformas",
    otherTechnical: "Outros conhecimentos técnicos",
    softSkills: "Competências comportamentais",
  },
  en: {
    programmingLanguages: "Programming languages",
    frameworks: "Frameworks and libraries",
    databases: "Databases",
    tools: "Tools and platforms",
    otherTechnical: "Other technical skills",
    softSkills: "Soft skills",
  },
  es: {
    programmingLanguages: "Lenguajes de programación",
    frameworks: "Frameworks y bibliotecas",
    databases: "Bases de datos",
    tools: "Herramientas y plataformas",
    otherTechnical: "Otros conocimientos técnicos",
    softSkills: "Competencias interpersonales",
  },
};

export const MISC_LABELS: Record<
  ResumeLocale,
  { present: string; technologies: string; workload: string; course: string; certification: string }
> = {
  "pt-BR": {
    present: "Atual",
    technologies: "Tecnologias",
    workload: "Carga horária",
    course: "Curso",
    certification: "Certificação",
  },
  en: {
    present: "Present",
    technologies: "Technologies",
    workload: "Workload",
    course: "Course",
    certification: "Certification",
  },
  es: {
    present: "Actual",
    technologies: "Tecnologías",
    workload: "Carga horaria",
    course: "Curso",
    certification: "Certificación",
  },
};

/** Rótulos usados na interface (sempre em português). */
export const UI_SECTION_LABELS = SECTION_LABELS["pt-BR"];
export const UI_SKILL_LABELS = SKILL_LABELS["pt-BR"];
