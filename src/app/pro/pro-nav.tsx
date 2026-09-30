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

/** `billing` = at least one optional paid channel is on; otherwise the tab does not exist. */
export function ProNav({ billing }: { billing: boolean }) {
  const pathname = usePathname();
  const items = billing ? ITEMS : ITEMS.filter((i) => i.value !== "/pro/billing");
  return <Segmented className="w-full sm:w-auto" value={pathname} items={items.map((i) => ({ ...i, href: i.value }))} />;
}
