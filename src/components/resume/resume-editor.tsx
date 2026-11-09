"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { TagInput } from "@/components/ui/tag-input";
import { UI_SECTION_LABELS, UI_SKILL_LABELS } from "@/lib/domain/labels";
import {
  DEFAULT_SECTION_ORDER,
  SKILL_CATEGORIES,
  type Certification,
  type Education,
  type Experience,
  type Project,
  type ResumeData,
  type SectionKey,
  type TailoredResume,
} from "@/lib/domain/resume";
import { cn, makeItemId } from "@/lib/utils";

type EditableResume = ResumeData | TailoredResume;

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.replace(/^\s*[-•*]\s*/, "").trimEnd())
    .filter((line) => line.trim());
}

function move<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function AreaField({
  label,
  value,
  onChange,
  hint,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  rows?: number;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
      {hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
    </div>
  );
}

function sameLines(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * Um tópico por linha. Mantém o texto bruto localmente (para permitir linhas em
 * branco enquanto se digita) e sincroniza quando o valor muda por fora.
 */
function LinesField({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  const id = useId();
  const [text, setText] = useState(() => values.join("\n"));
  if (!sameLines(lines(text), lines(values.join("\n")))) {
    setText(values.join("\n"));
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        rows={Math.min(10, Math.max(3, values.length + 1))}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          onChange(lines(event.target.value));
        }}
      />
      <p className="text-xs text-ink-3">Um tópico por linha.</p>
    </div>
  );
}

function TagsField({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-[13px] font-medium text-ink">{label}</span>
      <TagInput label={label} value={values} onChange={onChange} />
    </div>
  );
}

function EditorSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {description ? <p className="text-xs text-ink-3">{description}</p> : null}
        </div>
        {action}
      </header>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

function ItemShell({
  label,
  index,
  total,
  onMove,
  onRemove,
  children,
}: {
  label: string;
  index: number;
  total: number;
  onMove: (delta: number) => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-ink">{label}</p>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink disabled:opacity-30"
            aria-label={`Mover ${label} para cima`}
          >
            <ArrowUp className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink disabled:opacity-30"
            aria-label={`Mover ${label} para baixo`}
          >
            <ArrowDown className="size-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-danger-soft hover:text-danger"
            aria-label={`Remover ${label}`}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function newExperience(): Experience {
  return {
    id: makeItemId("exp"),
    company: "",
    role: "",
    employmentType: "",
    location: "",
    startDate: "",
    endDate: "",
    current: false,
    description: "",
    highlights: [],
    technologies: [],
  };
}

function newProject(): Project {
  return { id: makeItemId("proj"), name: "", description: "", highlights: [], technologies: [], url: "", startDate: "", endDate: "" };
}

function newEducation(): Education {
  return { id: makeItemId("edu"), institution: "", degree: "", field: "", startDate: "", endDate: "", status: "", details: "" };
}

function newCertification(): Certification {
  return { id: makeItemId("cert"), name: "", issuer: "", date: "", workload: "", url: "", kind: "curso" };
}

/** Editor controlado do currículo (original ou personalizado). */
export function ResumeEditor<T extends EditableResume>({
  value,
  onChange,
  mode,
}: {
  value: T;
  onChange: (next: T) => void;
  mode: "base" | "tailored";
}) {
  const tailored = mode === "tailored";
  const set = <K extends keyof T>(key: K, next: T[K]) => onChange({ ...value, [key]: next });
  const personal = value.personal;
  const setPersonal = (key: keyof ResumeData["personal"], next: string) =>
    onChange({ ...value, personal: { ...personal, [key]: next } });

  const sectionOrder = tailored ? (value as TailoredResume).sectionOrder : DEFAULT_SECTION_ORDER;

  return (
    <div className="space-y-5">
      {tailored ? (
        <EditorSection title="Ordem das seções" description="A ordem em que as seções aparecem no PDF.">
          <ol className="space-y-1.5">
            {sectionOrder.map((section, index) => (
              <li key={section} className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
                <span className="w-5 font-mono text-xs text-ink-3">{index + 1}</span>
                <span className="flex-1 text-ink">{UI_SECTION_LABELS[section]}</span>
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => set("sectionOrder" as keyof T, move(sectionOrder, index, -1) as T[keyof T])}
                  className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink disabled:opacity-30"
                  aria-label={`Subir ${UI_SECTION_LABELS[section]}`}
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={index === sectionOrder.length - 1}
                  onClick={() => set("sectionOrder" as keyof T, move(sectionOrder, index, 1) as T[keyof T])}
                  className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink disabled:opacity-30"
                  aria-label={`Descer ${UI_SECTION_LABELS[section]}`}
                >
                  <ArrowDown className="size-4" />
                </button>
              </li>
            ))}
          </ol>
          {DEFAULT_SECTION_ORDER.filter((section) => !sectionOrder.includes(section)).length ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
              Seções fora do PDF:
              {DEFAULT_SECTION_ORDER.filter((section) => !sectionOrder.includes(section)).map((section: SectionKey) => (
                <button
                  key={section}
                  type="button"
                  onClick={() => set("sectionOrder" as keyof T, [...sectionOrder, section] as T[keyof T])}
                  className="chalk-border rounded-md px-2 py-0.5 text-ink-2 hover:text-ink"
                >
                  + {UI_SECTION_LABELS[section]}
                </button>
              ))}
            </div>
          ) : null}
        </EditorSection>
      ) : null}

      <EditorSection
        title="Dados pessoais"
        description={tailored ? "Nome e contatos vêm sempre do currículo original." : undefined}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Nome completo" value={personal.fullName} disabled={tailored} onChange={(next) => setPersonal("fullName", next)} />
          <TextField
            label="Título profissional"
            value={personal.headline}
            placeholder="Ex.: Desenvolvedor Full Stack"
            onChange={(next) => setPersonal("headline", next)}
          />
          <TextField label="E-mail" value={personal.email} disabled={tailored} onChange={(next) => setPersonal("email", next)} />
          <TextField label="Telefone" value={personal.phone} disabled={tailored} onChange={(next) => setPersonal("phone", next)} />
          <TextField label="Localização" value={personal.location} onChange={(next) => setPersonal("location", next)} />
        </div>
        {!tailored ? (
          <div className="space-y-2">
            <span className="block text-[13px] font-medium text-ink">Links</span>
            {personal.links.map((link, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  aria-label="Rótulo do link"
                  className="w-32 shrink-0"
                  value={link.label}
                  placeholder="LinkedIn"
                  onChange={(event) =>
                    onChange({
                      ...value,
                      personal: {
                        ...personal,
                        links: personal.links.map((item, position) =>
                          position === index ? { ...item, label: event.target.value } : item,
                        ),
                      },
                    })
                  }
                />
                <Input
                  aria-label="Endereço do link"
                  value={link.url}
                  placeholder="linkedin.com/in/seu-perfil"
                  onChange={(event) =>
                    onChange({
                      ...value,
                      personal: {
                        ...personal,
                        links: personal.links.map((item, position) =>
                          position === index ? { ...item, url: event.target.value } : item,
                        ),
                      },
                    })
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...value, personal: { ...personal, links: personal.links.filter((_, position) => position !== index) } })
                  }
                  className="grid size-10 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-danger-soft hover:text-danger"
                  aria-label="Remover link"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...value, personal: { ...personal, links: [...personal.links, { label: "", url: "" }] } })}
            >
              <Plus /> Adicionar link
            </Button>
          </div>
        ) : null}
      </EditorSection>

      <EditorSection title={UI_SECTION_LABELS.summary}>
        <AreaField
          label="Resumo"
          value={value.summary}
          rows={5}
          onChange={(next) => set("summary" as keyof T, next as T[keyof T])}
          hint="2 a 4 frases objetivas, sem exageros."
        />
      </EditorSection>

      <EditorSection title={UI_SECTION_LABELS.skills} description="Pressione Enter ou vírgula para adicionar.">
        {SKILL_CATEGORIES.map((category) => (
          <TagsField
            key={category}
            label={UI_SKILL_LABELS[category]}
            values={value.skills[category]}
            onChange={(next) => onChange({ ...value, skills: { ...value.skills, [category]: next } })}
          />
        ))}
      </EditorSection>

      <EditorSection
        title={UI_SECTION_LABELS.experience}
        action={
          <Button variant="secondary" size="sm" onClick={() => set("experiences" as keyof T, [...value.experiences, newExperience()] as T[keyof T])}>
            <Plus /> Experiência
          </Button>
        }
      >
        {value.experiences.length === 0 ? <p className="text-sm text-ink-3">Nenhuma experiência cadastrada.</p> : null}
        {value.experiences.map((experience, index) => {
          const update = (patch: Partial<Experience>) =>
            set(
              "experiences" as keyof T,
              value.experiences.map((item, position) => (position === index ? { ...item, ...patch } : item)) as T[keyof T],
            );
          return (
            <ItemShell
              key={experience.id}
              label={[experience.role, experience.company].filter(Boolean).join(" — ") || "Nova experiência"}
              index={index}
              total={value.experiences.length}
              onMove={(delta) => set("experiences" as keyof T, move(value.experiences, index, delta) as T[keyof T])}
              onRemove={() => set("experiences" as keyof T, value.experiences.filter((_, position) => position !== index) as T[keyof T])}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Cargo" value={experience.role} onChange={(next) => update({ role: next })} />
                <TextField label="Empresa" value={experience.company} onChange={(next) => update({ company: next })} />
                <TextField label="Vínculo" value={experience.employmentType} placeholder="CLT, PJ, Estágio…" onChange={(next) => update({ employmentType: next })} />
                <TextField label="Local" value={experience.location} onChange={(next) => update({ location: next })} />
                <TextField label="Início" value={experience.startDate} placeholder="03/2022" onChange={(next) => update({ startDate: next })} />
                <TextField
                  label="Término"
                  value={experience.current ? "" : experience.endDate}
                  placeholder={experience.current ? "Atual" : "12/2023"}
                  disabled={experience.current}
                  onChange={(next) => update({ endDate: next })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--primary)]"
                  checked={experience.current}
                  onChange={(event) => update({ current: event.target.checked, endDate: event.target.checked ? "" : experience.endDate })}
                />
                Trabalho atual
              </label>
              <AreaField label="Descrição" value={experience.description} rows={3} onChange={(next) => update({ description: next })} />
              <LinesField label="Tópicos" values={experience.highlights} onChange={(next) => update({ highlights: next })} />
              <TagsField label="Tecnologias usadas nesta experiência" values={experience.technologies} onChange={(next) => update({ technologies: next })} />
            </ItemShell>
          );
        })}
      </EditorSection>

      <EditorSection
        title={UI_SECTION_LABELS.projects}
        action={
          <Button variant="secondary" size="sm" onClick={() => set("projects" as keyof T, [...value.projects, newProject()] as T[keyof T])}>
            <Plus /> Projeto
          </Button>
        }
      >
        {value.projects.length === 0 ? <p className="text-sm text-ink-3">Nenhum projeto cadastrado.</p> : null}
        {value.projects.map((project, index) => {
          const update = (patch: Partial<Project>) =>
            set(
              "projects" as keyof T,
              value.projects.map((item, position) => (position === index ? { ...item, ...patch } : item)) as T[keyof T],
            );
          return (
            <ItemShell
              key={project.id}
              label={project.name || "Novo projeto"}
              index={index}
              total={value.projects.length}
              onMove={(delta) => set("projects" as keyof T, move(value.projects, index, delta) as T[keyof T])}
              onRemove={() => set("projects" as keyof T, value.projects.filter((_, position) => position !== index) as T[keyof T])}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Nome" value={project.name} onChange={(next) => update({ name: next })} />
                <TextField label="Link" value={project.url} onChange={(next) => update({ url: next })} />
                <TextField label="Início" value={project.startDate} onChange={(next) => update({ startDate: next })} />
                <TextField label="Término" value={project.endDate} onChange={(next) => update({ endDate: next })} />
              </div>
              <AreaField label="Descrição" value={project.description} rows={3} onChange={(next) => update({ description: next })} />
              <LinesField label="Tópicos" values={project.highlights} onChange={(next) => update({ highlights: next })} />
              <TagsField label="Tecnologias" values={project.technologies} onChange={(next) => update({ technologies: next })} />
            </ItemShell>
          );
        })}
      </EditorSection>

      <EditorSection
        title={UI_SECTION_LABELS.education}
        action={
          <Button variant="secondary" size="sm" onClick={() => set("education" as keyof T, [...value.education, newEducation()] as T[keyof T])}>
            <Plus /> Formação
          </Button>
        }
      >
        {value.education.length === 0 ? <p className="text-sm text-ink-3">Nenhuma formação cadastrada.</p> : null}
        {value.education.map((education, index) => {
          const update = (patch: Partial<Education>) =>
            set(
              "education" as keyof T,
              value.education.map((item, position) => (position === index ? { ...item, ...patch } : item)) as T[keyof T],
            );
          return (
            <ItemShell
              key={education.id}
              label={education.institution || "Nova formação"}
              index={index}
              total={value.education.length}
              onMove={(delta) => set("education" as keyof T, move(value.education, index, delta) as T[keyof T])}
              onRemove={() => set("education" as keyof T, value.education.filter((_, position) => position !== index) as T[keyof T])}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Instituição" value={education.institution} onChange={(next) => update({ institution: next })} />
                <TextField label="Grau" value={education.degree} placeholder="Bacharelado, Tecnólogo…" onChange={(next) => update({ degree: next })} />
                <TextField label="Curso" value={education.field} onChange={(next) => update({ field: next })} />
                <TextField label="Situação" value={education.status} placeholder="Concluído, Em andamento…" onChange={(next) => update({ status: next })} />
                <TextField label="Início" value={education.startDate} onChange={(next) => update({ startDate: next })} />
                <TextField label="Término" value={education.endDate} onChange={(next) => update({ endDate: next })} />
              </div>
              <AreaField label="Detalhes" value={education.details} rows={2} onChange={(next) => update({ details: next })} />
            </ItemShell>
          );
        })}
      </EditorSection>

      <EditorSection
        title={UI_SECTION_LABELS.certifications}
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => set("certifications" as keyof T, [...value.certifications, newCertification()] as T[keyof T])}
          >
            <Plus /> Curso
          </Button>
        }
      >
        {value.certifications.length === 0 ? <p className="text-sm text-ink-3">Nenhum curso ou certificação.</p> : null}
        {value.certifications.map((certification, index) => {
          const update = (patch: Partial<Certification>) =>
            set(
              "certifications" as keyof T,
              value.certifications.map((item, position) => (position === index ? { ...item, ...patch } : item)) as T[keyof T],
            );
          return (
            <ItemShell
              key={certification.id}
              label={certification.name || "Novo curso"}
              index={index}
              total={value.certifications.length}
              onMove={(delta) => set("certifications" as keyof T, move(value.certifications, index, delta) as T[keyof T])}
              onRemove={() =>
                set("certifications" as keyof T, value.certifications.filter((_, position) => position !== index) as T[keyof T])
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Nome" value={certification.name} onChange={(next) => update({ name: next })} />
                <TextField label="Instituição" value={certification.issuer} onChange={(next) => update({ issuer: next })} />
                <TextField label="Data" value={certification.date} onChange={(next) => update({ date: next })} />
                <TextField label="Carga horária" value={certification.workload} onChange={(next) => update({ workload: next })} />
                <div className="space-y-1.5">
                  <Label htmlFor={`${certification.id}-kind`}>Tipo</Label>
                  <Select
                    id={`${certification.id}-kind`}
                    value={certification.kind}
                    onChange={(event) => update({ kind: event.target.value as Certification["kind"] })}
                  >
                    <option value="curso">Curso</option>
                    <option value="certificacao">Certificação</option>
                  </Select>
                </div>
                <TextField label="Link" value={certification.url} onChange={(next) => update({ url: next })} />
              </div>
            </ItemShell>
          );
        })}
      </EditorSection>

      <EditorSection
        title={UI_SECTION_LABELS.languages}
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => set("languages" as keyof T, [...value.languages, { name: "", level: "" }] as T[keyof T])}
          >
            <Plus /> Idioma
          </Button>
        }
      >
        {value.languages.map((language, index) => (
          <div key={index} className="flex gap-2">
            <Input
              aria-label="Idioma"
              placeholder="Inglês"
              value={language.name}
              onChange={(event) =>
                set(
                  "languages" as keyof T,
                  value.languages.map((item, position) => (position === index ? { ...item, name: event.target.value } : item)) as T[keyof T],
                )
              }
            />
            <Input
              aria-label="Nível"
              placeholder="Avançado"
              value={language.level}
              onChange={(event) =>
                set(
                  "languages" as keyof T,
                  value.languages.map((item, position) => (position === index ? { ...item, level: event.target.value } : item)) as T[keyof T],
                )
              }
            />
            <button
              type="button"
              onClick={() => set("languages" as keyof T, value.languages.filter((_, position) => position !== index) as T[keyof T])}
              className="grid size-10 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-danger-soft hover:text-danger"
              aria-label="Remover idioma"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        {value.languages.length === 0 ? <p className="text-sm text-ink-3">Nenhum idioma cadastrado.</p> : null}
      </EditorSection>

      <EditorSection title={UI_SECTION_LABELS.additional}>
        <LinesField
          label="Informações adicionais"
          values={value.additionalInfo}
          onChange={(next) => set("additionalInfo" as keyof T, next as T[keyof T])}
        />
      </EditorSection>
    </div>
  );
}
