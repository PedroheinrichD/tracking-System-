import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { ApiError, clientIp, isSecureRequest, readJson, route } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { findUserByEmail } from "@/server/repositories/users";

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Informe seu e-mail.").max(190),
  password: z.string().min(1, "Informe sua senha.").max(200),
});

// Hash usado quando o e-mail não existe, para que a resposta leve o mesmo tempo.
let dummyHash: Promise<string> | null = null;

export const POST = route(async (request) => {
  const body = await readJson(request, LoginSchema);
  enforceRateLimit(
    `login:${clientIp(request)}:${body.email}`,
    8,
    15 * 60 * 1000,
    "Muitas tentativas de login.",
  );

  const user = await findUserByEmail(body.email);
  dummyHash ??= hashPassword("senha-inexistente");
  const valid = await verifyPassword(body.password, user?.password_hash ?? (await dummyHash));
  if (!user || !valid) {
    throw new ApiError(401, "E-mail ou senha incorretos.", "credenciais");
  }

  await createSession(user.id, {
    userAgent: request.headers.get("user-agent"),
    ip: clientIp(request),
    secure: isSecureRequest(request),
  });
  return NextResponse.json({ ok: true });
});
