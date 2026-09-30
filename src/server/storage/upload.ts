import "server-only";
import { randomUUID } from "node:crypto";
import sharp, { type OutputInfo } from "sharp";
import { badRequest } from "../http/errors";
import { fileUrl, storage } from "./index";

export const UPLOAD_PURPOSES = {
  avatar: { maxW: 512, maxH: 512, fit: "cover" as const, private: false, allowVideo: false, allowPdf: false },
  cover: { maxW: 2000, maxH: 1200, fit: "inside" as const, private: false, allowVideo: false, allowPdf: false },
  portfolio: { maxW: 2000, maxH: 2000, fit: "inside" as const, private: false, allowVideo: true, allowPdf: false },
  order: { maxW: 1600, maxH: 1600, fit: "inside" as const, private: false, allowVideo: false, allowPdf: false },
  chat: { maxW: 1600, maxH: 1600, fit: "inside" as const, private: false, allowVideo: false, allowPdf: false },
  review: { maxW: 1600, maxH: 1600, fit: "inside" as const, private: false, allowVideo: false, allowPdf: false },
  document: { maxW: 2400, maxH: 2400, fit: "inside" as const, private: true, allowVideo: false, allowPdf: true },
} as const;
export type UploadPurpose = keyof typeof UPLOAD_PURPOSES;

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

function sniff(buf: Buffer): "jpeg" | "png" | "webp" | "gif" | "heic" | "avif" | "pdf" | "mp4" | "webm" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.toString("ascii", 0, 3) === "GIF") return "gif";
  if (buf.toString("ascii", 0, 5) === "%PDF-") return "pdf";
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "webm";
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (/^(heic|heix|hevc|mif1|msf1)/.test(brand)) return "heic";
    if (/^avi[fs]/.test(brand)) return "avif";
    return "mp4";
  }
  return null;
}

/**
 * Validates by magic bytes (never by the client-provided MIME), re-encodes
 * images to WebP (strips EXIF incl. GPS), bounds dimensions and stores.
 */
export async function processUpload(userId: string, purpose: UploadPurpose, file: File) {
  const cfg = UPLOAD_PURPOSES[purpose];
  if (file.size === 0) throw badRequest("Файл пустой");
  if (file.size > MAX_VIDEO_BYTES) throw badRequest("Файл слишком большой");
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniff(buf);
  if (!kind) throw badRequest("Поддерживаются фото JPG, PNG, WebP, HEIC" + (cfg.allowVideo ? ", видео MP4/WebM" : "") + (cfg.allowPdf ? ", PDF" : ""));
  const base = `${cfg.private ? "private/" : ""}${purpose}/${userId.slice(0, 8)}/${randomUUID()}`;

  if (kind === "mp4" || kind === "webm") {
    if (!cfg.allowVideo) throw badRequest("Видео здесь загрузить нельзя");
    const key = `${base}.${kind}`;
    await storage().put(key, buf, kind === "mp4" ? "video/mp4" : "video/webm");
    return { url: fileUrl(key), kind: "video" as const, width: 1280, height: 720 };
  }
  if (kind === "pdf") {
    if (!cfg.allowPdf) throw badRequest("PDF здесь загрузить нельзя");
    if (buf.length > MAX_IMAGE_BYTES) throw badRequest("PDF — не больше 12 МБ");
    const key = `${base}.pdf`;
    await storage().put(key, buf, "application/pdf");
    return { url: fileUrl(key), kind: "pdf" as const, width: 0, height: 0 };
  }
  if (buf.length > MAX_IMAGE_BYTES) throw badRequest("Фото — не больше 12 МБ");
  let out: { data: Buffer; info: OutputInfo };
  try {
    out = await sharp(buf, { limitInputPixels: 50_000_000, failOn: "error" })
      .rotate() // respect EXIF orientation before stripping metadata
      .resize({ width: cfg.maxW, height: cfg.maxH, fit: cfg.fit, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw badRequest("Не удалось обработать изображение. Попробуйте другой файл.");
  }
  const key = `${base}.webp`;
  await storage().put(key, out.data, "image/webp");
  return { url: fileUrl(key), kind: "image" as const, width: out.info.width, height: out.info.height };
}
