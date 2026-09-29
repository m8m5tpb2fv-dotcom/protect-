import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRing, MessageSquareText, Percent, ShieldCheck } from "lucide-react";
import { APP, FREE_RESPONSES_PER_MONTH } from "@/config/app";
import { getCurrentUser } from "@/server/auth/session";
import { providerFormData } from "@/server/services/form-data";
import { ProviderForm, DEFAULT_SCHEDULE } from "@/components/domain/provider-form";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Стать исполнителем", description: `Получайте заказы от клиентов в Саратове. Бесплатный профиль, ${FREE_RESPONSES_PER_MONTH} откликов в месяц, комиссия только с выполненных заказов.` };

export default async function BecomeProviderPage() {
  const user = await getCurrentUser();
  if (user?.provider) redirect("/pro");
  const perks = [
    { icon: BellRing, t: "Заявки рядом", d: "Уведомления о новых заказах в вашем районе — в приложении и Telegram." },
    { icon: MessageSquareText, t: `${FREE_RESPONSES_PER_MONTH} откликов бесплатно`, d: "Каждый месяц. Безлимит — в тарифе Pro." },
    { icon: Percent, t: `Комиссия ${Math.round(APP.commissionRate * 100)}%`, d: "Только с выполненных заказов. Никаких абонентских плат." },
    { icon: ShieldCheck, t: "Статус «Проверенный»", d: "Загрузите документы — клиенты доверяют таким профилям больше." },
  ];
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 lg:pt-8">
      <PageHeader sticky={false} />
      <h1 className="display text-[40px] md:text-[56px]">Стать исполнителем</h1>
      <p className="mt-3 text-[17px] text-ink-2">Заполните профиль за 3 минуты — и начните получать заказы от клиентов {`в Саратове`}.</p>
      <ul className="mt-6 grid grid-cols-2 gap-2.5">
        {perks.map((p) => (
          <li key={p.t} className="rounded-[22px] bezel p-4">
            <p.icon className="h-5 w-5" />
            <p className="mt-3 text-[15px] font-semibold">{p.t}</p>
            <p className="mt-1 text-[13px] leading-snug text-muted">{p.d}</p>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        {user ? (
          <ProviderForm
            mode="create"
            {...await providerFormData()}
            initial={{ displayName: user.name === "Пользователь" ? "" : user.name, kind: "person", headline: "", bio: "", primarySubcategoryId: null, subcategoryIds: [], districtId: user.districtId, radiusKm: 10, worksCityWide: false, experienceYears: 0, priceFrom: "", phone: user.phone ?? "", telegram: user.telegramUsername ? `@${user.telegramUsername}` : "", showPhone: true, avatarUrl: user.avatarUrl, coverUrl: null, schedule: DEFAULT_SCHEDULE }}
          />
        ) : (
          <Link href="/login?next=/become-provider" className={buttonClass({ variant: "accent", size: "lg", block: true })}>
            Войти и начать
          </Link>
        )}
      </div>
    </main>
  );
}
