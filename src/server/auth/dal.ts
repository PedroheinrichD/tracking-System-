import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError } from "@/server/http";
import { findSessionUser, SESSION_COOKIE, type SessionUser } from "./session";

/**
 * Camada de acesso a dados autenticada (DAL). Toda leitura de dados do usuário
 * passa por aqui; o proxy faz apenas um redirecionamento otimista.
 * `cache` evita consultar a sessão mais de uma vez por requisição.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return findSessionUser(token);
});

/** Para páginas: redireciona ao login se não houver sessão válida. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Para rotas de API: responde 401 se não houver sessão válida. */
export async function requireApiUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Sua sessão expirou. Entre novamente.", "nao_autenticado");
  return user;
}

export type { SessionUser };
