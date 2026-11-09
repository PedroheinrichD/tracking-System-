import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { execute, queryOne, type PoolConnection, type RowDataPacket } from "@/server/db";
import { ApiError } from "@/server/http";

export type FilePurpose = "resume_source" | "job_image" | "job_pdf" | "tailored_pdf";
export type DetectedType = "pdf" | "png" | "jpeg" | "webp";

export const MIME_BY_TYPE: Record<DetectedType, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export interface StoredFile {
  id: number;
  userId: number;
  purpose: FilePurpose;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storageKey: string;
  createdAt: Date;
}

interface StoredFileRow extends RowDataPacket {
  id: number;
  user_id: number;
  purpose: FilePurpose;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  storage_key: string;
  created_at: Date;
}

function toStoredFile(row: StoredFileRow): StoredFile {
  return {
    id: row.id,
    userId: row.user_id,
    purpose: row.purpose,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    sha256: row.sha256,
    storageKey: row.storage_key,
    createdAt: row.created_at,
  };
}

// A pasta de uploads é dado de tempo de execução: os comentários turbopackIgnore evitam que o
// build tente rastrear (e empacotar) o projeto inteiro por causa destes caminhos dinâmicos.
function storageRoot(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.STORAGE_DIR || "storage");
}

/** Resolve o caminho em disco garantindo que ele fique dentro da pasta de armazenamento. */
function resolveKey(storageKey: string): string {
  const root = storageRoot();
  const fullPath = path.resolve(/*turbopackIgnore: true*/ root, storageKey);
  if (fullPath !== root && !fullPath.startsWith(root + path.sep)) {
    throw new ApiError(400, "Caminho de arquivo inválido.", "arquivo");
  }
  return fullPath;
}

/** Identifica o tipo real do arquivo pelos primeiros bytes (a extensão e o MIME do navegador não são confiáveis). */
export function detectFileType(buffer: Buffer): DetectedType | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  // O cabeçalho %PDF- pode aparecer em qualquer ponto do primeiro KB.
  if (buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) return "pdf";
  return null;
}

export function sanitizeFileName(name: string): string {
  const base = path.basename(name || "arquivo").normalize("NFC");
  const clean = base.replace(/[\u0000-\u001f<>:"/\\|?*]+/g, "_").trim();
  return (clean || "arquivo").slice(0, 200);
}

export async function saveFile(
  input: { userId: number; purpose: FilePurpose; buffer: Buffer; type: DetectedType; originalName: string },
  executor?: PoolConnection,
): Promise<StoredFile> {
  const extension = input.type === "jpeg" ? "jpg" : input.type;
  const storageKey = `${input.userId}/${input.purpose}/${randomUUID()}.${extension}`;
  const fullPath = resolveKey(storageKey);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, input.buffer, { flag: "wx" });

  const sha256 = createHash("sha256").update(input.buffer).digest("hex");
  const originalName = sanitizeFileName(input.originalName);
  try {
    const result = await execute(
      `INSERT INTO stored_files (user_id, purpose, original_name, mime_type, size_bytes, sha256, storage_key)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [input.userId, input.purpose, originalName, MIME_BY_TYPE[input.type], input.buffer.length, sha256, storageKey],
      executor,
    );
    return {
      id: result.insertId,
      userId: input.userId,
      purpose: input.purpose,
      originalName,
      mimeType: MIME_BY_TYPE[input.type],
      sizeBytes: input.buffer.length,
      sha256,
      storageKey,
      createdAt: new Date(),
    };
  } catch (error) {
    await unlink(fullPath).catch(() => undefined);
    throw error;
  }
}

export async function getFileForUser(fileId: number, userId: number): Promise<StoredFile | null> {
  const row = await queryOne<StoredFileRow>("SELECT * FROM stored_files WHERE id = ? AND user_id = ?", [fileId, userId]);
  return row ? toStoredFile(row) : null;
}

/** Lê o arquivo do disco conferindo o hash gravado no upload. */
export async function readFileContent(file: StoredFile): Promise<Buffer> {
  let buffer: Buffer;
  try {
    buffer = await readFile(resolveKey(file.storageKey));
  } catch {
    throw new ApiError(410, "O arquivo não foi encontrado no armazenamento do servidor.", "arquivo_ausente");
  }
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  if (sha256 !== file.sha256) {
    throw new ApiError(409, "O arquivo armazenado foi alterado fora do sistema (hash diferente).", "arquivo_corrompido");
  }
  return buffer;
}

/** Remove registro e arquivo físico. Usado só para anexos de vagas e PDFs gerados, nunca para o currículo original. */
export async function deleteFile(file: StoredFile): Promise<void> {
  await execute("DELETE FROM stored_files WHERE id = ? AND user_id = ?", [file.id, file.userId]);
  await unlink(resolveKey(file.storageKey)).catch(() => undefined);
}

export function contentDisposition(type: "inline" | "attachment", fileName: string): string {
  const ascii = fileName.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
