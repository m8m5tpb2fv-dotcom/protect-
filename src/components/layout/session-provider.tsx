"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";

export type SessionUser = {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: "user" | "moderator" | "admin";
  provider: { id: string; slug: string; status: string; displayName: string; isAvailable: boolean } | null;
} | null;

type Counts = { unreadNotifications: number; unreadMessages: number };
type Ctx = { user: SessionUser; counts: Counts; refreshCounts: () => void; city: { slug: string; name: string; nameIn: string }; demoMode: boolean };

const SessionCtx = createContext<Ctx>({
  user: null,
  counts: { unreadNotifications: 0, unreadMessages: 0 },
  refreshCounts: () => {},
  city: { slug: "saratov", name: "Саратов", nameIn: "в Саратове" },
  demoMode: false,
});
export const useSession = () => useContext(SessionCtx);

export function SessionProvider({ user, initialCounts, city, demoMode, children }: { user: SessionUser; initialCounts: Counts; city: Ctx["city"]; demoMode: boolean; children: ReactNode }) {
  const [counts, setCounts] = useState(initialCounts);
  const [seen, setSeen] = useState(initialCounts);
  if (seen !== initialCounts) {
    // server re-render delivered fresh counts
    setSeen(initialCounts);
    setCounts(initialCounts);
  }

  const refreshCounts = useCallback(() => {
    if (!user) return;
    api<Counts>("/api/me/summary")
      .then(setCounts)
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refreshCounts();
    }, 25_000);
    const onFocus = () => refreshCounts();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, refreshCounts]);

  return <SessionCtx.Provider value={{ user, counts, refreshCounts, city, demoMode }}>{children}</SessionCtx.Provider>;
}
