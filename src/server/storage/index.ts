import "server-only";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { AwsClient } from "aws4fetch";
import { env } from "../env";

/**
 * Storage abstraction. Files are always referenced in the DB by our own path
 * `/files/<key>` so switching drivers never requires data migration.
 * Keys under `private/` are never served publicly.
 */
export interface StorageDriver {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ data: Buffer; contentType: string } | null>;
  publicUrl(key: string): string | null; // direct CDN url if available
}

const MIME_BY_EXT: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", png: "image/png", pdf: "application/pdf", mp4: "video/mp4", webm: "video/webm" };

class LocalDriver implements StorageDriver {
  constructor(private root: string) {}
  private resolve(key: string) {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("path traversal");
    return full;
  }
  async put(key: string, data: Buffer) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  }
  async get(key: string) {
    try {
      const full = this.resolve(key);
      await stat(full);
      const ext = key.split(".").pop() ?? "";
      return { data: await readFile(full), contentType: MIME_BY_EXT[ext] ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }
  publicUrl() {
    return null;
  }
}

class S3Driver implements StorageDriver {
  private client = new AwsClient({ accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY, region: env.S3_REGION, service: "s3" });
  private url(key: string) {
    return `${env.S3_ENDPOINT.replace(/\/$/, "")}/${env.S3_BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }
  async put(key: string, data: Buffer, contentType: string) {
    const res = await this.client.fetch(this.url(key), {
      method: "PUT",
      body: new Uint8Array(data),
      headers: { "content-type": contentType, "cache-control": "public, max-age=31536000, immutable", ...(key.startsWith("private/") ? {} : { "x-amz-acl": "public-read" }) },
    });
    if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);
  }
  async get(key: string) {
    const res = await this.client.fetch(this.url(key));
    if (!res.ok) return null;
    return { data: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "application/octet-stream" };
  }
  publicUrl(key: string) {
    if (key.startsWith("private/") || !env.S3_PUBLIC_URL) return null;
    return `${env.S3_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  }
}

let driver: StorageDriver | null = null;
export function storage(): StorageDriver {
  if (!driver) driver = env.STORAGE_DRIVER === "s3" && env.S3_BUCKET ? new S3Driver() : new LocalDriver(path.resolve(env.STORAGE_LOCAL_DIR));
  return driver;
}

export const fileUrl = (key: string) => `/files/${key}`;
export const keyFromUrl = (url: string) => (url.startsWith("/files/") ? url.slice(7) : null);
