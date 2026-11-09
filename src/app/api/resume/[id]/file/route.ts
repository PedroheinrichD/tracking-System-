import { requireApiUser } from "@/server/auth/dal";
import { notFound, parseId, route } from "@/server/http";
import { getResumeById } from "@/server/repositories/resumes";
import { contentDisposition, getFileForUser, readFileContent } from "@/server/storage/files";

/** PDF original enviado pelo usuário (visualização inline ou download). */
export const GET = route<{ id: string }>(async (request, { params }) => {
  const user = await requireApiUser();
  const resume = await getResumeById(parseId((await params).id), user.id);
  if (!resume?.sourceFileId) throw notFound("Este currículo não tem PDF original.");
  const file = await getFileForUser(resume.sourceFileId, user.id);
  if (!file) throw notFound("Arquivo não encontrado.");

  const buffer = await readFileContent(file);
  const disposition = request.nextUrl.searchParams.get("download") ? "attachment" : "inline";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(buffer.length),
      "Content-Disposition": contentDisposition(disposition, file.originalName),
      "Cache-Control": "private, no-store",
    },
  });
});
