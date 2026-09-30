ALTER TABLE "invoices" ADD COLUMN "currency" text DEFAULT 'RUB' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "telegram_charge_id" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "promo_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "promo_video_url" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_telegram_charge_id_unique" UNIQUE("telegram_charge_id");