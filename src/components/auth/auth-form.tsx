"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { apiFetch, ApiClientError, errorMessage } from "@/lib/api-client";

/** Só aceita caminhos internos no parâmetro ?next=, evitando redirecionamento para outros sites. */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export function AuthForm({ mode }: { mode: "login" | "registro" }) {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const isLogin = mode === "login";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      await apiFetch(isLogin ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      });
      window.location.href = isLogin ? safeNext(searchParams.get("next")) : "/curriculo";
    } catch (caught) {
      if (caught instanceof ApiClientError && Array.isArray(caught.details)) {
        const fields: Record<string, string> = {};
        for (const detail of caught.details as { path: string; message: string }[]) fields[detail.path] = detail.message;
        setFieldErrors(fields);
      }
      setError(errorMessage(caught));
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-raised sm:p-7">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{isLogin ? "Entrar" : "Criar sua conta"}</h1>
      <p className="mt-1 text-sm text-ink-2">
        {isLogin
          ? "Acesse seu currículo, suas análises e o histórico de candidaturas."
          : "Esta conta guarda seu currículo original e todas as versões personalizadas."}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        {!isLogin ? (
          <Field label="Nome" htmlFor="name" error={fieldErrors.name}>
            <Input id="name" name="name" autoComplete="name" required aria-invalid={Boolean(fieldErrors.name)} />
          </Field>
        ) : null}
        <Field label="E-mail" htmlFor="email" error={fieldErrors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={Boolean(fieldErrors.email)}
          />
        </Field>
        <Field
          label="Senha"
          htmlFor="password"
          error={fieldErrors.password}
          hint={!isLogin ? "Pelo menos 8 caracteres." : undefined}
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
            minLength={isLogin ? undefined : 8}
            aria-invalid={Boolean(fieldErrors.password)}
          />
        </Field>

        {error && !Object.keys(fieldErrors).length ? <Notice tone="danger">{error}</Notice> : null}

        <Button type="submit" className="w-full" loading={loading}>
          {isLogin ? "Entrar" : "Criar conta"}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-2">
        {isLogin ? (
          <>
            Primeiro acesso?{" "}
            <Link href="/registro" className="font-medium text-primary hover:underline">
              Criar conta
            </Link>
          </>
        ) : (
          <>
            Já tem conta?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Entrar
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
