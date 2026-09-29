"use client";
/* eslint-disable @next/next/no-img-element */
import { ImagePlus, Images, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, uploadFile } from "@/lib/api-client";
import { Button, Spinner } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { useToast } from "@/components/ui/toast";

type Item = { id: string; url: string; width: number; height: number; caption: string; kind: "image" | "video" };

export function PortfolioEditor({ items }: { items: Item[] }) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [caption, setCaption] = useState("");
  const router = useRouter();
  const toast = useToast();
  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const f of [...files].slice(0, 12)) {
      setUploading((n) => n + 1);
      try {
        const r = await uploadFile(f, "portfolio");
        await api("/api/provider/portfolio", { body: { url: r.url, width: r.width || 1280, height: r.height || 720, caption } });
      } catch (e) {
        toast(`${f.name}: ${(e as Error).message}`, "error");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    setCaption("");
    router.refresh();
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-5 shadow-card sm:flex-row sm:items-center">
        <div className="flex-1">
          <h2 className="title text-[22px]">Портфолио</h2>
          <p className="text-[14px] text-muted">Фото JPG/PNG/HEIC до 12 МБ и видео MP4/WebM до 60 МБ. Метаданные (в т.ч. геолокация) удаляются автоматически.</p>
          <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} placeholder="Подпись к работам (необязательно)" aria-label="Подпись" className="mt-3 h-11 w-full rounded-2xl bg-surface-2 px-4 text-[15px] outline-none focus:ring-2 focus:ring-ink" />
        </div>
        <Button size="lg" onClick={() => ref.current?.click()} loading={uploading > 0}>
          <ImagePlus className="h-5 w-5" /> Загрузить
        </Button>
        <input ref={ref} type="file" accept="image/*,video/mp4,video/webm" multiple hidden onChange={(e) => (onFiles(e.target.files), (e.target.value = ""))} />
      </div>
      {items.length === 0 && !uploading ? (
        <EmptyState icon={Images} title="Покажите свои работы" text="Клиенты выбирают глазами: 5–10 фото «до/после» заметно повышают доверие." />
      ) : (
        <div className="masonry columns-2 md:columns-4">
          {Array.from({ length: uploading }).map((_, i) => (
            <div key={i} className="skeleton flex aspect-square items-center justify-center rounded-[20px]">
              <Spinner />
            </div>
          ))}
          {items.map((it) => (
            <div key={it.id} className="group relative overflow-hidden rounded-[20px] bg-surface-2" style={{ aspectRatio: `${it.width}/${it.height}` }}>
              {it.kind === "video" ? <video src={it.url} muted playsInline className="absolute inset-0 h-full w-full object-cover" /> : <img src={it.url} alt={it.caption} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />}
              <button
                onClick={async () => {
                  if (!confirm("Удалить работу?")) return;
                  await api(`/api/provider/portfolio/${it.id}`, { method: "DELETE" }).catch((e) => toast(e.message, "error"));
                  router.refresh();
                }}
                className="glass absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-danger opacity-100 md:opacity-0 md:group-hover:opacity-100"
                aria-label="Удалить"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              {it.caption && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-2.5 pt-6 text-[12px] text-white">{it.caption}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
