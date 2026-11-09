import { NextResponse } from "next/server";
import { ResumeDataSchema } from "@/lib/domain/resume";
import { requireApiUser } from "@/server/auth/dal";
import { notFound, parseId, readJson, route } from "@/server/http";
import { getResumeById, updateResumeData } from "@/server/repositories/resumes";

/** Salva correções manuais nos dados extraídos do currículo original. */
export const PUT = route<{ id: string }>(async (request, { params }) => {
  const user = await requireApiUser();
  const id = parseId((await params).id);
  const resume = await getResumeById(id, user.id);
  if (!resume) throw notFound("Currículo não encontrado.");

  const data = await readJson(request, ResumeDataSchema);
  // Ids precisam ser únicos: personalizações referenciam os itens por eles.
  const ids = [...data.experiences, ...data.education, ...data.certifications, ...data.projects].map((item) => item.id);
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json(
      { error: { message: "Há itens com identificadores repetidos. Recarregue a página e tente de novo.", code: "ids_duplicados" } },
      { status: 400 },
    );
  }
  await updateResumeData(id, user.id, data);
  return NextResponse.json({ ok: true });
});
