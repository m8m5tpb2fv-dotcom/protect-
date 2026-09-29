"use client";
import { Flag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { Sheet } from "../ui/sheet";
import { Button } from "../ui/button";
import { Textarea } from "../ui/field";
import { useSession } from "../layout/session-provider";
import { useToast } from "../ui/toast";
import { cn } from "@/lib/cn";

const REASONS = ["Недостоверная информация", "Мошенничество", "Грубость или оскорбления", "Не пришёл / сорвал заказ", "Спам или реклама", "Другое"];

export function ReportButton({ targetType, targetId, className, label = "Пожаловаться" }: { targetType: "provider" | "review" | "order" | "message" | "user"; targetId: string; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <button onClick={() => (user ? setOpen(true) : router.push("/login"))} className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink", className)}>
        <Flag className="h-3.5 w-3.5" /> {label}
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Жалоба"
        footer={
          <Button
            block
            size="lg"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api("/api/reports", { body: { targetType, targetId, reason, text } });
                toast("Спасибо! Модераторы проверят жалобу.");
                setOpen(false);
              } catch (e) {
                toast((e as Error).message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            Отправить
          </Button>
        }
      >
        <div className="flex flex-col gap-1.5">
          {REASONS.map((r) => (
            <label key={r} className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl px-4 text-[15px]", reason === r ? "bg-accent-soft font-semibold" : "hover:bg-surface-2")}>
              <input type="radio" name="reason" className="accent-[var(--ink)]" checked={reason === r} onChange={() => setReason(r)} />
              {r}
            </label>
          ))}
        </div>
        <Textarea className="mt-4" label="Подробности" optional value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
      </Sheet>
    </>
  );
}
