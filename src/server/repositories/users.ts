import "server-only";
import { execute, queryOne, type RowDataPacket } from "@/server/db";

interface UserRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  password_hash: string;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  return queryOne<UserRow>("SELECT id, name, email, password_hash FROM users WHERE email = ?", [email]);
}

export async function countUsers(): Promise<number> {
  const row = await queryOne<RowDataPacket & { total: number }>("SELECT COUNT(*) AS total FROM users");
  return Number(row?.total ?? 0);
}

export async function createUser(input: { name: string; email: string; passwordHash: string }): Promise<number> {
  const result = await execute("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)", [
    input.name,
    input.email,
    input.passwordHash,
  ]);
  return result.insertId;
}

/** Cadastro aberto só quando ALLOW_REGISTRATION=true; sem isso, apenas a primeira conta pode ser criada. */
export async function isRegistrationOpen(): Promise<boolean> {
  if (process.env.ALLOW_REGISTRATION === "true") return true;
  return (await countUsers()) === 0;
}
