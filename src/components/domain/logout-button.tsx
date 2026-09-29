"use client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { api, setBearerToken } from "@/lib/api-client";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await api("/api/auth/logout", { method: "POST" }).catch(() => {});
        setBearerToken(null);
        router.replace("/");
        router.refresh();
      }}
      className="press flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 text-left text-[15px] font-medium text-danger hover:bg-danger-soft"
    >
      <LogOut className="h-5 w-5" /> Выйти
    </button>
  );
}
