import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, SearchX } from "lucide-react";
import { searchQuerySchema } from "@/lib/validation";
import { getCurrentUser } from "@/server/auth/session";
import { getCatalog, getCurrentCity } from "@/server/services/catalog";
import { favoriteIds, searchProviders } from "@/server/services/providers";
import { ResultsWithMap } from "@/components/domain/results";
import { SearchFilters } from "@/components/domain/search-filters";
import { CatalogIcon } from "@/components/ui/catalog-icon";
import { EmptyState } from "@/components/ui/empty";
import { buttonClass } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { PageHeader } from "@/components/layout/page-header";
import { pl, rub } from "@/lib/format";
import { toneStyle } from "@/lib/tones";
import { APP } from "@/config/app";

async function resolve(slug: string) {
  const catalog = await getCatalog();
  const cat = catalog.categories.find((c) => c.slug === slug);
  if (cat) return { kind: "category" as const, cat, sub: null, catalog };
  const sub = catalog.subBySlug.get(slug);
  if (!sub) return null;
  const parent = catalog.categories.find((c) => c.id === sub.categoryId)!;
  return { kind: "sub" as const, cat: parent, sub: parent.subs.find((s) => s.id === sub.id)!, catalog };
}

export async function generateMetadata({ params }: PageProps<"/services/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const r = await resolve(slug);
  if (!r) return { title: "Не найдено" };
  const name = r.sub ? r.sub.namePlural : r.cat.name;
  return {
    title: `${name} в Саратове — цены, отзывы, рейтинг`,
    description: r.sub
      ? `${r.sub.namePlural} в Саратове: сравните цены, рейтинг и отзывы. ${r.sub.services.slice(0, 3).map((s) => s.name).join(", ")} — создайте заявку и получите отклики за несколько минут.`
      : `${r.cat.name} в Саратове: ${r.cat.subs.map((s) => s.name.toLowerCase()).join(", ")}. Проверенные исполнители с отзывами.`,
    alternates: { canonical: `/services/${slug}` },
    openGraph: { title: `${name} в Саратове · ${APP.name}` },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/services/[slug]">) {
  const { slug } = await params;
  const r = await resolve(slug);
  if (!r) notFound();
  const raw = await searchParams;
  const parsed = searchQuerySchema.safeParse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const q = { ...(parsed.success ? parsed.data : {}), ...(r.sub ? { sub: r.sub.slug } : { category: r.cat.slug }) };
  const [user, city] = await Promise.all([getCurrentUser(), getCurrentCity()]);
  const [result, favs] = await Promise.all([searchProviders(city.id, q), favoriteIds(user?.id)]);
  const title = r.sub ? r.sub.namePlural : r.cat.name;
  const makeHref = (p: number) => {
    const sp = new URLSearchParams(Object.entries(raw).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
    sp.set("page", String(p));
    return `/services/${slug}?${sp}`;
  };
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${title} в Саратове`,
    itemListElement: result.items.slice(0, 10).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "LocalBusiness",
        name: p.displayName,
        url: `${APP.url}/provider/${p.slug}`,
        address: { "@type": "PostalAddress", addressLocality: "Саратов", addressCountry: "RU" },
        ...(p.reviewsCount ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.ratingAvg, reviewCount: p.reviewsCount } } : {}),
        ...(p.priceFrom ? { priceRange: `от ${p.priceFrom} ₽` } : {}),
      },
    })),
  };

  return (
    <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 pb-32 lg:px-6 lg:pt-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PageHeader sticky={false} backHref="/services" />
      <section style={toneStyle(r.cat.tone)} className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(145deg,var(--t-a),color-mix(in_srgb,var(--t-b)_60%,var(--t-a)))] p-6 text-[var(--t-ink)] dark:bg-[linear-gradient(145deg,color-mix(in_srgb,var(--t-ink)_70%,#000),color-mix(in_srgb,var(--t-c)_25%,#111))] dark:text-[var(--t-a)] md:p-10">
        <CatalogIcon name={r.sub?.icon ?? r.cat.icon} strokeWidth={1} className="pointer-events-none absolute -bottom-10 -right-6 h-56 w-56 opacity-25 md:h-80 md:w-80" />
        <nav aria-label="Навигация" className="relative mb-3 text-[13px] font-semibold opacity-70">
          <Link href="/services" className="hover:underline">Услуги</Link>
          {r.sub && (
            <>
              {" / "}
              <Link href={`/services/${r.cat.slug}`} className="hover:underline">{r.cat.name}</Link>
            </>
          )}
        </nav>
        <h1 className="display relative text-[38px] md:text-[60px]">{title}</h1>
        <p className="relative mt-2 text-[16px] opacity-80 md:text-[18px]">
          {pl(result.total, ["исполнитель", "исполнителя", "исполнителей"])} {city.nameIn}
          {r.sub?.services[0]?.priceFrom ? ` · от ${rub(Math.min(...r.sub.services.map((s) => s.priceFrom ?? Infinity)))}` : ""}
        </p>
        <Link href={r.sub ? `/order/new?sub=${r.sub.slug}` : "/order/new"} className={buttonClass({ variant: "primary", size: "lg", className: "relative mt-6 rounded-full" })}>
          Создать заявку <ArrowRight className="h-5 w-5" />
        </Link>
      </section>

      {r.kind === "category" ? (
        <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 no-scrollbar lg:mx-0 lg:flex-wrap lg:px-0">
          {r.cat.subs.map((s) => (
            <Link key={s.id} href={`/services/${s.slug}`} className="press inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-surface px-4 text-[14.5px] font-semibold shadow-soft ring-1 ring-line hover:ring-line-strong">
              <CatalogIcon name={s.icon} className="h-4 w-4" /> {s.name}
            </Link>
          ))}
        </div>
      ) : (
        <section className="mt-5" aria-labelledby="prices">
          <h2 id="prices" className="sr-only">Услуги и цены</h2>
          <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 no-scrollbar lg:mx-0 lg:grid lg:grid-cols-4 lg:px-0">
            {r.sub!.services.map((s) => (
              <Link key={s.id} href={`/order/new?service=${s.slug}`} className="press lift flex w-[220px] shrink-0 flex-col justify-between rounded-[22px] bg-surface p-4 shadow-card lg:w-auto">
                <span className="text-[15px] font-semibold leading-snug">{s.name}</span>
                <span className="mt-3 flex items-end justify-between">
                  <span className="text-[14px] text-muted">
                    {s.priceFrom ? `от ${rub(s.priceFrom)}` : ""} <span className="text-[12px]">{s.unit}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="sticky top-[calc(var(--safe-top))] z-20 -mx-4 mt-5 bg-bg/85 px-4 py-2 backdrop-blur-xl lg:top-[88px] lg:mx-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
        <SearchFilters districts={city.districts.map((d) => ({ slug: d.slug, name: d.name }))} />
      </div>
      <div className="mt-3">
        {result.items.length === 0 ? (
          <EmptyState icon={SearchX} title="Пока нет исполнителей" text="Создайте заявку — как только появится подходящий специалист, он получит уведомление." action={<Link href="/order/new" className={buttonClass({ variant: "accent" })}>Создать заявку</Link>} />
        ) : (
          <ResultsWithMap items={result.items} favorites={[...favs]} center={[city.lat, city.lng]} me={q.lat != null && q.lng != null ? { lat: q.lat, lng: q.lng } : null} />
        )}
        <Pagination page={result.page} total={result.total} pageSize={result.pageSize} href={makeHref} />
      </div>
      {r.sub && (
        <section className="mt-12 max-w-3xl text-[15px] leading-relaxed text-muted">
          <h2 className="title mb-2 text-[20px] text-ink">{r.sub.namePlural} в Саратове</h2>
          <p>
            На {APP.name} собраны {r.sub.namePlural.toLowerCase()}, работающие {city.nameIn} — в районах {city.districts.map((d) => d.name).join(", ")}. Сравнивайте цены, рейтинг и отзывы клиентов, смотрите портфолио и время ответа. Чтобы
            быстрее найти исполнителя, создайте заявку: специалисты рядом сами предложат цену и время.
          </p>
        </section>
      )}
    </main>
  );
}
