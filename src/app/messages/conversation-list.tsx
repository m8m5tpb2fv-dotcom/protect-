"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { relative } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty";

export type Conv = { id: string; asRole: "client" | "provider"; peerName: string; peerAvatar: string | null; orderTitle: string | null; lastMessageAt: string | Date; lastMessagePreview: string; unread: number };

export function ConversationList({ initial }: { initial: Conv[] }) {
  const pathname = usePathname();
  const [items, setItems] = useState(initial);
  const activeId = pathname.split("/")[2];
  useEffect(() => {
    const load = () => api<{ conversations: Conv[] }>("/api/conversations").then((r) => setItems(r.conversations)).catch(() => {});
    const t = setInterval(() => document.visibilityState === "visible" && load(), 12000);
    load();
    return () => clearInterval(t);
  }, [pathname]);

  return (
    <div className={cn("min-w-0", activeId ? "hidden lg:block" : "block")}>
      <h1 className="display mb-4 px-1 text-[36px] lg:text-[34px]">Сообщения</h1>
      {items.length === 0 ? (
        <EmptyState icon={MessagesSquare} title="Пока нет диалогов" text="Напишите исполнителю из его профиля или откликнитесь на заявку — переписка появится здесь." />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((c) => (
            <li key={c.id}>
              <Link href={`/messages/${c.id}`} aria-current={activeId === c.id ? "page" : undefined} className={cn("press flex items-center gap-3 rounded-[22px] p-3", activeId === c.id ? "bg-surface shadow-card" : "hover:bg-surface/70")}>
                <Avatar name={c.peerName} src={c.peerAvatar} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[15.5px] font-semibold">{c.peerName}</p>
                    <span className="shrink-0 text-[12px] text-muted">{relative(c.lastMessageAt)}</span>
                  </div>
                  {c.orderTitle && <p className="truncate text-[12.5px] font-medium text-ink-2">{c.asRole === "provider" ? "Клиент · " : ""}{c.orderTitle}</p>}
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn("truncate text-[14px]", c.unread ? "font-medium text-ink" : "text-muted")}>{c.lastMessagePreview || "Нет сообщений"}</p>
                    {c.unread > 0 && <span className="min-w-[20px] rounded-full bg-accent px-1.5 text-center text-[11.5px] font-semibold leading-5 text-accent-ink tabular">{c.unread}</span>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
