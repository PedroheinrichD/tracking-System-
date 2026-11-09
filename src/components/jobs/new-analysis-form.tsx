"use client";

import { ChevronDown, ClipboardType, ImageIcon, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dropzone } from "@/components/ui/dropzone";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { ACCEPTED_IMAGE_TYPES, LIMITS, OUTPUT_LANGUAGES, PIPELINE_DONE, MATCH_DONE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { PipelineRunner } from "./pipeline-runner";

function SourceLabel({ icon: Icon, title, hint }: { icon: typeof ImageIcon; title: string; hint: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <Icon className="size-4 text-ink-3" aria-hidden />
      <span className="text-sm font-medium text-ink">{title}</span>
      <span className="text-xs text-ink-3">{hint}</span>
    </div>
  );
}

export function NewAnalysisForm({ aiConfigured }: { aiConfigured: boolean }) {
  const router = useRouter();
  const textId = useId();
  const [text, setText] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [pdf, setPdf] = useState<File[]>([]);
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("auto");
  const [autoTailor, setAutoTailor] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<number | null>(null);

  const hasInput = text.trim().length > 0 || images.length > 0 || pdf.length > 0;

  function reset() {
    setText("");
    setImages([]);
    setPdf([]);
    setCompany("");
    setTitle("");
    setUrl("");
    setLanguage("auto");
    setJobId(null);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!hasInput) {
      setError("Cole a descrição da vaga ou envie um print ou PDF do anúncio.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const form = new FormData();
    form.append("text", text);
    form.append("company", company);
    form.append("title", title);
    form.append("url", url);
    form.append("language", language);
    for (const image of images) form.append("images", image);
    if (pdf[0]) form.append("pdf", pdf[0]);
    try {
      const created = await apiFetch<{ id: number }>("/api/jobs", { method: "POST", body: form });
      setJobId(created.id);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  if (jobId !== null) {
    const destination = autoTailor ? `/vagas/${jobId}/curriculo` : `/vagas/${jobId}`;
    return (
      <Card className="max-w-2xl">
        <CardHeader
          title="Analisando a vaga"
          description="Cada etapa é salva assim que termina. Se sair desta página, o progresso continua disponível em Minhas vagas."
        />
        <CardBody>
          <PipelineRunner
            jobId={jobId}
            initialCompleted={0}
            until={autoTailor ? PIPELINE_DONE : MATCH_DONE}
            onFinished={() => {
              reset();
              router.push(destination);
            }}
          />
          <div className="mt-5 border-t border-line pt-4">
            <ButtonLink href={`/vagas/${jobId}`} variant="ghost" size="sm">
              Abrir a vaga sem esperar
            </ButtonLink>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        <Card>
          <CardBody className="space-y-6">
            <div>
              <SourceLabel icon={ClipboardType} title="Descrição da vaga" hint="cole o texto do anúncio" />
              <Textarea
                id={textId}
                aria-label="Descrição da vaga"
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={12}
                maxLength={LIMITS.jobTextChars}
                placeholder="Cole aqui o anúncio completo: cargo, responsabilidades, requisitos, diferenciais…"
                className="font-[450]"
              />
              <p className="mt-1.5 text-right font-mono text-[11px] text-ink-3">
                {text.length.toLocaleString("pt-BR")} / {LIMITS.jobTextChars.toLocaleString("pt-BR")}
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <SourceLabel icon={ImageIcon} title="Prints da vaga" hint={`até ${LIMITS.jobImages}`} />
                <Dropzone
                  compact
                  multiple
                  maxFiles={LIMITS.jobImages}
                  accept={[...ACCEPTED_IMAGE_TYPES]}
                  maxBytes={LIMITS.jobImageBytes}
                  files={images}
                  onFilesChange={setImages}
                  title="Arraste capturas de tela"
                  hint="PNG, JPG ou WEBP · até 3,5 MB cada"
                />
              </div>
              <div>
                <SourceLabel icon={FileText} title="PDF da vaga" hint="opcional" />
                <Dropzone
                  compact
                  accept={["application/pdf", ".pdf"]}
                  maxBytes={LIMITS.jobPdfBytes}
                  files={pdf}
                  onFilesChange={setPdf}
                  title="Arraste o PDF do anúncio"
                  hint="Até 10 MB e 20 páginas"
                />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <button
            type="button"
            onClick={() => setShowDetails((value) => !value)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
            aria-expanded={showDetails}
          >
            <span>
              <span className="block text-sm font-semibold text-ink">Detalhes opcionais</span>
              <span className="block text-xs text-ink-3">Empresa, cargo, link e idioma do currículo gerado</span>
            </span>
            <ChevronDown className={cn("size-4 text-ink-3 transition-transform", showDetails && "rotate-180")} />
          </button>
          {showDetails ? (
            <div className="grid gap-4 border-t border-line p-5 sm:grid-cols-2">
              <Field label="Empresa" htmlFor="company" hint="Se vazio, a IA identifica pelo anúncio.">
                <Input id="company" value={company} onChange={(event) => setCompany(event.target.value)} maxLength={190} />
              </Field>
              <Field label="Cargo" htmlFor="title" hint="Usado também no nome do PDF.">
                <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={190} />
              </Field>
              <Field label="Link da vaga" htmlFor="url">
                <Input id="url" type="url" value={url} placeholder="https://" onChange={(event) => setUrl(event.target.value)} />
              </Field>
              <Field label="Idioma do currículo personalizado" htmlFor="language">
                <Select id="language" value={language} onChange={(event) => setLanguage(event.target.value)}>
                  {OUTPUT_LANGUAGES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : null}
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
        <Card>
          <CardBody className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">O que acontece</h2>
              <ol className="mt-3 space-y-2.5 text-sm text-ink-2">
                <li>1. A IA lê a vaga e lista requisitos, nível e palavras-chave.</li>
                <li>2. Cada requisito é comparado ao seu currículo, com trechos como evidência.</li>
                <li>3. Uma nova versão do currículo é escrita só com o que é verdadeiro.</li>
                <li>4. Um revisor independente confere se nada foi inventado.</li>
              </ol>
            </div>
            <label className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-2 p-3 text-sm">
              <input
                type="checkbox"
                checked={autoTailor}
                onChange={(event) => setAutoTailor(event.target.checked)}
                className="mt-0.5 size-4 accent-[var(--primary)]"
              />
              <span>
                <span className="block font-medium text-ink">Gerar o currículo personalizado</span>
                <span className="block text-xs text-ink-3">Desmarque para ver só a compatibilidade primeiro.</span>
              </span>
            </label>

            {!aiConfigured ? (
              <Notice tone="warning">Defina ANTHROPIC_API_KEY no .env.local para usar a análise por IA.</Notice>
            ) : null}
            {error ? <Notice tone="danger">{error}</Notice> : null}

            <Button type="submit" size="lg" className="w-full" loading={submitting} disabled={!aiConfigured}>
              Analisar vaga
            </Button>
            <p className="text-center text-xs text-ink-3">Leva de 1 a 3 minutos, conforme o tamanho da vaga.</p>
          </CardBody>
        </Card>
      </aside>
    </form>
  );
}
