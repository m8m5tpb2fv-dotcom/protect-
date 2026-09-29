"use client";
/* eslint-disable @next/next/no-img-element */
import { ArrowLeft, ArrowUp, Check, CheckCheck, ChevronRight, ImagePlus, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, uploadFile } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { dateShort, ORDER_STATUS, time } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/components/layout/session-provider";
import { useTelegram } from "@/components/telegram/telegram-provider";

type Msg = { id: string; senderId: string | null; body: string; kind: string; attachments: { url: string; width?: number; height?: number }[] | null; createdAt: string; readAt: string | null; pending?: boolean; failed?: boolean };

export function ChatThread({ conversationId, me, peer, order, asRole, initial }: { conversationId: string; me: string; peer: { name: string; avatar: string | null; slug: string | null }; order: { id: string; title: string | null; status: string | null } | null; asRole: "client" | "provider"; initial: Msg[] }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const toast = useToast();
  const { refreshCounts } = useSession();
  const { isTelegram, haptic } = useTelegram();
  const atBottom = useRef(true);

  const scrollDown = useCallback((smooth = false) => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);
  useLayoutEffect(() => scrollDown(), [scrollDown]);
  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  // polling for new messages + read receipts
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const last = [...msgs].reverse().find((m) => !m.pending);
      try {
        const r = await api<{ messages: Msg[]; readIds: string[] }>(`/api/conversations/${conversationId}/messages${last ? `?after=${encodeURIComponent(last.createdAt)}` : ""}`);
        if (stop) return;
        const read = new Set(r.readIds);
        setMsgs((cur) => {
          const ids = new Set(cur.map((m) => m.id));
          const fresh = r.messages.filter((m) => !ids.has(m.id));
          if (fresh.length && atBottom.current) setTimeout(() => scrollDown(true), 30);
          if (fresh.some((m) => m.senderId !== me)) haptic("light");
          return [...cur.map((m) => (read.has(m.id) && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m)), ...fresh];
        });
      } catch {}
    };
    const id = setInterval(tick, 3000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [conversationId, msgs, me, scrollDown, haptic]);

  const send = async (body: string, attachments: Msg["attachments"] = []) => {
    const tmp: Msg = { id: `tmp-${Date.now()}`, senderId: me, body, kind: "text", attachments, createdAt: new Date().toISOString(), readAt: null, pending: true };
    setMsgs((m) => [...m, tmp]);
    setTimeout(() => scrollDown(true), 20);
    try {
      const r = await api<{ message: Msg }>(`/api/conversations/${conversationId}/messages`, { body: { body, attachments } });
      setMsgs((m) => m.map((x) => (x.id === tmp.id ? { ...r.message, createdAt: new Date(r.message.createdAt).toISOString() } : x)));
      haptic("light");
    } catch (e) {
      setMsgs((m) => m.map((x) => (x.id === tmp.id ? { ...x, pending: false, failed: true } : x)));
      toast((e as Error).message, "error");
    }
  };

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    if (taRef.current) taRef.current.style.height = "";
    send(body);
  };

  const days = msgs.map((m) => dateShort(m.createdAt));
  return (
    <section className="fixed inset-0 z-50 flex flex-col bg-bg lg:static lg:z-auto lg:h-[calc(100dvh-140px)] lg:overflow-hidden lg:rounded-[28px] lg:bg-surface lg:shadow-card">
      <header className="glass flex items-center gap-3 border-x-0 border-t-0 px-3 pb-2.5 pt-[calc(var(--safe-top)+8px)] lg:bg-surface lg:pt-3">
        {!isTelegram && (
          <button onClick={() => router.push("/messages")} className="press inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2 lg:hidden" aria-label="Назад к диалогам">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <Avatar name={peer.name} src={peer.avatar} size={42} />
        <div className="min-w-0 flex-1">
          {peer.slug ? (
            <Link href={`/provider/${peer.slug}`} className="block truncate text-[16px] font-semibold hover:underline">
              {peer.name}
            </Link>
          ) : (
            <p className="truncate text-[16px] font-semibold">{peer.name}</p>
          )}
          <p className="truncate text-[12.5px] text-muted">{asRole === "client" ? "Исполнитель" : "Клиент"}</p>
        </div>
      </header>
      {order && (
        <Link href={`/orders/${order.id}`} className="flex items-center gap-2 border-b border-line bg-surface/60 px-4 py-2.5 text-[13.5px] hover:bg-surface">
          <span className="text-muted">Заказ:</span>
          <span className="flex-1 truncate font-semibold">{order.title}</span>
          {order.status && <span className="text-[12px] text-muted">{ORDER_STATUS[order.status]?.label}</span>}
          <ChevronRight className="h-4 w-4 text-muted" />
        </Link>
      )}

      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 md:px-6"
        role="log"
        aria-live="polite"
        aria-label="Сообщения"
      >
        {msgs.length === 0 && <p className="mt-10 text-center text-[14px] text-muted">Напишите первое сообщение — например, уточните детали задачи.</p>}
        {msgs.map((m, i) => {
          const mine = m.senderId === me;
          const day = days[i];
          const showDay = i === 0 || day !== days[i - 1];
          const prev = msgs[i - 1];
          const grouped = prev && prev.senderId === m.senderId && !showDay;
          return (
            <Fragment key={m.id}>
              {showDay && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-surface-2 px-3 py-1 text-[12px] font-semibold text-muted">{day}</span>
                </div>
              )}
              <div className={cn("flex", mine ? "justify-end" : "justify-start", grouped ? "mt-1" : "mt-3")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-[22px] px-3.5 py-2.5 text-[15px] leading-snug shadow-soft animate-pop md:max-w-[65%]",
                    mine ? "rounded-br-lg bg-ink text-bg" : "rounded-bl-lg bg-surface text-ink lg:bg-surface-2",
                    m.failed && "opacity-60 ring-2 ring-danger",
                  )}
                >
                  {m.attachments?.map((a) => (
                    <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" className="mb-1.5 block overflow-hidden rounded-2xl">
                      <img src={a.url} alt="Фото" className="max-h-72 w-full object-cover" loading="lazy" />
                    </a>
                  ))}
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                  <span className={cn("mt-1 flex items-center justify-end gap-1 text-[11px]", mine ? "text-bg/60" : "text-muted")}>
                    {time(m.createdAt)}
                    {mine && (m.pending ? <Loader2 className="h-3 w-3 animate-spin" /> : m.readAt ? <CheckCheck className="h-3.5 w-3.5 text-accent dark:text-ink" aria-label="Прочитано" /> : <Check className="h-3.5 w-3.5" aria-label="Отправлено" />)}
                  </span>
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2 border-t border-line bg-bg px-3 pb-[max(10px,var(--safe-bottom))] pt-2.5 lg:bg-surface"
      >
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Прикрепить фото">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setUploading(true);
            try {
              const r = await uploadFile(f, "chat");
              await send("", [{ url: r.url, width: r.width, height: r.height }]);
            } catch (err) {
              toast((err as Error).message, "error");
            } finally {
              setUploading(false);
            }
          }}
        />
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(140, e.target.scrollHeight)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder="Сообщение"
          aria-label="Сообщение"
          className="max-h-[140px] min-h-11 flex-1 resize-none rounded-[22px] bg-surface-2 px-4 py-[11px] text-[15px] outline-none focus:ring-2 focus:ring-ink"
        />
        <button type="submit" disabled={!text.trim()} className="press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink disabled:bg-surface-3 disabled:text-muted" aria-label="Отправить">
          <ArrowUp className="h-5 w-5" strokeWidth={2.4} />
        </button>
      </form>
    </section>
  );
}
