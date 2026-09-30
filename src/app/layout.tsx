import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { APP } from "@/config/app";
import { getCurrentUser } from "@/server/auth/session";
import { getCurrentCity } from "@/server/services/catalog";
import { summary } from "@/server/services/account";
import { env } from "@/server/env";
import { SessionProvider } from "@/components/layout/session-provider";
import { TelegramProvider } from "@/components/telegram/telegram-provider";
import { ToastProvider } from "@/components/ui/toast";
import { BottomNav } from "@/components/layout/bottom-nav";
import { DesktopHeader, MobileTopBar } from "@/components/layout/header";
import { Onboarding } from "@/components/domain/onboarding";
import { ServiceWorkerRegistrar } from "@/components/layout/sw-register";

export const metadata: Metadata = {
  metadataBase: new URL(APP.url),
  title: { default: `${APP.name} — ${APP.tagline.toLowerCase()} в Саратове`, template: `%s · ${APP.name}` },
  description: APP.description,
  applicationName: APP.name,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: APP.name, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  openGraph: { type: "website", locale: "ru_RU", siteName: APP.name },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#000000" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

/** Runs before paint: resolves system theme and detects Telegram Mini App launch. */
const BOOT = `(function(){try{var d=document.documentElement;var p=d.getAttribute('data-theme-pref');if(p==='system'){d.setAttribute('data-theme',matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}var tg=location.hash.indexOf('tgWebAppData')>-1||sessionStorage.getItem('ryadom_tg')==='1';if(tg){sessionStorage.setItem('ryadom_tg','1');d.setAttribute('data-tg','1');var s=document.createElement('script');s.src='https://telegram.org/js/telegram-web-app.js?59';s.async=false;document.head.appendChild(s)}}catch(e){}})();`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const jar = await cookies();
  const pref = jar.get("ryadom_theme")?.value ?? "dark"; // dark-first, as in the visual references
  const [user, city] = await Promise.all([getCurrentUser(), getCurrentCity()]);
  const counts = user ? await summary(user) : { unreadNotifications: 0, unreadMessages: 0 };
  const onboarded = jar.get("ryadom_onboarded")?.value === "1";
  const sessionUser = user
    ? {
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        provider: user.provider ? { id: user.provider.id, slug: user.provider.slug, status: user.provider.status, displayName: user.provider.displayName, isAvailable: user.provider.isAvailable } : null,
      }
    : null;

  return (
    <html lang="ru" data-theme-pref={pref} data-theme={pref === "dark" ? "dark" : "light"} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
        <link rel="preload" href="/fonts/inter-cyrillic-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-xl focus:bg-ink focus:px-4 focus:py-2 focus:text-bg">
          Перейти к содержимому
        </a>
        <SessionProvider user={sessionUser} initialCounts={counts} city={{ slug: city.slug, name: city.name, nameIn: city.nameIn }} demoMode={env.DEMO_MODE}>
          <TelegramProvider isAuthed={!!user}>
            <ToastProvider>
              <DesktopHeader />
              <MobileTopBar />
              <div id="main" className="flex min-h-[calc(100dvh-80px)] flex-col">{children}</div>
              <BottomNav />
              {!onboarded && !user && <Onboarding />}
              <ServiceWorkerRegistrar />
            </ToastProvider>
          </TelegramProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
