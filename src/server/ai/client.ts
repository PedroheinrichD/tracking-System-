import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaContentBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { z } from "zod";
import { ApiError } from "@/server/http";
import { logAiRun } from "@/server/repositories/ai-runs";

export const DEFAULT_MODEL = "claude-opus-5-5";

/**
 * Modelos que aceitam `fallbacks: "default"`: se o classificador de segurança
 * recusar a requisição, a API refaz a chamada em um modelo alternativo.
 */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export type AiTask =
  | "extracao_curriculo"
  | "transcricao_vaga"
  | "analise_vaga"
  | "compatibilidade"
  | "personalizacao"
  | "verificacao";

export type AiEffort = "low" | "medium" | "high" | "xhigh" | "max";

/** Erro de IA com mensagem pronta para o usuário. */
export class AiError extends ApiError {
  constructor(status: number, message: string, code = "ia") {
    super(status, message, code);
    this.name = "AiError";
  }
}

const globalForAi = globalThis as typeof globalThis & { __sobMedidaAnthropic?: Anthropic };

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new AiError(
      503,
      "A IA não está configurada: defina ANTHROPIC_API_KEY no arquivo .env.local e reinicie o servidor.",
      "ia_nao_configurada",
    );
  }
  globalForAi.__sobMedidaAnthropic ??= new Anthropic({ maxRetries: 2, timeout: 10 * 60 * 1000 });
  return globalForAi.__sobMedidaAnthropic;
}

export function getModel(): string {
  return process.env.AI_MODEL?.trim() || DEFAULT_MODEL;
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/** Converte erros do SDK em mensagens claras, do mais específico para o mais genérico. */
function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof Anthropic.AuthenticationError) {
    return new AiError(503, "A chave da API de IA foi recusada. Confira ANTHROPIC_API_KEY.", "ia_autenticacao");
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return new AiError(503, "A chave da API não tem permissão para usar o modelo configurado (AI_MODEL).", "ia_permissao");
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new AiError(503, `O modelo "${getModel()}" não foi encontrado. Confira AI_MODEL.`, "ia_modelo");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AiError(429, "Limite de uso da API de IA atingido. Aguarde um minuto e tente novamente.", "ia_limite");
  }
  if (error instanceof Anthropic.ContentTooLargeError) {
    return new AiError(413, "O conteúdo enviado é grande demais para a IA. Envie menos arquivos ou arquivos menores.", "ia_tamanho");
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new AiError(502, `A IA recusou a requisição: ${error.message}`, "ia_requisicao");
  }
  if (error instanceof Anthropic.InternalServerError) {
    return new AiError(503, "O serviço de IA está instável ou sobrecarregado. Tente novamente em instantes.", "ia_indisponivel");
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new AiError(504, "A IA demorou demais para responder. Tente novamente.", "ia_timeout");
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AiError(503, "Não foi possível conectar ao serviço de IA. Verifique a conexão com a internet.", "ia_conexao");
  }
  if (error instanceof Anthropic.APIError) {
    return new AiError(502, `Erro no serviço de IA (${error.status ?? "sem status"}).`, "ia_erro");
  }
  console.error("[ai] erro ao processar resposta:", error);
  return new AiError(502, "A IA retornou uma resposta em formato inesperado. Tente novamente.", "ia_formato");
}

export interface StructuredRequest<S extends z.ZodType> {
  task: AiTask;
  userId: number;
  jobId?: number | null;
  schema: S;
  system: string;
  content: BetaContentBlockParam[];
  effort: AiEffort;
  maxTokens: number;
}

/**
 * Chamada única ao Claude com saída estruturada (JSON validado pelo schema Zod).
 * Usa streaming para não esbarrar em timeouts de respostas longas, registra
 * tokens/tempo em ai_runs e trata recusa, truncamento e formato inválido.
 */
export async function generateStructured<S extends z.ZodType>(request: StructuredRequest<S>): Promise<z.infer<S>> {
  const model = getModel();
  const startedAt = performance.now();
  let usage: { input: number; output: number } | null = null;

  try {
    const client = getClient();
    const useFallbacks = FALLBACK_MODELS.has(model);
    const stream = client.beta.messages.stream({
      model,
      max_tokens: request.maxTokens,
      ...(useFallbacks ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
      thinking: { type: "adaptive" },
      output_config: { effort: request.effort, format: betaZodOutputFormat(request.schema) },
      system: request.system,
      messages: [{ role: "user", content: request.content }],
    });
    const message = await stream.finalMessage();
    usage = {
      input:
        message.usage.input_tokens +
        (message.usage.cache_creation_input_tokens ?? 0) +
        (message.usage.cache_read_input_tokens ?? 0),
      output: message.usage.output_tokens,
    };

    if (message.stop_reason === "refusal") {
      throw new AiError(
        422,
        "A IA se recusou a processar este conteúdo. Revise o texto enviado e tente novamente.",
        "ia_recusa",
      );
    }
    if (message.stop_reason === "max_tokens") {
      throw new AiError(502, "A resposta da IA ficou longa demais e foi interrompida. Tente novamente.", "ia_truncada");
    }
    const parsed = message.parsed_output as z.infer<S> | null | undefined;
    if (parsed === null || parsed === undefined) {
      throw new AiError(502, "A IA não retornou dados no formato esperado. Tente novamente.", "ia_formato");
    }

    await logAiRun({
      userId: request.userId,
      jobId: request.jobId ?? null,
      task: request.task,
      model: message.model ?? model,
      status: "ok",
      inputTokens: usage.input,
      outputTokens: usage.output,
      durationMs: performance.now() - startedAt,
      errorMessage: null,
    });
    return parsed;
  } catch (error) {
    const aiError = toAiError(error);
    await logAiRun({
      userId: request.userId,
      jobId: request.jobId ?? null,
      task: request.task,
      model,
      status: "erro",
      inputTokens: usage?.input ?? null,
      outputTokens: usage?.output ?? null,
      durationMs: performance.now() - startedAt,
      errorMessage: `${aiError.code}: ${aiError.message}`,
    });
    throw aiError;
  }
}
