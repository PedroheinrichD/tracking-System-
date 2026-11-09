import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/dal";
import { notFound, parseId, route } from "@/server/http";
import { activateResumeVersion } from "@/server/repositories/resumes";

/** Volta a usar uma versão anterior do currículo original. */
export const POST = route<{ id: string }>(async (_request, { params }) => {
  const user = await requireApiUser();
  const id = parseId((await params).id);
  if (!(await activateResumeVersion(id, user.id))) throw notFound("Versão do currículo não encontrada.");
  return NextResponse.json({ ok: true });
});
