import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { anyChannelOn } from "@/server/billing";
import { ProNav } from "./pro-nav";

export default async function ProLayout({ children }: LayoutProps<"/pro">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/pro");
  if (!user.provider) redirect("/become-provider");
  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-32 pt-[calc(var(--safe-top)+12px)] lg:px-6 lg:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-muted">Кабинет исполнителя</p>
          <h1 className="display text-[34px] lg:text-[44px]">{user.provider.displayName}</h1>
        </div>
        <Link href={`/provider/${user.provider.slug}`} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink-2 hover:text-ink">
          Мой публичный профиль <ExternalLink className="h-4 w-4" />
        </Link>
      </div>
      {/* Pinned to the very top on phones (the global top bar is hidden in the cabinet) with a soft fade under it. */}
      <div className="sticky top-0 z-20 -mx-4 mt-3 bg-bg/80 px-4 pb-2 pt-[calc(var(--safe-top)+8px)] backdrop-blur-xl after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-5 after:bg-gradient-to-b after:from-bg/70 after:to-transparent lg:top-[88px] lg:mx-0 lg:bg-transparent lg:px-0 lg:pt-2 lg:backdrop-blur-none lg:after:hidden">
        <ProNav billing={anyChannelOn()} />
      </div>
      <div className="mt-4">{children}</div>
    </main>
  );
}
