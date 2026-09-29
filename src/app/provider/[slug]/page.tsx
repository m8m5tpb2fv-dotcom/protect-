import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Clock3, MapPin, MessageCircle, Phone, Repeat2, ShieldCheck, Star, Trophy, Users } from "lucide-react";
import { APP } from "@/config/app";
import { getCurrentUser } from "@/server/auth/session";
import { getProviderProfile, isFavorite, listProviders } from "@/server/services/providers";
import { getCatalog } from "@/server/services/catalog";
import { ServicePicker } from "@/components/domain/service-picker";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusDot } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Media } from "@/components/ui/media";
import { RatingInline, Stars } from "@/components/ui/rating";
import { VerifiedMark } from "@/components/ui/verified";
import { FavoriteButton } from "@/components/domain/favorite-button";
import { MessageButton } from "@/components/domain/message-button";
import { PortfolioGrid } from "@/components/domain/portfolio-grid";
import { ProviderCard } from "@/components/domain/provider-card";
import { Rail } from "@/components/domain/rail";
import { ReportButton } from "@/components/domain/report-button";
import { ShareButton } from "@/components/domain/share-button";
import { MapView } from "@/components/maps/map-view";
import { PageHeader } from "@/components/layout/page-header";
import { dateShort, pl, rating, responseTime, rub, VERIFICATION } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { miniAppUrl } from "@/lib/deeplink";
import { cn } from "@/lib/cn";

const DAYS = [["mon", "Пн"], ["tue", "Вт"], ["wed", "Ср"], ["thu", "Чт"], ["fri", "Пт"], ["sat", "Сб"], ["sun", "Вс"]] as const;

export async function generateMetadata({ params }: PageProps<"/provider/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProviderProfile(slug);
  if (!data || data.provider.status !== "active") return { title: "Исполнитель не найден", robots: { index: false } };
  const { card } = data;
  return {
    title: `${card.displayName} — ${card.subName.toLowerCase()} в Саратове`,
    description: `${card.headline}. Рейтинг ${rating(card.ratingAvg)}, ${pl(card.reviewsCount, ["отзыв", "отзыва", "отзывов"])}, ${pl(card.ordersCompleted, ["заказ", "заказа", "заказов"])}. ${card.priceFrom ? `Цены от ${rub(card.priceFrom)}.` : ""}`,
    alternates: { canonical: `/provider/${slug}` },
    openGraph: { title: `${card.displayName} · ${card.subName}`, images: card.coverUrl ? [card.coverUrl] : undefined },
  };
}

