import { requireApiUser } from "@/server/auth/dal";
import { notFound, parseId, route } from "@/server/http";
import { getLatestTailored } from "@/server/repositories/tailored";
import { contentDisposition, getFileForUser, readFileContent } from "@/server/storage/files";

/** Download do PDF final gerado para a vaga (o mesmo arquivo enviado à empresa). */
export const GET = route<{ id: string }>(async (_request, { params }) => {
  const user = await requireApiUser();
  const tailored = await getLatestTailored(parseId((await params).id), user.id);
  const file = tailored?.pdfFileId ? await getFileForUser(tailored.pdfFileId, user.id) : null;
  if (!file) throw notFound("O PDF final ainda não foi gerado para esta vaga.");

  const buffer = await readFileContent(file);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": contentDisposition("attachment", file.originalName),
      "Cache-Control": "private, no-store",
    },
  });
});
