import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { APP } from "@/config/app";
import { env } from "@/server/env";
import { getCurrentUser } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Вход", robots: { index: false } };

function safeNext(n: unknown) {
  return typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return <LoginForm next={next} demo={env.DEMO_MODE} telegramBot={APP.telegramBot} telegramEnabled={!!env.TELEGRAM_BOT_TOKEN} />;
}
