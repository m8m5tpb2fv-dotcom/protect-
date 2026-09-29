import type { MetadataRoute } from "next";
import { APP } from "@/config/app";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP.name} — ${APP.tagline}`,
    short_name: APP.name,
    description: APP.description,
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    lang: "ru",
    categories: ["lifestyle", "business", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Создать заявку", url: "/order/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Мои заказы", url: "/orders" },
      { name: "Сообщения", url: "/messages" },
    ],
  };
}
