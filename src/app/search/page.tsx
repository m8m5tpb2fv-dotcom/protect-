import type { Metadata } from "next";
import Link from "next/link";
import { SearchX, Sparkles } from "lucide-react";
import { searchQuerySchema } from "@/lib/validation";
import { getCurrentUser } from "@/server/auth/session";
import { getCatalog, getCurrentCity } from "@/server/services/catalog";
import { favoriteIds, searchProviders } from "@/server/services/providers";
import { SearchBox } from "@/components/domain/search-box";
import { SearchFilters } from "@/components/domain/search-filters";
import { ResultsWithMap } from "@/components/domain/results";
import { EmptyState } from "@/components/ui/empty";
import { buttonClass } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { CatalogIcon } from "@/components/ui/catalog-icon";
import { pl } from "@/lib/format";
import { AdSlot } from "@/components/domain/ad-slot";

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const q = (await searchParams).q;
  return { title: q ? `«${q}» — поиск специалистов` : "Поиск специалистов", robots: { index: false } };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const raw = await searchParams;
  const parsed = searchQuerySchema.safeParse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const q = parsed.success ? parsed.data : {};
  const [user, city, catalog] = await Promise.all([getCurrentUser(), getCurrentCity(), getCatalog()]);
  const [result, favs] = await Promise.all([searchProviders(city.id, q), favoriteIds(user?.id)]);
  const sub = q.sub ? catalog.subBySlug.get(q.sub) : undefined;
  const title = q.q ? `«${q.q}»` : sub ? sub.namePlural : "Все специалисты";
  const makeHref = (p: number) => {
    const sp = new URLSearchParams(Object.entries(raw).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
    sp.set("page", String(p));
    return `/search?${sp}`;
  };

  return (
    <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 pb-32 pt-2 lg:px-6 lg:pt-8">
      <SearchBox initial={q.q ?? ""} size="md" className="relative z-30 lg:max-w-2xl" />
      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="title text-[26px] lg:text-[34px]">{title}</h1>
          <p className="mt-1 text-[15px] text-muted">
            {pl(result.total, ["исполнитель", "исполнителя", "исполнителей"])} {city.nameIn}
          </p>
        </div>
      </div>
      {result.matched.services.length > 0 && (
        <div className="mt-4 rounded-[24px] bg-accent-soft p-4">
          <p className="mb-2.5 flex items-center gap-2 text-[14px] font-semibold">
            <Sparkles className="h-4 w-4" /> Быстрее создать заявку — исполнители сами откликнутся
          </p>
          <div className="flex flex-wrap gap-2">
            {result.matched.services.slice(0, 4).map((s) => {
              const sb = catalog.subById.get(s.subcategoryId);
              return (
                <Link key={s.id} href={`/order/new?service=${s.slug}`} className="press inline-flex h-10 items-center gap-2 rounded-full bezel px-4 text-[14px] font-semibold">
                  {sb && <CatalogIcon name={sb.icon} className="h-4 w-4" />} {s.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}
      <div className="sticky top-[calc(var(--safe-top)+72px)] z-20 -mx-4 mt-4 bg-bg/85 px-4 py-2 backdrop-blur-xl lg:top-[88px] lg:mx-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
        <SearchFilters districts={city.districts.map((d) => ({ slug: d.slug, name: d.name }))} />
      </div>
      <div className="mt-3">
        {result.items.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Никого не нашли"
            text={q.q ? `По запросу «${q.q}» пока нет исполнителей. Создайте заявку — её увидят все подходящие мастера, в том числе новые.` : "Попробуйте изменить фильтры или район."}
            action={
              <Link href={`/order/new${q.q ? `?q=${encodeURIComponent(q.q)}` : ""}`} className={buttonClass({ variant: "accent", size: "lg", className: "rounded-full" })}>
                Создать заявку
              </Link>
            }
          />
        ) : (
          <ResultsWithMap items={result.items} favorites={[...favs]} center={[city.lat, city.lng]} me={q.lat != null && q.lng != null ? { lat: q.lat, lng: q.lng } : null} />
        )}
        <Pagination page={result.page} total={result.total} pageSize={result.pageSize} href={makeHref} />
        <AdSlot slot="search" className="mt-6" />
      </div>
    </main>
  );
}
