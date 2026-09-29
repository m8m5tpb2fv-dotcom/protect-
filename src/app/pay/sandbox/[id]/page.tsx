import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { FlaskConical } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { payments } from "@/server/db/schema";
import { getProduct } from "@/server/payments";
import { rub } from "@/lib/format";
import { SandboxButtons } from "./buttons";

export const metadata: Metadata = { title: "Тестовая оплата", robots: { index: false } };

/** Sandbox checkout. Clearly labelled as TEST — never presented as a real payment. */
export default async function SandboxPay({ params }: PageProps<"/pay/sandbox/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/pay/sandbox/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [p] = await db.select().from(payments).where(eq(payments.id, id));
  if (!p || p.userId !== user.id || p.gateway !== "sandbox") notFound();
  const product = getProduct(p.productId);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
      <div className="rounded-[32px] border-2 border-dashed border-warning bg-surface p-6 shadow-float">
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-warning-soft px-3 text-[13px] font-bold uppercase tracking-wide text-warning">
          <FlaskConical className="h-4 w-4" /> Тестовая оплата
        </span>
        <h1 className="title mt-4 text-[26px]">{product?.title ?? p.productId}</h1>
        <p className="mt-1 text-[14.5px] text-muted">Это sandbox-шлюз для разработки и демо. Деньги не списываются, данные карты не запрашиваются.</p>
        <dl className="mt-5 space-y-2 rounded-2xl bg-surface-2 p-4 text-[15px]">
          <div className="flex justify-between"><dt className="text-muted">Сумма</dt><dd className="tabular">{rub(p.amount)}</dd></div>
          {p.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Скидка</dt><dd className="tabular">−{rub(p.discount)}</dd></div>}
          <div className="flex justify-between font-semibold"><dt>К оплате</dt><dd className="tabular">{rub(p.amount - p.discount)}</dd></div>
        </dl>
        {p.status === "pending" ? <SandboxButtons id={p.id} /> : <p className="mt-5 text-center text-[15px] font-semibold">Платёж уже {p.status === "succeeded" ? "оплачен" : "закрыт"}.</p>}
      </div>
    </main>
  );
}
