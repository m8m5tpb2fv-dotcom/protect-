"use client";
import { RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonClass } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <span className="inline-flex h-20 w-20 items-center justify-center rounded-[28px] bg-danger-soft text-danger">
        <TriangleAlert className="h-9 w-9" strokeWidth={1.6} />
      </span>
      <h1 className="title mt-8 text-[28px]">{offline ? "Нет соединения" : "Что-то пошло не так"}</h1>
      <p className="mt-2 text-[16px] text-muted">{offline ? "Проверьте интернет и попробуйте снова." : "Мы уже знаем об ошибке. Попробуйте обновить страницу."}</p>
      {error.digest && <p className="mt-2 font-mono text-[12px] text-muted">Код: {error.digest}</p>}
      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Button size="lg" onClick={reset}>
          <RefreshCw className="h-4 w-4" /> Повторить
        </Button>
        <Link href="/" className={buttonClass({ variant: "secondary", size: "lg" })}>
          На главную
        </Link>
      </div>
    </main>
  );
}
