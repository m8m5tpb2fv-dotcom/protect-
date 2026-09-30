"use client";
import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { buttonClass, Spinner } from "../ui/button";
import { useSession } from "../layout/session-provider";
import { useToast } from "../ui/toast";

/** «Написать»: opens (or creates) the conversation with a provider. */
export function MessageButton({ providerId, orderId, compact, className, variant = "secondary", label = "Написать" }: { providerId: string; orderId?: string; compact?: boolean; className?: string; variant?: "secondary" | "surface" | "outline" | "glass"; label?: string }) {
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!user) return router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    setBusy(true);
    try {
      const r = await api<{ id: string }>("/api/conversations", { body: { providerId, orderId } });
      router.push(`/messages/${r.id}`);
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
    }
  };
  if (compact)
    return (
      <button onClick={go} disabled={busy} className={buttonClass({ variant, size: "icon-sm", className })} aria-label={label}>
        {busy ? <Spinner /> : <MessageCircle className="h-[18px] w-[18px]" />}
      </button>
    );
  return (
    <button onClick={go} disabled={busy} className={buttonClass({ variant, size: "sm", className })}>
      {busy ? <Spinner /> : <MessageCircle className="h-4 w-4" />} {label}
    </button>
  );
}
