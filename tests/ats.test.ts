import { describe, expect, it } from "vitest";
import { assessKeywords, keywordCoverage } from "@/lib/ats/keywords";
import { containsExact, containsTerm, normalizeForMatch, sameTerm } from "@/lib/ats/normalize";
import { computeScore } from "@/lib/ats/score";
import { finalizeMatch } from "@/lib/ats/match";
import { isQuoteInText } from "@/lib/ats/evidence";
import { applyVerifierIssues, mergeTailoredResume, runFidelityRules } from "@/lib/ats/guardrails";
import { assessTailoredKeywords, computeKeywordsAdded, computeReorganization, computeTailoredScore } from "@/lib/ats/report";
import type { MatchResult } from "@/lib/domain/job";

function match(): MatchResult {
  return {
    requirements: [],
    keywords: keywordAssessments(),
    strengths: [],
    improvements: [],
    seniorityFit: { assessment: "compativel", explanation: "" },
    overview: "",
  };
}
import { buildSkillInventory } from "@/lib/ats/inventory";
import { resumeToText } from "@/lib/resume/text";
import { baseResume, jobAnalysis, keywordAssessments, tailorAi } from "./fixtures";

describe("normalização e busca de termos", () => {
  const text = normalizeForMatch("Experiência com Node.js, React e C#. Front-end responsivo; inglês avançado.");

  it("encontra termos com pontuação e caixa diferentes", () => {
    expect(containsTerm(text, "node.js")).toBe(true);
    expect(containsTerm(text, "NodeJS")).toBe(true);
    expect(containsTerm(text, "react")).toBe(true);
    expect(containsTerm(text, "C#")).toBe(true);
  });

  it("não confunde Java com JavaScript nem termos parciais", () => {
    const js = normalizeForMatch("Desenvolvimento em JavaScript");
    expect(containsTerm(js, "Java")).toBe(false);
    expect(containsTerm(js, "JavaScript")).toBe(true);
    expect(containsTerm(normalizeForMatch("Usei Reactive Forms"), "React")).toBe(false);
  });

  it("trata hífen e acentos", () => {
    expect(containsTerm(text, "Frontend")).toBe(true);
    expect(containsTerm(text, "front end")).toBe(true);
    expect(containsTerm(text, "Ingles")).toBe(true);
  });

  it("diferencia termo exato de sinônimo", () => {
    const resume = normalizeForMatch("Linguagens: JS, TypeScript");
    expect(containsExact(resume, "JavaScript")).toBe(false);
    expect(containsTerm(resume, "JavaScript")).toBe(true);
  });

  it("GitHub implica Git, mas Git não implica GitHub", () => {
    expect(containsTerm(normalizeForMatch("Uso GitHub diariamente"), "Git")).toBe(true);
    expect(containsTerm(normalizeForMatch("Uso Git diariamente"), "GitHub")).toBe(false);
    expect(sameTerm("JS", "JavaScript")).toBe(true);
  });
});

describe("citações de evidência", () => {
  const resumeText = resumeToText(baseResume());
  it("aceita trecho literal com diferenças de pontuação", () => {
    expect(isQuoteInText("Desenvolvi telas do e-commerce com React e TypeScript.", resumeText)).toBe(true);
  });
  it("recusa trecho inventado", () => {
    expect(isQuoteInText("Liderei uma equipe de 8 desenvolvedores", resumeText)).toBe(false);
  });
});

