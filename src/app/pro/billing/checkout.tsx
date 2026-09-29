"use client";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

export function Checkout({ productId, label, disabled, dark }: { productId: string; label: string; disabled?: boolean; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const [promo, setPromo] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <>
      <Button className="mt-4" variant={dark ? "accent" : "primary"} block disabled={disabled} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Оплата"
        footer={
          <Button
            block
            size="lg"
            variant="accent"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await api<{ confirmationUrl: string }>("/api/payments/checkout", { body: { productId, promoCode: promo || undefined } });
                window.location.href = r.confirmationUrl;
              } catch (e) {
                toast((e as Error).message, "error");
                setBusy(false);
              }
            }}
          >
            Перейти к оплате
          </Button>
        }
      >
        <Input label="Промокод" optional value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} placeholder="Например, WELCOME10" />
      </Sheet>
    </>
  );
}
