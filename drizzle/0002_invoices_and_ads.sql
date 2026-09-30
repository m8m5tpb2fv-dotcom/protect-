CREATE TYPE "public"."ad_slot" AS ENUM('home', 'category', 'search');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('requested', 'activated', 'cancelled');--> statement-breakpoint
CREATE TABLE "ads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot" "ad_slot" NOT NULL,
	"category_id" integer,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"link_url" text NOT NULL,
	"advertiser" text NOT NULL,
	"erid" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"product_id" text NOT NULL,
	"amount" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"promo_code_id" integer,
	"status" "invoice_status" DEFAULT 'requested' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone,
	"activated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_activated_by_users_id_fk" FOREIGN KEY ("activated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ads_slot_idx" ON "ads" USING btree ("slot","is_active");--> statement-breakpoint
CREATE INDEX "invoices_provider_idx" ON "invoices" USING btree ("provider_id","created_at");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "content_blocks" SET "body" = 'Бесплатно для всех. Комиссии нет ни с клиента, ни с исполнителя: за работу вы платите исполнителю напрямую.', "updated_at" = now() WHERE "key" = 'faq.price' AND "body" LIKE '%комисси%';
