"use client";
import { ArrowLeft, BriefcaseBusiness, Send, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError, setBearerToken } from "@/lib/api-client";
import { APP } from "@/config/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { LogoMark } from "@/components/layout/logo";
import { useTelegram } from "@/components/telegram/telegram-provider";

export function LoginForm({ next, demo, telegramBot, telegramEnabled }: { next: string; demo: boolean; telegramBot: string; telegramEnabled: boolean }) {
  const router = useRouter();
  const { isTelegram, authError } = useTelegram();
  const [tab, setTab] = useState<"phone" | "email">("phone");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [codeSent, setCodeSent] = useState<{ devCode?: string } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const done = (token?: string) => {
    if (token) setBearerToken(token);
    router.replace(next);
    router.refresh();
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await fn();
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.details)) {
        setFieldErrors(Object.fromEntries((e.details as { path: string; message: string }[]).map((d) => [d.path, d.message])));
      }
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-10 pt-[calc(var(--safe-top)+12px)] lg:pt-16">
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-10 h-72 w-72 rounded-full bg-accent opacity-30 blur-[90px]" />
      <Link href="/" className="press relative -ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2 lg:hidden" aria-label="На главную">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="relative mt-6">
        <LogoMark size={44} />
        <h1 className="display mt-6 text-[40px]">Вход в {APP.name}</h1>
        <p className="mt-2 text-[16px] text-muted">Чтобы создавать заявки, общаться с исполнителями и получать уведомления.</p>
      </div>

      {isTelegram && authError && <p className="mt-6 rounded-2xl bg-danger-soft p-4 text-[14px] text-danger">Не удалось войти через Telegram: {authError}. Войдите по телефону или email.</p>}

      <div className="relative mt-8 rounded-[28px] bg-surface p-5 shadow-card">
        <Segmented
          className="mb-5 w-full [&>*]:flex-1 [&>*]:justify-center"
          value={tab}
          onChange={(v) => (setTab(v as "phone" | "email"), setError(null))}
          items={[
            { value: "phone", label: "Телефон" },
            { value: "email", label: "Email" },
          ]}
        />
        {tab === "phone" ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!codeSent)
                run(async () => {
                  const r = await api<{ devCode?: string }>("/api/auth/phone/request", { body: { phone } });
                  setCodeSent(r);
                });
              else
                run(async () => {
                  const r = await api<{ token: string }>("/api/auth/phone/verify", { body: { phone, code, name: name || undefined } });
                  done(r.token);
                });
            }}
          >
            <Input label="Номер телефона" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 900 000-00-00" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!!codeSent} required />
            {codeSent && (
              <>
                <Input label="Код из SMS" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus error={fieldErrors.code} />
                {codeSent.devCode && (
                  <p className="rounded-2xl bg-warning-soft p-3 text-[13px] text-warning">
                    Демо-режим: SMS не отправляется. Ваш код — <b className="tabular">{codeSent.devCode}</b>
                  </p>
                )}
                <Input label="Как вас зовут" optional placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} hint="Для новых пользователей" />
              </>
            )}
            {error && <p role="alert" className="text-[14px] text-danger">{error}</p>}
            <Button type="submit" size="lg" block loading={busy}>
              {codeSent ? "Войти" : "Получить код"}
            </Button>
            {codeSent && (
              <button type="button" className="text-[14px] font-semibold text-muted hover:text-ink" onClick={() => (setCodeSent(null), setCode(""))}>
                Изменить номер
              </button>
            )}
          </form>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const r = await api<{ token: string }>(mode === "login" ? "/api/auth/login" : "/api/auth/register", { body: mode === "login" ? { email, password } : { name, email, password } });
                done(r.token);
              });
            }}
          >
            {mode === "register" && <Input label="Имя" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required error={fieldErrors.name} />}
            <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required error={fieldErrors.email} />
            <Input label="Пароль" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "register" ? 8 : 1} error={fieldErrors.password} hint={mode === "register" ? "Минимум 8 символов" : undefined} />
            {error && !Object.keys(fieldErrors).length && <p role="alert" className="text-[14px] text-danger">{error}</p>}
            <Button type="submit" size="lg" block loading={busy}>
              {mode === "login" ? "Войти" : "Создать аккаунт"}
            </Button>
            <button type="button" className="text-[14px] font-semibold text-muted hover:text-ink" onClick={() => (setMode(mode === "login" ? "register" : "login"), setError(null))}>
              {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
            </button>
          </form>
        )}
      </div>

      {!isTelegram && (
        <div className="relative mt-4 flex items-center gap-3 rounded-[24px] bg-surface p-4 shadow-soft">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2AABEE] text-white">
            <Send className="h-5 w-5 -translate-x-px" />
          </span>
          <p className="flex-1 text-[14px] text-ink-2">
            {telegramBot && telegramEnabled ? (
              <>
                Откройте нас в Telegram — вход произойдёт автоматически.{" "}
                <a className="font-semibold text-ink underline" href={`https://t.me/${telegramBot}/${APP.telegramAppName}`} target="_blank" rel="noopener noreferrer">
                  Открыть @{telegramBot}
                </a>
              </>
            ) : (
              "В Telegram Mini App вход происходит автоматически — без паролей и кодов."
            )}
          </p>
        </div>
      )}

      {demo && (
        <div className="relative mt-6">
          <p className="mb-2 text-center text-[13px] font-semibold uppercase tracking-wide text-muted">Демо-аккаунты</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="surface" loading={busy} onClick={() => run(async () => done((await api<{ token: string }>("/api/auth/demo", { body: { as: "client" } })).token))}>
              <UserRound className="h-4 w-4" /> Клиент
            </Button>
            <Button variant="surface" loading={busy} onClick={() => run(async () => done((await api<{ token: string }>("/api/auth/demo", { body: { as: "provider" } })).token))}>
              <BriefcaseBusiness className="h-4 w-4" /> Исполнитель
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
