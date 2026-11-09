import "server-only";
import { coerceResume, coerceTailored, type ResumeData, type TailoredResume } from "@/lib/domain/resume";
import type { TailoringReport } from "@/lib/domain/tailoring";
import { execute, fit, parseJsonColumn, queryOne, toJson, withTransaction, type RowDataPacket } from "@/server/db";

export interface TailoredRecord {
  id: number;
  jobId: number;
  userId: number;
  version: number;
  baseResumeId: number;
  baseSnapshot: ResumeData;
  aiContent: TailoredResume;
  content: TailoredResume;
  report: TailoringReport;
  language: string;
  verified: boolean;
  pdfFileId: number | null;
  pdfGeneratedAt: Date | null;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TailoredRow extends RowDataPacket {
  id: number;
  job_id: number;
  user_id: number;
  version: number;
  base_resume_id: number;
  base_snapshot_json: unknown;
  ai_content_json: unknown;
  content_json: unknown;
  report_json: unknown;
  language: string;
  verified: number;
  pdf_file_id: number | null;
  pdf_generated_at: Date | null;
  edited_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function toRecord(row: TailoredRow): TailoredRecord {
  return {
    id: row.id,
    jobId: row.job_id,
    userId: row.user_id,
    version: row.version,
    baseResumeId: row.base_resume_id,
    baseSnapshot: coerceResume(parseJsonColumn<unknown>(row.base_snapshot_json, {})),
    aiContent: coerceTailored(parseJsonColumn<unknown>(row.ai_content_json, {})),
    content: coerceTailored(parseJsonColumn<unknown>(row.content_json, {})),
    report: parseJsonColumn<TailoringReport>(row.report_json, {} as TailoringReport),
    language: row.language,
    verified: row.verified === 1,
    pdfFileId: row.pdf_file_id,
    pdfGeneratedAt: row.pdf_generated_at,
    editedAt: row.edited_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getLatestTailored(jobId: number, userId: number): Promise<TailoredRecord | null> {
  const row = await queryOne<TailoredRow>(
    "SELECT * FROM tailored_resumes WHERE job_id = ? AND user_id = ? ORDER BY version DESC LIMIT 1",
    [jobId, userId],
  );
  return row ? toRecord(row) : null;
}

/** Cada geração cria uma nova versão; versões anteriores permanecem no banco. */
export async function createTailored(input: {
  jobId: number;
  userId: number;
  baseResumeId: number;
  baseSnapshot: ResumeData;
  content: TailoredResume;
  report: TailoringReport;
  language: string;
}): Promise<number> {
  return withTransaction(async (connection) => {
    const current = await queryOne<RowDataPacket & { max_version: number | null }>(
      "SELECT MAX(version) AS max_version FROM tailored_resumes WHERE job_id = ? FOR UPDATE",
      [input.jobId],
      connection,
    );
    const result = await execute(
      `INSERT INTO tailored_resumes
         (job_id, user_id, version, base_resume_id, base_snapshot_json, ai_content_json, content_json, report_json, language, verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        input.jobId,
        input.userId,
        Number(current?.max_version ?? 0) + 1,
        input.baseResumeId,
        toJson(input.baseSnapshot),
        toJson(input.content),
        toJson(input.content),
        toJson(input.report),
        fit(input.language, 10),
      ],
      connection,
    );
    return result.insertId;
  });
}

export async function saveVerification(
  id: number,
  input: { aiContent: TailoredResume; content: TailoredResume; report: TailoringReport },
): Promise<void> {
  await execute(
    "UPDATE tailored_resumes SET ai_content_json = ?, content_json = ?, report_json = ?, verified = 1 WHERE id = ?",
    [toJson(input.aiContent), toJson(input.content), toJson(input.report), id],
  );
}

export async function saveReport(id: number, report: TailoringReport): Promise<void> {
  await execute("UPDATE tailored_resumes SET report_json = ? WHERE id = ?", [toJson(report), id]);
}

export async function saveEditedContent(
  id: number,
  userId: number,
  content: TailoredResume,
  report: TailoringReport,
): Promise<void> {
  await execute(
    `UPDATE tailored_resumes SET content_json = ?, report_json = ?, edited_at = UTC_TIMESTAMP()
      WHERE id = ? AND user_id = ?`,
    [toJson(content), toJson(report), id, userId],
  );
}

export async function setTailoredPdf(id: number, fileId: number): Promise<void> {
  await execute("UPDATE tailored_resumes SET pdf_file_id = ?, pdf_generated_at = UTC_TIMESTAMP() WHERE id = ?", [
    fileId,
    id,
  ]);
}
