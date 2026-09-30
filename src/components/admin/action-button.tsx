"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button, type ButtonVariant } from "../ui/button";
import { useToast } from "../ui/toast";

/** Runs an admin action. `prompt` asks for a text value that is merged into the payload under `promptKey`. */
export function AdminAction({ payload, label, variant = "secondary", confirmText, prompt, promptKey = "note", size = "sm" }: { payload: Record<string, unknown>; label: string; variant?: ButtonVariant; confirmText?: string; prompt?: string; promptKey?: string; size?: "sm" | "md" }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  return (
    <Button
      size={size}
      variant={variant}
      loading={busy}
      onClick={async () => {
        if (confirmText && !confirm(confirmText)) return;
        let extra: Record<string, unknown> = {};
        if (prompt) {
          const v = window.prompt(prompt);
          if (v == null || !v.trim()) return;
          extra = { [promptKey]: v.trim() };
        }
        setBusy(true);
        try {
          await api("/api/admin/action", { body: { ...payload, ...extra } });
          toast("Готово");
          router.refresh();
        } catch (e) {
          toast((e as Error).message, "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      {label}
    </Button>
  );
}