describe("palavras-chave e pontuação", () => {
  const resumeText = resumeToText(baseResume());
  const analysis = jobAnalysis();

  it("classifica presente, equivalente, semântica verificada e ausente", () => {
    const result = assessKeywords(analysis.atsKeywords, resumeText, [
      { term: "metodologias ágeis", status: "equivalente", matchedText: "Scrum" },
      { term: "liderança", status: "equivalente", matchedText: "Liderei equipes" },
    ]);
    const byTerm = Object.fromEntries(result.map((item) => [item.term, item]));
    expect(byTerm.React.status).toBe("presente");
    expect(byTerm.JavaScript.status).toBe("equivalente");
    expect(byTerm.Kubernetes.status).toBe("ausente");
    expect(byTerm["metodologias ágeis"]).toMatchObject({ status: "equivalente", source: "ia" });
    // A IA afirmou equivalência, mas o trecho não existe no currículo: ignorado.
    expect(byTerm["liderança"].status).toBe("ausente");
    // Cobertura considera só termos exatos (1 de 5: React).
    expect(keywordCoverage(result)).toBe(20);
  });

  it("calcula a pontuação pela fórmula documentada", () => {
    const score = computeScore(
      analysis.requirements,
      [
        { requirementId: "req-1", status: "atendido", evidenceType: "profissional", evidence: [], explanation: "", adjustment: null },
        { requirementId: "req-2", status: "nao_atendido", evidenceType: "nenhuma", evidence: [], explanation: "", adjustment: null },
        { requirementId: "req-3", status: "parcial", evidenceType: "declarado", evidence: [], explanation: "", adjustment: null },
      ],
      keywordAssessments(),
    );
    // Requisitos: (3×1 + 3×0 + 1×0,5) / 7 = 50%
    expect(score.requirements?.score).toBe(50);
    expect(score.requirements?.mandatory).toEqual({ total: 2, met: 1, partial: 0, notMet: 1 });
    // Palavras-chave: (3×1 + 3×0,75 + 2×0 + 1×0,75 + 1×0) / 10 = 60%
    expect(score.keywords?.score).toBe(60);
    // Total: 0,7×50 + 0,3×60 = 53
    expect(score.total).toBe(53);
  });

  it("rebaixa 'atendido' sem evidência confirmada", () => {
    const match = finalizeMatch(
      analysis,
      {
        requirements: [
          { requirementId: "req-1", status: "atendido", evidenceType: "profissional", evidenceQuotes: ["Desenvolvi telas do e-commerce com React e TypeScript"], explanation: "ok" },
          { requirementId: "req-2", status: "atendido", evidenceType: "profissional", evidenceQuotes: ["Administrei clusters Kubernetes"], explanation: "inventado" },
        ],
        keywords: [],
        strengths: [],
        improvements: [],
        seniorityFit: { assessment: "compativel", explanation: "" },
        overview: "",
      },
      resumeText,
    );
    expect(match.requirements[0].status).toBe("atendido");
    expect(match.requirements[1].status).toBe("parcial");
    expect(match.requirements[1].adjustment).toMatch(/Rebaixado/);
    // Requisito sem avaliação vira "não atendido".
    expect(match.requirements[2].status).toBe("nao_atendido");
  });
});

describe("inventário de evidências", () => {
  it("distingue experiência profissional de curso", () => {
    const inventory = buildSkillInventory(baseResume());
    const react = inventory.find((entry) => entry.skill === "React");
    const docker = inventory.find((entry) => entry.skill === "Docker");
    expect(react?.strongest).toBe("profissional");
    expect(docker?.strongest).toBe("curso");
  });
});

