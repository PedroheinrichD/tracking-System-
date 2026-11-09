import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth-cookie";
import { execute, fit, queryOne, type RowDataPacket } from "@/server/db";

export const SESSION_COOKIE = SESSION_COOKIE_NAME;

export interface SessionUser {
  id: number;
  name: string;
  email: string;
}

function ttlDays(): number {
  const value = Number(process.env.SESSION_TTL_DAYS ?? 30);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 365) : 30;
}

/** O banco guarda apenas o hash do token; quem lê o banco não consegue se passar pelo usuário. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  userId: number,
  meta: { userAgent: string | null; ip: string | null; secure: boolean },
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlDays() * 24 * 60 * 60 * 1000);

  await execute("DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP()");
  await execute("INSERT INTO sessions (id, user_id, expires_at, user_agent, ip) VALUES (?, ?, ?, ?, ?)", [
    hashToken(token),
    userId,
    expiresAt,
    fit(meta.userAgent, 255),
    fit(meta.ip, 64),
  ]);

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: meta.secure,
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await execute("DELETE FROM sessions WHERE id = ?", [hashToken(token)]);
  store.delete(SESSION_COOKIE);
}

interface SessionRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
}

export async function findSessionUser(token: string): Promise<SessionUser | null> {
  const row = await queryOne<SessionRow>(
    `SELECT u.id, u.name, u.email
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > UTC_TIMESTAMP()`,
    [hashToken(token)],
  );
  return row ? { id: row.id, name: row.name, email: row.email } : null;
}
