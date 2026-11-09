import {
  SKILL_CATEGORIES,
  type Certification,
  type Education,
  type Experience,
  type Project,
  type ResumeData,
} from "@/lib/domain/resume";
import { UI_SKILL_LABELS } from "@/lib/domain/labels";

function join(parts: (string | null | undefined)[], separator = " · "): string {
  return parts.map((part) => (part ?? "").trim()).filter(Boolean).join(separator);
}

function period(start: string, end: string, current: boolean): string {
  const finish = current ? "atual" : end;
  if (start && finish) return `${start} – ${finish}`;
  return start || finish || "";
}

export function experienceText(experience: Experience): string {
  return [
    join([experience.role, experience.company, experience.employmentType]),
    join([period(experience.startDate, experience.endDate, experience.current), experience.location]),
    experience.description,
    ...experience.highlights.map((highlight) => `- ${highlight}`),
    experience.technologies.length ? `Tecnologias: ${experience.technologies.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function projectText(project: Project): string {
  return [
    join([project.name, project.url]),
    period(project.startDate, project.endDate, false),
    project.description,
    ...project.highlights.map((highlight) => `- ${highlight}`),
    project.technologies.length ? `Tecnologias: ${project.technologies.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function educationText(education: Education): string {
  return [
    join([education.degree, education.field]),
    join([education.institution, education.status]),
    period(education.startDate, education.endDate, false),
    education.details,
  ]
    .filter(Boolean)
    .join("\n");
}

export function certificationText(certification: Certification): string {
  return join([
    certification.name,
    certification.issuer,
    certification.date,
    certification.workload,
    certification.kind === "certificacao" ? "certificação" : "curso",
  ]);
}

/**
 * Texto legível do currículo. Com `withIds`, cada item recebe seu id entre
 * colchetes para que a IA possa referenciá-lo.
 */
export function resumeToText(resume: ResumeData, options: { withIds?: boolean } = {}): string {
  const tag = (id: string) => (options.withIds ? `[${id}] ` : "");
  const lines: string[] = [];
  const { personal } = resume;

  lines.push("## DADOS PESSOAIS");
  lines.push(join([personal.fullName, personal.headline], "\n"));
  lines.push(join([personal.email, personal.phone, personal.location]));
  for (const link of personal.links) lines.push(join([link.label, link.url], ": "));

  if (resume.summary.trim()) {
    lines.push("", "## RESUMO", resume.summary.trim());
  }

  if (resume.experiences.length) {
    lines.push("", "## EXPERIÊNCIA PROFISSIONAL");
    for (const experience of resume.experiences) {
      lines.push(`${tag(experience.id)}${experienceText(experience)}`, "");
    }
  }

  if (resume.projects.length) {
    lines.push("", "## PROJETOS");
    for (const project of resume.projects) lines.push(`${tag(project.id)}${projectText(project)}`, "");
  }

  if (resume.education.length) {
    lines.push("", "## FORMAÇÃO ACADÊMICA");
    for (const education of resume.education) lines.push(`${tag(education.id)}${educationText(education)}`, "");
  }

  if (resume.certifications.length) {
    lines.push("", "## CURSOS E CERTIFICAÇÕES");
    for (const certification of resume.certifications) {
      lines.push(`${tag(certification.id)}${certificationText(certification)}`);
    }
  }

  const skillLines = SKILL_CATEGORIES.filter((category) => resume.skills[category].length).map(
    (category) => `${UI_SKILL_LABELS[category]}: ${resume.skills[category].join(", ")}`,
  );
  if (skillLines.length) lines.push("", "## COMPETÊNCIAS", ...skillLines);

  if (resume.languages.length) {
    lines.push("", "## IDIOMAS", ...resume.languages.map((language) => join([language.name, language.level], " — ")));
  }

  if (resume.additionalInfo.length) {
    lines.push("", "## INFORMAÇÕES ADICIONAIS", ...resume.additionalInfo.map((info) => `- ${info}`));
  }

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
