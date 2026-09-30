"use client";
import { Camera, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, uploadFile } from "@/lib/api-client";
import { formatPhone } from "@/lib/phone";
import { Avatar } from "@/components/ui/avatar";
import { Button, Spinner } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { useTelegram } from "@/components/telegram/telegram-provider";

type U = { name: string; avatarUrl: string | null; districtId: number | null; notifyEmail: boolean; notifyTelegram: boolean; email: string | null; phone: string | null; telegramUsername: string | null; hasTelegram: boolean };

export function SettingsForm({ user, districts, telegramBot }: { user: U; districts: { id: number; name: string }[]; telegramBot: string }) {
  const [f, setF] = useState(user);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();
  const { webApp } = useTelegram();
  const save = async (patch: Partial<U>, silent = false) => {
    try {
      await api("/api/me", { method: "PATCH", body: patch });
      if (!silent) toast("Сохранено");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <>
      <section className="rounded-[28px] bezel p-5">
        <div className="flex items-center gap-4">
          <button onClick={() => fileRef.current?.click()} className="press relative rounded-full" aria-label="Изменить фото">
            <Avatar name={f.name} src={f.avatarUrl} size={80} />
            <span className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink text-bg ring-4 ring-surface">{uploading ? <Spinner /> : <Camera className="h-4 w-4" />}</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setUploading(true);
              try {
                const r = await uploadFile(file, "avatar");
                setF((x) => ({ ...x, avatarUrl: r.url }));
                await save({ avatarUrl: r.url });
              } catch (err) {
                toast((err as Error).message, "error");
              } finally {
                setUploading(false);
              }
            }}
          />
          <div className="text-[14px] text-muted">
            {user.email && <p>{user.email}</p>}
            {user.phone && <p>{formatPhone(user.phone)}</p>}
            {user.telegramUsername && <p>Telegram: @{user.telegramUsername}</p>}
          </div>
        </div>
        <form
          className="mt-5 flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await save({ name: f.name, districtId: f.districtId });
            setBusy(false);
          }}
        >
          <Input label="Имя" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={60} required minLength={2} />
          <Select label="Мой район" value={f.districtId ?? ""} onChange={(e) => setF({ ...f, districtId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Не выбран</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Button type="submit" loading={busy}>
            Сохранить
          </Button>
        </form>
      </section>

      <section className="mt-3 rounded-[28px] bezel p-5">
        <h2 className="mb-2 text-[15px] font-semibold">Уведомления</h2>
        <Switch label="В Telegram" description={user.hasTelegram ? "Отклики, сообщения, статусы заказов" : "Откройте приложение через Telegram-бота, чтобы подключить"} checked={f.notifyTelegram} disabled={!user.hasTelegram} onChange={(v) => (setF({ ...f, notifyTelegram: v }), save({ notifyTelegram: v }, true))} />
        <Switch className="mt-2" label="На email" description={user.email ? "Важные события: выбор исполнителя, модерация, оплаты" : "Email не указан"} checked={f.notifyEmail} disabled={!user.email} onChange={(v) => (setF({ ...f, notifyEmail: v }), save({ notifyEmail: v }, true))} />
        {webApp?.requestWriteAccess && (
          <Button variant="secondary" className="mt-4" block onClick={() => webApp.requestWriteAccess!((ok) => toast(ok ? "Бот сможет присылать уведомления" : "Разрешение не выдано", ok ? "success" : "info"))}>
            <Send className="h-4 w-4" /> Разрешить сообщения от бота
          </Button>
        )}
        {!user.hasTelegram && telegramBot && (
          <a href={`https://t.me/${telegramBot}`} target="_blank" rel="noopener noreferrer" className="mt-4 block text-[14px] font-semibold underline">
            Открыть @{telegramBot}
          </a>
        )}
      </section>
    </>
  );
}
