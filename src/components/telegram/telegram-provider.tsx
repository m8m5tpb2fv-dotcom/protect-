"use client";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, setBearerToken } from "@/lib/api-client";
import { decodeStartParam } from "@/lib/deeplink";
import type { TgWebApp } from "./types";

type Haptic = "light" | "medium" | "heavy" | "success" | "error" | "warning" | "select";
type TgCtx = { isTelegram: boolean; webApp: TgWebApp | null; haptic: (h: Haptic) => void; authError: string | null };

const Ctx = createContext<TgCtx>({ isTelegram: false, webApp: null, haptic: () => {}, authError: null });
export const useTelegram = () => useContext(Ctx);

/** Top-level routes where the Telegram BackButton is hidden. */
const ROOT_PATHS = new Set(["/", "/search", "/orders", "/messages", "/profile", "/services"]);

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Maps Telegram theme onto our tokens. Accent stays brand; paper/ink/hint come from Telegram. */
function applyTheme(wa: TgWebApp) {
  const root = document.documentElement;
  const t = wa.themeParams;
  const scheme = wa.colorScheme === "dark" || (t.bg_color && luminance(t.bg_color) < 0.2) ? "dark" : "light";
  root.dataset.theme = scheme;
  const set = (k: string, v?: string) => (v ? root.style.setProperty(k, v) : root.style.removeProperty(k));
  set("--bg", t.secondary_bg_color || t.bg_color);
  set("--surface", t.section_bg_color || t.bg_color);
  set("--ink", t.text_color);
  set("--muted", t.hint_color);
  const bg = t.secondary_bg_color || t.bg_color;
  try {
    if (bg) {
      wa.setHeaderColor(bg);
      wa.setBackgroundColor(bg);
      wa.setBottomBarColor?.(bg);
    }
  } catch {}
}

function applyInsets(wa: TgWebApp) {
  const root = document.documentElement;
  const s = wa.safeAreaInset;
  const c = wa.contentSafeAreaInset;
  root.style.setProperty("--tg-safe-top", `${(s?.top ?? 0) + (c?.top ?? 0)}px`);
  root.style.setProperty("--tg-safe-bottom", `${(s?.bottom ?? 0) + (c?.bottom ?? 0)}px`);
}

export function TelegramProvider({ children, isAuthed }: { children: ReactNode; isAuthed: boolean }) {
  const [webApp, setWebApp] = useState<TgWebApp | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const authStarted = useRef(false);

  // 1. wait for the SDK (injected in <head> only when launched from Telegram)
  useEffect(() => {
    if (document.documentElement.dataset.tg !== "1") return;
    let tries = 0;
    const id = setInterval(() => {
      const wa = window.Telegram?.WebApp;
      if (wa && wa.initData) {
        clearInterval(id);
        wa.ready();
        wa.expand();
        try {
          wa.disableVerticalSwipes?.();
        } catch {}
        applyTheme(wa);
        applyInsets(wa);
        const onTheme = () => applyTheme(wa);
        const onInsets = () => applyInsets(wa);
        wa.onEvent("themeChanged", onTheme);
        wa.onEvent("safeAreaChanged", onInsets);
        wa.onEvent("contentSafeAreaChanged", onInsets);
        setWebApp(wa);
      } else if (++tries > 60) {
        clearInterval(id); // SDK failed to load — keep working as a normal web app
        document.documentElement.dataset.tg = "0";
      }
    }, 50);
    return () => clearInterval(id);
  }, []);

  // 2. automatic sign-in with signed initData
  useEffect(() => {
    if (!webApp || authStarted.current) return;
    authStarted.current = true;
    const startPath = decodeStartParam(webApp.initDataUnsafe.start_param);
    const handledKey = "ryadom_tg_start_handled";
    const shouldRoute = startPath && sessionStorage.getItem(handledKey) !== webApp.initDataUnsafe.start_param;
    (async () => {
      if (!isAuthed) {
        try {
          const r = await api<{ token: string }>("/api/auth/telegram", { body: { initData: webApp.initData } });
          setBearerToken(r.token);
        } catch (e) {
          setAuthError((e as Error).message);
        }
      }
      if (shouldRoute) {
        sessionStorage.setItem(handledKey, webApp.initDataUnsafe.start_param!);
        router.replace(startPath!);
      }
      router.refresh();
    })();
  }, [webApp, isAuthed, router]);

  // 3. native BackButton for nested screens
  useEffect(() => {
    if (!webApp) return;
    const bb = webApp.BackButton;
    const onBack = () => (window.history.length > 1 ? router.back() : router.push("/"));
    if (ROOT_PATHS.has(pathname)) bb.hide();
    else bb.show();
    bb.onClick(onBack);
    return () => bb.offClick(onBack);
  }, [webApp, pathname, router]);

  const haptic = useCallback(
    (h: Haptic) => {
      const hf = webApp?.HapticFeedback;
      if (!hf) return;
      try {
        if (h === "success" || h === "error" || h === "warning") hf.notificationOccurred(h);
        else if (h === "select") hf.selectionChanged();
        else hf.impactOccurred(h);
      } catch {}
    },
    [webApp],
  );

  const value = useMemo(() => ({ isTelegram: !!webApp, webApp, haptic, authError }), [webApp, haptic, authError]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Binds Telegram's MainButton while the component is mounted.
 * Returns true when the native button is used, so the caller can hide its own.
 */
export function useMainButton(opts: { text: string; onClick: () => void; enabled?: boolean; loading?: boolean; visible?: boolean }) {
  const { webApp } = useTelegram();
  const cb = useRef(opts.onClick);
  useEffect(() => {
    cb.current = opts.onClick;
  });
  const visible = opts.visible ?? true;
  useEffect(() => {
    if (!webApp) return;
    const mb = webApp.MainButton;
    const handler = () => cb.current();
    mb.onClick(handler);
    return () => {
      mb.offClick(handler);
      mb.hide();
    };
  }, [webApp]);
  useEffect(() => {
    if (!webApp) return;
    const mb = webApp.MainButton;
    mb.setParams({ text: opts.text, is_active: opts.enabled ?? true, is_visible: visible, color: "#D4F25C", text_color: "#0D0D0F" });
    if (opts.loading) mb.showProgress(false);
    else mb.hideProgress();
  }, [webApp, opts.text, opts.enabled, opts.loading, visible]);
  return !!webApp && visible;
}
