import { ArrowRight, Ban, Lightbulb, ShieldCheck, ShieldAlert, Wrench } from "lucide-react";
import { AddedKeywordChip } from "@/components/ats/keyword-chip";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { UI_SECTION_LABELS } from "@/lib/domain/labels";
import type { TailoringReport } from "@/lib/domain/tailoring";
import { cn } from "@/lib/utils";

function Block({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <p className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.1em] text-ink-3">
        {title}
        {count !== undefined ? <span className="font-mono normal-case tracking-normal">{count}</span> : null}
      </p>
      {children}
    </div>
  );
}

/** Relatório da personalização: o que entrou, o que ficou de fora e por quê. */
export function ReportPanel({ report }: { report: TailoringReport }) {
  const { reorganization } = report;
  const highWarnings = report.warnings.filter((warning) => warning.severity === "alta");
  const sectionOrderChanged = reorganization.sectionOrderBefore.join() !== reorganization.sectionOrderAfter.join();

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              {report.verification.status === "concluida" && !highWarnings.length ? (
                <ShieldCheck className="size-4 text-success" aria-hidden />
              ) : (
                <ShieldAlert className="size-4 text-warning" aria-hidden />
              )}
              Fidelidade ao original
            </span>
          }
          description={
            report.verification.status === "concluida"
              ? report.verification.summary || "Revisado por um verificador independente."
              : "A verificação independente ainda não foi concluída."
          }
        />
        <CardBody className="space-y-4">
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-surface-2 p-2.5">
              <dt className="text-[11px] text-ink-3">Correções</dt>
              <dd className="font-mono text-lg font-semibold text-ink">{report.autoFixes.length}</dd>
            </div>
            <div className="rounded-lg bg-surface-2 p-2.5">
              <dt className="text-[11px] text-ink-3">Bloqueios</dt>
              <dd className="font-mono text-lg font-semibold text-ink">{report.blocked.length}</dd>
            </div>
            <div className={cn("rounded-lg p-2.5", report.warnings.length ? "bg-warning-soft" : "bg-surface-2")}>
              <dt className="text-[11px] text-ink-3">Alertas</dt>
              <dd className="font-mono text-lg font-semibold text-ink">{report.warnings.length}</dd>
            </div>
          </dl>

          {report.warnings.length ? (
            <Block title="Alertas para revisar" count={report.warnings.length}>
              <ul className="space-y-2.5">
                {report.warnings.map((warning, index) => (
                  <li key={index} className="text-sm">
                    <p className="text-xs font-medium text-ink-2">{warning.label}</p>
                    <p className="text-ink">
                      <Badge tone={warning.severity === "alta" ? "danger" : "warning"} className="mr-1.5 align-middle">
                        {warning.severity}
                      </Badge>
                      {warning.message}
                    </p>
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}

          {report.autoFixes.length ? (
            <Block title="Corrigido automaticamente" count={report.autoFixes.length}>
              <ul className="space-y-3">
                {report.autoFixes.map((fix, index) => (
                  <li key={index} className="space-y-1 text-sm">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
                      <Wrench className="size-3.5" aria-hidden /> {fix.label}
                    </p>
                    <p className="text-ink-3 line-through decoration-danger/50">{fix.before}</p>
                    {fix.after ? <p className="text-ink">{fix.after}</p> : <p className="text-xs italic text-ink-3">(removido)</p>}
                    <p className="text-xs text-ink-3">{fix.reason}</p>
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}

          {report.blocked.length ? (
            <Block title="Bloqueado pelas regras" count={report.blocked.length}>
              <ul className="space-y-1.5">
                {report.blocked.map((item, index) => (
                  <li key={index} className="flex gap-2 text-sm">
                    <Ban className="mt-0.5 size-3.5 shrink-0 text-danger" aria-hidden />
                    <span>
                      <span className="font-mono text-ink">{item.value}</span>{" "}
                      <span className="text-ink-3">
                        em {item.location}: {item.reason}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Palavras-chave" />
        <CardBody className="space-y-4">
          <div>
            <div className="flex items-baseline gap-2 font-mono text-sm">
              <span className="text-ink">{report.keywordCoverage.before}%</span>
              <ArrowRight className="size-3.5 self-center text-ink-3" aria-hidden />
              <span className="font-semibold text-ink">{report.keywordCoverage.after}%</span>
              <span className="text-xs text-ink-3">de {report.keywordCoverage.total} termos</span>
            </div>
            <p className="mt-1 text-xs text-ink-3">
              Palavras-chave da vaga escritas exatamente como no anúncio — o que um ATS de busca literal encontra.
            </p>
          </div>
          <Block title="Adicionadas ao texto" count={report.keywordsAdded.length}>
            {report.keywordsAdded.length ? (
              <div className="flex flex-wrap gap-1.5">
                {report.keywordsAdded.map((term) => (
                  <AddedKeywordChip key={term} term={term} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-3">Nenhum termo novo: o original já usava a terminologia da vaga.</p>
            )}
            <p className="text-xs text-ink-3">
              Só entram termos que descrevem algo que já está no seu currículo (ex.: “JS” → “JavaScript”).
            </p>
          </Block>
          <Block title="Não adicionadas (você não tem no currículo)" count={report.missingSkills.length}>
            {report.missingSkills.length ? (
              <ul className="space-y-2">
                {report.missingSkills.map((item, index) => (
                  <li key={index} className="text-sm">
                    <span className="chalk-border mr-1.5 inline-block rounded-md px-1.5 py-0.5 font-mono text-xs text-ink">
                      {item.skill}
                    </span>
                    <Badge tone={item.importance === "obrigatorio" ? "warning" : "neutral"}>
                      {item.importance === "obrigatorio" ? "obrigatório" : "desejável"}
                    </Badge>
                    {item.note ? <p className="mt-1 text-xs text-ink-2">{item.note}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-3">Nenhuma lacuna importante.</p>
            )}
          </Block>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Informações reorganizadas" />
        <CardBody className="space-y-4">
          {sectionOrderChanged ? (
            <Block title="Ordem das seções">
              <ol className="space-y-1 text-sm">
                {reorganization.sectionOrderAfter.map((section, index) => {
                  const before = reorganization.sectionOrderBefore.indexOf(section);
                  return (
                    <li key={section} className="flex items-center gap-2">
                      <span className="w-4 font-mono text-xs text-ink-3">{index + 1}</span>
                      <span className="text-ink">{UI_SECTION_LABELS[section]}</span>
                      {before !== -1 && before !== index ? (
                        <span className="font-mono text-[11px] text-ink-3">era {before + 1}º</span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </Block>
          ) : (
            <p className="text-sm text-ink-3">A ordem das seções foi mantida.</p>
          )}
          {reorganization.skillsPromoted.length ? (
            <Block title="Competências em destaque">
              <p className="text-sm text-ink">{reorganization.skillsPromoted.join(", ")}</p>
            </Block>
          ) : null}
          {reorganization.moved.length ? (
            <Block title="Itens reordenados" count={reorganization.moved.length}>
              <ul className="space-y-1 text-sm text-ink">
                {reorganization.moved.map((item, index) => (
                  <li key={index}>
                    {item.label}{" "}
                    <span className="font-mono text-xs text-ink-3">
                      {item.from}º → {item.to}º
                    </span>
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}
          {reorganization.omitted.length ? (
            <Block title="Omitidos nesta versão" count={reorganization.omitted.length}>
              <p className="text-sm text-ink-2">{reorganization.omitted.map((item) => item.label).join(", ")}</p>
              <p className="text-xs text-ink-3">Continuam no seu currículo original; você pode recolocá-los na aba Editar.</p>
            </Block>
          ) : null}
        </CardBody>
      </Card>

      {report.suggestions.length || report.changes.length ? (
        <Card>
          <CardHeader title="Sugestões de melhoria" description="Ajustes que só você pode fazer, com informações verdadeiras." />
          <CardBody className="space-y-4">
            <ul className="space-y-2.5">
              {report.suggestions.map((suggestion, index) => (
                <li key={index} className="flex gap-2.5 text-sm text-ink">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-tape-edge" aria-hidden />
                  {suggestion}
                </li>
              ))}
            </ul>
            {report.changes.length ? (
              <Block title="Principais alterações feitas pela IA" count={report.changes.length}>
                <ul className="space-y-1.5 text-sm text-ink-2">
                  {report.changes.map((change, index) => (
                    <li key={index}>
                      <span className="font-medium text-ink">{UI_SECTION_LABELS[change.section]}:</span> {change.description}
                    </li>
                  ))}
                </ul>
              </Block>
            ) : null}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
