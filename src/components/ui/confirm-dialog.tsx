"use client";

import { useRef, type ReactNode } from "react";
import { Button } from "./button";

/**
 * Botão que pede confirmação em um <dialog> nativo (foco preso, Esc fecha).
 * Usado em ações destrutivas, como excluir uma vaga.
 */
export function ConfirmButton({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  loading,
  tone = "danger",
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  tone?: "danger" | "primary";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <span onClick={() => dialogRef.current?.showModal()}>{trigger}</span>
      <dialog
        ref={(dialog) => {
          dialogRef.current = dialog;
          // Fecha se a página for ocultada pela navegação (Activity mantém o componente montado).
          return () => dialog?.close();
        }}
        className="m-auto w-[min(92vw,420px)] rounded-xl border border-line bg-surface p-0 text-ink shadow-raised backdrop:bg-black/40"
        aria-labelledby="confirm-title"
      >
        <div className="space-y-2 p-5">
          <h2 id="confirm-title" className="text-base font-semibold">
            {title}
          </h2>
          <div className="text-sm text-ink-2">{description}</div>
        </div>
        <div className="flex justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => dialogRef.current?.close()}>
            Cancelar
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            size="sm"
            loading={loading}
            onClick={async () => {
              await onConfirm();
              dialogRef.current?.close();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </dialog>
    </>
  );
}
