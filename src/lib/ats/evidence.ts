import { normalizeLoose } from "./normalize";

/**
 * Confere se um trecho citado pela IA existe de fato no currículo.
 * Aceita diferenças de pontuação, acentos e caixa. Para citações longas que a IA
 * tenha encurtado ou emendado, aceita quando a maior parte dos trigramas de
 * palavras do trecho aparece no texto.
 */
export function isQuoteInText(quote: string, sourceText: string): boolean {
  const normalizedQuote = normalizeLoose(quote);
  if (!normalizedQuote) return false;
  const normalizedSource = ` ${normalizeLoose(sourceText)} `;
  if (normalizedSource.includes(` ${normalizedQuote} `) || normalizedSource.includes(normalizedQuote)) return true;

  const words = normalizedQuote.split(" ");
  if (words.length < 4) return false;
  const trigrams: string[] = [];
  for (let index = 0; index <= words.length - 3; index += 1) {
    trigrams.push(words.slice(index, index + 3).join(" "));
  }
  const found = trigrams.filter((trigram) => normalizedSource.includes(` ${trigram} `)).length;
  return found / trigrams.length >= 0.75;
}

/** Números (inteiros, decimais, percentuais) presentes em um texto, normalizados. */
export function extractNumbers(text: string): string[] {
  const matches = text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return Array.from(new Set(matches.map((match) => match.replace(",", "."))));
}
