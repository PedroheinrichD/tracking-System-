import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import type { TailoredResume } from "@/lib/domain/resume";
import { ApiError } from "@/server/http";
import { registerPdfFonts, ResumeDocument } from "./resume-document";

export async function renderResumePdf(resume: TailoredResume, subject: string): Promise<Buffer> {
  registerPdfFonts();
  try {
    return await renderToBuffer(<ResumeDocument resume={resume} subject={subject} />);
  } catch (error) {
    console.error("[pdf] falha ao gerar o PDF:", error);
    throw new ApiError(500, "Não foi possível gerar o PDF. Tente novamente.", "pdf_geracao");
  }
}
