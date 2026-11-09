import "server-only";

/** Tags usadas para delimitar conteúdo do usuário/terceiros nos prompts. */
const DATA_TAGS = [
  "vaga",
  "curriculo",
  "curriculo_original",
  "curriculo_adaptado",
  "analise_vaga",
  "documento",
  "inventario",
] as const;
export type DataTag = (typeof DATA_TAGS)[number];

const TAG_PATTERN = new RegExp(`<\\s*/?\\s*(${DATA_TAGS.join("|")})\\b[^>]*>`, "gi");

/**
 * Envolve conteúdo não confiável em uma tag de dados. Qualquer ocorrência das
 * nossas tags dentro do conteúdo é neutralizada, para que um texto malicioso
 * não consiga "fechar" o bloco e se passar por instrução.
 */
export function wrapData(tag: DataTag, content: string): string {
  const neutralized = content.replace(TAG_PATTERN, (match) => match.replace(/</g, "‹").replace(/>/g, "›"));
  return `<${tag}>\n${neutralized.trim()}\n</${tag}>`;
}
