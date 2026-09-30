"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

/** Request a paid service. Nothing is charged: an admin sends an invoice and activates the service after payment. */
export function RequestService({ productId, title, label, pending, disabled }: { productId: string; title: string; label: string; pending: boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [promo, setPromo] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  if (pending)
    return (
      <p className="mt-4 rounded-full bg-surface-2 px-4 py-3 text-center text-[13.5px] font-semibold text-muted">Заявка отправлена — ждём оплату по счёту</p>
    );
  return (
    <>
      <Button className="mt-4" variant="primary" block disabled={disabled} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        footer={
          <Button
            block
            size="lg"
            variant="accent"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await api<{ status: string }>("/api/billing/request", { body: { productId, promoCode: promo || undefined } });
                toast(r.status === "activated" ? "Услуга подключена" : "Заявка отправлена. Счёт придёт на email или в Telegram.");
                setOpen(false);
                router.refresh();
              } catch (e) {
                toast((e as Error).message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            Отправить заявку
          </Button>
        }
      >
        <p className="mb-4 text-[14.5px] text-muted">Онлайн-оплаты на платформе нет. Мы пришлём счёт, а после оплаты включим услугу. Отменить заявку можно в любой момент до оплаты.</p>
        <Input label="Промокод" optional value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} placeholder="Например, WELCOME10" />
      </Sheet>
    </>
  );
}

export function CancelRequest({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api(`/api/billing/${id}/cancel`, { method: "POST" });
          router.refresh();
        } catch (e) {
          toast((e as Error).message, "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      Отменить
    </Button>
  );
}
