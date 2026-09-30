"use client";
/* eslint-disable @next/next/no-img-element */
import { Camera, Check, MessageCircle, Star, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, uploadFile } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { pl, rating as fmtRating, relative, rub } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonClass, Spinner } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { VerifiedMark } from "@/components/ui/verified";
import { StatusDot } from "@/components/ui/badge";
import { useTelegram } from "@/components/telegram/telegram-provider";
import { MessageButton } from "@/components/domain/message-button";

function useAction(orderId: string) {
  const router = useRouter();
  const toast = useToast();
  const { haptic } = useTelegram();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, payload: Record<string, unknown>, success: string) => {
    setBusy(key);
    try {
      await api(`/api/orders/${orderId}/action`, { body: payload });
      haptic("success");
      toast(success);
      router.refresh();
    } catch (e) {
      haptic("error");
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

export type ResponseItem = {
  id: string;
  message: string;
  price: number | null;
  eta: string | null;
  status: string;
  createdAt: string | Date;
  providerId: string;
  providerSlug: string;
  providerName: string;
  providerAvatar: string | null;
  providerRating: number;
  providerReviews: number;
  providerOrders: number;
  providerVerification: "none" | "verified" | "pro" | "business";
  providerAvailable: boolean;
  providerHeadline: string;
};

export function ResponsesList({ orderId, responses, canChoose }: { orderId: string; responses: ResponseItem[]; canChoose: boolean }) {
  const { busy, run } = useAction(orderId);
  const [confirm, setConfirm] = useState<ResponseItem | null>(null);
  return (
    <>
      <ul className="flex flex-col gap-3">
        {responses.map((r) => (
          <li key={r.id} className={cn("rounded-[26px] bezel p-4", r.status === "accepted" && "ring-2 ring-accent", r.status === "declined" && "opacity-60")}>
            <div className="flex items-start gap-3">
              <Link href={`/provider/${r.providerSlug}`}>
                <Avatar name={r.providerName} src={r.providerAvatar} size={52} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/provider/${r.providerSlug}`} className="flex items-center gap-1.5 text-[16px] font-semibold hover:underline">
                  <span className="truncate">{r.providerName}</span>
                  <VerifiedMark level={r.providerVerification} size={13} />
                </Link>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
                  <span className="inline-flex items-center gap-1 font-semibold text-ink">
                    <Star className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
                    {r.providerReviews ? fmtRating(r.providerRating) : "новый"}
                  </span>
                  <span>{pl(r.providerReviews, ["отзыв", "отзыва", "отзывов"])}</span>
                  <span>· {pl(r.providerOrders, ["заказ", "заказа", "заказов"])}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[18px] font-semibold tracking-[-0.02em] tabular">{r.price != null ? rub(r.price) : "—"}</p>
                {r.eta && <p className="text-[12.5px] text-muted">{r.eta}</p>}
              </div>
            </div>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{r.message}</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
                <StatusDot online={r.providerAvailable} /> {relative(r.createdAt)}
              </span>
              <div className="flex gap-2">
                <MessageButton providerId={r.providerId} orderId={orderId} />
                {canChoose && r.status === "pending" && (
                  <Button size="sm" variant="accent" onClick={() => setConfirm(r)}>
                    Выбрать
                  </Button>
                )}
                {r.status === "accepted" && (
                  <span className="inline-flex h-9 items-center gap-1 rounded-xl bg-accent px-3 text-[13px] font-semibold text-accent-ink">
                    <Check className="h-4 w-4" /> Выбран
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <Sheet
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Выбрать исполнителя?"
        footer={
          <Button block size="lg" variant="accent" loading={busy === "choose"} onClick={async () => (await run("choose", { action: "choose", responseId: confirm!.id }, "Исполнитель выбран — он получил уведомление"), setConfirm(null))}>
            Выбрать {confirm?.providerName.split(" ")[0]}
          </Button>
        }
      >
        {confirm && (
          <p className="text-[15px] leading-relaxed text-ink-2">
            {confirm.providerName} получит ваш адрес и контакты. Остальные отклики будут закрыты. Цена по отклику: <b className="text-ink">{confirm.price != null ? rub(confirm.price) : "по договорённости"}</b>. Оплата — напрямую исполнителю после выполнения.
          </p>
        )}
      </Sheet>
    </>
  );
}

export function RespondForm({ orderId, budget }: { orderId: string; budget: number | null }) {
  const [message, setMessage] = useState("");
  const [price, setPrice] = useState(budget ? String(budget) : "");
  const [eta, setEta] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const { haptic } = useTelegram();
  return (
    <form
      className="flex flex-col gap-3 rounded-[26px] bezel p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api(`/api/orders/${orderId}/respond`, { body: { message, price: price ? Number(price) : null, eta: eta || null } });
          haptic("success");
          toast("Отклик отправлен клиенту");
          router.refresh();
        } catch (err) {
          haptic("error");
          toast((err as Error).message, "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="title text-[20px]">Откликнуться</h2>
      <Textarea label="Сообщение клиенту" rows={4} required minLength={5} maxLength={1500} placeholder="Когда сможете приехать, что понадобится, как рассчитываете цену" value={message} onChange={(e) => setMessage(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Цена, ₽" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="1500" />
        <Input label="Когда" value={eta} onChange={(e) => setEta(e.target.value)} placeholder="Сегодня 18:00" maxLength={60} />
      </div>
      <Button type="submit" size="lg" variant="accent" loading={busy}>
        Отправить отклик
      </Button>
      <p className="text-[12.5px] text-muted">Контакты клиента откроются, когда он выберет вас.</p>
    </form>
  );
}

export function OrderActions({ orderId, role, status, isDirectToMe, isAssignedToMe, agreedPrice }: { orderId: string; role: string; status: string; isDirectToMe: boolean; isAssignedToMe: boolean; agreedPrice: number | null }) {
  const { busy, run } = useAction(orderId);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [finalPrice, setFinalPrice] = useState(agreedPrice ? String(agreedPrice) : "");
  const buttons: React.ReactNode[] = [];

  if (isDirectToMe && status === "new") {
    buttons.push(
      <Button key="accept" size="lg" variant="accent" loading={busy === "accept"} onClick={() => run("accept", { action: "accept" }, "Заказ принят")}>
        Принять заказ
      </Button>,
      <Button key="decline" size="lg" variant="secondary" loading={busy === "decline"} onClick={() => run("decline", { action: "decline" }, "Заказ передан другим исполнителям")}>
        Не смогу
      </Button>,
    );
  }
  if (isAssignedToMe && status === "assigned")
    buttons.push(
      <Button key="start" size="lg" variant="primary" loading={busy === "start"} onClick={() => run("start", { action: "start" }, "Статус: в работе")}>
        Приступить к работе
      </Button>,
    );
  if ((isAssignedToMe || role === "client") && (status === "assigned" || status === "in_progress"))
    buttons.push(
      <Button key="complete" size="lg" variant="accent" onClick={() => setCompleteOpen(true)}>
        {role === "client" ? "Подтвердить выполнение" : "Завершить заказ"}
      </Button>,
    );
  if ((role === "client" && !["completed", "cancelled"].includes(status)) || (isAssignedToMe && (status === "assigned" || status === "in_progress")))
    buttons.push(
      <Button key="cancel" size="lg" variant="ghost" onClick={() => setCancelOpen(true)}>
        {role === "client" ? "Отменить заказ" : "Отказаться от заказа"}
      </Button>,
    );
  if (!buttons.length) return null;

  return (
    <>
      <div className="flex flex-col gap-2">{buttons}</div>
      <Sheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={role === "client" ? "Отменить заказ?" : "Отказаться от заказа?"}
        footer={
          <Button block size="lg" variant="danger" loading={busy === "cancel"} onClick={async () => (await run("cancel", { action: "cancel", reason: reason || undefined }, role === "client" ? "Заказ отменён" : "Вы отказались от заказа"), setCancelOpen(false))}>
            {role === "client" ? "Отменить" : "Отказаться"}
          </Button>
        }
      >
        <Textarea label="Причина" optional rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder={role === "client" ? "Например: уже не актуально" : "Например: не успеваю по времени"} />
        {role !== "client" && <p className="mt-3 text-[13px] text-muted">Заявка снова станет доступна другим исполнителям.</p>}
      </Sheet>
      <Sheet
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        title="Работа выполнена?"
        footer={
          <Button block size="lg" variant="accent" loading={busy === "complete"} onClick={async () => (await run("complete", { action: "complete", finalPrice: finalPrice ? Number(finalPrice) : null }, "Заказ завершён"), setCompleteOpen(false))}>
            Да, завершить
          </Button>
        }
      >
        <Input label="Итоговая стоимость, ₽" inputMode="numeric" value={finalPrice} onChange={(e) => setFinalPrice(e.target.value.replace(/\D/g, "").slice(0, 8))} hint="Для истории заказа. Оплата — напрямую исполнителю, платформа комиссию не берёт." />
      </Sheet>
    </>
  );
}

export function ReviewForm({ orderId, providerName }: { orderId: string; providerName: string }) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();
  const { haptic } = useTelegram();
  const labels = ["", "Плохо", "Так себе", "Нормально", "Хорошо", "Отлично"];
  return (
    <section id="review" className="scroll-mt-24 rounded-[28px] bg-inverse p-5 text-inverse-ink md:p-6">
      <h2 className="title text-[22px]">Как всё прошло?</h2>
      <p className="mt-1 text-[14.5px] opacity-70">Оцените работу: {providerName}. Отзыв увидят другие клиенты.</p>
      <div className="mt-4 flex items-center gap-1" role="radiogroup" aria-label="Оценка">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} role="radio" aria-checked={rating === i} aria-label={`${i} из 5`} onClick={() => (setRating(i), haptic("light"))} className="press p-1">
            <Star className={cn("h-9 w-9 transition-colors", i <= rating ? "fill-accent text-accent" : "text-white/30 dark:text-black/25")} strokeWidth={1.5} />
          </button>
        ))}
        <span className="ml-2 text-[15px] font-semibold">{labels[rating]}</span>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} placeholder="Что понравилось, что можно улучшить" aria-label="Текст отзыва" className="mt-4 w-full resize-none rounded-2xl bg-white/10 p-4 text-[15px] outline-none placeholder:text-current placeholder:opacity-50 focus:bg-white/15 dark:bg-black/5" />
      <div className="mt-3 flex flex-wrap gap-2">
        {photos.map((p) => (
          <div key={p} className="relative h-16 w-16 overflow-hidden rounded-xl">
            <img src={p} alt="" className="h-full w-full object-cover" />
            <button onClick={() => setPhotos(photos.filter((x) => x !== p))} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-1 text-white" aria-label="Удалить">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {photos.length < 6 && (
          <button onClick={() => fileRef.current?.click()} className="press inline-flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-current opacity-60 hover:opacity-100" aria-label="Добавить фото">
            {uploading ? <Spinner /> : <Camera className="h-5 w-5" />}
          </button>
        )}
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
              const r = await uploadFile(f, "review");
              setPhotos((p) => [...p, r.url]);
            } catch (err) {
              toast((err as Error).message, "error");
            } finally {
              setUploading(false);
            }
          }}
        />
      </div>
      <Button
        className="mt-4"
        block
        size="lg"
        variant="accent"
        disabled={!rating}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api(`/api/orders/${orderId}/review`, { body: { rating, text, photos } });
            haptic("success");
            toast("Спасибо за отзыв!");
            router.refresh();
          } catch (e) {
            toast((e as Error).message, "error");
            setBusy(false);
          }
        }}
      >
        Отправить отзыв
      </Button>
    </section>
  );
}

export function ChatLink({ conversationId, label = "Открыть чат" }: { conversationId: string; label?: string }) {
  return (
    <Link href={`/messages/${conversationId}`} className={buttonClass({ variant: "secondary", size: "lg", block: true })}>
      <MessageCircle className="h-5 w-5" /> {label}
    </Link>
  );
}