describe("salvaguardas da personalização", () => {
  const base = baseResume();
  const keywords = keywordAssessments();

  it("mantém fatos do original e bloqueia o que não existe nele", () => {
    const { resume, blocked } = mergeTailoredResume({ base, ai: tailorAi(), outputLanguage: "pt-BR", keywords });

    // Dados pessoais e fatos preservados
    expect(resume.personal.fullName).toBe(base.personal.fullName);
    expect(resume.experiences[0]).toMatchObject({ company: "Loja Online LTDA", role: "Desenvolvedor Front-end", startDate: "03/2022" });
    // Experiência omitida pela IA continua presente, sem alterações
    expect(resume.experiences).toHaveLength(2);
    expect(resume.experiences[1]).toEqual(base.experiences[1]);

    const blockedValues = blocked.map((item) => item.value);
    // Kubernetes e Liderança não existem no original
    expect(blockedValues).toContain("Kubernetes");
    expect(blockedValues).toContain("Liderança");
    // Docker é só curso: não pode ser atribuído à experiência profissional
    expect(resume.experiences[0].technologies).not.toContain("Docker");
    expect(blocked.some((item) => item.kind === "tecnologia" && item.value === "Docker")).toBe(true);
    // Projeto inventado é ignorado
    expect(resume.projects.map((project) => project.id)).toEqual(["proj-1"]);

    // Sinônimos e composições verdadeiras são aceitos
    expect(resume.skills.programmingLanguages).toContain("JavaScript");
    expect(resume.skills.otherTechnical).toContain("Metodologias ágeis (Scrum)");
    // Docker continua como competência (está no original), apenas não na experiência
    expect(resume.skills.tools).toContain("Docker");
  });

  it("remove tópico com tecnologia inexistente e reverte resumo/título inflados", () => {
    const ai = tailorAi({
      headline: "Desenvolvedor Front-end Sênior",
      summary: "Desenvolvedor com experiência em React e Kubernetes.",
      experiences: [
        {
          id: "exp-1",
          description: "",
          highlights: [
            "Desenvolvi telas do e-commerce com React e TypeScript",
            "Orquestrei containers com Kubernetes em produção",
            "Aumentei a conversão em 45%",
          ],
          technologies: ["React"],
        },
      ],
    });
    const merged = mergeTailoredResume({ base, ai, outputLanguage: "pt-BR", keywords });
    const { resume, autoFixes, warnings } = runFidelityRules(base, merged.resume, keywords, { autoFix: true });

    expect(resume.personal.headline).toBe(base.personal.headline);
    expect(resume.summary).toBe(base.summary);
    expect(resume.experiences[0].highlights).toEqual([
      "Desenvolvi telas do e-commerce com React e TypeScript",
      "Aumentei a conversão em 45%",
    ]);
    expect(autoFixes.map((fix) => fix.path)).toEqual(
      expect.arrayContaining(["headline", "summary", "experience:exp-1:highlight:1"]),
    );
    // Métrica sem origem vira alerta para revisão humana
    expect(warnings.some((warning) => warning.message.includes("45"))).toBe(true);
  });

  it("alerta quando uma tecnologia do original é atribuída ao item errado", () => {
    const ai = tailorAi({
      experiences: [
        { id: "exp-2", description: "Manutenção de sites em PHP e MySQL.", highlights: ["Criei páginas com React"], technologies: ["PHP"] },
      ],
    });
    const merged = mergeTailoredResume({ base, ai, outputLanguage: "pt-BR", keywords });
    const { warnings } = runFidelityRules(base, merged.resume, keywords, { autoFix: true });
    expect(
      warnings.some((warning) => warning.path === "experience:exp-2:highlight:0" && warning.message.includes("React")),
    ).toBe(true);
  });

  it("aplica correções do verificador: texto, remoção e fato", () => {
    const merged = mergeTailoredResume({ base, ai: tailorAi(), outputLanguage: "pt-BR", keywords }).resume;
    merged.experiences[0].role = "Tech Lead";
    const { resume, autoFixes } = applyVerifierIssues(base, merged, [
      { path: "experience:exp-1:highlight:0", claim: "as telas", reason: "ok", severity: "media", fixedText: "Desenvolvi telas com React" },
      { path: "experience:exp-1:highlight:2", claim: "Integrei o front-end", reason: "inventado", severity: "alta", fixedText: "" },
      { path: "experience:exp-1:role", claim: "Tech Lead", reason: "cargo alterado", severity: "alta", fixedText: "" },
      { path: "caminho:inexistente", claim: "", reason: "", severity: "alta", fixedText: "" },
    ]);
    expect(resume.experiences[0].highlights).toEqual([
      "Desenvolvi telas com React",
      "Reduzi o tempo de carregamento da página inicial em 30%",
    ]);
    expect(resume.experiences[0].role).toBe("Desenvolvedor Front-end");
    expect(autoFixes).toHaveLength(3);
  });

  it("ancora a correção do verificador no campo que contém o trecho, mesmo com índice errado", () => {
    const merged = mergeTailoredResume({ base, ai: tailorAi(), outputLanguage: "pt-BR", keywords }).resume;
    // tópicos de exp-1: [0] telas…, [1] Reduzi…30%, [2] Integrei…
    const { resume, autoFixes, warnings } = applyVerifierIssues(base, merged, [
      // índice 2 está errado: o trecho citado está no tópico 1
      { path: "experience:exp-1:highlight:2", claim: "página inicial em 30%", reason: "métrica alterada", severity: "alta", fixedText: "" },
      // trecho que não existe em lugar nenhum: vira só alerta
      { path: "summary", claim: "liderou 12 pessoas", reason: "inventado", severity: "alta", fixedText: "Resumo trocado" },
    ]);
    expect(resume.experiences[0].highlights).toEqual([
      "Desenvolvi as telas do e-commerce com React e TypeScript",
      "Integrei o front-end a APIs REST em Node.js",
    ]);
    expect(autoFixes.map((fix) => fix.path)).toEqual(["experience:exp-1:highlight:1"]);
    expect(resume.summary).toBe(merged.summary);
    expect(warnings).toHaveLength(1);
  });

  it("não premia na nota nem no relatório um termo sem respaldo inserido no texto", () => {
    const { resume } = mergeTailoredResume({ base, ai: tailorAi(), outputLanguage: "pt-BR", keywords });
    const before = computeTailoredScore(jobAnalysis(), match(), resume);
    const edited = { ...resume, summary: `${resume.summary} Experiência com Kubernetes.` };
    expect(computeTailoredScore(jobAnalysis(), match(), edited)).toBe(before);
    expect(computeKeywordsAdded(base, edited, keywords)).not.toContain("Kubernetes");
    expect(assessTailoredKeywords(edited, keywords).find((item) => item.term === "Kubernetes")?.status).toBe("ausente");
  });

  it("calcula palavras-chave adicionadas e reorganização", () => {
    const { resume } = mergeTailoredResume({ base, ai: tailorAi(), outputLanguage: "pt-BR", keywords });
    expect(computeKeywordsAdded(base, resume, keywords)).toEqual(expect.arrayContaining(["JavaScript", "metodologias ágeis"]));
    const reorganization = computeReorganization(base, resume);
    expect(reorganization.omitted.map((item) => item.label)).toEqual(
      expect.arrayContaining(["Blog Pessoal", "Photoshop Básico", "Figma"]),
    );
    expect(reorganization.sectionOrderAfter.slice(0, 3)).toEqual(["summary", "skills", "experience"]);
  });
});
