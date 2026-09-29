import Link from "next/link";
import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { Pagination } from "../ui/pagination";

export function AdminPage({ title, subtitle, children, actions }: { title: string; subtitle?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="title text-[28px]">{title}</h1>
          {subtitle && <p className="mt-1 text-[14px] text-muted">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function Filters({ base, q, status, statuses }: { base: string; q?: string; status?: string; statuses?: { v: string; l: string }[] }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <form action={base} className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input name="q" defaultValue={q} placeholder="Поиск" aria-label="Поиск" className="h-10 w-64 rounded-xl bezel pl-10 pr-3 text-[14px] outline-none ring-1 ring-line focus:ring-2 focus:ring-ink" />
        {status && <input type="hidden" name="status" value={status} />}
      </form>
      {statuses?.map((s) => (
        <Link key={s.v} href={`${base}?${new URLSearchParams({ ...(q ? { q } : {}), ...(s.v ? { status: s.v } : {}) })}`} className={cn("inline-flex h-10 items-center rounded-xl px-3.5 text-[13.5px] font-semibold", (status ?? "") === s.v ? "bg-ink text-bg" : "bezel ring-1 ring-line")}>
          {s.l}
        </Link>
      ))}
    </div>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-[20px] bezel">
      <table className="w-full min-w-[720px] text-left text-[13.5px]">
        <thead className="border-b border-line text-[12px] uppercase tracking-wide text-muted">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line [&_td]:px-4 [&_td]:py-3 [&_td]:align-top">{children}</tbody>
      </table>
      {empty && <p className="p-8 text-center text-[14px] text-muted">Ничего не найдено</p>}
    </div>
  );
}

export function AdminPagination({ page, total, pageSize, base, params }: { page: number; total: number; pageSize: number; base: string; params: Record<string, string | undefined> }) {
  return (
    <Pagination
      page={page}
      total={total}
      pageSize={pageSize}
      href={(p) => `${base}?${new URLSearchParams({ ...(Object.fromEntries(Object.entries(params).filter(([, v]) => v)) as Record<string, string>), page: String(p) })}`}
    />
  );
}

export function sp(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
