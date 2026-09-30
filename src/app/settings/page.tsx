import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { getCurrentCity } from "@/server/services/catalog";
import { PageHeader } from "@/components/layout/page-header";
import { ThemeSwitch } from "@/components/domain/theme-switch";
import { botUsername } from "@/server/telegram/config";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Настройки", robots: { index: false } };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings");
  const city = await getCurrentCity();
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 lg:pt-8">
      <PageHeader title="Настройки" backHref="/profile" />
      <SettingsForm
        user={{ name: user.name, avatarUrl: user.avatarUrl, districtId: user.districtId, notifyEmail: user.notifyEmail, notifyTelegram: user.notifyTelegram, email: user.email, phone: user.phone, telegramUsername: user.telegramUsername, hasTelegram: !!user.telegramId }}
        districts={city.districts.map((d) => ({ id: d.id, name: d.name }))}
        telegramBot={await botUsername()}
      />
      <section className="mt-3 rounded-[28px] bezel p-5">
        <h2 className="mb-3 text-[15px] font-semibold">Оформление</h2>
        <ThemeSwitch />
      </section>
    </main>
  );
}
