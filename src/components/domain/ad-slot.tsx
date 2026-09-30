import { ArrowUpRight } from "lucide-react";
import { pickAd, type AdSlot as Slot } from "@/server/services/ads";
import { cn } from "@/lib/cn";

/**
 * Advertising placement. Renders nothing while the "ads" channel is off or no campaign is live.
 * Always labelled «Реклама» with the advertiser and erid (38-ФЗ); links are rel="sponsored".
 */
export async function AdSlot({ slot, categoryId, className }: { slot: Slot; categoryId?: number; className?: string }) {
  const ad = await pickAd(slot, categoryId);
  if (!ad) return null;
  return (
    <aside aria-label="Реклама" className={cn("rounded-[26px] bezel p-4", className)}>
      <a href={`/api/ads/${ad.id}`} target="_blank" rel="sponsored noopener" className="press flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold">{ad.title}</p>
          {ad.body && <p className="mt-0.5 line-clamp-2 text-[14px] text-ink-2">{ad.body}</p>}
        </div>
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2">
          <ArrowUpRight className="h-5 w-5" />
        </span>
      </a>
      <p className="mt-2 text-[11.5px] text-muted">
        Реклама · {ad.advertiser}
        {ad.erid ? ` · erid: ${ad.erid}` : ""}
      </p>
    </aside>
  );
}
