import { requireApiUser } from "@/server/auth/dal";
import { notFound, parseId, route } from "@/server/http";
import { listJobFiles } from "@/server/repositories/jobs";
import { contentDisposition, getFileForUser, readFileContent } from "@/server/storage/files";

/** Anexos da vaga (prints e PDF), servidos só para o dono. */
export const GET = route<{ id: string; fileId: string }>(async (_request, { params }) => {
  const user = await requireApiUser();
  const { id, fileId } = await params;
  const jobId = parseId(id);
  const targetId = parseId(fileId);

  const attached = (await listJobFiles(jobId, user.id)).some((file) => file.id === targetId);
  const file = attached ? await getFileForUser(targetId, user.id) : null;
  if (!file) throw notFound("Anexo não encontrado.");

  const buffer = await readFileContent(file);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(buffer.length),
      "Content-Disposition": contentDisposition("inline", file.originalName),
      "Cache-Control": "private, max-age=3600",
    },
  });
});
