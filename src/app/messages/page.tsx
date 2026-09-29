import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";

export const metadata: Metadata = { title: "Сообщения", robots: { index: false } };

export default function MessagesIndex() {
  return (
    <div className="hidden h-[calc(100dvh-140px)] flex-col items-center justify-center rounded-[28px] bg-surface text-center shadow-card lg:flex">
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-surface-2">
        <MessageCircle className="h-7 w-7" />
      </span>
      <p className="title mt-4 text-[20px]">Выберите диалог</p>
      <p className="mt-1 text-[15px] text-muted">Переписка с исполнителями и клиентами</p>
    </div>
  );
}
