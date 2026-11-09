import "server-only";
import { APPLICATION_STATUSES, APPLIED_STATUSES, type ApplicationStatus } from "@/lib/constants";
import type { KeywordAssessment } from "@/lib/domain/job";
import { parseJsonColumn, query, queryOne, type RowDataPacket } from "@/server/db";

export interface DashboardStats {
  totalJobs: number;
  analyzedThisWeek: number;
  averageScore: number | null;
  averageTailoredGain: number | null;
  appliedCount: number;
  interviewCount: number;
  approvedCount: number;
  rejectedCount: number;
  byStatus: Record<ApplicationStatus, number>;
  weekly: { weekStart: string; analyzed: number; applied: number }[];
  scores: { id: number; title: string; company: string | null; score: number; status: ApplicationStatus }[];
  topGaps: { term: string; count: number }[];
  topMatched: { term: string; count: number }[];
}

/** Segunda-feira (UTC) da semana de uma data, como AAAA-MM-DD. */
function weekStart(date: Date): string {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() - (day - 1));
  return copy.toISOString().slice(0, 10);
}

export async function getDashboardStats(userId: number, now: Date): Promise<DashboardStats> {
  const jobs = await query<
    RowDataPacket & {
      id: number;
      title: string | null;
      company: string | null;
      status: ApplicationStatus;
      compatibility_score: number | null;
      tailored_score: number | null;
      match_json: unknown;
      created_at: Date;
      applied_at: Date | null;
    }
  >(
    `SELECT id, title, company, status, compatibility_score, tailored_score, match_json, created_at, applied_at
       FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1000`,
    [userId],
  );

  const byStatus = Object.fromEntries(APPLICATION_STATUSES.map((status) => [status, 0])) as Record<ApplicationStatus, number>;
  for (const job of jobs) byStatus[job.status] += 1;

  const scored = jobs.filter((job) => job.compatibility_score !== null);
  const averageScore = scored.length
    ? Math.round(scored.reduce((sum, job) => sum + Number(job.compatibility_score), 0) / scored.length)
    : null;
  const tailored = jobs.filter((job) => job.compatibility_score !== null && job.tailored_score !== null);
  const averageTailoredGain = tailored.length
    ? Math.round(
        tailored.reduce((sum, job) => sum + Number(job.tailored_score) - Number(job.compatibility_score), 0) / tailored.length,
      )
    : null;

  // Últimas 10 semanas, incluindo a atual.
  const weeks: string[] = [];
  const cursor = new Date(now);
  for (let index = 0; index < 10; index += 1) {
    weeks.unshift(weekStart(cursor));
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }
  const weekly = weeks.map((week) => ({ weekStart: week, analyzed: 0, applied: 0 }));
  const weekIndex = new Map(weeks.map((week, index) => [week, index]));
  for (const job of jobs) {
    const analyzedIndex = weekIndex.get(weekStart(job.created_at));
    if (analyzedIndex !== undefined) weekly[analyzedIndex].analyzed += 1;
    if (job.applied_at) {
      const appliedIndex = weekIndex.get(weekStart(job.applied_at));
      if (appliedIndex !== undefined) weekly[appliedIndex].applied += 1;
    }
  }

  // Lacunas e pontos fortes recorrentes, a partir das palavras-chave avaliadas em cada vaga.
  const gapCounts = new Map<string, { term: string; count: number }>();
  const matchedCounts = new Map<string, { term: string; count: number }>();
  for (const job of jobs) {
    const match = parseJsonColumn<{ keywords?: KeywordAssessment[] } | null>(job.match_json, null);
    const seen = new Set<string>();
    for (const keyword of match?.keywords ?? []) {
      if (keyword.category === "cargo" || keyword.category === "dominio") continue;
      const key = keyword.term.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const target = keyword.status === "ausente" ? gapCounts : matchedCounts;
      const entry = target.get(key) ?? { term: keyword.term.trim(), count: 0 };
      entry.count += 1;
      target.set(key, entry);
    }
  }
  const top = (map: Map<string, { term: string; count: number }>) =>
    Array.from(map.values())
      .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
      .slice(0, 8);

  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    totalJobs: jobs.length,
    analyzedThisWeek: jobs.filter((job) => job.created_at >= weekAgo).length,
    averageScore,
    averageTailoredGain,
    appliedCount: jobs.filter((job) => APPLIED_STATUSES.includes(job.status)).length,
    interviewCount: byStatus.entrevista + byStatus.aprovado,
    approvedCount: byStatus.aprovado,
    rejectedCount: byStatus.reprovado,
    byStatus,
    weekly,
    scores: scored.map((job) => ({
      id: job.id,
      title: job.title ?? "Vaga sem título",
      company: job.company,
      score: Number(job.tailored_score ?? job.compatibility_score),
      status: job.status,
    })),
    topGaps: top(gapCounts),
    topMatched: top(matchedCounts),
  };
}

export async function hasActiveResume(userId: number): Promise<boolean> {
  const row = await queryOne<RowDataPacket & { id: number }>(
    "SELECT id FROM base_resumes WHERE user_id = ? AND is_active = 1 LIMIT 1",
    [userId],
  );
  return Boolean(row);
}
