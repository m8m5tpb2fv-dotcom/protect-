import type { Metadata } from "next";
import { pageProvider } from "@/server/auth/session";
import { getOwnProvider } from "@/server/services/provider-self";
import { PortfolioEditor } from "./editor";

export const metadata: Metadata = { title: "Портфолио", robots: { index: false } };

export default async function ProPortfolioPage() {
  const user = await pageProvider();
  const own = (await getOwnProvider(user))!;
  return <PortfolioEditor items={own.portfolio.map((p) => ({ id: p.id, url: p.url, width: p.width, height: p.height, caption: p.caption, kind: p.kind }))} />;
}
