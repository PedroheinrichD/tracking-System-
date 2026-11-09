import { ResumeDataSchema, type ResumeData } from "@/lib/domain/resume";
import type { JobAnalysis, KeywordAssessment } from "@/lib/domain/job";
import type { TailorAi } from "@/lib/domain/tailoring";

export function baseResume(): ResumeData {
  return ResumeDataSchema.parse({
    language: "pt-BR",
    personal: {
      fullName: "Pedro Henrique Souza",
      headline: "Desenvolvedor Full Stack",
      email: "pedro@example.com",
      phone: "(11) 90000-0000",
      location: "São Paulo, SP",
      links: [{ label: "GitHub", url: "github.com/pedro" }],
    },
    summary: "Desenvolvedor com experiência em aplicações web com React e Node.js.",
    experiences: [
      {
        id: "exp-1",
        company: "Loja Online LTDA",
        role: "Desenvolvedor Front-end",
        employmentType: "CLT",
        location: "Remoto",
        startDate: "03/2022",
        endDate: "",
        current: true,
        description: "",
        highlights: [
          "Desenvolvi telas do e-commerce com React e TypeScript",
          "Integrei o front-end com APIs REST em Node.js",
          "Reduzi o tempo de carregamento da home em 30%",
        ],
        technologies: ["React", "TypeScript", "Node.js"],
      },
      {
        id: "exp-2",
        company: "Agência Pixel",
        role: "Estagiário de Desenvolvimento",
        employmentType: "Estágio",
        location: "São Paulo, SP",
        startDate: "01/2021",
        endDate: "02/2022",
        current: false,
        description: "Manutenção de sites institucionais em PHP e MySQL.",
        highlights: ["Criei páginas responsivas com HTML, CSS e JS"],
        technologies: ["PHP", "MySQL", "JS"],
      },
    ],
    education: [
      {
        id: "edu-1",
        institution: "Universidade Paulista",
        degree: "Bacharelado",
        field: "Ciência da Computação",
        startDate: "2019",
        endDate: "2023",
        status: "Concluído",
        details: "",
      },
    ],
    certifications: [
      { id: "cert-1", name: "Docker para Desenvolvedores", issuer: "Alura", date: "2023", workload: "12h", url: "", kind: "curso" },
      { id: "cert-2", name: "Photoshop Básico", issuer: "Udemy", date: "2020", workload: "8h", url: "", kind: "curso" },
    ],
    projects: [
      {
        id: "proj-1",
        name: "Gerenciador de Tarefas",
        description: "Aplicação de tarefas com autenticação.",
        highlights: ["Implementei autenticação com JWT"],
        technologies: ["Next.js", "PostgreSQL"],
        url: "github.com/pedro/tarefas",
        startDate: "2023",
        endDate: "2023",
      },
      {
        id: "proj-2",
        name: "Blog Pessoal",
        description: "Blog estático.",
        highlights: [],
        technologies: ["Gatsby"],
        url: "",
        startDate: "2021",
        endDate: "2021",
      },
    ],
    skills: {
      programmingLanguages: ["JS", "TypeScript", "PHP"],
      frameworks: ["React", "Next.js"],
      databases: ["MySQL", "PostgreSQL"],
      tools: ["Git", "Docker", "Figma"],
      otherTechnical: ["Scrum", "APIs REST"],
      softSkills: ["Comunicação"],
    },
    languages: [{ name: "Inglês", level: "Intermediário" }],
    additionalInfo: [],
  });
}

