"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

export function SupportForm({ needEmail }: { needEmail: boolean }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  return (
    <form
      className="mt-6 flex flex-col gap-4 rounded-[28px] bg-surface p-5 shadow-card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api("/api/support", { body: { subject, body, email: email || undefined } });
          toast("Обращение отправлено. Ответим в течение дня.");
          setSubject("");
          setBody("");
          router.refresh();
        } catch (err) {
          toast((err as Error).message, "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="title text-[20px]">Написать в поддержку</h2>
      <Input label="Тема" value={subject} onChange={(e) => setSubject(e.target.value)} required minLength={3} maxLength={120} />
      <Textarea label="Сообщение" value={body} onChange={(e) => setBody(e.target.value)} required minLength={10} maxLength={4000} rows={5} />
      {needEmail && <Input label="Email для ответа" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
      <Button type="submit" loading={busy} size="lg">
        Отправить
      </Button>
    </form>
  );
}
