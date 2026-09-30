import type { MetadataRoute } from "next";
import { APP } from "@/config/app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/services", "/provider/"], disallow: ["/api/", "/admin", "/orders", "/messages", "/pro", "/profile", "/settings", "/login", "/order/new", "/files/private/"] }],
    sitemap: `${APP.url}/sitemap.xml`,
  };
}
