import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <span className="inline-flex h-20 w-20 items-center justify-center rounded-[28px] bg-accent text-accent-ink">
        <Compass className="h-9 w-9" strokeWidth={1.6} />
      </span>
      <p className="display mt-8 text-[72px] text-muted/40">404</p>
      <h1 className="title -mt-2 text-[28px]">Такой страницы нет</h1>
      <p className="mt-2 text-[16px] text-muted">Возможно, ссылка устарела или исполнитель скрыл профиль.</p>
      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Link href="/" className={buttonClass({ variant: "primary", size: "lg" })}>
          На главную
        </Link>
        <Link href="/search" className={buttonClass({ variant: "secondary", size: "lg" })}>
          Найти специалиста
        </Link>
      </div>
    </main>
  );
}
