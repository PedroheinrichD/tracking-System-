/**
 * Normalização de texto para comparação de termos ao estilo de um ATS:
 * minúsculas, sem acentos, pontuação como separador, preservando caracteres
 * que fazem parte de nomes de tecnologias (c++, c#, node.js, ci/cd).
 */

export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Retorna o texto normalizado cercado por espaços, para que `includes(" termo ")`
 * funcione como busca por palavra inteira.
 */
export function normalizeForMatch(input: string): string {
  let value = stripAccents(input.toLowerCase());
  // front-end -> frontend, e-commerce -> ecommerce, full_stack -> fullstack
  value = value.replace(/([a-z0-9])[-_]+(?=[a-z0-9])/g, "$1");
  // Qualquer outro caractere vira separador, exceto + # . / (partes de nomes técnicos).
  value = value.replace(/[^a-z0-9+#./]+/g, " ");
  // Pontos e barras soltos ou no fim/começo de palavras são pontuação, não parte do termo.
  value = value
    .split(" ")
    .map((token) => token.replace(/^[./]+|[./]+$/g, ""))
    .filter(Boolean)
    .join(" ");
  return ` ${value} `;
}

/** Forma "frouxa" (só letras e números) usada para conferir citações literais. */
export function normalizeLoose(input: string): string {
  return stripAccents(input.toLowerCase())
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Grupos de grafias equivalentes. Termos curtos e ambíguos em português
 * (ex.: "ia", "go", "next") ficam de fora para evitar falsos positivos.
 */
const ALIAS_GROUPS: string[][] = [
  ["javascript", "js", "ecmascript"],
  ["typescript", "ts"],
  ["node.js", "nodejs", "node"],
  ["react", "react.js", "reactjs"],
  ["react native", "reactnative"],
  ["next.js", "nextjs"],
  ["vue", "vue.js", "vuejs"],
  ["nuxt", "nuxt.js", "nuxtjs"],
  ["angular", "angularjs", "angular.js"],
  ["express", "express.js", "expressjs"],
  ["nestjs", "nest.js"],
  ["postgresql", "postgres"],
  ["mongodb", "mongo"],
  ["sql server", "mssql", "microsoft sql server"],
  ["kubernetes", "k8s"],
  ["aws", "amazon web services"],
  ["gcp", "google cloud", "google cloud platform"],
  ["azure", "microsoft azure"],
  ["c#", "csharp"],
  [".net", "dotnet", ".net core"],
  ["golang"],
  ["html", "html5"],
  ["css", "css3"],
  ["tailwind css", "tailwind", "tailwindcss"],
  ["rest", "restful", "api rest", "apis rest", "rest api", "rest apis", "api restful", "apis restful"],
  ["ci/cd", "ci cd", "integracao continua"],
  ["frontend", "front end"],
  ["backend", "back end"],
  ["fullstack", "full stack"],
  ["machine learning", "aprendizado de maquina"],
  ["ingles", "english"],
  ["espanhol", "spanish", "espanol"],
  ["testes unitarios", "teste unitario", "unit tests", "unit testing", "testes de unidade"],
  ["spring boot", "springboot"],
  ["github actions"],
  ["ux", "user experience", "experiencia do usuario"],
  ["ui", "user interface", "interface do usuario"],
  ["git", "github", "gitlab"],
];

const aliasIndex: Map<string, string[]> = (() => {
  const index = new Map<string, string[]>();
  for (const group of ALIAS_GROUPS) {
    const normalized = group.map((term) => normalizeForMatch(term).trim());
    for (const term of normalized) {
      const existing = index.get(term) ?? [];
      index.set(term, Array.from(new Set([...existing, ...normalized])));
    }
  }
  return index;
})();

/**
 * Termos específicos que não herdam o grupo: quem cita "GitHub" conhece Git,
 * mas quem cita só "Git" não necessariamente usou GitHub.
 */
const SPECIFIC_TERMS = new Set(["github", "gitlab"]);

/** Todas as grafias (normalizadas) que contam como o mesmo termo. */
export function termForms(term: string, extraVariants: string[] = []): string[] {
  const base = normalizeForMatch(term).trim();
  if (!base) return [];
  const forms = new Set<string>([base]);
  if (!SPECIFIC_TERMS.has(base)) {
    for (const alias of aliasIndex.get(base) ?? []) forms.add(alias);
  }
  for (const variant of extraVariants) {
    const normalized = normalizeForMatch(variant).trim();
    if (normalized) forms.add(normalized);
  }
  return Array.from(forms);
}

function containsForm(normalizedText: string, form: string): boolean {
  if (!form) return false;
  if (normalizedText.includes(` ${form} `)) return true;
  // "react native" também deve casar com "reactnative" (e vice-versa via aliases).
  if (form.includes(" ") && normalizedText.includes(` ${form.replace(/ /g, "")} `)) return true;
  return false;
}

/** O texto (já normalizado com normalizeForMatch) contém exatamente este termo? */
export function containsExact(normalizedText: string, term: string): boolean {
  return containsForm(normalizedText, normalizeForMatch(term).trim());
}

/** O texto contém o termo ou alguma grafia equivalente? Retorna a forma encontrada. */
export function findTerm(normalizedText: string, term: string, extraVariants: string[] = []): string | null {
  for (const form of termForms(term, extraVariants)) {
    if (containsForm(normalizedText, form)) return form;
  }
  return null;
}

export function containsTerm(normalizedText: string, term: string, extraVariants: string[] = []): boolean {
  return findTerm(normalizedText, term, extraVariants) !== null;
}

/** Compara duas competências ignorando caixa, acentos e grafias equivalentes. */
export function sameTerm(a: string, b: string): boolean {
  const formsA = termForms(a);
  const normalizedB = normalizeForMatch(b).trim();
  return formsA.includes(normalizedB);
}
