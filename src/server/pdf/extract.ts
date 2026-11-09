import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import { ApiError } from "@/server/http";

export interface PdfTextResult {
  text: string;
  pages: number;
}

function cleanText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isPasswordError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: string }).name === "PasswordException";
}

/**
 * Extrai o texto de um PDF localmente (sem IA).
 * Erros comuns viram mensagens claras: PDF protegido, corrompido ou com páginas demais.
 */
export async function readPdfText(buffer: Buffer, options: { maxPages: number; label: string }): Promise<PdfTextResult> {
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    pdf = await getDocumentProxy(new Uint8Array(buffer));
  } catch (error) {
    if (isPasswordError(error)) {
      throw new ApiError(
        422,
        `O ${options.label} está protegido por senha. Gere uma cópia sem senha e envie novamente.`,
        "pdf_protegido",
      );
    }
    throw new ApiError(
      422,
      `Não foi possível abrir o ${options.label}. O arquivo pode estar corrompido ou não ser um PDF válido.`,
      "pdf_invalido",
    );
  }

  try {
    if (pdf.numPages > options.maxPages) {
      throw new ApiError(
        422,
        `O ${options.label} tem ${pdf.numPages} páginas; o limite é ${options.maxPages}.`,
        "pdf_paginas",
      );
    }
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    return { text: cleanText(text.map(cleanText).join("\n\n")), pages: totalPages };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(422, `Não foi possível extrair o texto do ${options.label}.`, "pdf_extracao");
  } finally {
    // O objeto do pdf.js tem destroy(), mas a tipagem do unpdf não o expõe.
    const closable = pdf as unknown as { destroy?: () => Promise<void> };
    await closable.destroy?.().catch(() => undefined);
  }
}

/** PDFs escaneados (só imagem) praticamente não têm texto extraível. */
export function hasUsefulText(text: string, minChars = 150): boolean {
  return text.replace(/\s+/g, "").length >= minChars;
}
