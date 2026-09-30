-- Zero-commission model: no commission, provider balance or in-platform acquiring.
ALTER TABLE "promotions" DROP CONSTRAINT IF EXISTS "promotions_payment_id_payments_id_fk";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_payment_id_payments_id_fk";--> statement-breakpoint
DROP TABLE IF EXISTS "payments" CASCADE;--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN IF EXISTS "commission_amount";--> statement-breakpoint
ALTER TABLE "promotions" DROP COLUMN IF EXISTS "payment_id";--> statement-breakpoint
ALTER TABLE "providers" DROP COLUMN IF EXISTS "balance";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "payment_id";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."payment_purpose";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."payment_status";
