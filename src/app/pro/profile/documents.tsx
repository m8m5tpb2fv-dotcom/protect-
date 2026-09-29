"use client";
import { FileCheck2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, uploadFile } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { VERIFICATION, dateShort } from "@/lib/format";

const KINDS = { passport: "Паспорт", diploma: "Диплом / сертификат", business: "Документы ИП / ООО", other: "Другое" } as const;

export function Documents({ docs, verification }: { docs: { id: string; kind: string; status: string; createdAt: string }[]; verification: "none" | "verified" | "pro" | "business" }) {
  const [kind, setKind] = useState<keyof typeof KINDS>("passport");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();
  const v = VERIFICATION[verification];
  return (
    <section className="rounded-[28px] bg-surface p-5 shadow-card md:p-6">
      <h2 className="title text-[22px]">Проверка профиля</h2>
      <p className="mt-1 text-[14.5px] text-muted">
        Текущий статус: <b className="text-ink">{v ? v.label : "Обычный профиль"}</b>. Документы видят только модераторы, они хранятся в закрытом хранилище. Статус — это проверка платформы, а не юридическая гарантия.
      </p>
      {docs.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
              <FileCheck2 className="h-5 w-5 text-muted" />
              <span className="flex-1 text-[14.5px] font-medium">{KINDS[d.kind as keyof typeof KINDS] ?? d.kind}</span>
              <span className="text-[12.5px] text-muted">{dateShort(d.createdAt)}</span>
              <Badge tone={d.status === "approved" ? "success" : "warning"}>{d.status === "approved" ? "Проверен" : "На проверке"}</Badge>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Select label="Тип документа" value={kind} onChange={(e) => setKind(e.target.value as keyof typeof KINDS)} className="flex-1">
          {Object.entries(KINDS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Select>
        <Button size="lg" variant="secondary" loading={busy} onClick={() => ref.current?.click()}>
          <Upload className="h-4 w-4" /> Загрузить фото или PDF
        </Button>
        <input
          ref={ref}
          type="file"
          accept="image/*,application/pdf"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setBusy(true);
            try {
              const r = await uploadFile(f, "document");
              await api("/api/provider/documents", { body: { kind, url: r.url } });
              toast("Документ отправлен на проверку");
              router.refresh();
            } catch (err) {
              toast((err as Error).message, "error");
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
    </section>
  );
}
