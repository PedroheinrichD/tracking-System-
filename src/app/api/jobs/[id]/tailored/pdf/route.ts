import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/dal";
import { parseId, route } from "@/server/http";
import { contentDisposition } from "@/server/storage/files";
import { finalizeTailoredPdf, renderTailoredPdf } from "@/server/services/tailored";

/** Pré-visualização do PDF a partir da versão atual (sem gravar). */
export const GET = route<{ id: string }>(async (request, { params }) => {
  const user = await requireApiUser();
  const { buffer, fileName } = await renderTailoredPdf(parseId((await params).id), user.id);
  const disposition = request.nextUrl.searchParams.get("download") ? "attachment" : "inline";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": contentDisposition(disposition, fileName),
      "Cache-Control": "private, no-store",
    },
  });
});

/** Gera o PDF final, guarda e atualiza o status da vaga. */
export const POST = route<{ id: string }>(async (_request, { params }) => {
  const user = await requireApiUser();
  const id = parseId((await params).id);
  const { fileName } = await finalizeTailoredPdf(id, user.id);
  return NextResponse.json({ fileName, downloadUrl: `/api/jobs/${id}/tailored/pdf/final` }, { status: 201 });
});
