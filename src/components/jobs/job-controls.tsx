"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { APPLICATION_STATUSES, STATUS_META, type ApplicationStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function StatusSelect({
  jobId,
  status,
  size = "md",
  className,
}: {
  jobId: number;
  status: ApplicationStatus;
  size?: "sm" | "md";
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);
  // Sincroniza quando o status muda por fora (ex.: geração do PDF marca "Currículo preparado").
  const [lastStatus, setLastStatus] = useState(status);
  if (status !== lastStatus) {
    setLastStatus(status);
    setValue(status);
  }

  async function change(next: ApplicationStatus) {
    const previous = value;
    setValue(next);
    setSaving(true);
    try {
      await apiFetch(`/api/jobs/${jobId}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      toast(`Status alterado para “${STATUS_META[next].label}”.`);
      router.refresh();
    } catch (error) {
      setValue(previous);
      toast(errorMessage(error), "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-2 -translate-y-1/2 rounded-full"
        style={{ backgroundColor: `var(--status-${value})` }}
      />
      <Select
        aria-label="Status da candidatura"
        value={value}
        disabled={saving}
        onChange={(event) => change(event.target.value as ApplicationStatus)}
        className={cn("pl-7 font-medium", size === "sm" ? "h-8 text-[13px]" : "h-10")}
      >
        {APPLICATION_STATUSES.map((option) => (
          <option key={option} value={option}>
            {STATUS_META[option].label}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function JobDetailsForm({
  jobId,
  company,
  title,
  jobUrl,
  notes,
}: {
  jobId: number;
  company: string | null;
  title: string | null;
  jobUrl: string | null;
  notes: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ company: company ?? "", title: title ?? "", jobUrl: jobUrl ?? "", notes: notes ?? "" });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await apiFetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        body: JSON.stringify({
          company: form.company.trim() || null,
          title: form.title.trim() || null,
          jobUrl: form.jobUrl.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      toast("Dados da vaga atualizados.");
      setEditing(false);
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), "danger");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="space-y-3">
        {notes ? <p className="whitespace-pre-line text-sm text-ink">{notes}</p> : <p className="text-sm text-ink-3">Sem anotações.</p>}
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
          <Pencil /> Editar dados e anotações
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Field label="Cargo" htmlFor="job-title">
        <Input id="job-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
      </Field>
      <Field label="Empresa" htmlFor="job-company">
        <Input id="job-company" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />
      </Field>
      <Field label="Link da vaga" htmlFor="job-url">
        <Input id="job-url" type="url" value={form.jobUrl} onChange={(event) => setForm({ ...form, jobUrl: event.target.value })} />
      </Field>
      <Field label="Anotações" htmlFor="job-notes" hint="Contatos, datas de entrevista, próximos passos…">
        <Textarea id="job-notes" rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
      </Field>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} loading={saving}>
          Salvar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

export function DeleteJobButton({ jobId, label }: { jobId: number; label: string }) {
  const router = useRouter();
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);

  return (
    <ConfirmButton
      trigger={
        <Button variant="danger" size="sm">
          <Trash2 /> Excluir vaga
        </Button>
      }
      title="Excluir esta vaga?"
      description={
        <>
          “{label}”, sua análise, os currículos personalizados e os anexos serão apagados. Seu currículo original não é
          afetado.
        </>
      }
      confirmLabel="Excluir vaga"
      loading={deleting}
      onConfirm={async () => {
        setDeleting(true);
        try {
          await apiFetch(`/api/jobs/${jobId}`, { method: "DELETE" });
          toast("Vaga excluída.");
          router.push("/vagas");
          router.refresh();
        } catch (error) {
          toast(errorMessage(error), "danger");
          setDeleting(false);
        }
      }}
    />
  );
}
