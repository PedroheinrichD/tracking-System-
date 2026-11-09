import type { ResumeData, TailoredResume } from "@/lib/domain/resume";
import { certificationText, educationText, experienceText, projectText, resumeToText } from "./text";

/**
 * Campos endereçáveis do currículo personalizado. Cada campo tem um caminho
 * estável (ex.: "experience:exp-1:highlight:2") usado pelo verificador de
 * fidelidade, pelas regras automáticas e pela interface de revisão.
 *
 * - "free": texto reescrito pela IA (pode receber correção textual);
 * - "fact": dado factual copiado/traduzido do original (correção = voltar ao original);
 * - "list": lista de tecnologias (correção = remover itens).
 */
export type FieldKind = "free" | "fact" | "list";

export interface TextField {
  path: string;
  label: string;
  text: string;
  kind: FieldKind;
}

const EXPERIENCE_FACTS = ["role", "employmentType", "location", "startDate", "endDate"] as const;
const PROJECT_FACTS = ["name", "startDate", "endDate"] as const;
const EDUCATION_FACTS = ["degree", "field", "status", "details", "startDate", "endDate"] as const;
const CERTIFICATION_FACTS = ["name", "workload", "date"] as const;

const FACT_LABELS: Record<string, string> = {
  role: "cargo",
  employmentType: "vínculo",
  location: "local",
  startDate: "início",
  endDate: "término",
  name: "nome",
  degree: "grau",
  field: "curso",
  status: "situação",
  details: "detalhes",
  workload: "carga horária",
  date: "data",
};

function shortLabel(value: string, fallback: string): string {
  const clean = value.trim();
  if (!clean) return fallback;
  return clean.length > 48 ? `${clean.slice(0, 45)}…` : clean;
}

export function listTextFields(resume: ResumeData | TailoredResume): TextField[] {
  const fields: TextField[] = [];
  const push = (path: string, label: string, text: string, kind: FieldKind) => {
    if (text.trim()) fields.push({ path, label, text, kind });
  };

  push("headline", "Título profissional", resume.personal.headline, "free");
  push("location", "Localização", resume.personal.location, "fact");
  push("summary", "Resumo profissional", resume.summary, "free");

  for (const experience of resume.experiences) {
    const name = shortLabel(`${experience.role} — ${experience.company}`, "Experiência");
    for (const key of EXPERIENCE_FACTS) {
      push(`experience:${experience.id}:${key}`, `${name} (${FACT_LABELS[key]})`, experience[key], "fact");
    }
    push(`experience:${experience.id}:description`, `${name} (descrição)`, experience.description, "free");
    experience.highlights.forEach((highlight, index) =>
      push(`experience:${experience.id}:highlight:${index}`, `${name} (tópico ${index + 1})`, highlight, "free"),
    );
    push(
      `experience:${experience.id}:technologies`,
      `${name} (tecnologias)`,
      experience.technologies.join(", "),
      "list",
    );
  }

  for (const project of resume.projects) {
    const name = shortLabel(project.name, "Projeto");
    for (const key of PROJECT_FACTS) {
      push(`project:${project.id}:${key}`, `Projeto ${name} (${FACT_LABELS[key]})`, project[key], "fact");
    }
    push(`project:${project.id}:description`, `Projeto ${name} (descrição)`, project.description, "free");
    project.highlights.forEach((highlight, index) =>
      push(`project:${project.id}:highlight:${index}`, `Projeto ${name} (tópico ${index + 1})`, highlight, "free"),
    );
    push(`project:${project.id}:technologies`, `Projeto ${name} (tecnologias)`, project.technologies.join(", "), "list");
  }

  for (const education of resume.education) {
    const name = shortLabel(education.institution, "Formação");
    for (const key of EDUCATION_FACTS) {
      push(`education:${education.id}:${key}`, `Formação ${name} (${FACT_LABELS[key]})`, education[key], "fact");
    }
  }

  for (const certification of resume.certifications) {
    const name = shortLabel(certification.name, "Curso");
    for (const key of CERTIFICATION_FACTS) {
      push(`certification:${certification.id}:${key}`, `Curso ${name} (${FACT_LABELS[key]})`, certification[key], "fact");
    }
  }

  resume.languages.forEach((language, index) =>
    push(`language:${index}`, `Idioma ${index + 1}`, [language.name, language.level].filter(Boolean).join(" — "), "fact"),
  );
  resume.additionalInfo.forEach((info, index) =>
    push(`additional:${index}`, `Informação adicional ${index + 1}`, info, "fact"),
  );

  return fields;
}

/** Texto rotulado com os caminhos, para o verificador de fidelidade. */
export function labeledResumeText(resume: ResumeData | TailoredResume): string {
  return listTextFields(resume)
    .map((field) => `[${field.path}] ${field.text}`)
    .join("\n");
}

export function fieldLabel(resume: ResumeData | TailoredResume, path: string): string {
  return listTextFields(resume).find((field) => field.path === path)?.label ?? path;
}

