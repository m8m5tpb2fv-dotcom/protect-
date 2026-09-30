"use client";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Accessible modal built on <dialog>: bottom sheet on phones, centered card on larger screens.
 * Native dialog gives us focus trapping, Esc handling and inert background for free.
 */
export function Sheet({ open, onClose, title, children, className, footer, wide }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; className?: string; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!open && d.open) {
      d.close();
    }
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={() => {
        document.documentElement.style.overflow = "";
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
      className={cn(
        "m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-[30px] bg-surface p-0 text-ink shadow-float backdrop:bg-black/40 backdrop:backdrop-blur-[2px] open:animate-sheet",
        "md:m-auto md:max-w-lg md:rounded-[30px] md:open:animate-pop",
        wide && "md:max-w-2xl",
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line-strong md:hidden" aria-hidden />
          {title && (
            <div className="flex items-center justify-between gap-3 px-6 pb-2 pt-4 md:pt-6">
              <h2 className="title text-xl">{title}</h2>
              <button onClick={onClose} className="press -mr-2 inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Закрыть">
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
          <div className="overflow-y-auto overscroll-contain px-6 pb-6 pt-2">{children}</div>
          {footer && <div className="border-t border-line px-6 py-4 pb-[max(1rem,var(--safe-bottom))]">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