export function jobAnalysis(): JobAnalysis {
  return {
    title: "Desenvolvedor Front-end Pleno",
    company: "Fintech X",
    seniority: "pleno",
    seniorityEvidence: "Título da vaga",
    location: "Remoto",
    workModel: "remoto",
    employmentType: "CLT",
    summary: "Vaga para front-end com React.",
    responsibilities: [],
    requirements: [
      { id: "req-1", description: "Experiência com React", category: "tecnico", importance: "obrigatorio", keywords: ["React"] },
      { id: "req-2", description: "Experiência com Kubernetes", category: "tecnico", importance: "obrigatorio", keywords: ["Kubernetes"] },
      { id: "req-3", description: "Conhecimento em metodologias ágeis", category: "tecnico", importance: "desejavel", keywords: ["metodologias ágeis"] },
    ],
    technologies: [],
    technicalSkills: [],
    softSkills: [],
    experienceRequired: "",
    minYearsExperience: null,
    educationRequired: "",
    languagesRequired: [],
    differentials: [],
    atsKeywords: [
      { term: "React", variants: ["React.js"], priority: "alta", category: "tecnologia" },
      { term: "JavaScript", variants: ["JS"], priority: "alta", category: "tecnologia" },
      { term: "Kubernetes", variants: ["K8s"], priority: "media", category: "tecnologia" },
      { term: "metodologias ágeis", variants: ["agile"], priority: "baixa", category: "metodologia" },
      { term: "liderança", variants: [], priority: "baixa", category: "competencia_comportamental" },
    ],
    postingLanguage: "pt-BR",
    suspiciousContent: [],
  };
}

/** Avaliação de palavras-chave equivalente à que o pipeline produziria para o currículo base. */
export function keywordAssessments(): KeywordAssessment[] {
  return [
    { term: "React", variants: ["React.js"], priority: "alta", category: "tecnologia", status: "presente", matchedText: "React", source: "texto" },
    { term: "JavaScript", variants: ["JS"], priority: "alta", category: "tecnologia", status: "equivalente", matchedText: "js", source: "texto" },
    { term: "Kubernetes", variants: ["K8s"], priority: "media", category: "tecnologia", status: "ausente", matchedText: "", source: "nenhum" },
    { term: "metodologias ágeis", variants: ["agile"], priority: "baixa", category: "metodologia", status: "equivalente", matchedText: "Scrum", source: "ia" },
    { term: "liderança", variants: [], priority: "baixa", category: "competencia_comportamental", status: "ausente", matchedText: "", source: "nenhum" },
  ];
}

export function tailorAi(overrides: Partial<TailorAi> = {}): TailorAi {
  return {
    headline: "Desenvolvedor Front-end | React | TypeScript",
    summary: "Desenvolvedor front-end com experiência em React, TypeScript e JavaScript, integrando APIs REST.",
    sectionOrder: ["summary", "skills", "experience", "projects", "education", "certifications", "languages"],
    experiences: [
      {
        id: "exp-1",
        description: "",
        highlights: [
          "Desenvolvi as telas do e-commerce com React e TypeScript",
          "Reduzi o tempo de carregamento da página inicial em 30%",
          "Integrei o front-end a APIs REST em Node.js",
        ],
        technologies: ["React", "TypeScript", "Node.js", "Docker"],
      },
    ],
    projects: [
      { id: "proj-1", description: "Aplicação de tarefas com autenticação.", highlights: ["Implementei autenticação com JWT"], technologies: ["Next.js", "PostgreSQL"] },
      { id: "proj-999", description: "Projeto inventado", highlights: [], technologies: [] },
    ],
    certificationIds: ["cert-1"],
    skills: {
      programmingLanguages: ["JavaScript", "TypeScript"],
      frameworks: ["React", "Next.js"],
      databases: ["PostgreSQL", "MySQL"],
      tools: ["Git", "Docker", "Kubernetes"],
      otherTechnical: ["Metodologias ágeis (Scrum)", "APIs REST"],
      softSkills: ["Comunicação", "Liderança"],
    },
    translations: { location: "", experiences: [], education: [], certifications: [], projects: [], languages: [], additionalInfo: [] },
    keywordsUsed: ["React", "JavaScript", "metodologias ágeis"],
    missingSkills: [{ skill: "Kubernetes", importance: "obrigatorio", note: "Não consta no currículo." }],
    changes: [],
    suggestions: [],
    ...overrides,
  };
}
