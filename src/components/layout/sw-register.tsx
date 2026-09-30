"use client";
import { useEffect } from "react";

/** Registers the PWA service worker (production only, not inside Telegram WebView). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    if (document.documentElement.dataset.tg === "1") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
