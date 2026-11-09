import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { ApiError, clientIp, isSecureRequest, readJson, route } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { createUser, findUserByEmail, isRegistrationOpen } from "@/server/repositories/users";

const RegisterSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(120, "Nome muito longo."),
  email: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
    z.email("Informe um e-mail válido.").max(190),
  ),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(200),
});

export const POST = route(async (request) => {
  enforceRateLimit(`register:${clientIp(request)}`, 5, 15 * 60 * 1000, "Muitas tentativas de cadastro.");

  if (!(await isRegistrationOpen())) {
    throw new ApiError(
      403,
      "O cadastro está fechado: este ATS já tem uma conta. Para liberar novos cadastros, defina ALLOW_REGISTRATION=true.",
      "cadastro_fechado",
    );
  }

  const body = await readJson(request, RegisterSchema);
  if (await findUserByEmail(body.email)) {
    throw new ApiError(409, "Já existe uma conta com este e-mail.", "email_em_uso");
  }

  const userId = await createUser({
    name: body.name,
    email: body.email,
    passwordHash: await hashPassword(body.password),
  });
  await createSession(userId, {
    userAgent: request.headers.get("user-agent"),
    ip: clientIp(request),
    secure: isSecureRequest(request),
  });

  return NextResponse.json({ ok: true }, { status: 201 });
});
