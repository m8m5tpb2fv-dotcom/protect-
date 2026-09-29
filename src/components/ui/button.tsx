import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-ink text-bg hover:bg-ink/90 shadow-soft",
  accent: "bg-accent text-accent-ink hover:bg-accent-strong shadow-[0_8px_24px_-10px_color-mix(in_srgb,var(--accent)_70%,transparent)]",
  secondary: "bg-surface-2 text-ink hover:bg-surface-3",
  surface: "bg-surface text-ink border border-line hover:border-line-strong shadow-soft",
  ghost: "text-ink hover:bg-surface-2",
  glass: "glass text-ink hover:bg-glass-strong",
  danger: "bg-danger-soft text-danger hover:bg-danger/15",
  outline: "border border-line-strong text-ink hover:bg-surface-2",
} as const;

const sizes = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5 rounded-xl",
  md: "h-11 px-5 text-[15px] gap-2 rounded-2xl",
  lg: "h-14 px-6 text-base gap-2.5 rounded-[20px]",
  icon: "h-11 w-11 rounded-full",
  "icon-sm": "h-9 w-9 rounded-full",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

type Common = { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean; className?: string; children?: ReactNode; block?: boolean };

export function buttonClass({ variant = "primary", size = "md", block, className }: Omit<Common, "children" | "loading">) {
  return cn(
    "press relative inline-flex select-none items-center justify-center whitespace-nowrap font-semibold tracking-[-0.01em] outline-offset-2 disabled:opacity-45",
    variants[variant],
    sizes[size],
    block && "w-full",
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, Common & ButtonHTMLAttributes<HTMLButtonElement>>(function Button(
  { variant, size, loading, className, children, block, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass({ variant, size, block, className })} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Spinner className="absolute" />}
      <span className={cn("inline-flex items-center justify-center gap-[inherit]", loading && "invisible")}>{children}</span>
    </button>
  );
});

export function ButtonLink({ href, variant, size, className, children, block, prefetch, ...rest }: Common & { href: string; prefetch?: boolean; "aria-label"?: string; target?: string; rel?: string }) {
  return (
    <Link href={href} prefetch={prefetch} className={buttonClass({ variant, size, block, className })} {...rest}>
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)} />;
}
