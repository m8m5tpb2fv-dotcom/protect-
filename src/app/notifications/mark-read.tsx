"use client";
import { CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/lib/api-client";
import { useSession } from "@/components/layout/session-provider";

/** Marks everything read after a short delay (so the user sees what was new) and via the button. */
export function MarkRead() {
  const router = useRouter();
  const { refreshCounts } = useSession();
  const run = async () => {
    await api("/api/notifications/read", { body: {} }).catch(() => {});
    refreshCounts();
    router.refresh();
  };
  useEffect(() => {
    const t = setTimeout(run, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <button onClick={run} className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[13.5px] font-semibold hover:bg-surface-3">
      <CheckCheck className="h-4 w-4" /> Прочитать все
    </button>
  );
}
