import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SkeletonCard } from "@/components/ui/skeleton";
import { isRegistrationOpen } from "@/server/repositories/users";

export const metadata: Metadata = { title: "Criar conta" };

async function Registration() {
  if (!(await isRegistrationOpen())) {
    return (
      <div className="space-y-4">
        <Notice tone="info" title="Cadastro fechado">
          Este ATS pessoal já tem uma conta. Para permitir novos cadastros, defina ALLOW_REGISTRATION=true no arquivo
          .env.local e reinicie o servidor.
        </Notice>
        <ButtonLink href="/login" className="w-full">
          Ir para o login
        </ButtonLink>
      </div>
    );
  }
  return <AuthForm mode="registro" />;
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<SkeletonCard lines={5} />}>
      <Registration />
    </Suspense>
  );
}
