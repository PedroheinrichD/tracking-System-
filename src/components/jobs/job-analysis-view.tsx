import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SENIORITY_LABELS, WORK_MODEL_LABELS } from "@/lib/constants";
import type { JobAnalysis } from "@/lib/domain/job";

function Facts({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {items
        .filter((item) => item.value.trim())
        .map((item) => (
          <div key={item.label}>
            <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">{item.label}</dt>
            <dd className="mt-1 text-sm text-ink">{item.value}</dd>
          </div>
        ))}
    </dl>
  );
}

function List({ items, empty = "Não informado na vaga." }: { items: string[]; empty?: string }) {
  if (!items.length) return <p className="text-sm text-ink-3">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5 text-sm text-ink">
          <span aria-hidden className="mt-2.25 size-1 shrink-0 rounded-full bg-ink-3" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function Terms({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-sm text-ink-3">Não informado na vaga.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="rounded-md bg-surface-3 px-2 py-1 font-mono text-xs text-ink">
          {item}
        </span>
      ))}
    </div>
  );
}

export function JobAnalysisView({ analysis }: { analysis: JobAnalysis }) {
  const required = analysis.technologies.filter((technology) => technology.importance === "obrigatorio");
  const preferred = analysis.technologies.filter((technology) => technology.importance === "desejavel");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Resumo da vaga" />
        <CardBody className="space-y-6">
          {analysis.summary ? <p className="text-[15px] leading-relaxed text-ink">{analysis.summary}</p> : null}
          <Facts
            items={[
              { label: "Cargo", value: analysis.title },
              { label: "Empresa", value: analysis.company },
              { label: "Nível", value: SENIORITY_LABELS[analysis.seniority] ?? analysis.seniority },
              { label: "Modelo", value: WORK_MODEL_LABELS[analysis.workModel] ?? analysis.workModel },
              { label: "Local", value: analysis.location },
              { label: "Contratação", value: analysis.employmentType },
              { label: "Experiência exigida", value: analysis.experienceRequired },
              {
                label: "Anos mínimos",
                value: analysis.minYearsExperience !== null ? `${analysis.minYearsExperience} ano(s)` : "",
              },
              { label: "Formação exigida", value: analysis.educationRequired },
            ]}
          />
          {analysis.seniorityEvidence ? (
            <p className="text-xs text-ink-3">Por que este nível: {analysis.seniorityEvidence}</p>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Tecnologias exigidas" />
          <CardBody className="space-y-4">
            <Terms items={required.map((technology) => technology.name)} />
            {preferred.length ? (
              <div>
                <p className="mb-2 text-xs font-medium text-ink-2">Desejáveis</p>
                <Terms items={preferred.map((technology) => technology.name)} />
              </div>
            ) : null}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Competências técnicas" />
          <CardBody>
            <Terms items={analysis.technicalSkills} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Competências comportamentais" />
          <CardBody>
            <List items={analysis.softSkills} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Diferenciais" />
          <CardBody>
            <List items={analysis.differentials} empty="A vaga não lista diferenciais." />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Responsabilidades" />
          <CardBody>
            <List items={analysis.responsibilities} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Idiomas" />
          <CardBody>
            <List items={analysis.languagesRequired} empty="A vaga não exige idiomas." />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Palavras-chave para ATS"
          description="Como aparecem na vaga, com as variações aceitas como equivalentes."
        />
        <CardBody>
          <ul className="divide-y divide-line">
            {analysis.atsKeywords.map((keyword) => (
              <li key={keyword.term} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                <span className="font-mono text-sm font-medium text-ink">{keyword.term}</span>
                <Badge tone={keyword.priority === "alta" ? "tape" : "neutral"}>prioridade {keyword.priority}</Badge>
                {keyword.variants.length ? (
                  <span className="font-mono text-xs text-ink-3">≈ {keyword.variants.join(", ")}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
