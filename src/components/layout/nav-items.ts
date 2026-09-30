import { BriefcaseBusiness, House, MessageCircle, Search, UserRound, ClipboardList } from "lucide-react";

export const NAV = {
  home: { href: "/", label: "Главная", icon: House },
  search: { href: "/search", label: "Поиск", icon: Search },
  orders: { href: "/orders", label: "Заказы", icon: ClipboardList },
  messages: { href: "/messages", label: "Сообщения", icon: MessageCircle },
  profile: { href: "/profile", label: "Профиль", icon: UserRound },
  pro: { href: "/pro", label: "Кабинет", icon: BriefcaseBusiness },
};

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