export default async function ProviderPage({ params }: PageProps<"/provider/[slug]">) {
  const { slug } = await params;
  const [data, user] = await Promise.all([getProviderProfile(slug), getCurrentUser()]);
  if (!data) notFound();
  const { card: p, provider, services, portfolio, reviews, subs, workDistricts, ratingDistribution } = data;
  const isOwner = user?.provider?.id === provider.id;
  const isStaff = user?.role === "admin" || user?.role === "moderator";
  if (provider.status !== "active" && !isOwner && !isStaff) notFound();
  const catalog = await getCatalog();
  const [fav, similar] = await Promise.all([user ? isFavorite(user.id, provider.id) : false, listProviders(provider.cityId, { sort: "top", subIds: [provider.primarySubcategoryId], limit: 8, excludeId: provider.id })]);
  const cover = p.coverUrl ?? `/art/${p.tone}/${p.icon}/${p.slug}-cover.svg?w=1600&h=900`;
  const v = VERIFICATION[p.verification];
  const maxBar = Math.max(1, ...ratingDistribution.map((r) => r.count));
  const tgLink = miniAppUrl(APP.telegramBot, APP.telegramAppName, { kind: "provider", value: p.slug });
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": p.kind === "company" ? "LocalBusiness" : "ProfessionalService",
    name: p.displayName,
    description: provider.bio || p.headline,
    url: `${APP.url}/provider/${p.slug}`,
    image: `${APP.url}${cover}`,
    areaServed: "Саратов",
    address: { "@type": "PostalAddress", addressLocality: "Саратов", addressRegion: "Саратовская область", addressCountry: "RU" },
    ...(p.priceFrom ? { priceRange: `от ${p.priceFrom} ₽` } : {}),
    ...(p.reviewsCount ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.ratingAvg, reviewCount: p.reviewsCount, bestRating: 5 } } : {}),
    makesOffer: services.slice(0, 10).map((s) => ({ "@type": "Offer", name: s.title, price: s.priceFrom, priceCurrency: "RUB" })),
  };

  const stats = [
    { icon: Star, value: p.reviewsCount ? rating(p.ratingAvg) : "—", label: pl(p.reviewsCount, ["отзыв", "отзыва", "отзывов"]) },
    { icon: Trophy, value: p.ordersCompleted.toLocaleString("ru-RU"), label: "выполнено заказов" },
    { icon: Users, value: provider.clientsCount.toLocaleString("ru-RU"), label: "клиентов" },
    { icon: Repeat2, value: `${provider.repeatClientsPct}%`, label: "обращаются повторно" },
    { icon: Clock3, value: p.responseTimeMin != null ? (p.responseTimeMin < 60 ? `${p.responseTimeMin} мин` : `${Math.round(p.responseTimeMin / 60)} ч`) : "—", label: "среднее время ответа" },
    { icon: CalendarClock, value: `${p.experienceYears}`, label: pl(p.experienceYears, ["год опыта", "года опыта", "лет опыта"]).replace(/^\d+\s/, "") },
  ];

  const actions = (
    <div className="flex gap-2">
      <MessageButton providerId={provider.id} variant="secondary" className="h-14 flex-1 rounded-[20px] text-[15px]" />
      <Link href={`/order/new?provider=${provider.id}`} className={buttonClass({ variant: "accent", size: "lg", className: "flex-[1.4]" })}>
        Заказать
      </Link>
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-[1320px] flex-1 pb-40 lg:px-6 lg:pb-16 lg:pt-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      {/* Hero — creator profile (reference: surf coach) */}
      <section className="grain relative overflow-hidden rounded-b-[36px] bg-[#0b0b0c] pb-7 text-white lg:rounded-[36px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" fetchPriority="high" />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgb(11_11_12/0.35)_0%,rgb(11_11_12/0.75)_45%,#0b0b0c_100%)]" />
        <div className="relative flex items-center justify-between px-4 pt-[calc(var(--safe-top)+8px)] lg:px-6 lg:pt-6">
          <PageHeader sticky={false} className="m-0 p-0 [&_button]:bg-white/12 [&_button]:text-white lg:hidden" />
          <div className="ml-auto flex gap-2">
            <ShareButton title={`${p.displayName} — ${p.subName}`} path={`/provider/${p.slug}`} tgLink={tgLink} className="!bg-white/12 !border-transparent text-white" />
            <FavoriteButton providerId={provider.id} initial={fav} className="!bg-white/12 !border-transparent text-white" />
          </div>
        </div>
        <div className="relative mx-auto mt-2 flex max-w-[560px] items-center justify-center gap-5 px-4 sm:gap-10">
          <div className="w-[86px] text-center">
            <p className="num text-[30px]">{p.ordersCompleted.toLocaleString("ru-RU")}</p>
            <p className="mt-1 text-[12.5px] text-white/55">{pl(p.ordersCompleted, ["заказ", "заказа", "заказов"]).replace(/^[\d\s]+/, "")}</p>
          </div>
          <span className="rounded-full p-[5px] ring-2 ring-white/85">
            <Avatar name={p.displayName} src={p.avatarUrl} size={124} />
          </span>
          <div className="w-[86px] text-center">
            <p className="num text-[30px]">{p.reviewsCount ? rating(p.ratingAvg) : "—"}</p>
            <p className="mt-1 text-[12.5px] text-white/55">{pl(p.reviewsCount, ["отзыв", "отзыва", "отзывов"])}</p>
          </div>
        </div>
        <div className="relative mt-5 px-6 text-center">
          <h1 className="inline-flex flex-wrap items-center justify-center gap-2 text-[28px] font-semibold tracking-[-0.03em] md:text-[36px]">
            {p.displayName}
            <VerifiedMark level={p.verification} size={18} className="[&>span]:bg-white [&>span]:text-black" />
          </h1>
          <p className="mx-auto mt-1.5 max-w-md text-[15px] leading-snug text-white/60">{p.headline}</p>
          {provider.status !== "active" && (
            <Badge tone="warning" className="mt-3">
              {provider.status === "pending" ? "На проверке" : provider.status === "rejected" ? "Требует доработки" : "Приостановлен"}
            </Badge>
          )}
        </div>
        {!isOwner && (
          <div className="relative mx-auto mt-6 grid max-w-[420px] grid-cols-2 gap-2.5 px-5">
            <MessageButton providerId={provider.id} variant="outline" className="h-12 rounded-full border-white/70 text-[15px] text-white hover:bg-white hover:text-black" />
            {provider.phone && provider.showPhone ? (
              <a href={`tel:${provider.phone.replace(/[^\d+]/g, "")}`} className={buttonClass({ variant: "outline", size: "sm", className: "h-12 border-white/70 text-[15px] text-white hover:bg-white hover:text-black" })}>
                <Phone className="h-4 w-4" /> Позвонить
              </a>
            ) : (
              <Link href={`/order/new?provider=${provider.id}`} className={buttonClass({ variant: "outline", size: "sm", className: "h-12 border-white/70 text-[15px] text-white hover:bg-white hover:text-black" })}>
                Заказать
              </Link>
            )}
          </div>
        )}
      </section>

      <div className="px-4 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10 lg:px-0">
        <div className="min-w-0">
          <section className="mt-5">
            <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full bezel px-3 text-[13.5px] font-semibold">
                <StatusDot online={p.isAvailable} /> {p.isAvailable ? "Свободен сейчас" : "Сейчас занят"}
              </span>
              {subs.map((s) => (
                <Link key={s.id} href={`/services/${s.slug}`} className="inline-flex h-8 items-center rounded-full bg-surface-2 px-3 text-[13.5px] font-semibold hover:bg-surface-3">
                  {s.name}
                </Link>
              ))}
              {p.districtName && (
                <span className="inline-flex h-8 items-center gap-1 rounded-full bg-surface-2 px-3 text-[13.5px] font-semibold">
                  <MapPin className="h-3.5 w-3.5" /> {p.districtName}
                </span>
              )}
            </div>
            {v && (
              <p className="mt-4 flex items-start gap-2 rounded-2xl bg-surface-2 p-3 text-[13.5px] text-ink-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <b className="font-semibold text-ink">{v.label}.</b> Статус модерации платформы: мы проверили данные исполнителя. Это не юридическая гарантия качества работ.
                </span>
              </p>
            )}
          </section>

          {/* Stats bento */}
          <section aria-label="Показатели" className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {stats.slice(2).map((s, i) => (
              <div key={s.label} className="bezel rounded-[24px] p-4">
                <s.icon className={cn("h-5 w-5", i === 0 ? "text-accent" : "text-muted")} strokeWidth={1.9} />
                <div className="num mt-3 text-[34px]">{s.value}</div>
                <div className="mt-1.5 text-[13px] text-muted">{s.label}</div>
              </div>
            ))}
          </section>

          {provider.bio && (
            <section className="mt-10">
              <h2 className="title text-[24px]">О себе</h2>
              <div className="rich-text mt-3 whitespace-pre-line text-[16px] leading-relaxed text-ink-2">{provider.bio}</div>
            </section>
          )}

          {services.length > 0 && (
            <section className="mt-10" aria-labelledby="svc">
              <h2 id="svc" className="title mb-4 text-[24px]">Услуги и цены</h2>
              <ServicePicker
                providerId={provider.id}
                popularId={services.length > 2 ? services[0].id : undefined}
                services={services.map((s) => ({ id: s.id, title: s.title, description: s.description, priceFrom: s.priceFrom, priceTo: s.priceTo, unit: s.unit, serviceSlug: s.serviceId ? (catalog.serviceById.get(s.serviceId)?.slug ?? null) : null }))}
              />
            </section>
          )}

          {portfolio.length > 0 && (
            <section className="mt-10" aria-labelledby="pf">
              <div className="mb-4 flex items-end justify-between">
                <h2 id="pf" className="title text-[24px]">Портфолио</h2>
                <span className="text-[14px] text-muted">{pl(portfolio.length, ["работа", "работы", "работ"])}</span>
              </div>
              <PortfolioGrid items={portfolio.map((x) => ({ id: x.id, url: x.url, width: x.width, height: x.height, caption: x.caption, kind: x.kind }))} />
            </section>
          )}

          {/* Reviews */}
          <section className="mt-10 scroll-mt-24" id="reviews" aria-labelledby="rv">
            <h2 id="rv" className="title text-[24px]">Отзывы</h2>
            {p.reviewsCount > 0 ? (
              <>
                <div className="mt-4 grid gap-4 rounded-[24px] bezel p-5 sm:grid-cols-[auto_1fr] sm:gap-8">
                  <div>
                    <div className="text-[56px] font-semibold leading-none tracking-[-0.05em] tabular">{rating(p.ratingAvg)}</div>
                    <Stars value={p.ratingAvg} className="mt-2" />
                    <p className="mt-1 text-[13px] text-muted">{pl(p.reviewsCount, ["отзыв", "отзыва", "отзывов"])}</p>
                  </div>
                  <ul className="flex flex-col justify-center gap-1.5">
                    {ratingDistribution.map((r) => (
                      <li key={r.rating} className="flex items-center gap-3 text-[13px]">
                        <span className="w-3 tabular text-muted">{r.rating}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <span className="block h-full rounded-full bg-ink" style={{ width: `${(r.count / maxBar) * 100}%` }} />
                        </span>
                        <span className="w-6 text-right tabular text-muted">{r.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <ul className="mt-3 flex flex-col gap-3">
                  {reviews.slice(0, 5).map((r) => (
                    <li key={r.id} className="rounded-[24px] bezel p-5">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.authorName} src={r.authorAvatar} size={40} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-semibold">{r.authorName.split(" ")[0]} {r.authorName.split(" ")[1]?.[0] ? `${r.authorName.split(" ")[1][0]}.` : ""}</p>
                          <p className="text-[12.5px] text-muted">
                            {dateShort(r.createdAt)}
                            {r.orderId && " · заказ через платформу"}
                          </p>
                        </div>
                        <Stars value={r.rating} size={14} />
                      </div>
                      {r.text && <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{r.text}</p>}
                      {r.photos.length > 0 && (
                        <div className="mt-3 flex gap-2">
                          {r.photos.map((ph) => (
                            <Media key={ph} src={ph} alt="Фото из отзыва" ratio={1} className="w-24 rounded-2xl" />
                          ))}
                        </div>
                      )}
                      {r.reply && (
                        <div className="mt-3 rounded-2xl bg-surface-2 p-3 text-[14px]">
                          <p className="mb-0.5 text-[12.5px] font-semibold text-muted">Ответ исполнителя</p>
                          {r.reply}
                        </div>
                      )}
                      <div className="mt-2 flex justify-end">
                        <ReportButton targetType="review" targetId={r.id} label="Пожаловаться" />
                      </div>
                    </li>
                  ))}
                </ul>
                {reviews.length > 5 && (
                  <details className="group mt-3">
                    <summary className="press flex h-12 cursor-pointer list-none items-center justify-center rounded-2xl bg-surface-2 text-[15px] font-semibold hover:bg-surface-3 group-open:hidden">Показать ещё {reviews.length - 5}</summary>
                    <ul className="flex flex-col gap-3">
                      {reviews.slice(5).map((r) => (
                        <li key={r.id} className="rounded-[24px] bezel p-5">
                          <div className="flex items-center gap-3">
                            <Avatar name={r.authorName} src={r.authorAvatar} size={40} />
                            <div className="min-w-0 flex-1">
                              <p className="text-[15px] font-semibold">{r.authorName.split(" ")[0]}</p>
                              <p className="text-[12.5px] text-muted">{dateShort(r.createdAt)}</p>
                            </div>
                            <Stars value={r.rating} size={14} />
                          </div>
                          {r.text && <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{r.text}</p>}
                          {r.reply && <div className="mt-3 rounded-2xl bg-surface-2 p-3 text-[14px]">{r.reply}</div>}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            ) : (
              <p className="mt-3 rounded-[24px] bezel p-5 text-[15px] text-muted">Отзывов пока нет. Станьте первым клиентом — после выполнения заказа вы сможете оценить работу.</p>
            )}
          </section>

          {/* Geography */}
          <section className="mt-10" aria-labelledby="geo">
            <h2 id="geo" className="title text-[24px]">География работы</h2>
            <p className="mt-2 text-[15px] text-ink-2">
              {provider.worksCityWide ? "Работает по всему Саратову" : `Выезжает в радиусе ${provider.radiusKm} км`}
              {workDistricts.length ? ` · ${workDistricts.map((d) => d.name).join(", ")} район` : ""}
            </p>
            {p.lat != null && p.lng != null && (
              <MapView center={[p.lat, p.lng]} zoom={provider.worksCityWide ? 11 : 12} markers={[{ id: p.slug, lat: p.lat, lng: p.lng, label: p.displayName.split(" ")[0], active: true }]} circles={provider.worksCityWide ? [] : [{ lat: p.lat, lng: p.lng, radiusKm: provider.radiusKm }]} className="mt-4 h-[280px]" />
            )}
          </section>

          <div className="mt-8 flex items-center justify-between border-t border-line pt-4">
            <span className="text-[13px] text-muted">На платформе с {dateShort(provider.createdAt)}</span>
            <ReportButton targetType="provider" targetId={provider.id} />
          </div>
        </div>

        {/* Desktop sticky action card */}
        <aside className="hidden lg:block">
          <div className="sticky top-28 mt-8 rounded-[28px] bezel p-6">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">Стоимость</p>
            <p className="mt-1 text-[32px] font-semibold tracking-[-0.04em] tabular">{p.priceFrom != null ? `от ${rub(p.priceFrom)}` : "По договорённости"}</p>
            <div className="mt-3 flex items-center gap-2 text-[14px]">
              <RatingInline value={p.ratingAvg} count={p.reviewsCount} />
              <span className="text-line-strong">•</span>
              <span className="text-ink-2">{responseTime(p.responseTimeMin)}</span>
            </div>
            <div className="mt-5">{actions}</div>
            {provider.phone && provider.showPhone && (
              <a href={`tel:${provider.phone.replace(/[^\d+]/g, "")}`} className={buttonClass({ variant: "ghost", size: "md", block: true, className: "mt-2" })}>
                <Phone className="h-4 w-4" /> {formatPhone(provider.phone) || provider.phone}
              </a>
            )}
            {provider.telegram && (
              <a href={`https://t.me/${provider.telegram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "ghost", size: "md", block: true })}>
                <MessageCircle className="h-4 w-4" /> Telegram {provider.telegram}
              </a>
            )}
            {provider.schedule && (
              <div className="mt-5 border-t border-line pt-5">
                <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted">График</p>
                <ul className="grid grid-cols-7 gap-1 text-center">
                  {DAYS.map(([k, l]) => {
                    const d = provider.schedule![k];
                    return (
                      <li key={k} className={cn("rounded-xl py-2", d ? "bg-accent-soft" : "bg-surface-2 text-muted")} title={d ? `${d.from}–${d.to}` : "Выходной"}>
                        <span className="block text-[12px] font-semibold">{l}</span>
                        <span className="mt-0.5 block text-[10px] tabular">{d ? d.from.slice(0, 2) + "–" + d.to.slice(0, 2) : "—"}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-14 px-4 lg:px-0">
          <h2 className="title mb-4 text-[24px]">Похожие специалисты</h2>
          <Rail>
            {similar.map((s) => (
              <ProviderCard key={s.id} p={s} />
            ))}
          </Rail>
        </section>
      )}

      {/* Mobile sticky actions */}
      {!isOwner && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(10px,var(--safe-bottom))] lg:hidden">
          <div className="glass mx-auto max-w-[520px] rounded-[28px] p-2 shadow-float">
            <div className="flex items-center justify-between px-3 pb-2 pt-1 text-[13px]">
              <span className="font-semibold tabular">{p.priceFrom != null ? `от ${rub(p.priceFrom)}` : "Цена по договорённости"}</span>
              <span className="text-muted">{responseTime(p.responseTimeMin)}</span>
            </div>
            {actions}
          </div>
        </div>
      )}
      {isOwner && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(10px,var(--safe-bottom))] lg:bottom-6 lg:left-auto lg:right-6">
          <Link href="/pro/profile" className={buttonClass({ variant: "primary", size: "lg", block: true, className: "mx-auto max-w-[520px] shadow-float" })}>
            Редактировать профиль
          </Link>
        </div>
      )}
    </main>
  );
}
