import { NextResponse } from "next/server";
import { ResumeDataSchema } from "@/lib/domain/resume";
import { requireApiUser } from "@/server/auth/dal";
import { ApiError, readJson, route } from "@/server/http";
import { createResumeVersion } from "@/server/repositories/resumes";

/** Cria uma versão do currículo preenchida manualmente (sem PDF). */
export const POST = route(async (request) => {
  const user = await requireApiUser();
  const data = await readJson(request, ResumeDataSchema);
  if (!data.personal.fullName.trim()) {
    throw new ApiError(400, "Informe pelo menos o seu nome.", "sem_nome");
  }
  const id = await createResumeVersion({
    userId: user.id,
    sourceType: "manual",
    sourceFileId: null,
    rawText: null,
    data,
    extracted: null,
    warnings: [],
    model: null,
  });
  return NextResponse.json({ id }, { status: 201 });
});
