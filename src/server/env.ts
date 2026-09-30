import "server-only";
import { z } from "zod";

/**
 * Server-side environment. Never import from client components.
 * Missing optional integrations switch the corresponding adapter to a safe
 * local / console implementation instead of failing.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).default("postgres://ryadom:ryadom@localhost:5432/ryadom"),
  APP_URL: z
    .string()
    .default(process.env.NEXT_PUBLIC_APP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "http://localhost:3000")),
  SESSION_SECRET: z.string().default(""),
  TELEGRAM_BOT_TOKEN: z.string().default(""),
  TELEGRAM_WEBHOOK_SECRET: z.string().default(""),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./storage"),
  S3_ENDPOINT: z.string().default(""),
  S3_REGION: z.string().default("ru-central1"),
  S3_BUCKET: z.string().default(""),
  S3_ACCESS_KEY_ID: z.string().default(""),
  S3_SECRET_ACCESS_KEY: z.string().default(""),
  S3_PUBLIC_URL: z.string().default(""),
  /** Optional revenue channels: "pro,promotion,ads". Empty = everything free, no paid offers anywhere. */
  MONETIZATION_CHANNELS: z.string().default(""),
  SMS_PROVIDER: z.enum(["console", "smsru"]).default("console"),
  SMSRU_API_KEY: z.string().default(""),
  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().default(""),
  EMAIL_FROM: z.string().default("Рядом <no-reply@example.com>"),
  ADMIN_EMAIL: z.string().default(""),
  ADMIN_PASSWORD: z.string().default(""),
  /** Enables one-click demo accounts on the login screen. Must be off in production. */
  DEMO_MODE: z
    .string()
    .default("true")
    .transform((v) => v === "true" || v === "1"),
});

export const env = schema.parse(process.env);
export const isProd = env.NODE_ENV === "production";
