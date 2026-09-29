import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCatalog, getCurrentCity } from "@/server/services/catalog";
import { providerCounts } from "@/server/services/providers";
import { CatalogIcon } from "@/components/ui/catalog-icon";
import { SearchBox } from "@/components/domain/search-box";
import { toneStyle } from "@/lib/tones";

export const metadata: Metadata = { title: "Все услуги в Саратове", description: "Каталог услуг Саратова: ремонт, дом, авто, красота, обучение, спорт, фото, IT, доставка, деловые услуги, мероприятия и строительство.", alternates: { canonical: "/services" } };

export default async function ServicesPage() {
  const [catalog, city] = await Promise.all([getCatalog(), getCurrentCity()]);
  const counts = await providerCounts(city.id);
  return (
    <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 pb-32 pt-2 lg:px-6 lg:pt-8">
      <h1 className="display text-[40px] lg:text-[64px]">Все услуги</h1>
      <p className="mt-2 text-[16px] text-muted">
        {catalog.categories.reduce((n, c) => n + c.subs.length, 0)} направлений · {counts.total} специалистов {city.nameIn}
      </p>
      <SearchBox size="md" className="relative z-20 mt-6 lg:max-w-2xl" />
      <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {catalog.categories.map((c) => (
          <section key={c.id} className="rounded-[var(--radius-card)] bezel p-2">
            <Link href={`/services/${c.slug}`} style={toneStyle(c.tone)} className="press flex items-center gap-3 rounded-[22px] bg-[var(--t-a)] p-4 text-[var(--t-ink)] dark:bg-[color-mix(in_srgb,var(--t-ink)_70%,#000)] dark:text-[var(--t-a)]">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/60 dark:bg-white/10">
                <CatalogIcon name={c.icon} className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <h2 className="text-[18px] font-semibold tracking-[-0.02em]">{c.name}</h2>
                <span className="text-[13px] opacity-70">{counts.byCat.get(c.id) ?? 0} специалистов</span>
              </span>
              <ChevronRight className="h-5 w-5 opacity-60" />
            </Link>
            <ul className="p-2">
              {c.subs.map((s) => (
                <li key={s.id}>
                  <Link href={`/services/${s.slug}`} className="flex min-h-11 items-center justify-between rounded-xl px-2 text-[15px] hover:bg-surface-2">
                    <span className="flex items-center gap-2.5">
                      <CatalogIcon name={s.icon} className="h-4 w-4 text-muted" />
                      {s.name}
                    </span>
                    <span className="text-[13px] text-muted tabular">{counts.bySub.get(s.id) ?? 0}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
