import "server-only";
import {
  APPLICATION_STATUSES,
  APPLIED_STATUSES,
  PIPELINE_STEPS,
  type ApplicationStatus,
  type PipelineStep,
} from "@/lib/constants";
import type { JobAnalysis, MatchResult, ScoreBreakdown } from "@/lib/domain/job";
import {
  execute,
  fit,
  parseJsonColumn,
  query,
  queryOne,
  withTransaction,
  type PoolConnection,
  type RowDataPacket,
} from "@/server/db";

/** Uma etapa "rodando" há mais que isso é considerada travada (ex.: servidor reiniciado). */
export const STALE_STEP_MINUTES = 15;

export interface JobRecord {
  id: number;
  userId: number;
  baseResumeId: number;
  company: string | null;
  title: string | null;
  seniority: string | null;
  location: string | null;
  workModel: string | null;
  jobUrl: string | null;
  inputText: string | null;
  extractedText: string | null;
  descriptionText: string | null;
  outputLanguage: string | null;
  analysis: JobAnalysis | null;
  match: MatchResult | null;
  score: ScoreBreakdown | null;
  compatibilityScore: number | null;
  tailoredScore: number | null;
  status: ApplicationStatus;
  pipelineCompleted: number;
  pipelineRunning: PipelineStep | null;
  pipelineStartedAt: Date | null;
  pipelineFailedStep: PipelineStep | null;
  pipelineError: string | null;
  notes: string | null;
  appliedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobSummary {
  id: number;
  company: string | null;
  title: string | null;
  seniority: string | null;
  compatibilityScore: number | null;
  tailoredScore: number | null;
  status: ApplicationStatus;
  pipelineCompleted: number;
  pipelineRunning: PipelineStep | null;
  pipelineFailedStep: PipelineStep | null;
  hasPdf: boolean;
  createdAt: Date;
  appliedAt: Date | null;
}

interface JobRow extends RowDataPacket {
  id: number;
  user_id: number;
  base_resume_id: number;
  company: string | null;
  title: string | null;
  seniority: string | null;
  location: string | null;
  work_model: string | null;
  job_url: string | null;
  input_text: string | null;
  extracted_text: string | null;
  description_text: string | null;
  output_language: string | null;
  analysis_json: unknown;
  match_json: unknown;
  score_json: unknown;
  compatibility_score: number | null;
  tailored_score: number | null;
  status: ApplicationStatus;
  pipeline_completed: number;
  pipeline_running: PipelineStep | null;
  pipeline_started_at: Date | null;
  pipeline_failed_step: PipelineStep | null;
  pipeline_error: string | null;
  notes: string | null;
  applied_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function toRecord(row: JobRow): JobRecord {
  return {
    id: row.id,
    userId: row.user_id,
    baseResumeId: row.base_resume_id,
    company: row.company,
    title: row.title,
    seniority: row.seniority,
    location: row.location,
    workModel: row.work_model,
    jobUrl: row.job_url,
    inputText: row.input_text,
    extractedText: row.extracted_text,
    descriptionText: row.description_text,
    outputLanguage: row.output_language,
    analysis: parseJsonColumn<JobAnalysis | null>(row.analysis_json, null),
    match: parseJsonColumn<MatchResult | null>(row.match_json, null),
    score: parseJsonColumn<ScoreBreakdown | null>(row.score_json, null),
    compatibilityScore: row.compatibility_score,
    tailoredScore: row.tailored_score,
    status: row.status,
    pipelineCompleted: row.pipeline_completed,
    pipelineRunning: row.pipeline_running,
    pipelineStartedAt: row.pipeline_started_at,
    pipelineFailedStep: row.pipeline_failed_step,
    pipelineError: row.pipeline_error,
    notes: row.notes,
    appliedAt: row.applied_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createJob(
  input: {
    userId: number;
    baseResumeId: number;
    company: string | null;
    title: string | null;
    jobUrl: string | null;
    inputText: string | null;
    extractedText: string | null;
    outputLanguage: string;
  },
  connection: PoolConnection,
): Promise<number> {
  const result = await execute(
    `INSERT INTO jobs (user_id, base_resume_id, company, title, job_url, input_text, extracted_text, output_language)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.userId,
      input.baseResumeId,
      fit(input.company, 190),
      fit(input.title, 190),
      fit(input.jobUrl, 1000),
      input.inputText,
      input.extractedText,
      fit(input.outputLanguage, 10),
    ],
    connection,
  );
  await execute(
    "INSERT INTO job_status_history (job_id, from_status, to_status) VALUES (?, NULL, 'analisada')",
    [result.insertId],
    connection,
  );
  return result.insertId;
}

export async function attachFileToJob(jobId: number, fileId: number, position: number, connection: PoolConnection) {
  await execute("INSERT INTO job_files (job_id, file_id, position) VALUES (?, ?, ?)", [jobId, fileId, position], connection);
}

export async function getJob(id: number, userId: number): Promise<JobRecord | null> {
  const row = await queryOne<JobRow>("SELECT * FROM jobs WHERE id = ? AND user_id = ?", [id, userId]);
  return row ? toRecord(row) : null;
}

export interface JobListFilters {
  status?: ApplicationStatus | null;
  search?: string | null;
  sort?: "recentes" | "antigas" | "compatibilidade";
}

export async function listJobs(userId: number, filters: JobListFilters = {}): Promise<JobSummary[]> {
  const where = ["j.user_id = ?"];
  const params: unknown[] = [userId];
  if (filters.status && (APPLICATION_STATUSES as readonly string[]).includes(filters.status)) {
    where.push("j.status = ?");
    params.push(filters.status);
  }
  if (filters.search?.trim()) {
    where.push("(j.title LIKE ? OR j.company LIKE ?)");
    const like = `%${filters.search.trim().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    params.push(like, like);
  }
  const order =
    filters.sort === "antigas"
      ? "j.created_at ASC"
      : filters.sort === "compatibilidade"
        ? "j.compatibility_score IS NULL, j.compatibility_score DESC, j.created_at DESC"
        : "j.created_at DESC";

  const rows = await query<
    RowDataPacket & {
      id: number;
      company: string | null;
      title: string | null;
      seniority: string | null;
      compatibility_score: number | null;
      tailored_score: number | null;
      status: ApplicationStatus;
      pipeline_completed: number;
      pipeline_running: PipelineStep | null;
      pipeline_failed_step: PipelineStep | null;
      has_pdf: number;
      created_at: Date;
      applied_at: Date | null;
    }
  >(
    `SELECT j.id, j.company, j.title, j.seniority, j.compatibility_score, j.tailored_score, j.status,
            j.pipeline_completed, j.pipeline_running, j.pipeline_failed_step, j.created_at, j.applied_at,
            EXISTS(SELECT 1 FROM tailored_resumes t WHERE t.job_id = j.id AND t.pdf_file_id IS NOT NULL) AS has_pdf
       FROM jobs j
      WHERE ${where.join(" AND ")}
      ORDER BY ${order}
      LIMIT 500`,
    params,
  );
  return rows.map((row) => ({
    id: row.id,
    company: row.company,
    title: row.title,
    seniority: row.seniority,
    compatibilityScore: row.compatibility_score,
    tailoredScore: row.tailored_score,
    status: row.status,
    pipelineCompleted: row.pipeline_completed,
    pipelineRunning: row.pipeline_running,
    pipelineFailedStep: row.pipeline_failed_step,
    hasPdf: Boolean(row.has_pdf),
    createdAt: row.created_at,
    appliedAt: row.applied_at,
  }));
}

/**
 * Reserva uma etapa do pipeline de forma atômica. Só funciona se as etapas
 * anteriores estiverem concluídas e nenhuma outra estiver rodando (ou se a que
 * está rodando travou). Evita execuções duplicadas por cliques repetidos.
 */
export async function claimPipelineStep(jobId: number, userId: number, step: PipelineStep): Promise<boolean> {
  const index = PIPELINE_STEPS.indexOf(step);
  const result = await execute(
    `UPDATE jobs
        SET pipeline_running = ?, pipeline_started_at = UTC_TIMESTAMP(), pipeline_error = NULL, pipeline_failed_step = NULL
      WHERE id = ? AND user_id = ? AND pipeline_completed >= ?
        AND (pipeline_running IS NULL OR pipeline_started_at < UTC_TIMESTAMP() - INTERVAL ${STALE_STEP_MINUTES} MINUTE)`,
    [step, jobId, userId, index],
  );
  return result.affectedRows === 1;
}

export async function completePipelineStep(
  jobId: number,
  step: PipelineStep,
  fields: Record<string, unknown> = {},
): Promise<void> {
  const index = PIPELINE_STEPS.indexOf(step);
  const columns = Object.keys(fields);
  if (columns.some((column) => !/^[a-z_]+$/.test(column))) throw new Error("Nome de coluna inválido.");
  const assignments = columns.map((column) => `${column} = ?`);
  await execute(
    `UPDATE jobs
        SET ${[...assignments, "pipeline_completed = ?", "pipeline_running = NULL", "pipeline_started_at = NULL"].join(", ")}
      WHERE id = ?`,
    [...columns.map((column) => fields[column]), index + 1, jobId],
  );
}

export async function failPipelineStep(jobId: number, step: PipelineStep, message: string): Promise<void> {
  await execute(
    `UPDATE jobs
        SET pipeline_running = NULL, pipeline_started_at = NULL, pipeline_failed_step = ?, pipeline_error = ?
      WHERE id = ?`,
    [step, message.slice(0, 2000), jobId],
  );
}

export async function updateJobDetails(
  jobId: number,
  userId: number,
  fields: { company?: string | null; title?: string | null; jobUrl?: string | null; notes?: string | null },
): Promise<void> {
  const assignments: string[] = [];
  const params: unknown[] = [];
  if (fields.company !== undefined) {
    assignments.push("company = ?");
    params.push(fit(fields.company, 190));
  }
  if (fields.title !== undefined) {
    assignments.push("title = ?");
    params.push(fit(fields.title, 190));
  }
  if (fields.jobUrl !== undefined) {
    assignments.push("job_url = ?");
    params.push(fit(fields.jobUrl, 1000));
  }
  if (fields.notes !== undefined) {
    assignments.push("notes = ?");
    params.push(fields.notes?.trim() ? fields.notes.trim().slice(0, 5000) : null);
  }
  if (!assignments.length) return;
  await execute(`UPDATE jobs SET ${assignments.join(", ")} WHERE id = ? AND user_id = ?`, [...params, jobId, userId]);
}

/** Muda o status da candidatura registrando o histórico. */
export async function updateJobStatus(jobId: number, userId: number, status: ApplicationStatus): Promise<boolean> {
  return withTransaction(async (connection) => {
    const current = await queryOne<RowDataPacket & { status: ApplicationStatus; applied_at: Date | null }>(
      "SELECT status, applied_at FROM jobs WHERE id = ? AND user_id = ? FOR UPDATE",
      [jobId, userId],
      connection,
    );
    if (!current) return false;
    if (current.status === status) return true;
    const markApplied = APPLIED_STATUSES.includes(status) && !current.applied_at;
    await execute(
      `UPDATE jobs SET status = ?${markApplied ? ", applied_at = UTC_TIMESTAMP()" : ""} WHERE id = ?`,
      [status, jobId],
      connection,
    );
    await execute(
      "INSERT INTO job_status_history (job_id, from_status, to_status) VALUES (?, ?, ?)",
      [jobId, current.status, status],
      connection,
    );
    return true;
  });
}

export async function getStatusHistory(
  jobId: number,
  userId: number,
): Promise<{ fromStatus: ApplicationStatus | null; toStatus: ApplicationStatus; changedAt: Date }[]> {
  const rows = await query<
    RowDataPacket & { from_status: ApplicationStatus | null; to_status: ApplicationStatus; changed_at: Date }
  >(
    `SELECT h.from_status, h.to_status, h.changed_at
       FROM job_status_history h
       JOIN jobs j ON j.id = h.job_id
      WHERE h.job_id = ? AND j.user_id = ?
      ORDER BY h.changed_at ASC, h.id ASC`,
    [jobId, userId],
  );
  return rows.map((row) => ({ fromStatus: row.from_status, toStatus: row.to_status, changedAt: row.changed_at }));
}

export interface JobFileSummary {
  id: number;
  purpose: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  position: number;
}

export async function listJobFiles(jobId: number, userId: number): Promise<JobFileSummary[]> {
  const rows = await query<
    RowDataPacket & {
      id: number;
      purpose: string;
      original_name: string;
      mime_type: string;
      size_bytes: number;
      position: number;
    }
  >(
    `SELECT f.id, f.purpose, f.original_name, f.mime_type, f.size_bytes, jf.position
       FROM job_files jf
       JOIN stored_files f ON f.id = jf.file_id
      WHERE jf.job_id = ? AND f.user_id = ?
      ORDER BY jf.position ASC`,
    [jobId, userId],
  );
  return rows.map((row) => ({
    id: row.id,
    purpose: row.purpose,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    position: row.position,
  }));
}

/** Exclui a vaga (e, em cascata, histórico e versões personalizadas). Retorna os arquivos a apagar do disco. */
export async function deleteJob(jobId: number, userId: number): Promise<number[] | null> {
  return withTransaction(async (connection) => {
    const job = await queryOne<RowDataPacket & { id: number }>(
      "SELECT id FROM jobs WHERE id = ? AND user_id = ? FOR UPDATE",
      [jobId, userId],
      connection,
    );
    if (!job) return null;
    const files = await query<RowDataPacket & { file_id: number }>(
      `SELECT file_id FROM job_files WHERE job_id = ?
       UNION
       SELECT pdf_file_id AS file_id FROM tailored_resumes WHERE job_id = ? AND pdf_file_id IS NOT NULL`,
      [jobId, jobId],
      connection,
    );
    await execute("DELETE FROM jobs WHERE id = ?", [jobId], connection);
    return files.map((file) => file.file_id);
  });
}

export async function countJobsByStatus(userId: number): Promise<Record<ApplicationStatus, number>> {
  const rows = await query<RowDataPacket & { status: ApplicationStatus; total: number }>(
    "SELECT status, COUNT(*) AS total FROM jobs WHERE user_id = ? GROUP BY status",
    [userId],
  );
  const counts = Object.fromEntries(APPLICATION_STATUSES.map((status) => [status, 0])) as Record<ApplicationStatus, number>;
  for (const row of rows) counts[row.status] = Number(row.total);
  return counts;
}
