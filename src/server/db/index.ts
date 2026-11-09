import "server-only";
import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

/**
 * Pool único de conexões MySQL/MariaDB.
 * Em desenvolvimento o módulo é recarregado a cada alteração; guardar o pool em
 * globalThis evita abrir um pool novo (e esgotar conexões) a cada recarga.
 */
const globalForDb = globalThis as typeof globalThis & { __sobMedidaPool?: Pool };

const SESSION_SETUP_SQL =
  "SET SESSION time_zone = '+00:00', " +
  "SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'";

function createPool(): Pool {
  const pool = mysql.createPool({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "sob_medida_ats",
    charset: "UTF8MB4_UNICODE_CI",
    // Datas trafegam em UTC: o driver converte Date <-> DATETIME como UTC e a sessão
    // do servidor também usa UTC (CURRENT_TIMESTAMP consistente).
    timezone: "Z",
    connectionLimit: 10,
    waitForConnections: true,
    decimalNumbers: true,
  });

  // O evento entrega a conexão "callback" interna do driver, por isso o cast.
  pool.on("connection", (connection) => {
    const raw = connection as unknown as {
      query(sql: string, callback: (error: Error | null) => void): void;
    };
    raw.query(SESSION_SETUP_SQL, (error) => {
      if (error) console.error("[db] falha ao configurar a sessão:", error.message);
    });
  });

  return pool;
}

export function getPool(): Pool {
  if (!globalForDb.__sobMedidaPool) {
    globalForDb.__sobMedidaPool = createPool();
  }
  return globalForDb.__sobMedidaPool;
}

type Executor = Pool | PoolConnection;

/** SELECT que retorna várias linhas. Sempre use placeholders `?` para valores. */
export async function query<T extends RowDataPacket>(
  sql: string,
  params: unknown[] = [],
  executor: Executor = getPool(),
): Promise<T[]> {
  const [rows] = await executor.query<T[]>(sql, params);
  return rows;
}

/** SELECT que retorna no máximo uma linha. */
export async function queryOne<T extends RowDataPacket>(
  sql: string,
  params: unknown[] = [],
  executor: Executor = getPool(),
): Promise<T | null> {
  const rows = await query<T>(sql, params, executor);
  return rows[0] ?? null;
}

/** INSERT/UPDATE/DELETE. */
export async function execute(
  sql: string,
  params: unknown[] = [],
  executor: Executor = getPool(),
): Promise<ResultSetHeader> {
  const [result] = await executor.query<ResultSetHeader>(sql, params);
  return result;
}

export async function withTransaction<T>(fn: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Colunas JSON chegam como objeto no MySQL 8 e como string no MariaDB
 * (onde JSON é um alias de LONGTEXT). Esta função normaliza os dois casos.
 */
export function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  if (Buffer.isBuffer(value)) {
    try {
      return JSON.parse(value.toString("utf8")) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

export function toJson(value: unknown): string {
  return JSON.stringify(value);
}

/** Corta strings para caber em colunas VARCHAR (o modo estrito recusaria o excesso). */
export function fit(value: string | null | undefined, max: number): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export type { RowDataPacket, ResultSetHeader, PoolConnection };
