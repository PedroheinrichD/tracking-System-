import type { KeywordAssessment } from "@/lib/domain/job";
import { resolveLocale } from "@/lib/domain/labels";
import {
  DEFAULT_SECTION_ORDER,
  SECTION_KEYS,
  SKILL_CATEGORIES,
  sectionHasContent,
  type ResumeData,
  type SectionKey,
  type TailoredResume,
} from "@/lib/domain/resume";
import type { AutoFix, BlockedItem, FidelityWarning, TailorAi, VerifyAi } from "@/lib/domain/tailoring";
import {
  baseValueForPath,
  fieldKind,
  listTextFields,
  referenceTextForPath,
  setFieldValue,
} from "@/lib/resume/fields";
import { experienceText, projectText, resumeToText } from "@/lib/resume/text";
import { extractNumbers } from "./evidence";
import { skillUniverse } from "./inventory";
import { SENIORITY_TERMS, TECH_LEXICON } from "./lexicon";
import { containsTerm, normalizeForMatch, normalizeLoose, sameTerm } from "./normalize";

/** Categorias de palavra-chave em que a detecção é precisa o bastante para corrigir sozinha. */
const HARD_KEYWORD_CATEGORIES = new Set(["tecnologia", "ferramenta", "certificacao"]);

function clone<T>(value: T): T {
  return structuredClone(value);
}

