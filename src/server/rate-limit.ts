import "server-only";
import { ApiError } from "./http";

/**
 * Limitador simples em memória (janela deslizante). Suficiente para uma
 * instância única; em um deploy com várias instâncias, troque por Redis.
 */
const globalForLimits = globalThis as typeof globalThis & { __sobMedidaLimits?: Map<string, number[]> };
const buckets = (globalForLimits.__sobMedidaLimits ??= new Map<string, number[]>());

export function hitRateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000)) };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { ok: true, retryAfterSeconds: 0 };
}

export function enforceRateLimit(key: string, limit: number, windowMs: number, message: string): void {
  const result = hitRateLimit(key, limit, windowMs);
  if (!result.ok) {
    throw new ApiError(429, `${message} Tente novamente em ${result.retryAfterSeconds} s.`, "limite");
  }
}

/** Limite de chamadas de IA por usuário: protege contra cliques repetidos e custos inesperados. */
export function enforceAiRateLimit(userId: number): void {
  enforceRateLimit(`ai:${userId}`, 40, 60 * 60 * 1000, "Limite de análises por hora atingido.");
}
