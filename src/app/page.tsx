import Link from "next/link";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, ClipboardList, LayoutGrid, MessageSquareText, Radio, Sparkles, Zap } from "lucide-react";
import { listClientOrders } from "@/server/services/orders";
import { LiveOrder } from "@/components/domain/live-order";
import { APP } from "@/config/app";
import { getCurrentUser } from "@/server/auth/session";
import { getCatalog, getCurrentCity } from "@/server/services/catalog";
import { favoriteIds, listProviders, providerCounts } from "@/server/services/providers";
import { getContent } from "@/server/services/account";
import { AllServicesTile, CategoryHero, CategoryTile } from "@/components/domain/category-tile";
import { ProviderCard } from "@/components/domain/provider-card";
import { SearchBox } from "@/components/domain/search-box";
import { Rail } from "@/components/domain/rail";
import { buttonClass } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/empty";
import { CatalogIcon } from "@/components/ui/catalog-icon";
import { StatusDot } from "@/components/ui/badge";
import { SiteFooter } from "@/components/layout/footer";
import { pl } from "@/lib/format";

export default async function HomePage() {
  const [user, city, catalog] = await Promise.all([getCurrentUser(), getCurrentCity(), getCatalog()]);
  const [counts, top, available, fresh, favs, content] = await Promise.all([
    providerCounts(city.id),
    listProviders(city.id, { sort: "top", limit: 10 }),
    listProviders(city.id, { sort: "available", limit: 10 }),
    listProviders(city.id, { sort: "new", limit: 10 }),
    favoriteIds(user?.id),
    getContent(["home.urgent", "home.announcement"]),
  ]);
  const popularServices = catalog.categories.flatMap((c) => c.subs.flatMap((s) => s.services.filter((v) => v.isPopular).map((v) => ({ ...v, icon: s.icon })))).slice(0, 14);
  const [first, ...rest] = catalog.categories;
  const PRIORITY = ["responses", "in_progress", "assigned", "new"];
  const live = user ? (await listClientOrders(user.id)).filter((o) => PRIORITY.includes(o.status)).sort((a, b) => PRIORITY.indexOf(a.status) - PRIORITY.indexOf(b.status))[0] : undefined;
  const urgent = content["home.urgent"];

  return (
    <main className={`mx-auto w-full max-w-[1320px] flex-1 px-4 lg:px-6 lg:pb-16 ${live ? "pb-64" : "pb-32"}`}>
      {live && <LiveOrder order={live} docked />}
      {/* Hero */}
      <section className="relative pt-4 lg:pt-14">
        <div aria-hidden className="pointer-events-none absolute -top-24 right-0 -z-0 h-[340px] w-[340px] rounded-full bg-accent opacity-35 blur-[100px] dark:opacity-15 lg:h-[520px] lg:w-[520px]" />
        <div className="relative lg:grid lg:grid-cols-[1.25fr_1fr] lg:items-end lg:gap-16">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 text-[14px] font-semibold text-ink-2">
              <StatusDot online />
              {pl(counts.available, ["специалист свободен", "специалиста свободны", "специалистов свободны"])} {city.nameIn}
            </p>
            <h1 className="display text-[44px] sm:text-[56px] lg:text-[84px]">
              Что нужно
              <br />
              <span className="text-muted">сделать?</span>
            </h1>
          </div>
          <p className="mt-3 max-w-md text-[15.5px] leading-relaxed text-ink-2 sm:text-[17px] lg:mb-3 lg:mt-0 lg:text-[19px]">
            Опишите задачу — мастера и специалисты {city.nameIn} сами предложат цену и время. Сравните и выберите лучшего.
          </p>
        </div>
        <SearchBox className="relative z-20 mt-6 lg:mt-10 lg:max-w-3xl" />
        <nav aria-label="Быстрые действия" className="mt-4 grid grid-cols-3 gap-2.5 lg:max-w-3xl">
          {[
            { href: "/order/new?urgency=urgent", label: "Срочно", icon: Zap },
            { href: "/search?available=1", label: "Свободны", icon: Radio },
            { href: user ? "/orders" : "/services", label: user ? "Мои заказы" : "Каталог", icon: user ? ClipboardList : LayoutGrid },
          ].map((a) => (
            <Link key={a.href} href={a.href} className="press bezel flex aspect-[1.35] flex-col items-center justify-center gap-2 rounded-[24px] text-[14px] font-semibold sm:aspect-auto sm:h-[92px]">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink text-bg">
                <a.icon className="h-4 w-4" strokeWidth={2.2} />
              </span>
              {a.label}
            </Link>
          ))}
        </nav>
        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar lg:mx-0 lg:flex-wrap lg:px-0 lg:[&>*:nth-child(n+9)]:hidden">
          {popularServices.map((s) => (
            <Link key={s.id} href={`/order/new?service=${s.slug}`} className="press inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-line bg-surface/70 px-3.5 text-[14px] font-medium hover:border-line-strong hover:bg-surface">
              <CatalogIcon name={s.icon} className="h-4 w-4 text-ink-2" />
              {s.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Categories bento */}
      <section className="mt-10 lg:mt-16" aria-labelledby="cats">
        <SectionHeader as="h2" title={<span id="cats">Категории</span>} action={<Link href="/services" className="text-[15px] font-semibold text-ink-2 hover:text-ink">Все</Link>} />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:gap-3 lg:grid-cols-6">
          {first && <CategoryHero c={first} count={counts.byCat.get(first.id)} className="col-span-2 row-span-2 sm:col-span-1 lg:col-span-2" />}
          {rest.map((c) => (
            <CategoryTile key={c.id} c={c} count={counts.byCat.get(c.id)} />
          ))}
          <AllServicesTile total={counts.total} />
        </div>
      </section>

      {/* Urgent CTA */}
      <section className="mt-10 lg:mt-16">
        <div className="relative overflow-hidden rounded-[32px] bg-inverse p-6 text-inverse-ink md:p-10">
          <div aria-hidden className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-accent opacity-25 blur-[80px]" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <span className="inline-flex h-8 items-center gap-2 rounded-full bg-white/10 px-3 text-[13px] font-semibold dark:bg-black/10">
                <Zap className="h-4 w-4 text-accent dark:text-ink" /> Срочно
              </span>
              <h2 className="display mt-4 text-[34px] md:text-[48px]">{urgent?.title ?? "Нужна помощь срочно?"}</h2>
              <p className="mt-3 text-[16px] leading-relaxed opacity-75 md:text-[17px]">{urgent?.body ?? "Опишите задачу — исполнители рядом получат уведомление и ответят за несколько минут."}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
              <Link href="/order/new?urgency=urgent" className={buttonClass({ variant: "accent", size: "lg", className: "rounded-full" })}>
                Создать заявку <ArrowRight className="h-5 w-5" />
              </Link>
              <p className="text-center text-[13px] opacity-60">Бесплатно для клиентов</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 lg:mt-16">
        <SectionHeader title="Лучшие специалисты" subtitle="Высокий рейтинг и много выполненных заказов" action={<Link href="/search?sort=rating" className="text-[15px] font-semibold text-ink-2 hover:text-ink">Все</Link>} />
        <Rail>
          {top.map((p, i) => (
            <ProviderCard key={p.id} p={p} favorite={favs.has(p.id)} priority={i < 2} />
          ))}
        </Rail>
      </section>

      <section className="mt-10 lg:mt-16">
        <SectionHeader title="Свободны прямо сейчас" subtitle="Быстро отвечают и готовы выехать" action={<Link href="/search?available=1" className="text-[15px] font-semibold text-ink-2 hover:text-ink">Все</Link>} />
        <Rail>
          {available.map((p) => (
            <ProviderCard key={p.id} p={p} favorite={favs.has(p.id)} />
          ))}
        </Rail>
      </section>

      {/* How it works */}
      <section className="mt-10 lg:mt-16" aria-labelledby="how">
        <SectionHeader title={<span id="how">Как это работает</span>} />
        <ol className="grid gap-2.5 md:grid-cols-3 md:gap-3">
          {[
            { icon: MessageSquareText, t: "Опишите задачу", d: "Пара предложений, адрес и удобное время. Можно приложить фото." },
            { icon: Sparkles, t: "Получите отклики", d: "Специалисты рядом предложат цену и сроки — обычно за 10–15 минут." },
            { icon: BadgeCheck, t: "Выберите лучшего", d: "Сравните рейтинг, отзывы и портфолио. Договоритесь в чате." },
          ].map((s, i) => (
            <li key={s.t} className="flex gap-4 rounded-[var(--radius-card)] bezel p-5 md:flex-col md:p-6">
              <span className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2">
                <s.icon className="h-6 w-6" strokeWidth={1.8} />
                <span className="absolute -right-1.5 -top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-accent-ink">{i + 1}</span>
              </span>
              <span>
                <span className="block text-[17px] font-semibold tracking-[-0.02em]">{s.t}</span>
                <span className="mt-1 block text-[15px] leading-relaxed text-muted">{s.d}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10 lg:mt-16">
        <SectionHeader title="Новые исполнители" subtitle={`Недавно присоединились ${city.nameIn}`} />
        <Rail>
          {fresh.map((p) => (
            <ProviderCard key={p.id} p={p} favorite={favs.has(p.id)} />
          ))}
        </Rail>
      </section>

      {/* Become provider */}
      <section className="mt-10 lg:mt-16">
        <div className="grid overflow-hidden rounded-[32px] bezel md:grid-cols-2">
          <div className="p-6 md:p-10">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-ink">
              <BriefcaseBusiness className="h-6 w-6" />
            </span>
            <h2 className="display mt-5 text-[32px] md:text-[44px]">Оказываете услуги?</h2>
            <p className="mt-3 max-w-md text-[16px] leading-relaxed text-ink-2">Получайте заявки от клиентов рядом. Профиль и отклики — бесплатно, комиссия {Math.round(APP.commissionRate * 100)}% только с выполненных заказов.</p>
            <Link href="/become-provider" className={buttonClass({ variant: "primary", size: "lg", className: "mt-6 rounded-full" })}>
              Стать исполнителем <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
          <div className="relative hidden min-h-[280px] md:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/art/lime/Hammer/become-provider.svg?w=1200&h=900" alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