/** Texto do original que serve de referência para um campo (o item correspondente ou o currículo todo). */
export function referenceTextForPath(base: ResumeData, path: string): string {
  const [scope, id] = path.split(":");
  if (scope === "experience") {
    const item = base.experiences.find((experience) => experience.id === id);
    if (item) return experienceText(item);
  }
  if (scope === "project") {
    const item = base.projects.find((project) => project.id === id);
    if (item) return projectText(item);
  }
  if (scope === "education") {
    const item = base.education.find((education) => education.id === id);
    if (item) return educationText(item);
  }
  if (scope === "certification") {
    const item = base.certifications.find((certification) => certification.id === id);
    if (item) return certificationText(item);
  }
  return resumeToText(base);
}

/** Valor original de um campo factual ou livre, quando existir correspondência no original. */
export function baseValueForPath(base: ResumeData, path: string): string | null {
  const parts = path.split(":");
  const [scope, id, key] = parts;
  switch (scope) {
    case "headline":
      return base.personal.headline;
    case "summary":
      return base.summary;
    case "location":
      return base.personal.location;
    case "experience": {
      const item = base.experiences.find((experience) => experience.id === id);
      if (!item) return null;
      if (key === "description") return item.description;
      if ((EXPERIENCE_FACTS as readonly string[]).includes(key)) return item[key as (typeof EXPERIENCE_FACTS)[number]];
      return null;
    }
    case "project": {
      const item = base.projects.find((project) => project.id === id);
      if (!item) return null;
      if (key === "description") return item.description;
      if ((PROJECT_FACTS as readonly string[]).includes(key)) return item[key as (typeof PROJECT_FACTS)[number]];
      return null;
    }
    case "education": {
      const item = base.education.find((education) => education.id === id);
      if (!item || !(EDUCATION_FACTS as readonly string[]).includes(key)) return null;
      return item[key as (typeof EDUCATION_FACTS)[number]];
    }
    case "certification": {
      const item = base.certifications.find((certification) => certification.id === id);
      if (!item || !(CERTIFICATION_FACTS as readonly string[]).includes(key)) return null;
      return item[key as (typeof CERTIFICATION_FACTS)[number]];
    }
    case "language": {
      const item = base.languages[Number(id)];
      return item ? [item.name, item.level].filter(Boolean).join(" — ") : null;
    }
    case "additional":
      return base.additionalInfo[Number(id)] ?? null;
    default:
      return null;
  }
}

/**
 * Altera um campo do currículo personalizado. `value = null` remove o campo
 * (tópicos são excluídos; textos ficam vazios). Retorna false se o caminho não existir.
 * Mutação in place: chame sobre uma cópia.
 */
export function setFieldValue(resume: TailoredResume, path: string, value: string | null): boolean {
  const parts = path.split(":");
  const [scope, id, key, index] = parts;
  const next = value ?? "";

  switch (scope) {
    case "headline":
      resume.personal.headline = next;
      return true;
    case "summary":
      resume.summary = next;
      return true;
    case "location":
      resume.personal.location = next;
      return true;
    case "experience":
    case "project": {
      const collection = scope === "experience" ? resume.experiences : resume.projects;
      const item = collection.find((entry) => entry.id === id);
      if (!item) return false;
      if (key === "highlight") {
        const position = Number(index);
        if (!Number.isInteger(position) || position < 0 || position >= item.highlights.length) return false;
        if (value === null || !value.trim()) item.highlights.splice(position, 1);
        else item.highlights[position] = value;
        return true;
      }
      if (key === "technologies") {
        item.technologies = next
          .split(",")
          .map((technology) => technology.trim())
          .filter(Boolean);
        return true;
      }
      if (key in item && typeof (item as Record<string, unknown>)[key] === "string") {
        (item as Record<string, unknown>)[key] = next;
        return true;
      }
      return false;
    }
    case "education": {
      const item = resume.education.find((entry) => entry.id === id);
      if (!item || !(EDUCATION_FACTS as readonly string[]).includes(key)) return false;
      item[key as (typeof EDUCATION_FACTS)[number]] = next;
      return true;
    }
    case "certification": {
      const item = resume.certifications.find((entry) => entry.id === id);
      if (!item || !(CERTIFICATION_FACTS as readonly string[]).includes(key)) return false;
      item[key as (typeof CERTIFICATION_FACTS)[number]] = next;
      return true;
    }
    case "language": {
      const position = Number(id);
      const item = resume.languages[position];
      if (!item) return false;
      const [name, ...level] = next.split(" — ");
      item.name = name?.trim() ?? item.name;
      item.level = level.join(" — ").trim();
      return true;
    }
    case "additional": {
      const position = Number(id);
      if (!Number.isInteger(position) || position < 0 || position >= resume.additionalInfo.length) return false;
      if (value === null || !value.trim()) resume.additionalInfo.splice(position, 1);
      else resume.additionalInfo[position] = value;
      return true;
    }
    default:
      return false;
  }
}

export function fieldKind(path: string): FieldKind {
  if (path === "headline" || path === "summary") return "free";
  if (path.endsWith(":description") || path.includes(":highlight:")) return "free";
  if (path.endsWith(":technologies")) return "list";
  return "fact";
}
