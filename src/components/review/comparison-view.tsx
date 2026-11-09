import { HighlightedText } from "@/components/resume/highlighted-text";
import { containsTerm, normalizeForMatch, sameTerm } from "@/lib/ats/normalize";
import { UI_SECTION_LABELS, UI_SKILL_LABELS } from "@/lib/domain/labels";
import {
  DEFAULT_SECTION_ORDER,
  SKILL_CATEGORIES,
  sectionHasContent,
  type ResumeData,
  type SectionKey,
  type TailoredResume,
} from "@/lib/domain/resume";
import { cn } from "@/lib/utils";
import { DiffText } from "./diff-text";

function Column({ label, children, muted }: { label: string; children: React.ReactNode; muted?: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-lg border border-line p-4", muted ? "bg-surface-2" : "bg-surface")}>
      <p className="mb-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-3">{label}</p>
      <div className="space-y-3 text-sm leading-relaxed text-ink">{children}</div>
    </div>
  );
}

function Empty() {
  return <p className="text-ink-3">—</p>;
}

function Bullets({ items, terms }: { items: string[]; terms?: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2">
          <span aria-hidden className="mt-2.25 size-1 shrink-0 rounded-full bg-ink-3" />
          <span>{terms ? <HighlightedText text={item} terms={terms} /> : item}</span>
        </li>
      ))}
    </ul>
  );
}

/** O termo aparece do outro lado, igual, como sinônimo ou dentro de um termo composto ("Metodologias ágeis (Scrum)")? */
function presentIn(item: string, others: string[]): boolean {
  return others.some(
    (value) =>
      sameTerm(value, item) ||
      sameTerm(item, value) ||
      containsTerm(normalizeForMatch(value), item) ||
      containsTerm(normalizeForMatch(item), value),
  );
}

function TagRow({ items, other, side }: { items: string[]; other: string[]; side: "before" | "after" }) {
  if (!items.length) return <Empty />;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const inOther = presentIn(item, other);
        return (
          <span
            key={item}
            className={cn(
              "rounded-md px-1.5 py-0.5 font-mono text-[11.5px]",
              inOther && "bg-surface-3 text-ink-2",
              !inOther && side === "after" && "bg-tape-soft text-tape-soft-ink",
              !inOther && side === "before" && "text-ink-3 line-through decoration-danger/50",
            )}
          >
            {item}
          </span>
        );
      })}
    </div>
  );
}

function SectionCompare({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

/**
 * Original × personalizado, seção por seção. No lado personalizado, textos
 * reescritos mostram a diferença palavra a palavra e as palavras-chave da vaga
 * aparecem em marca-texto.
 */
export function ComparisonView({
  original,
  tailored,
  keywordTerms,
}: {
  original: ResumeData;
  tailored: TailoredResume;
  keywordTerms: string[];
}) {
  const order: SectionKey[] = [
    ...tailored.sectionOrder.filter((section) => sectionHasContent(tailored, section)),
    ...DEFAULT_SECTION_ORDER.filter(
      (section) => !tailored.sectionOrder.includes(section) && sectionHasContent(original, section),
    ),
  ];

  return (
    <div className="space-y-7">
      <SectionCompare title="Título profissional">
        <Column label="Original" muted>
          {original.personal.headline ? <p>{original.personal.headline}</p> : <Empty />}
        </Column>
        <Column label="Personalizado">
          {tailored.personal.headline ? (
            <p>
              <DiffText before={original.personal.headline} after={tailored.personal.headline} />
            </p>
          ) : (
            <Empty />
          )}
        </Column>
      </SectionCompare>

      {order.map((section) => {
        switch (section) {
          case "summary":
            return (
              <SectionCompare key={section} title={UI_SECTION_LABELS.summary}>
                <Column label="Original" muted>
                  {original.summary ? <p>{original.summary}</p> : <Empty />}
                </Column>
                <Column label="Personalizado">
                  {tailored.summary ? (
                    <p>
                      <DiffText before={original.summary} after={tailored.summary} />
                    </p>
                  ) : (
                    <Empty />
                  )}
                </Column>
              </SectionCompare>
            );
          case "skills":
            return (
              <SectionCompare key={section} title={UI_SECTION_LABELS.skills}>
                <Column label="Original" muted>
                  {SKILL_CATEGORIES.filter((category) => original.skills[category].length).map((category) => (
                    <div key={category}>
                      <p className="mb-1 text-xs text-ink-3">{UI_SKILL_LABELS[category]}</p>
                      <TagRow
                        items={original.skills[category]}
                        other={SKILL_CATEGORIES.flatMap((key) => tailored.skills[key])}
                        side="before"
                      />
                    </div>
                  ))}
                </Column>
                <Column label="Personalizado">
                  {SKILL_CATEGORIES.filter((category) => tailored.skills[category].length).map((category) => (
                    <div key={category}>
                      <p className="mb-1 text-xs text-ink-3">{UI_SKILL_LABELS[category]}</p>
                      <TagRow
                        items={tailored.skills[category]}
                        other={SKILL_CATEGORIES.flatMap((key) => original.skills[key])}
                        side="after"
                      />
                    </div>
                  ))}
                </Column>
              </SectionCompare>
            );
          case "experience":
            return (
              <div key={section} className="space-y-4">
                <h3 className="text-sm font-semibold text-ink">{UI_SECTION_LABELS.experience}</h3>
                {tailored.experiences.map((experience) => {
                  const source = original.experiences.find((item) => item.id === experience.id);
                  return (
                    <div key={experience.id} className="space-y-2">
                      <p className="text-[13px] font-medium text-ink-2">
                        {experience.role} — {experience.company}
                      </p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Column label="Original" muted>
                          {source?.description ? <p>{source.description}</p> : null}
                          <Bullets items={source?.highlights ?? []} />
                          {!source?.description && !source?.highlights.length ? <Empty /> : null}
                        </Column>
                        <Column label="Personalizado">
                          {experience.description ? (
                            <p>
                              <DiffText before={source?.description ?? ""} after={experience.description} />
                            </p>
                          ) : null}
                          <Bullets items={experience.highlights} terms={keywordTerms} />
                          {experience.technologies.length ? (
                            <TagRow items={experience.technologies} other={source?.technologies ?? []} side="after" />
                          ) : null}
                        </Column>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          case "projects":
            return (
              <div key={section} className="space-y-4">
                <h3 className="text-sm font-semibold text-ink">{UI_SECTION_LABELS.projects}</h3>
                {tailored.projects.map((project) => {
                  const source = original.projects.find((item) => item.id === project.id);
                  return (
                    <div key={project.id} className="space-y-2">
                      <p className="text-[13px] font-medium text-ink-2">{project.name}</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Column label="Original" muted>
                          {source?.description ? <p>{source.description}</p> : null}
                          <Bullets items={source?.highlights ?? []} />
                        </Column>
                        <Column label="Personalizado">
                          {project.description ? (
                            <p>
                              <DiffText before={source?.description ?? ""} after={project.description} />
                            </p>
                          ) : null}
                          <Bullets items={project.highlights} terms={keywordTerms} />
                        </Column>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          case "certifications":
            return (
              <SectionCompare key={section} title={UI_SECTION_LABELS.certifications}>
                <Column label="Original" muted>
                  <Bullets items={original.certifications.map((item) => item.name)} />
                </Column>
                <Column label="Personalizado">
                  <Bullets items={tailored.certifications.map((item) => item.name)} />
                </Column>
              </SectionCompare>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
