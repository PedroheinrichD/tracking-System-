import { NextResponse } from "next/server";
import { z } from "zod";
import { TailoredResumeSchema } from "@/lib/domain/resume";
import { requireApiUser } from "@/server/auth/dal";
import { parseId, readJson, route } from "@/server/http";
import { restoreAiVersion, saveTailoredEdits } from "@/server/services/tailored";

/** Salva a versão revisada pelo usuário. */
export const PUT = route<{ id: string }>(async (request, { params }) => {
  const user = await requireApiUser();
  const { content } = await readJson(request, z.object({ content: TailoredResumeSchema }));
  const { report } = await saveTailoredEdits(parseId((await params).id), user.id, content);
  return NextResponse.json({ ok: true, report });
});

/** Descarta as edições e volta ao texto gerado (e verificado) pela IA. */
export const POST = route<{ id: string }>(async (_request, { params }) => {
  const user = await requireApiUser();
  const { report } = await restoreAiVersion(parseId((await params).id), user.id);
  return NextResponse.json({ ok: true, report });
});
