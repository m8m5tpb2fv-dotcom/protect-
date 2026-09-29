"use client";
import { CheckCircle2, CircleAlert, Info } from "lucide-react";
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
          const Icon = t.tone === "error" ? CircleAlert : t.tone === "info" ? Info : CheckCircle2;
          return (
            <div key={t.id} role={t.tone === "error" ? "alert" : "status"} className={cn("pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl bg-inverse px-4 py-3 text-[14px] font-medium text-inverse-ink shadow-float animate-pop")}>
              <Icon className={cn("h-[18px] w-[18px] shrink-0", t.tone === "error" ? "text-danger" : t.tone === "success" ? "text-accent" : "")} />
              {t.message}
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
