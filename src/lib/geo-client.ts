"use client";
import type { TgWebApp } from "@/components/telegram/types";

/** Location via Telegram LocationManager (Bot API 8.0+) or the browser Geolocation API. Never forced. */
export function getLocation(webApp?: TgWebApp | null): Promise<{ lat: number; lng: number }> {
  const lm = webApp?.LocationManager;
  if (lm && webApp?.isVersionAtLeast("8.0")) {
    return new Promise((resolve, reject) => {
      const go = () =>
        lm.getLocation((loc) => (loc ? resolve({ lat: loc.latitude, lng: loc.longitude }) : reject(new Error("Нет доступа к геолокации. Разрешите его в настройках Telegram или выберите район вручную."))));
      if (lm.isInited) go();
      else lm.init(go);
    });
  }
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Геолокация недоступна в этом браузере. Выберите район вручную."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => reject(new Error(err.code === 1 ? "Доступ к местоположению запрещён. Выберите район вручную." : "Не удалось определить местоположение. Выберите район вручную.")),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}

/** Nearest district by straight-line distance. */
export function nearestDistrict<T extends { lat: number; lng: number }>(pos: { lat: number; lng: number }, districts: T[]): T | null {
  let best: T | null = null;
  let bd = Infinity;
  for (const d of districts) {
    const dd = (d.lat - pos.lat) ** 2 + ((d.lng - pos.lng) * Math.cos((pos.lat * Math.PI) / 180)) ** 2;
    if (dd < bd) {
      bd = dd;
      best = d;
    }
  }
  return best;
}
