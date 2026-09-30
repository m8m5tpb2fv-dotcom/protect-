"use client";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

type Pending = { id: string; url: string; expiresAt: number };

/**
 * «Войти через Telegram»: opens the bot with a one-time link and waits (polling) until the user
 * confirms inside Telegram. The session is issued only to this browser (nonce cookie set by /start).
 */
export function TelegramLogin({ bot, onDone }: { bot: string; onDone: (token?: string) => void }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [state, setState] = useState<"idle" | "starting" | "waiting" | "expired" | "rejected">("idle");
  const [error, setError] = useState<string | null>(null);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    if (!pending) return;
    let stop = false;
    const check = async () => {
      if (stop) return;
      if (Date.now() > pending.expiresAt) {
        setState("expired");
        return;
      }
      try {
        const r = await api<{ status: string; token?: string }>(`/api/auth/telegram-login/${pending.id}`, { method: "POST" });
        if (stop) return;
        if (r.status === "ok") {
          stop = true;
          doneRef.current(r.token);
        } else if (r.status === "expired" || r.status === "rejected") {
          stop = true;
          setState(r.status);
        }
      } catch (e) {
        stop = true;
        setError((e as Error).message);
        setState("idle");
      }
    };
    const timer = window.setInterval(check, 2000);
    // coming back from the Telegram app → check right away
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pending]);

  const start = async () => {
    setError(null);
    setState("starting");
    // open the window synchronously (inside the click) so popup blockers allow it; navigate it once the link is ready
    const win = window.open("", "_blank");
    try {
      const r = await api<{ id: string; url: string; expiresAt: string }>("/api/auth/telegram-login/start", { method: "POST" });
      setPending({ id: r.id, url: r.url, expiresAt: new Date(r.expiresAt).getTime() });
      setState("waiting");
      if (win) {
        win.opener = null; // the bot page must not be able to reach back into this tab
        win.location.href = r.url;
      }
      else window.location.href = r.url;
    } catch (e) {
      win?.close();
      setError((e as Error).message);
      setState("idle");
    }
  };

  if (state === "waiting" && pending)
    return (
      <div className="rounded-[24px] bezel p-4 text-center" aria-live="polite">
        <p className="text-[15px] font-semibold">Подтвердите вход в Telegram</p>
        <p className="mt-1 text-[13.5px] text-muted">
          В чате с @{bot} нажмите «Старт», а затем «✅ Войти». Эта страница обновится сама.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <a href={pending.url} target="_blank" rel="noopener noreferrer" className="press inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#2AABEE] text-[15px] font-semibold text-white">
            <Send className="h-4 w-4" /> Открыть Telegram ещё раз
          </a>
          <button type="button" className="text-[13.5px] font-semibold text-muted hover:text-ink" onClick={() => (setPending(null), setState("idle"))}>
            Отмена
          </button>
        </div>
      </div>
    );

  return (
    <div>
      <Button size="lg" variant="secondary" block loading={state === "starting"} onClick={start} className="!bg-[#2AABEE] !text-white hover:!bg-[#229ED9]">
        <Send className="h-5 w-5" /> Войти через Telegram
      </Button>
      {(state === "expired" || state === "rejected" || error) && (
        <p role="alert" className="mt-2 text-center text-[13.5px] text-danger">
          {error ?? (state === "rejected" ? "Вход отклонён в Telegram." : "Время на подтверждение вышло — нажмите кнопку ещё раз.")}
        </p>
      )}
    </div>
  );
}