function cleanList(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    const key = normalizeForMatch(value).trim();
    if (!value || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

// ── Base de apoio: o que o currículo original comprova ──────────────────────

export interface SupportIndex {
  baseText: string;
  baseNorm: string;
  universe: string[];
  keywords: KeywordAssessment[];
  /** O original sustenta este termo (literalmente, por sinônimo ou por equivalência verificada)? */
  isSupported(term: string, variants?: string[]): boolean;
}

export function buildSupportIndex(base: ResumeData, keywords: KeywordAssessment[]): SupportIndex {
  const baseText = resumeToText(base);
  const baseNorm = normalizeForMatch(baseText);
  const universe = skillUniverse(base);
  const keywordByTerm = new Map(keywords.map((keyword) => [normalizeForMatch(keyword.term).trim(), keyword]));

  return {
    baseText,
    baseNorm,
    universe,
    keywords,
    isSupported(term, variants = []) {
      if (containsTerm(baseNorm, term, variants)) return true;
      if (universe.some((skill) => sameTerm(skill, term) || sameTerm(term, skill))) return true;
      const keyword = keywordByTerm.get(normalizeForMatch(term).trim());
      return Boolean(keyword && keyword.status !== "ausente");
    },
  };
}

interface DetectedTerm {
  term: string;
  hard: boolean;
}

/** Termos técnicos (vocabulário + palavras-chave da vaga) citados em um texto. */
function detectTerms(text: string, keywords: KeywordAssessment[]): DetectedTerm[] {
  const normalized = normalizeForMatch(text);
  const found = new Map<string, DetectedTerm>();
  for (const term of TECH_LEXICON) {
    if (containsTerm(normalized, term)) found.set(normalizeForMatch(term).trim(), { term, hard: true });
  }
  for (const keyword of keywords) {
    if (!containsTerm(normalized, keyword.term, keyword.variants)) continue;
    const key = normalizeForMatch(keyword.term).trim();
    const hard = HARD_KEYWORD_CATEGORIES.has(keyword.category) || found.get(key)?.hard === true;
    found.set(key, { term: keyword.term, hard });
  }
  return Array.from(found.values());
}

function variantsOf(term: string, keywords: KeywordAssessment[]): string[] {
  const key = normalizeForMatch(term).trim();
  return keywords.find((keyword) => normalizeForMatch(keyword.term).trim() === key)?.variants ?? [];
}

/** Termos citados no texto que o original não sustenta. */
export function findUnsupportedTerms(text: string, support: SupportIndex): DetectedTerm[] {
  return detectTerms(text, support.keywords).filter(
    (detected) => !support.isSupported(detected.term, variantsOf(detected.term, support.keywords)),
  );
}

/** Uma competência proposta pela IA é sustentada pelo original? */
export function isSkillSupported(skill: string, support: SupportIndex): boolean {
  if (support.isSupported(skill)) return true;
  // Competência composta, ex.: "Metodologias ágeis (Scrum)": precisa conter um termo do
  // original e não pode introduzir nenhum termo técnico sem respaldo.
  const normalizedSkill = normalizeForMatch(skill);
  const mentionsKnown = support.universe.some((known) => containsTerm(normalizedSkill, known));
  if (!mentionsKnown) return false;
  return findUnsupportedTerms(skill, support).length === 0;
}

// ── Etapa 1: mesclar a resposta da IA com os fatos do original ──────────────

export interface MergeInput {
  base: ResumeData;
  ai: TailorAi;
  outputLanguage: string;
  keywords: KeywordAssessment[];
}

export interface MergeResult {
  resume: TailoredResume;
  blocked: BlockedItem[];
}

function sanitizeSectionOrder(proposed: SectionKey[], resume: ResumeData): SectionKey[] {
  const order: SectionKey[] = [];
  for (const key of proposed) {
    if ((SECTION_KEYS as readonly string[]).includes(key) && !order.includes(key)) order.push(key);
  }
  for (const key of DEFAULT_SECTION_ORDER) if (!order.includes(key)) order.push(key);
  return order.filter((key) => sectionHasContent(resume, key));
}

function filterItemTechnologies(
  proposed: string[],
  originalTechnologies: string[],
  originalText: string,
  location: string,
  blocked: BlockedItem[],
): string[] {
  const normalizedOriginal = normalizeForMatch(originalText);
  const kept: string[] = [];
  for (const technology of cleanList(proposed)) {
    const listed = originalTechnologies.some((original) => sameTerm(original, technology) || sameTerm(technology, original));
    if (listed || containsTerm(normalizedOriginal, technology)) {
      kept.push(technology);
    } else {
      blocked.push({
        kind: "tecnologia",
        value: technology,
        location,
        reason: "Não aparece neste item no currículo original.",
      });
    }
  }
  return kept;
}

export function mergeTailoredResume({ base, ai, outputLanguage, keywords }: MergeInput): MergeResult {
  const blocked: BlockedItem[] = [];
  const support = buildSupportIndex(base, keywords);
  const translated = resolveLocale(outputLanguage) !== resolveLocale(base.language);
  const t = ai.translations;
  const resume: TailoredResume = { ...clone(base), language: outputLanguage, sectionOrder: [] };

  // Cabeçalho: dados pessoais sempre do original; título e localização podem ser adaptados/traduzidos.
  resume.personal.headline = ai.headline.trim() || base.personal.headline;
  if (translated && t.location.trim()) resume.personal.location = t.location.trim();
  resume.summary = ai.summary.trim() || base.summary;

  // Experiências: todas mantidas, na ordem cronológica do original; só os textos mudam.
  const aiExperiences = new Map(ai.experiences.map((item) => [item.id, item]));
  for (const item of ai.experiences) {
    if (!base.experiences.some((experience) => experience.id === item.id)) {
      blocked.push({ kind: "item", value: item.id, location: "Experiências", reason: "A IA citou uma experiência inexistente; ignorada." });
    }
  }
  resume.experiences = base.experiences.map((original) => {
    const rewritten = aiExperiences.get(original.id);
    const experience = clone(original);
    if (rewritten) {
      const highlights = cleanList(rewritten.highlights);
      const description = rewritten.description.trim();
      if (highlights.length || description) {
        experience.highlights = highlights;
        experience.description = description;
      }
      const label = `${original.role || "Experiência"} — ${original.company}`;
      const technologies = filterItemTechnologies(
        rewritten.technologies,
        original.technologies,
        experienceText(original),
        label,
        blocked,
      );
      experience.technologies = technologies.length || !original.technologies.length ? technologies : original.technologies;
    }
    if (translated) {
      const tr = t.experiences.find((entry) => entry.id === original.id);
      if (tr) {
        experience.role = tr.role.trim() || original.role;
        experience.employmentType = tr.employmentType.trim() || original.employmentType;
        experience.location = tr.location.trim() || original.location;
        experience.startDate = tr.startDate.trim() || original.startDate;
        experience.endDate = original.current ? "" : tr.endDate.trim() || original.endDate;
      }
    }
    return experience;
  });

  // Projetos: a IA escolhe quais entram e em que ordem; nome, link e datas vêm do original.
  const projectsById = new Map(base.projects.map((project) => [project.id, project]));
  const usedProjects = new Set<string>();
  resume.projects = [];
  for (const item of ai.projects) {
    const original = projectsById.get(item.id);
    if (!original) {
      blocked.push({ kind: "item", value: item.id, location: "Projetos", reason: "A IA citou um projeto inexistente; ignorado." });
      continue;
    }
    if (usedProjects.has(item.id)) continue;
    usedProjects.add(item.id);
    const project = clone(original);
    const highlights = cleanList(item.highlights);
    const description = item.description.trim();
    if (highlights.length || description) {
      project.highlights = highlights;
      project.description = description;
    }
    const technologies = filterItemTechnologies(
      item.technologies,
      original.technologies,
      projectText(original),
      `Projeto ${original.name}`,
      blocked,
    );
    project.technologies = technologies.length || !original.technologies.length ? technologies : original.technologies;
    if (translated) {
      const tr = t.projects.find((entry) => entry.id === original.id);
      if (tr) {
        project.name = tr.name.trim() || original.name;
        project.startDate = tr.startDate.trim() || original.startDate;
        project.endDate = tr.endDate.trim() || original.endDate;
      }
    }
    resume.projects.push(project);
  }

  // Formação: sempre completa e na ordem original (pode ser traduzida).
  resume.education = base.education.map((original) => {
    const education = clone(original);
    if (translated) {
      const tr = t.education.find((entry) => entry.id === original.id);
      if (tr) {
        education.degree = tr.degree.trim() || original.degree;
        education.field = tr.field.trim() || original.field;
        education.status = tr.status.trim() || original.status;
        education.details = tr.details.trim() || original.details;
        education.startDate = tr.startDate.trim() || original.startDate;
        education.endDate = tr.endDate.trim() || original.endDate;
      }
    }
    return education;
  });

  // Cursos e certificações: seleção e ordem da IA; conteúdo do original.
  const certificationsById = new Map(base.certifications.map((item) => [item.id, item]));
  const usedCertifications = new Set<string>();
  resume.certifications = [];
  for (const id of ai.certificationIds) {
    const original = certificationsById.get(id);
    if (!original || usedCertifications.has(id)) continue;
    usedCertifications.add(id);
    const certification = clone(original);
    if (translated) {
      const tr = t.certifications.find((entry) => entry.id === id);
      if (tr) {
        certification.name = tr.name.trim() || original.name;
        certification.workload = tr.workload.trim() || original.workload;
        certification.date = tr.date.trim() || original.date;
      }
    }
    resume.certifications.push(certification);
  }

  // Competências: só entram as que o original sustenta.
  const usedSkills = new Set<string>();
  const proposedAny = SKILL_CATEGORIES.some((category) => ai.skills[category].length > 0);
  for (const category of SKILL_CATEGORIES) {
    const accepted: string[] = [];
    for (const skill of cleanList(ai.skills[category])) {
      const key = normalizeForMatch(skill).trim();
      if (usedSkills.has(key)) continue;
      if (isSkillSupported(skill, support)) {
        usedSkills.add(key);
        accepted.push(skill);
      } else {
        blocked.push({
          kind: "competencia",
          value: skill,
          location: "Competências",
          reason: "Não consta no currículo original; foi removida.",
        });
      }
    }
    resume.skills[category] = proposedAny ? accepted : base.skills[category];
  }

  // Idiomas e informações adicionais: do original (traduzidos se necessário).
  if (translated && t.languages.length === base.languages.length) {
    resume.languages = base.languages.map((language, index) => ({
      name: t.languages[index].name.trim() || language.name,
      level: t.languages[index].level.trim() || language.level,
    }));
  }
  if (translated && t.additionalInfo.length === base.additionalInfo.length) {
    resume.additionalInfo = base.additionalInfo.map((info, index) => t.additionalInfo[index].trim() || info);
  }

  resume.sectionOrder = sanitizeSectionOrder(ai.sectionOrder, resume);
  return { resume, blocked };
}

// ── Etapa 2: aplicar as correções do verificador de fidelidade ──────────────

export interface FixResult {
  resume: TailoredResume;
  autoFixes: AutoFix[];
  warnings: FidelityWarning[];
}

function highlightIndex(path: string): number {
  const parts = path.split(":");
  return parts[2] === "highlight" ? Number(parts[3]) : -1;
}

/**
 * Confere se o caminho apontado pelo verificador contém de fato o trecho citado.
 * Se não contiver (ex.: índice de tópico errado), procura o único campo que contém
 * o trecho. Sem correspondência segura, devolve null e nada é alterado.
 */
function locateIssue(
  issue: VerifyAi["issues"][number],
  fields: Map<string, ReturnType<typeof listTextFields>[number]>,
): string | null {
  const claim = normalizeLoose(issue.claim);
  const field = fields.get(issue.path);
  if (!claim) return field ? issue.path : null;
  if (field && normalizeLoose(field.text).includes(claim)) return issue.path;
  const candidates = Array.from(fields.values()).filter((item) => normalizeLoose(item.text).includes(claim));
  return candidates.length === 1 ? candidates[0].path : null;
}

export function applyVerifierIssues(base: ResumeData, input: TailoredResume, issues: VerifyAi["issues"]): FixResult {
  const resume = clone(input);
  const fields = new Map(listTextFields(resume).map((field) => [field.path, field]));
  const autoFixes: AutoFix[] = [];
  const warnings: FidelityWarning[] = [];
  const handled = new Set<string>();

  // Cada problema é ancorado no campo que realmente contém o trecho citado.
  const located = issues.map((issue) => {
    const path = locateIssue(issue, fields);
    return path ? { ...issue, path, unlocated: false } : { ...issue, unlocated: true };
  });

  // Remoções de tópicos por último e do maior índice para o menor, para não deslocar os demais.
  const ordered = [...located].sort((a, b) => highlightIndex(b.path) - highlightIndex(a.path));
  const updates: { path: string; value: string | null; fix: AutoFix }[] = [];

  for (const issue of ordered) {
    if (issue.unlocated) {
      // Não dá para saber com segurança onde está o problema: só alerta, sem alterar o texto.
      warnings.push({
        path: issue.path,
        label: fields.get(issue.path)?.label ?? "Currículo personalizado",
        message: `${issue.claim ? `“${issue.claim}”: ` : ""}${issue.reason}`,
        severity: issue.severity,
        source: "verificacao_ia",
      });
      continue;
    }
    const field = fields.get(issue.path);
    if (!field) continue;
    if (issue.severity === "baixa" || handled.has(issue.path)) {
      warnings.push({
        path: issue.path,
        label: field.label,
        message: `${issue.claim ? `“${issue.claim}”: ` : ""}${issue.reason}`,
        severity: issue.severity,
        source: "verificacao_ia",
      });
      continue;
    }
    handled.add(issue.path);

    const kind = fieldKind(issue.path);
    let value: string | null;
    if (kind === "fact") {
      value = baseValueForPath(base, issue.path);
      if (value === null) {
        warnings.push({ path: issue.path, label: field.label, message: issue.reason, severity: issue.severity, source: "verificacao_ia" });
        continue;
      }
    } else if (kind === "list") {
      const proposed = issue.fixedText.split(",").map((item) => normalizeForMatch(item).trim());
      value = field.text
        .split(",")
        .map((item) => item.trim())
        .filter((item) => proposed.includes(normalizeForMatch(item).trim()))
        .join(", ");
    } else {
      const fixed = issue.fixedText.trim();
      if (fixed) value = fixed;
      else if (issue.path.includes(":highlight:")) value = null;
      else value = baseValueForPath(base, issue.path) ?? "";
    }

    updates.push({
      path: issue.path,
      value,
      fix: {
        path: issue.path,
        label: field.label,
        before: field.text,
        after: value ?? "",
        reason: issue.reason,
        source: "verificacao_ia",
      },
    });
  }

  for (const update of updates) {
    if (setFieldValue(resume, update.path, update.value)) autoFixes.push(update.fix);
  }
  return { resume, autoFixes, warnings };
}

// ── Etapa 3: regras determinísticas finais ──────────────────────────────────

export interface RuleCheckOptions {
  /** true: corrige automaticamente o que for inequívoco. false: apenas alerta (edições do usuário). */
  autoFix: boolean;
}

export function runFidelityRules(
  base: ResumeData,
  input: TailoredResume,
  keywords: KeywordAssessment[],
  options: RuleCheckOptions,
): FixResult {
  const resume = clone(input);
  const support = buildSupportIndex(base, keywords);
  const autoFixes: AutoFix[] = [];
  const warnings: FidelityWarning[] = [];
  const source: FidelityWarning["source"] = options.autoFix ? "regra" : "edicao";
  const pendingRemovals: { path: string; fix: AutoFix }[] = [];

  for (const field of listTextFields(resume)) {
    if (field.kind === "list") continue;
    const unsupported = findUnsupportedTerms(field.text, support);
    const hard = unsupported.filter((term) => term.hard);
    const soft = unsupported.filter((term) => !term.hard);

    // 1. Termo técnico inexistente no original.
    if (hard.length) {
      const names = hard.map((term) => term.term).join(", ");
      const reason = `Cita ${names}, que não consta no currículo original.`;
      if (options.autoFix && field.kind === "free") {
        const isHighlight = field.path.includes(":highlight:");
        const fallback = isHighlight ? null : baseValueForPath(base, field.path) ?? "";
        const fix: AutoFix = {
          path: field.path,
          label: field.label,
          before: field.text,
          after: fallback ?? "",
          reason: isHighlight ? `${reason} O tópico foi removido.` : `${reason} O texto voltou ao original.`,
          source: "regra",
        };
        if (isHighlight) pendingRemovals.push({ path: field.path, fix });
        else if (setFieldValue(resume, field.path, fallback)) autoFixes.push(fix);
        continue;
      }
      if (options.autoFix && field.kind === "fact") {
        const original = baseValueForPath(base, field.path);
        if (original !== null && setFieldValue(resume, field.path, original)) {
          autoFixes.push({ path: field.path, label: field.label, before: field.text, after: original, reason, source: "regra" });
          continue;
        }
      }
      warnings.push({ path: field.path, label: field.label, message: reason, severity: "alta", source });
      continue;
    }

    if (soft.length) {
      warnings.push({
        path: field.path,
        label: field.label,
        message: `Usa “${soft.map((term) => term.term).join("”, “")}”, termo da vaga sem correspondência no original. Confirme se é verdadeiro.`,
        severity: "media",
        source,
      });
    }

    // 2. Senioridade/escopo inflados no título ou no resumo.
    if (field.path === "headline" || field.path === "summary") {
      const normalized = normalizeForMatch(field.text);
      const inflated = SENIORITY_TERMS.filter(
        (term) => containsTerm(normalized, term) && !containsTerm(support.baseNorm, term),
      );
      if (inflated.length) {
        const reason = `Indica nível “${inflated[0]}”, que não aparece no currículo original.`;
        const original = baseValueForPath(base, field.path) ?? "";
        if (options.autoFix && setFieldValue(resume, field.path, original)) {
          autoFixes.push({ path: field.path, label: field.label, before: field.text, after: original, reason, source: "regra" });
          continue;
        }
        warnings.push({ path: field.path, label: field.label, message: reason, severity: "alta", source });
        continue;
      }
    }

    // 3. Tecnologia que existe no original, mas não neste item (experiência/projeto).
    if (field.path.startsWith("experience:") || field.path.startsWith("project:")) {
      const itemReference = normalizeForMatch(referenceTextForPath(base, field.path));
      const misplaced = detectTerms(field.text, support.keywords)
        .filter((term) => term.hard)
        .filter((term) => !containsTerm(itemReference, term.term, variantsOf(term.term, support.keywords)));
      if (misplaced.length) {
        warnings.push({
          path: field.path,
          label: field.label,
          message: `Atribui ${misplaced.map((term) => term.term).join(", ")} a este item, mas no original isso não aparece aqui.`,
          severity: "media",
          source,
        });
      }
    }

    // 4. Números sem origem (métricas, percentuais, prazos).
    if (field.kind === "free") {
      const reference = referenceTextForPath(base, field.path);
      const referenceNumbers = new Set(extractNumbers(reference));
      const unknown = extractNumbers(field.text).filter((number) => !referenceNumbers.has(number));
      if (unknown.length) {
        warnings.push({
          path: field.path,
          label: field.label,
          message: `Contém número(s) que não aparecem no original: ${unknown.join(", ")}.`,
          severity: "media",
          source,
        });
      }
    }
  }

  // Remoção de tópicos do maior índice para o menor.
  pendingRemovals.sort((a, b) => highlightIndex(b.path) - highlightIndex(a.path));
  for (const removal of pendingRemovals) {
    if (setFieldValue(resume, removal.path, null)) autoFixes.push(removal.fix);
  }

  // Competências digitadas que não existem no original (só alerta).
  for (const category of SKILL_CATEGORIES) {
    for (const skill of resume.skills[category]) {
      if (!isSkillSupported(skill, support)) {
        warnings.push({
          path: `skills:${category}`,
          label: "Competências",
          message: `“${skill}” não consta no currículo original.`,
          severity: options.autoFix ? "alta" : "media",
          source,
        });
      }
    }
  }

  return { resume, autoFixes, warnings };
}
