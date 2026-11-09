import "server-only";
import { execute, fit } from "@/server/db";

export async function logAiRun(input: {
  userId: number;
  jobId: number | null;
  task: string;
  model: string;
  status: "ok" | "erro";
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number;
  errorMessage: string | null;
}): Promise<void> {
  try {
    await execute(
      `INSERT INTO ai_runs (user_id, job_id, task, model, status, input_tokens, output_tokens, duration_ms, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.userId,
        input.jobId,
        input.task,
        fit(input.model, 100),
        input.status,
        input.inputTokens,
        input.outputTokens,
        Math.round(input.durationMs),
        input.errorMessage ? input.errorMessage.slice(0, 2000) : null,
      ],
    );
  } catch (error) {
    // Falha de auditoria não deve derrubar a operação principal.
    console.error("[ai] não foi possível registrar a execução:", error);
  }
}
