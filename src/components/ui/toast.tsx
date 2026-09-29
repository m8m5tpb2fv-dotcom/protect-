"use client";
import { Check, CircleAlert, Info } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };
const Ctx = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s.slice(-2), { id, message, tone }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+12px)] z-[100] flex flex-col items-center gap-2 px-4">
        {items.map((t) => {
          const Icon = t.tone === "error" ? CircleAlert : t.tone === "info" ? Info : Check;
          return (
            <div key={t.id} role={t.tone === "error" ? "alert" : "status"} className="pointer-events-auto flex min-h-[56px] max-w-md items-center gap-3 rounded-full border border-white/10 bg-[#0b0b0c] py-2 pl-5 pr-2 text-[14.5px] font-medium text-white shadow-float animate-pop">
              <span className="flex-1">{t.message}</span>
              <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2", t.tone === "error" ? "border-danger text-danger" : t.tone === "success" ? "border-success text-success" : "border-white/30 text-white/80")}>
                <Icon className="h-5 w-5" strokeWidth={2.2} />
              </span>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
