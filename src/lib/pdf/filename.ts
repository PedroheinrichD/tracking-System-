import { resolveLocale } from "@/lib/domain/labels";

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function capitalize(word: string): string {
  return word ? word[0].toUpperCase() + word.slice(1) : word;
}

/** "Desenvolvedor(a) Front-end Pleno" → "Desenvolvedor_Frontend_Pleno" */
export function titleSlug(title: string, maxWords = 6): string {
  const cleaned = stripAccents(title)
    .replace(/\((a|o|e|as|os)\)|\/(a|o|e)\b/gi, "")
    .replace(/([A-Za-z0-9])[-–]([A-Za-z0-9])/g, "$1$2");
  return cleaned
    .split(/[^A-Za-z0-9+#]+/)
    .map((word) => word.replace(/\+/g, "plus").replace(/#/g, "sharp"))
    .filter(Boolean)
    .slice(0, maxWords)
    .map(capitalize)
    .join("_");
}

/** Ex.: Pedro_Curriculo_Desenvolvedor_Frontend.pdf */
export function buildResumeFileName(fullName: string, jobTitle: string | null | undefined, language: string): string {
  const firstName = titleSlug(fullName.trim().split(/\s+/)[0] ?? "", 1) || "Meu";
  const locale = resolveLocale(language);
  const document = locale === "en" ? "Resume" : locale === "es" ? "Curriculum" : "Curriculo";
  const title = jobTitle ? titleSlug(jobTitle) : "";
  return `${[firstName, document, title].filter(Boolean).join("_")}.pdf`;
}
