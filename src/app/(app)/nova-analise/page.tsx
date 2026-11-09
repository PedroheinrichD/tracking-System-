import { FileUser } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { NewAnalysisForm } from "@/components/jobs/new-analysis-form";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton";
import { isAiConfigured } from "@/server/ai/client";
import { requireUser } from "@/server/auth/dal";
import { getActiveResume } from "@/server/repositories/resumes";

export const metadata: Metadata = { title: "Nova análise" };

async function AnalysisContent() {
  const user = await requireUser();
  const resume = await getActiveResume(user.id);
  if (!resume) {
    return (
      <EmptyState
        icon={FileUser}
        title="Cadastre seu currículo primeiro"
        description="A análise compara a vaga com o seu currículo original. Envie o PDF ou preencha os dados em Meu currículo."
        action={<ButtonLink href="/curriculo">Ir para Meu currículo</ButtonLink>}
      />
    );
  }
  return <NewAnalysisForm aiConfigured={isAiConfigured()} />;
}

export default function NewAnalysisPage() {
  return (
    <>
      <PageHeader
        title="Nova análise"
        description="Envie a vaga do jeito que for mais fácil: texto, prints ou PDF. Você pode combinar os três."
      />
      <Suspense fallback={<SkeletonCard lines={10} />}>
        <AnalysisContent />
      </Suspense>
    </>
  );
}
