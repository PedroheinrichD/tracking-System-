import { NextResponse } from "next/server";
import { z } from "zod";
import { APPLICATION_STATUSES } from "@/lib/constants";
import { requireApiUser } from "@/server/auth/dal";
import { ApiError, notFound, parseId, readJson, route } from "@/server/http";
import { deleteJob, getJob, updateJobDetails, updateJobStatus } from "@/server/repositories/jobs";
import { deleteFile, getFileForUser } from "@/server/storage/files";

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();

const PatchSchema = z.object({
  status: z.enum(APPLICATION_STATUSES).optional(),
  company: nullableText(190),
  title: nullableText(190),
  jobUrl: nullableText(1000),
  notes: z.string().max(5000).nullable().optional(),
});

export const GET = route<{ id: string }>(async (_request, { params }) => {
  const user = await requireApiUser();
  const job = await getJob(parseId((await params).id), user.id);
  if (!job) throw notFound("Vaga não encontrada.");
  return NextResponse.json({
    id: job.id,
    title: job.title,
    company: job.company,
    status: job.status,
    pipelineCompleted: job.pipelineCompleted,
    pipelineRunning: job.pipelineRunning,
    pipelineFailedStep: job.pipelineFailedStep,
    pipelineError: job.pipelineError,
    compatibilityScore: job.compatibilityScore,
    tailoredScore: job.tailoredScore,
  });
});

export const PATCH = route<{ id: string }>(async (request, { params }) => {
  const user = await requireApiUser();
  const id = parseId((await params).id);
  const body = await readJson(request, PatchSchema);
  const job = await getJob(id, user.id);
  if (!job) throw notFound("Vaga não encontrada.");

  if (body.jobUrl) {
    try {
      const url = new URL(body.jobUrl);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      throw new ApiError(400, "O link da vaga precisa começar com http:// ou https://.", "link_invalido");
    }
  }

  await updateJobDetails(id, user.id, {
    company: body.company,
    title: body.title,
    jobUrl: body.jobUrl,
    notes: body.notes,
  });
  if (body.status) await updateJobStatus(id, user.id, body.status);
  return NextResponse.json({ ok: true });
});

/** Exclui a vaga, suas versões personalizadas e anexos. O currículo original não é afetado. */
export const DELETE = route<{ id: string }>(async (_request, { params }) => {
  const user = await requireApiUser();
  const fileIds = await deleteJob(parseId((await params).id), user.id);
  if (!fileIds) throw notFound("Vaga não encontrada.");
  for (const fileId of fileIds) {
    const file = await getFileForUser(fileId, user.id);
    if (file && file.purpose !== "resume_source") await deleteFile(file);
  }
  return NextResponse.json({ ok: true });
});
