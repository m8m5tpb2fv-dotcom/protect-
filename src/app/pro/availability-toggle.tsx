"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { useTelegram } from "@/components/telegram/telegram-provider";

export function AvailabilityToggle({ initial, disabled }: { initial: boolean; disabled?: boolean }) {
  const [on, setOn] = useState(initial);
  const router = useRouter();
  const toast = useToast();
  const { haptic } = useTelegram();
  return (
    <Switch
      label={on ? "Свободен — принимаю заказы" : "Занят"}
      description={on ? "Клиенты видят зелёный статус и чаще выбирают вас" : "Вы не показываетесь в фильтре «Свободны сейчас»"}
      checked={on}
      disabled={disabled}
      onChange={async (v) => {
        setOn(v);
        haptic("select");
        try {
          await api("/api/provider/availability", { body: { isAvailable: v } });
          router.refresh();
        } catch (e) {
          setOn(!v);
          toast((e as Error).message, "error");
        }
      }}
    />
  );
}
