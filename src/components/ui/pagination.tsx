import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClass } from "./button";

export function Pagination({ page, total, pageSize, href }: { page: number; total: number; pageSize: number; href: (p: number) => string }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <nav aria-label="Страницы" className="mt-8 flex items-center justify-center gap-2">
      {page > 1 && (
        <Link href={href(page - 1)} className={buttonClass({ variant: "surface", size: "md" })} rel="prev">
          <ChevronLeft className="h-4 w-4" /> Назад
        </Link>
      )}
      <span className="px-3 text-[14px] text-muted tabular">
        {page} из {pages}
      </span>
      {page < pages && (
        <Link href={href(page + 1)} className={buttonClass({ variant: "surface", size: "md" })} rel="next">
          Дальше <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </nav>
  );
}
