import { allSkills, type ResumeData } from "@/lib/domain/resume";
import { certificationText, educationText, experienceText, projectText } from "@/lib/resume/text";
import { containsTerm, normalizeForMatch } from "./normalize";

export type EvidenceContext = "profissional" | "projeto" | "formacao" | "curso" | "declarado";

export interface SkillEvidence {
  skill: string;
  contexts: { type: EvidenceContext; refs: string[] }[];
  strongest: EvidenceContext;
}

const STRENGTH: EvidenceContext[] = ["profissional", "projeto", "formacao", "curso", "declarado"];

/** Todas as competências e tecnologias citadas no currículo, sem duplicatas. */
export function skillUniverse(resume: ResumeData): string[] {
  const all = [
    ...allSkills(resume),
    ...resume.experiences.flatMap((experience) => experience.technologies),
    ...resume.projects.flatMap((project) => project.technologies),
  ];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const skill of all) {
    const key = normalizeForMatch(skill).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(skill.trim());
  }
  return result;
}

/**
 * Para cada competência, onde ela aparece. Isso permite distinguir experiência
 * profissional de conhecimento apenas estudado ou declarado.
 */
export function buildSkillInventory(resume: ResumeData): SkillEvidence[] {
  const experiences = resume.experiences.map((experience) => ({
    id: experience.id,
    text: normalizeForMatch(experienceText(experience)),
  }));
  const projects = resume.projects.map((project) => ({ id: project.id, text: normalizeForMatch(projectText(project)) }));
  const education = resume.education.map((item) => ({ id: item.id, text: normalizeForMatch(educationText(item)) }));
  const certifications = resume.certifications.map((item) => ({
    id: item.id,
    text: normalizeForMatch(certificationText(item)),
  }));

  return skillUniverse(resume).map((skill) => {
    const contexts: SkillEvidence["contexts"] = [];
    const collect = (type: EvidenceContext, items: { id: string; text: string }[]) => {
      const refs = items.filter((item) => containsTerm(item.text, skill)).map((item) => item.id);
      if (refs.length) contexts.push({ type, refs });
    };
    collect("profissional", experiences);
    collect("projeto", projects);
    collect("formacao", education);
    collect("curso", certifications);
    if (!contexts.length) contexts.push({ type: "declarado", refs: [] });
    const strongest = STRENGTH.find((type) => contexts.some((context) => context.type === type)) ?? "declarado";
    return { skill, contexts, strongest };
  });
}

const CONTEXT_LABELS: Record<EvidenceContext, string> = {
  profissional: "experiência profissional",
  projeto: "projeto",
  formacao: "formação",
  curso: "curso/estudo",
  declarado: "apenas listado em competências",
};

/** Versão em texto do inventário, para o prompt de personalização. */
export function inventoryToText(inventory: SkillEvidence[]): string {
  return inventory
    .map((entry) => {
      const contexts = entry.contexts
        .map((context) =>
          context.refs.length ? `${CONTEXT_LABELS[context.type]} (${context.refs.join(", ")})` : CONTEXT_LABELS[context.type],
        )
        .join("; ");
      return `- ${entry.skill}: ${contexts}`;
    })
    .join("\n");
}
