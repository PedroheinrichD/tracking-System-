"use client";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details: unknown = null,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/** fetch para as rotas /api: devolve o JSON ou lança ApiClientError com a mensagem do servidor. */
export async function apiFetch<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: init.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new ApiClientError("Sem conexão com o servidor. Verifique sua internet e tente de novo.", 0, "rede");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      // Sessão expirada: recarga completa para o login, descartando o estado do usuário anterior.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    const error = payload?.error;
    throw new ApiClientError(
      error?.message ?? `Erro ${response.status}. Tente novamente.`,
      response.status,
      error?.code ?? "erro",
      error?.details ?? null,
    );
  }
  return payload as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Algo deu errado. Tente novamente.";
}
