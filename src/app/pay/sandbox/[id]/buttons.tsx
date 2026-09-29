"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function SandboxButtons({ id }: { id: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();
  const go = async (outcome: "success" | "fail") => {
    setBusy(outcome);
    try {
      await api(`/api/payments/sandbox/${id}`, { body: { outcome } });
      router.replace(`/pro/billing?paid=${id}`);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(null);
    }
  };
  return (
    <div className="mt-5 flex flex-col gap-2">
      <Button size="lg" variant="accent" loading={busy === "success"} onClick={() => go("success")}>
        Симулировать успешную оплату
      </Button>
      <Button size="lg" variant="ghost" loading={busy === "fail"} onClick={() => go("fail")}>
        Симулировать ошибку оплаты
      </Button>
    </div>
  );
}
