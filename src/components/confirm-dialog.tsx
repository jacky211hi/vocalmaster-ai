"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "確定",
  cancelLabel = "取消",
  loading = false,
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="關閉"
        disabled={loading}
        onClick={() => {
          if (!loading) onCancel();
        }}
      />
      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-white/15 bg-slate-950/95 p-6 shadow-2xl shadow-black/50">
        <h2
          id="confirm-dialog-title"
          className="font-[family-name:var(--font-display)] text-2xl text-white"
        >
          {title}
        </h2>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            {description}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={danger ? "danger" : "default"}
            size="sm"
            disabled={loading}
            onClick={onConfirm}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
