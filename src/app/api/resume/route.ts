import { NextResponse } from "next/server";
import { LIMITS } from "@/lib/constants";
import { requireApiUser } from "@/server/auth/dal";
import { ApiError, readFormData, route } from "@/server/http";
import { enforceAiRateLimit } from "@/server/rate-limit";
import { importResumePdf } from "@/server/services/resume-import";

/** Envia um currículo em PDF. Cria sempre uma nova versão; as anteriores são preservadas. */
export const POST = route(async (request) => {
  const user = await requireApiUser();
  const form = await readFormData(request, LIMITS.resumePdfBytes + 1024 * 1024);
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new ApiError(400, "Selecione o arquivo PDF do currículo.", "sem_arquivo");
  }
  enforceAiRateLimit(user.id);
  const id = await importResumePdf(user.id, file);
  return NextResponse.json({ id }, { status: 201 });
});
