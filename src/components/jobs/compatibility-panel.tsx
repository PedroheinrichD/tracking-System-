import { CheckCircle2, CircleDot, CircleSlash, Quote, ShieldAlert } from "lucide-react";
import { KeywordChip } from "@/components/ats/keyword-chip";
import { scoreLabel, TapeMeasure } from "@/components/ats/tape-measure";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import type {
  JobAnalysis,
  JobRequirement,
  KeywordAssessment,
  MatchResult,
  RequirementAssessment,
  RequirementStatus,
  ScoreBreakdown,
} from "@/lib/domain/job";
import { cn } from "@/lib/utils";

const PRIORITY_ORDER = { alta: 0, media: 1, baixa: 2 } as const;
const CATEGORY_LABEL: Record<string, string> = {
  tecnico: "técnico",
  comportamental: "comportamental",
  experiencia: "experiência",
  formacao: "formação",
  idioma: "idioma",
  certificacao: "certificação",
  outro: "outro",
};
const EVIDENCE_LABEL: Record<string, string> = {
  profissional: "experiência profissional",
  projeto: "projeto",
  formacao: "formação",
  curso: "curso/estudo",
  declarado: "apenas listado",
  nenhuma: "sem evidência",
};

function sortKeywords(keywords: KeywordAssessment[]) {
  return [...keywords].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

function fmt(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function ScoreBreakdownView({ score }: { score: ScoreBreakdown }) {
  const { requirements, keywords, weights } = score;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {requirements ? (
        <div className="rounded-lg border border-line bg-surface-2 p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-ink">Requisitos</p>
            <p className="font-mono text-xs text-ink-3">peso {Math.round(weights.requirements * 100)}%</p>
          </div>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">{requirements.score}%</p>
          <p className="mt-1 font-mono text-[11px] text-ink-3">
            {fmt(requirements.points)} de {requirements.maxPoints} pontos
          </p>
          <ul className="mt-3 space-y-1 text-xs text-ink-2">
            <li>
              Obrigatórios: <b className="font-medium text-ink">{requirements.mandatory.met}</b> de {requirements.mandatory.total}{" "}
              atendidos{requirements.mandatory.partial ? `, ${requirements.mandatory.partial} parcial(is)` : ""}
            </li>
            <li>
              Desejáveis: <b className="font-medium text-ink">{requirements.preferred.met}</b> de {requirements.preferred.total}{" "}
              atendidos{requirements.preferred.partial ? `, ${requirements.preferred.partial} parcial(is)` : ""}
            </li>
          </ul>
        </div>
      ) : null}
      {keywords ? (
        <div className="rounded-lg border border-line bg-surface-2 p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-ink">Palavras-chave</p>
            <p className="font-mono text-xs text-ink-3">peso {Math.round(weights.keywords * 100)}%</p>
          </div>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">{keywords.score}%</p>
          <p className="mt-1 font-mono text-[11px] text-ink-3">
            {fmt(keywords.points)} de {keywords.maxPoints} pontos
          </p>
          <ul className="mt-3 space-y-1 text-xs text-ink-2">
            <li>
              <b className="font-medium text-ink">{keywords.present}</b> presentes,{" "}
              <b className="font-medium text-ink">{keywords.equivalent}</b> equivalentes
            </li>
            <li>
              <b className="font-medium text-ink">{keywords.missing}</b> ausentes de {keywords.total}
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const STATUS_GROUPS: { status: RequirementStatus; title: string; icon: typeof CheckCircle2; tone: string }[] = [
  { status: "atendido", title: "Atendidos", icon: CheckCircle2, tone: "text-success" },
  { status: "parcial", title: "Parcialmente atendidos", icon: CircleDot, tone: "text-warning" },
  { status: "nao_atendido", title: "Não atendidos", icon: CircleSlash, tone: "text-danger" },
];

function RequirementRow({ requirement, assessment }: { requirement: JobRequirement; assessment: RequirementAssessment }) {
  return (
    <li className="space-y-2 py-3.5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
        <p className="min-w-0 flex-1 text-sm font-medium text-ink">{requirement.description}</p>
        <div className="flex shrink-0 gap-1.5">
          <Badge tone={requirement.importance === "obrigatorio" ? "neutral" : "primary"}>
            {requirement.importance === "obrigatorio" ? "Obrigatório" : "Desejável"}
          </Badge>
          <Badge>{CATEGORY_LABEL[requirement.category] ?? requirement.category}</Badge>
        </div>
      </div>
      {assessment.explanation ? <p className="text-sm text-ink-2">{assessment.explanation}</p> : null}
      {assessment.evidence.length ? (
        <ul className="space-y-1.5">
          {assessment.evidence.map((evidence, index) => (
            <li key={index} className="flex gap-2 text-xs">
              <Quote className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="font-mono text-ink-2">“{evidence.quote}”</span>{" "}
                <span className={evidence.verified ? "text-success" : "text-warning"}>
                  {evidence.verified ? "· conferido no currículo" : "· não localizado literalmente"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-3">
        <span>Evidência: {EVIDENCE_LABEL[assessment.evidenceType] ?? assessment.evidenceType}</span>
        {assessment.adjustment ? <span className="text-warning">{assessment.adjustment}</span> : null}
      </div>
    </li>
  );
}

export function CompatibilityPanel({
  analysis,
  match,
  score,
  tailoredScore,
}: {
  analysis: JobAnalysis;
  match: MatchResult;
  score: ScoreBreakdown;
  tailoredScore: number | null;
}) {
  const main = tailoredScore ?? score.total;
  const found = sortKeywords(match.keywords.filter((keyword) => keyword.status !== "ausente"));
  const missing = sortKeywords(match.keywords.filter((keyword) => keyword.status === "ausente"));
  const assessments = new Map(match.requirements.map((assessment) => [assessment.requirementId, assessment]));
  const formula =
    score.requirements && score.keywords
      ? `${score.weights.requirements.toLocaleString("pt-BR")} × ${score.requirements.score} + ${score.weights.keywords.toLocaleString("pt-BR")} × ${score.keywords.score} = ${score.total}`
      : null;

  return (
    <div className="space-y-6">
      {analysis.suspiciousContent.length ? (
        <Notice tone="warning" title="A vaga contém instruções dirigidas a sistemas de IA">
          Esses trechos foram tratados apenas como texto e ignorados na análise:
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            {analysis.suspiciousContent.map((item, index) => (
              <li key={index} className="font-mono text-xs">
                {item}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <Card>
        <CardHeader
          title="Compatibilidade estimada"
          description={
            tailoredScore !== null
              ? "Medida no currículo personalizado; o marcador inferior mostra o original."
              : "Medida no seu currículo original."
          }
          actions={
            <span className="rounded-md border border-line px-2.5 py-1 text-sm font-medium text-ink">{scoreLabel(main)}</span>
          }
        />
        <CardBody className="space-y-6">
          <TapeMeasure value={main} before={tailoredScore !== null ? score.total : null} />
          {match.overview ? <p className="text-[15px] leading-relaxed text-ink">{match.overview}</p> : null}
          <details className="group rounded-lg border border-line">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-ink">
              Como esta nota é calculada
              <span className="font-mono text-xs text-ink-3 group-open:hidden">mostrar</span>
              <span className="hidden font-mono text-xs text-ink-3 group-open:inline">ocultar</span>
            </summary>
            <div className="space-y-4 border-t border-line p-4">
              <ScoreBreakdownView score={score} />
              {formula ? <p className="font-mono text-xs text-ink-2">Original: {formula}</p> : null}
              <p className="text-xs leading-relaxed text-ink-3">
                Requisito obrigatório vale 3 pontos e desejável vale 1; atendido conta 100%, parcial 50%. Palavra-chave de
                prioridade alta vale 3, média 2 e baixa 1; presente conta 100%, equivalente 75%. No currículo personalizado
                só a cobertura de palavras-chave muda — os requisitos dependem dos fatos, que são os mesmos.
              </p>
              <p className="text-xs leading-relaxed text-ink-3">
                Esta é uma estimativa deste sistema, baseada nos requisitos identificados na vaga. Não é a pontuação oficial
                de nenhuma plataforma ATS.
              </p>
            </div>
          </details>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Palavras-chave da vaga" description="Termos que um ATS tende a procurar, em ordem de prioridade." />
        <CardBody className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-medium text-ink-2">Encontradas no currículo · {found.length}</p>
            <div className="flex flex-wrap gap-1.5">
              {found.length ? found.map((keyword) => <KeywordChip key={keyword.term} keyword={keyword} />) : <span className="text-sm text-ink-3">Nenhuma.</span>}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-ink-2">Ausentes · {missing.length}</p>
            <div className="flex flex-wrap gap-1.5">
              {missing.length ? missing.map((keyword) => <KeywordChip key={keyword.term} keyword={keyword} />) : <span className="text-sm text-ink-3">Nenhuma ausente.</span>}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="space-y-6">
        {STATUS_GROUPS.map(({ status, title, icon: Icon, tone }) => {
          const items = analysis.requirements.filter((requirement) => assessments.get(requirement.id)?.status === status);
          return (
            <Card key={status}>
              <CardHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    <Icon className={cn("size-4", tone)} aria-hidden />
                    {title}
                    <span className="font-mono text-xs font-normal text-ink-3">{items.length}</span>
                  </span>
                }
              />
              <CardBody>
                {items.length ? (
                  <ul className="divide-y divide-line">
                    {items.map((requirement) => (
                      <RequirementRow
                        key={requirement.id}
                        requirement={requirement}
                        assessment={assessments.get(requirement.id)!}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-3">Nenhum requisito nesta situação.</p>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Pontos fortes" />
          <CardBody>
            <ul className="space-y-2.5">
              {match.strengths.map((item, index) => (
                <li key={index} className="flex gap-2.5 text-sm text-ink">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Pontos que podem melhorar" />
          <CardBody>
            <ul className="space-y-3">
              {match.improvements.map((item, index) => (
                <li key={index} className="text-sm text-ink">
                  <Badge tone={item.kind === "lacuna" ? "warning" : "primary"} className="mb-1">
                    {item.kind === "lacuna" ? "Lacuna real" : "Ajuste de redação"}
                  </Badge>
                  <p>{item.text}</p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      {match.seniorityFit.explanation ? (
        <Notice tone={match.seniorityFit.assessment === "compativel" ? "success" : "info"} title="Nível da vaga × sua trajetória">
          {match.seniorityFit.explanation}
        </Notice>
      ) : null}

      <p className="flex items-center gap-2 text-xs text-ink-3">
        <ShieldAlert className="size-3.5" aria-hidden />
        Evidências “conferidas” foram encontradas literalmente no seu currículo pelo sistema, não apenas afirmadas pela IA.
      </p>
    </div>
  );
}
