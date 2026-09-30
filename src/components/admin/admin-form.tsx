"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "../ui/button";
import { Input, Select, Textarea } from "../ui/field";
import { Switch } from "../ui/switch";
import { useToast } from "../ui/toast";

type FieldDef = { name: string; label: string; kind?: "text" | "number" | "textarea" | "switch" | "date" | "select"; placeholder?: string; required?: boolean; options?: { v: string; l: string }[] };

/** Small declarative form that posts `{ type, ...fixed, ...values }` to /api/admin/action. */
export function AdminForm({ type, fields, fixed = {}, initial = {}, submitLabel = "Сохранить", resetOnSuccess = true, className }: { type: string; fields: FieldDef[]; fixed?: Record<string, unknown>; initial?: Record<string, unknown>; submitLabel?: string; resetOnSuccess?: boolean; className?: string }) {
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  return (
    <form
      className={className ?? "flex flex-wrap items-end gap-3"}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const payload: Record<string, unknown> = { type, ...fixed };
          for (const f of fields) {
            const v = values[f.name];
            if (f.kind === "number") payload[f.name] = v === "" || v == null ? null : Number(v);
            else if (f.kind === "switch") payload[f.name] = !!v;
            else if (f.kind === "date") payload[f.name] = v ? new Date(String(v)).toISOString() : null;
            else if (f.kind === "select") payload[f.name] = v === "" || v == null ? (f.required ? f.options?.[0]?.v : null) : v;
            else payload[f.name] = v ?? "";
          }
          await api("/api/admin/action", { body: payload });
          toast("Сохранено");
          if (resetOnSuccess) setValues(initial);
          router.refresh();
        } catch (err) {
          toast((err as Error).message, "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      {fields.map((f) =>
        f.kind === "switch" ? (
          <Switch key={f.name} label={f.label} checked={!!values[f.name]} onChange={(v) => setValues({ ...values, [f.name]: v })} className="min-w-[180px]" />
        ) : f.kind === "select" ? (
          <Select key={f.name} label={f.label} className="min-w-[180px] flex-1" value={String(values[f.name] ?? (f.required ? (f.options?.[0]?.v ?? "") : ""))} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}>
            {!f.required && <option value="">—</option>}
            {f.options?.map((o) => (
              <option key={o.v} value={o.v}>
                {o.l}
              </option>
            ))}
          </Select>
        ) : f.kind === "textarea" ? (
          <Textarea key={f.name} label={f.label} className="w-full" rows={3} value={String(values[f.name] ?? "")} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} required={f.required} />
        ) : (
          <Input key={f.name} label={f.label} className="min-w-[140px] flex-1" type={f.kind === "date" ? "date" : "text"} inputMode={f.kind === "number" ? "decimal" : undefined} placeholder={f.placeholder} value={String(values[f.name] ?? "")} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} required={f.required} />
        ),
      )}
      <Button type="submit" size="lg" loading={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}
