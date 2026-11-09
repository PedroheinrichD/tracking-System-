export const APP_NAME = "Sob Medida";
export const APP_TAGLINE = "ATS pessoal para currículos sob medida";
export const APP_TIME_ZONE = "America/Sao_Paulo";

/** Limites de upload (compartilhados entre a validação do cliente e a do servidor). */
export const LIMITS = {
  resumePdfBytes: 5 * 1024 * 1024,
  resumePdfPages: 10,
  jobPdfBytes: 10 * 1024 * 1024,
  jobPdfPages: 20,
  /** A API de visão aceita até 5 MB por imagem em base64 (≈ 3,75 MB brutos). */
  jobImageBytes: 3.5 * 1024 * 1024,
  jobImages: 4,
  jobTextChars: 30_000,
  /** Teto para o corpo de uma requisição de upload (soma de todos os arquivos). */
  requestBytes: 30 * 1024 * 1024,
} as const;

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const APPLICATION_STATUSES = [
  "analisada",
  "curriculo_preparado",
  "candidatado",
  "em_andamento",
  "entrevista",
  "reprovado",
  "aprovado",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type StatusTone = "neutral" | "info" | "primary" | "progress" | "highlight" | "danger" | "success";

export const STATUS_META: Record<ApplicationStatus, { label: string; tone: StatusTone; hint: string }> = {
  analisada: { label: "Analisada", tone: "neutral", hint: "Vaga analisada, currículo ainda não finalizado" },
  curriculo_preparado: { label: "Currículo preparado", tone: "info", hint: "PDF personalizado gerado" },
  candidatado: { label: "Candidatado", tone: "primary", hint: "Candidatura enviada" },
  em_andamento: { label: "Em andamento", tone: "progress", hint: "Processo seletivo em curso" },
  entrevista: { label: "Entrevista", tone: "highlight", hint: "Entrevista marcada ou realizada" },
  reprovado: { label: "Reprovado", tone: "danger", hint: "Processo encerrado sem aprovação" },
  aprovado: { label: "Aprovado", tone: "success", hint: "Aprovado no processo" },
};

/** Status que indicam que a candidatura foi de fato enviada. */
export const APPLIED_STATUSES: ApplicationStatus[] = [
  "candidatado",
  "em_andamento",
  "entrevista",
  "reprovado",
  "aprovado",
];

/** Etapas do pipeline de IA, na ordem em que precisam ser executadas. */
export const PIPELINE_STEPS = ["leitura", "analise", "compatibilidade", "personalizacao", "verificacao"] as const;
export type PipelineStep = (typeof PIPELINE_STEPS)[number];

export const PIPELINE_STEP_META: Record<PipelineStep, { label: string; running: string }> = {
  leitura: { label: "Leitura da vaga", running: "Lendo a vaga" },
  analise: { label: "Análise da vaga", running: "Analisando requisitos e palavras-chave" },
  compatibilidade: { label: "Compatibilidade", running: "Comparando com seu currículo" },
  personalizacao: { label: "Personalização", running: "Personalizando o currículo" },
  verificacao: { label: "Verificação de fidelidade", running: "Conferindo se nada foi inventado" },
};

/** Etapa concluída a partir da qual a compatibilidade já pode ser exibida. */
export const MATCH_DONE = PIPELINE_STEPS.indexOf("compatibilidade") + 1;
export const PIPELINE_DONE = PIPELINE_STEPS.length;

export const SENIORITY_LABELS: Record<string, string> = {
  estagio: "Estágio",
  junior: "Júnior",
  pleno: "Pleno",
  senior: "Sênior",
  especialista: "Especialista",
  gestao: "Liderança/gestão",
  nao_informado: "Nível não informado",
};

export const WORK_MODEL_LABELS: Record<string, string> = {
  remoto: "Remoto",
  hibrido: "Híbrido",
  presencial: "Presencial",
  nao_informado: "Modelo não informado",
};

export const OUTPUT_LANGUAGES = [
  { value: "auto", label: "Mesmo idioma do meu currículo" },
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en", label: "Inglês" },
  { value: "es", label: "Espanhol" },
] as const;

export const LANGUAGE_LABELS: Record<string, string> = {
  "pt-BR": "Português",
  pt: "Português",
  en: "Inglês",
  es: "Espanhol",
};
