"use client";
import { usePathname } from "next/navigation";
import { Segmented } from "@/components/ui/segmented";

const ITEMS = [
  { value: "/pro", label: "Заявки" },
  { value: "/pro/profile", label: "Профиль" },
  { value: "/pro/services", label: "Услуги" },
  { value: "/pro/portfolio", label: "Портфолио" },
  { value: "/pro/billing", label: "Продвижение" },
];

export function ProNav() {
  const pathname = usePathname();
  return <Segmented className="w-full sm:w-auto" value={pathname} items={ITEMS.map((i) => ({ ...i, href: i.value }))} />;
}
