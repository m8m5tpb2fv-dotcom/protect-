"use client";
import { useState } from "react";

/**
 * Single-series column chart (one ink hue, no legend needed — the title names it).
 * Hover/focus shows a tooltip; a visually-hidden table carries the data for screen readers.
 */
export function ColumnChart({ data, unit, label }: { data: { day: string; value: number }[]; unit?: "rub"; label: string }) {
  const format = (v: number) => (unit === "rub" ? `${Math.round(v).toLocaleString("ru-RU")} ₽` : v.toLocaleString("ru-RU"));
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = 600;
  const H = 180;
  const gap = 2;
  const bw = W / data.length - gap;
  const fmtDay = (d: string) => new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[180px] w-full" role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={0} x2={W} y1={H - H * f} y2={H - H * f} stroke="var(--line)" strokeWidth={1} />
        ))}
        {data.map((d, i) => {
          const h = Math.max(d.value > 0 ? 3 : 0, (d.value / max) * (H - 8));
          const x = i * (bw + gap);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${fmtDay(d.day)}: ${format(d.value)}`}>
              <rect x={x} y={0} width={bw + gap} height={H} fill="transparent" />
              <path d={`M${x},${H} L${x},${H - h + Math.min(4, h)} Q${x},${H - h} ${x + Math.min(4, bw / 2)},${H - h} L${x + bw - Math.min(4, bw / 2)},${H - h} Q${x + bw},${H - h} ${x + bw},${H - h + Math.min(4, h)} L${x + bw},${H} Z`} fill={hover === i ? "var(--ink)" : "color-mix(in srgb, var(--ink) 72%, transparent)"} />
            </g>
          );
        })}
</svg>
      {hover != null && data[hover] && (
        <div className="pointer-events-none absolute -top-2 rounded-xl bg-inverse px-3 py-1.5 text-[12.5px] text-inverse-ink shadow-float" style={{ left: `clamp(0px, calc(${((hover + 0.5) / data.length) * 100}% - 50px), calc(100% - 110px))` }}>
          <span className="opacity-70">{fmtDay(data[hover].day)}</span> · <b className="tabular">{format(data[hover].value)}</b>
        </div>
      )}
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <th>{d.day}</th>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Ranked horizontal bars — magnitude in one hue, values in text ink. */
export function RankBars({ rows }: { rows: { name: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.name} className="grid grid-cols-[120px_1fr_40px] items-center gap-3 text-[13.5px]" title={`${r.name}: ${r.count}`}>
          <span className="truncate">{r.name}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full rounded-full bg-ink/75" style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="text-right font-semibold tabular">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}
