import Link from "next/link";
import { APP } from "@/config/app";
import { getCatalog } from "@/server/services/catalog";
import { Logo } from "./logo";

export async function SiteFooter() {
  const catalog = await getCatalog();
  return (
    <footer className="mt-16 border-t border-line pt-10 text-[14px] text-muted lg:mt-24">
      <div className="grid gap-8 md:grid-cols-[1.2fr_2fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs leading-relaxed">{APP.tagline}. Мастера и специалисты Саратова — сантехники, электрики, клининг, репетиторы, фотографы и ещё 40+ профессий.</p>
          <p className="mt-4">Скоро: Энгельс, Самара, Волгоград, Казань</p>
        </div>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          <div>
            <h3 className="mb-3 font-semibold text-ink">Клиентам</h3>
            <ul className="space-y-2">
              <li><Link href="/order/new" className="hover:text-ink">Создать заявку</Link></li>
              <li><Link href="/services" className="hover:text-ink">Все услуги</Link></li>
              <li><Link href="/search" className="hover:text-ink">Поиск специалистов</Link></li>
              <li><Link href="/support" className="hover:text-ink">Поддержка</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 font-semibold text-ink">Исполнителям</h3>
            <ul className="space-y-2">
              <li><Link href="/become-provider" className="hover:text-ink">Стать исполнителем</Link></li>
              <li><Link href="/pro" className="hover:text-ink">Кабинет</Link></li>
              <li><Link href="/pro/billing" className="hover:text-ink">Продвижение и Pro</Link></li>
            </ul>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <h3 className="mb-3 font-semibold text-ink">Популярное в Саратове</h3>
            <ul className="space-y-2">
              {catalog.categories.slice(0, 3).flatMap((c) => c.subs.slice(0, 2)).map((s) => (
                <li key={s.id}>
                  <Link href={`/services/${s.slug}`} className="hover:text-ink">
                    {s.namePlural} в Саратове
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="mt-10 flex flex-col gap-2 border-t border-line py-6 text-[13px] sm:flex-row sm:justify-between">
        <span>© {new Date().getFullYear()} {APP.name}. Статусы проверки — это статусы модерации платформы, а не юридическая гарантия.</span>
        <span>
          <Link href="/support" className="hover:text-ink">{APP.supportEmail}</Link>
        </span>
      </div>
    </footer>
  );
}
