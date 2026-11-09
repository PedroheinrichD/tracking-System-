import "server-only";
import { coerceResume, type ResumeData } from "@/lib/domain/resume";
import {
  execute,
  fit,
  parseJsonColumn,
  query,
  queryOne,
  toJson,
  withTransaction,
  type RowDataPacket,
} from "@/server/db";

export interface BaseResumeRecord {
  id: number;
  userId: number;
  version: number;
  isActive: boolean;
  sourceType: "pdf" | "manual";
  sourceFileId: number | null;
  sourceFileName: string | null;
  sourceFileSize: number | null;
  rawText: string | null;
  data: ResumeData;
  extracted: ResumeData | null;
  warnings: string[];
  model: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResumeVersionSummary {
  id: number;
  version: number;
  isActive: boolean;
  sourceType: "pdf" | "manual";
  sourceFileName: string | null;
  fullName: string;
  createdAt: Date;
  jobsCount: number;
}

interface ResumeRow extends RowDataPacket {
  id: number;
  user_id: number;
  version: number;
  is_active: number;
  source_type: "pdf" | "manual";
  source_file_id: number | null;
  raw_text: string | null;
  data_json: unknown;
  extracted_json: unknown;
  extraction_warnings: unknown;
  extraction_model: string | null;
  created_at: Date;
  updated_at: Date;
  file_name: string | null;
  file_size: number | null;
}

const SELECT_RESUME = `
  SELECT r.*, f.original_name AS file_name, f.size_bytes AS file_size
    FROM base_resumes r
    LEFT JOIN stored_files f ON f.id = r.source_file_id`;

function toRecord(row: ResumeRow): BaseResumeRecord {
  const extracted = parseJsonColumn<unknown>(row.extracted_json, null);
  return {
    id: row.id,
    userId: row.user_id,
    version: row.version,
    isActive: row.is_active === 1,
    sourceType: row.source_type,
    sourceFileId: row.source_file_id,
    sourceFileName: row.file_name,
    sourceFileSize: row.file_size,
    rawText: row.raw_text,
    data: coerceResume(parseJsonColumn<unknown>(row.data_json, {})),
    extracted: extracted ? coerceResume(extracted) : null,
    warnings: parseJsonColumn<string[]>(row.extraction_warnings, []),
    model: row.extraction_model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getActiveResume(userId: number): Promise<BaseResumeRecord | null> {
  const row = await queryOne<ResumeRow>(
    `${SELECT_RESUME} WHERE r.user_id = ? AND r.is_active = 1 ORDER BY r.version DESC LIMIT 1`,
    [userId],
  );
  return row ? toRecord(row) : null;
}

export async function getResumeById(id: number, userId: number): Promise<BaseResumeRecord | null> {
  const row = await queryOne<ResumeRow>(`${SELECT_RESUME} WHERE r.id = ? AND r.user_id = ?`, [id, userId]);
  return row ? toRecord(row) : null;
}

export async function listResumeVersions(userId: number): Promise<ResumeVersionSummary[]> {
  const rows = await query<
    RowDataPacket & {
      id: number;
      version: number;
      is_active: number;
      source_type: "pdf" | "manual";
      file_name: string | null;
      data_json: unknown;
      created_at: Date;
      jobs_count: number;
    }
  >(
    `SELECT r.id, r.version, r.is_active, r.source_type, r.data_json, r.created_at,
            f.original_name AS file_name,
            (SELECT COUNT(*) FROM jobs j WHERE j.base_resume_id = r.id) AS jobs_count
       FROM base_resumes r
       LEFT JOIN stored_files f ON f.id = r.source_file_id
      WHERE r.user_id = ?
      ORDER BY r.version DESC`,
    [userId],
  );
  return rows.map((row) => ({
    id: row.id,
    version: row.version,
    isActive: row.is_active === 1,
    sourceType: row.source_type,
    sourceFileName: row.file_name,
    fullName: coerceResume(parseJsonColumn<unknown>(row.data_json, {})).personal.fullName,
    createdAt: row.created_at,
    jobsCount: Number(row.jobs_count),
  }));
}

/** Cria uma nova versão ativa. As versões anteriores ficam guardadas (inativas), nunca são apagadas. */
export async function createResumeVersion(input: {
  userId: number;
  sourceType: "pdf" | "manual";
  sourceFileId: number | null;
  rawText: string | null;
  data: ResumeData;
  extracted: ResumeData | null;
  warnings: string[];
  model: string | null;
}): Promise<number> {
  return withTransaction(async (connection) => {
    const current = await queryOne<RowDataPacket & { max_version: number | null }>(
      "SELECT MAX(version) AS max_version FROM base_resumes WHERE user_id = ? FOR UPDATE",
      [input.userId],
      connection,
    );
    const version = Number(current?.max_version ?? 0) + 1;
    await execute("UPDATE base_resumes SET is_active = 0 WHERE user_id = ?", [input.userId], connection);
    const result = await execute(
      `INSERT INTO base_resumes
         (user_id, version, is_active, source_type, source_file_id, raw_text, data_json, extracted_json, extraction_warnings, extraction_model)
       VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.userId,
        version,
        input.sourceType,
        input.sourceFileId,
        input.rawText,
        toJson(input.data),
        input.extracted ? toJson(input.extracted) : null,
        toJson(input.warnings),
        fit(input.model, 100),
      ],
      connection,
    );
    return result.insertId;
  });
}

export async function updateResumeData(id: number, userId: number, data: ResumeData): Promise<boolean> {
  const result = await execute("UPDATE base_resumes SET data_json = ? WHERE id = ? AND user_id = ?", [
    toJson(data),
    id,
    userId,
  ]);
  return result.affectedRows === 1;
}

export async function activateResumeVersion(id: number, userId: number): Promise<boolean> {
  return withTransaction(async (connection) => {
    const target = await queryOne<RowDataPacket & { id: number }>(
      "SELECT id FROM base_resumes WHERE id = ? AND user_id = ? FOR UPDATE",
      [id, userId],
      connection,
    );
    if (!target) return false;
    await execute("UPDATE base_resumes SET is_active = (id = ?) WHERE user_id = ?", [id, userId], connection);
    return true;
  });
}
