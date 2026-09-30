import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-[var(--radius-field)] border border-transparent bg-surface-2 px-4 text-[15px] text-ink transition-[border-color,background-color,box-shadow] outline-none placeholder:text-muted hover:bg-surface-3 focus:border-ink focus:bg-surface focus:shadow-[0_0_0_4px_var(--accent-soft)] aria-[invalid=true]:border-danger disabled:opacity-60";

export function Field({ label, hint, error, children, className, htmlFor, optional }: { label?: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string; htmlFor?: string; optional?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="px-1 text-[13px] font-semibold text-ink-2">
          {label} {optional && <span className="font-normal text-muted">· необязательно</span>}
        </label>
      )}
      {children}
      {error ? (
        <p role="alert" className="px-1 text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="px-1 text-[13px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: ReactNode; error?: string | null; optional?: boolean; leading?: ReactNode }>(function Input(
  { label, hint, error, optional, className, id, leading, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} optional={optional} className={className}>
      <div className="relative">
        {leading && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">{leading}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error || undefined}
          // iOS gives date/time inputs an intrinsic width and centred text; keep them inside their column like other fields
          className={cn(control, "h-[52px] min-w-0", leading && "pl-11", (rest.type === "date" || rest.type === "time" || rest.type === "datetime-local") && "block appearance-none text-left [&::-webkit-date-and-time-value]:text-left")}
          {...rest}
        />
      </div>
    </Field>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: ReactNode; error?: string | null; optional?: boolean }>(function Textarea(
  { label, hint, error, optional, className, id, rows = 4, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} optional={optional} className={className}>
      <textarea ref={ref} id={inputId} rows={rows} aria-invalid={!!error || undefined} className={cn(control, "resize-none py-3.5 leading-relaxed")} {...rest} />
    </Field>
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: ReactNode; error?: string | null; optional?: boolean }>(function Select(
  { label, hint, error, optional, className, id, children, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} optional={optional} className={className}>
      <select ref={ref} id={inputId} aria-invalid={!!error || undefined} className={cn(control, "h-[52px] appearance-none bg-size-[16px] bg-position-[right_16px_center] bg-no-repeat pr-10")} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237a7a80' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
        {children}
      </select>
    </Field>
  );
});
