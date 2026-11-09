import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { SkeletonCard } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/server/auth/dal";

export const metadata: Metadata = { title: "Entrar" };

/** Se já houver sessão válida, vai direto para o painel. */
async function RedirectIfSignedIn() {
  if (await getCurrentUser()) redirect("/");
  return null;
}

export default function LoginPage() {
  return (
    <>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <Suspense fallback={<SkeletonCard lines={4} />}>
        <AuthForm mode="login" />
      </Suspense>
    </>
  );
}
