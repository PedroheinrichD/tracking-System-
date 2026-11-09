import { NextResponse } from "next/server";
import { LIMITS } from "@/lib/constants";
import { requireApiUser } from "@/server/auth/dal";
import { readFormData, route } from "@/server/http";
import { createJobFromForm } from "@/server/services/job-pipeline";

/** Cria uma vaga a partir de texto, imagens e/ou PDF. A análise roda depois, etapa por etapa. */
export const POST = route(async (request) => {
  const user = await requireApiUser();
  const form = await readFormData(request, LIMITS.requestBytes);
  const id = await createJobFromForm(user.id, form);
  return NextResponse.json({ id }, { status: 201 });
});
