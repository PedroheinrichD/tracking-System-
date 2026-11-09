import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";

/** Erro com status HTTP e mensagem pronta para o usuário. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = "erro",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function notFound(message = "Registro não encontrado."): ApiError {
  return new ApiError(404, message, "nao_encontrado");
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { message: error.message, code: error.code, details: error.details ?? null } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          message: "Alguns dados enviados são inválidos.",
          code: "validacao",
          details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      },
      { status: 400 },
    );
  }
  console.error("[api] erro inesperado:", error);
  return NextResponse.json(
    { error: { message: "Erro interno no servidor. Tente novamente em instantes.", code: "interno", details: null } },
    { status: 500 },
  );
}

/**
 * Defesa contra CSRF (além do cookie SameSite=Lax): requisições que alteram
 * dados precisam vir do próprio site quando o navegador informa a origem.
 */
export function assertSameOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    originHost = null;
  }
  if (!originHost || originHost !== host) {
    throw new ApiError(403, "Requisição de origem não permitida.", "origem");
  }
}

export interface RouteContext<P> {
  params: Promise<P>;
}

/** Envolve um Route Handler com verificação de origem e tratamento de erros uniforme. */
export function route<P = Record<string, string>>(
  handler: (request: NextRequest, context: RouteContext<P>) => Promise<Response>,
) {
  return async (request: NextRequest, context: RouteContext<P>): Promise<Response> => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) assertSameOrigin(request);
      return await handler(request, context);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function readJson<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "O corpo da requisição precisa ser um JSON válido.", "json");
  }
  return schema.parse(body);
}

/** Lê multipart/form-data com limite de tamanho verificado antes da leitura. */
export async function readFormData(request: NextRequest, maxBytes: number): Promise<FormData> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBytes) {
    throw new ApiError(413, "Os arquivos enviados excedem o tamanho máximo permitido.", "tamanho");
  }
  try {
    return await request.formData();
  } catch {
    throw new ApiError(400, "Não foi possível ler os dados enviados. Tente enviar novamente.", "formulario");
  }
}

export function parseId(value: string | undefined): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw notFound();
  return id;
}

export function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

export function isSecureRequest(request: NextRequest): boolean {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}
