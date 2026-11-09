import { UI_SECTION_LABELS, UI_SKILL_LABELS } from "@/lib/domain/labels";
import {
  DEFAULT_SECTION_ORDER,
  SKILL_CATEGORIES,
  sectionHasContent,
  type ResumeData,
  type SectionKey,
} from "@/lib/domain/resume";
import { cn } from "@/lib/utils";
import { HighlightedText } from "./highlighted-text";

function period(start: string, end: string, current: boolean) {
  const finish = current ? "atual" : end;
  if (start && finish) return `${start} – ${finish}`;
  return start || finish;
}

function Meta({ parts }: { parts: (string | null | undefined)[] }) {
  const text = parts.filter((part) => part && part.trim()).join(" · ");
  return text ? <p className="font-mono text-xs text-ink-3">{text}</p> : null;
}

function Bullets({ items, terms }: { items: string[]; terms?: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5 text-sm leading-relaxed text-ink">
          <span aria-hidden className="mt-2.25 size-1 shrink-0 rounded-full bg-ink-3" />
          <span>
            <HighlightedText text={item} terms={terms} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Tags({ items, terms }: { items: string[]; terms?: string[] }) {
  if (!items.length) return null;
  const normalizedTerms = new Set((terms ?? []).map((term) => term.toLowerCase()));
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className={cn(
            "rounded-md px-1.5 py-0.5 font-mono text-[11.5px]",
            normalizedTerms.has(item.toLowerCase()) ? "bg-tape-soft text-tape-soft-ink" : "bg-surface-3 text-ink-2",
          )}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-5 first:border-t-0 first:pt-0">
      <h3 className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">{title}</h3>
      {children}
    </section>
  );
}

/** Currículo estruturado para leitura na interface (não é o PDF). */
export function ResumeView({
  resume,
  order,
  terms,
  showHeader = true,
}: {
  resume: ResumeData;
  order?: SectionKey[];
  terms?: string[];
  showHeader?: boolean;
}) {
  const sections = (order ?? DEFAULT_SECTION_ORDER).filter((section) => sectionHasContent(resume, section));
  const { personal } = resume;

  const render = (section: SectionKey) => {
    switch (section) {
      case "summary":
        return (
          <SectionBlock key={section} title={UI_SECTION_LABELS.summary}>
            <p className="text-sm leading-relaxed text-ink">
              <HighlightedText text={resume.summary} terms={terms} />
            </p>
          </SectionBlock>
        );
      case "skills":
        return (
          <SectionBlock key={section} title={UI_SECTION_LABELS.skills}>
            <dl className="space-y-2.5">
              {SKILL_CATEGORIES.filter((category) => resume.skills[category].length).map((category) => (
                <div key={category} className="grid gap-1 sm:grid-cols-[190px_1fr] sm:gap-3">
                  <dt className="text-xs font-medium text-ink-2 sm:pt-1">{UI_SKILL_LABELS[category]}</dt>
                  <dd className="-mt-2.5">
                    <Tags items={resume.skills[category]} terms={terms} />
                  </dd>
                </div>
              ))}
            </dl>
          </SectionBlock>
        );
      case "experience":
        return (
          <SectionBlock key={section} title={UI_SECTION_LABELS.experience}>
            <div className="space-y-5">
              {resume.experiences.map((experience) => (
                <article key={experience.id}>
                  <h4 className="text-[15px] font-semibold leading-snug text-ink">
                    {experience.role || "Cargo não informado"}
                    {experience.company ? <span className="font-normal text-ink-2"> — {experience.company}</span> : null}
                  </h4>
                  <Meta
                    parts={[
                      period(experience.startDate, experience.endDate, experience.current),
                      experience.location,
                      experience.employmentType,
                    ]}
                  />
                  {experience.description ? (
                    <p className="mt-2 text-sm leading-relaxed text-ink">
                      <HighlightedText text={experience.description} terms={terms} />
                    </p>
                  ) : null}
                  <Bullets items={experience.highlights} terms={terms} />
                  <Tags items={experience.technologies} terms={terms} />
                </article>
              ))}
            </div>
          </SectionBlock>
        );
      case "projects":
        return (
          <SectionBlock key={section} title={UI_SECTION_LABELS.projects}>
            <div className="space-y-5">
              {resume.projects.map((project) => (
                <article key={project.id}>
                  <h4 className="text-[15px] font-semibold leading-snug text-ink">{project.name || "Projeto"}</h4>
                  <Meta parts={[period(project.startDate, project.endDate, false), project.url]} />
                  {project.description ? (
                    <p className="mt-2 text-sm leading-relaxed text-ink">
                      <HighlightedText text={project.description} terms={terms} />
                    </p>
                  ) : null}
                  <Bullets items={project.highlights} terms={terms} />
                  <Tags items={project.technologies} terms={terms} />
                </article>
              ))}
            </div>
          </SectionBlock>
        );
      case "education":
        return (
          <SectionBlock key={section} title={UI_SECTION_LABELS.education}>
            <div className="space-y-4">
              {resume.education.map((education) => (
                <article key={education.id}>
                  <h4 className="text-sm font-semibold text-ink">
                    {[education.degree, education.field].filter(Boolean).join(" em ") || "Formação"}
                  </h4>
                  <p className="text-sm text-ink-2">{education.institution}</p>
                  <Meta parts={[period(education.startDate, education.endDate, false), education.status]} />
                  {education.details ? <p className="mt-1 text-sm text-ink-2">{education.details}</p> : null}
                </article>
              ))}
            </div>
          </SectionBlock>
        );
      case "certifications":
        return (
          <SectionBlock key={section} title={UI_SECTION_LABELS.certifications}>
            <ul className="space-y-2">
              {resume.certifications.map((certification) => (
                <li key={certification.id} className="text-sm">
                  <span className="font-medium text-ink">{certification.name}</span>
                  <span className="text-ink-2">
                    {[certification.issuer, certification.date, certification.workload].filter(Boolean).length
                      ? ` — ${[certification.issuer, certification.date, certification.workload].filter(Boolean).join(" · ")}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </SectionBlock>
        );
      case "languages":
        return (
          <SectionBlock key={section} title={UI_SECTION_LABELS.languages}>
            <ul className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
              {resume.languages.map((language, index) => (
                <li key={index}>
                  <span className="font-medium text-ink">{language.name}</span>
                  {language.level ? <span className="text-ink-2"> — {language.level}</span> : null}
                </li>
              ))}
            </ul>
          </SectionBlock>
        );
      case "additional":
        return (
          <SectionBlock key={section} title={UI_SECTION_LABELS.additional}>
            <Bullets items={resume.additionalInfo} terms={terms} />
          </SectionBlock>
        );
    }
  };

  return (
    <div className="space-y-5">
      {showHeader ? (
        <header className="space-y-1.5 pb-1">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
            {personal.fullName || "Nome não informado"}
          </h2>
          {personal.headline ? (
            <p className="text-[15px] font-medium text-primary-ink">
              <HighlightedText text={personal.headline} terms={terms} />
            </p>
          ) : null}
          <p className="text-sm text-ink-2">
            {[personal.email, personal.phone, personal.location, ...personal.links.map((link) => link.url)]
              .filter(Boolean)
              .join("  ·  ")}
          </p>
        </header>
      ) : null}
      {sections.map(render)}
    </div>
  );
}
