CREATE TABLE "order_dismissals" (
	"provider_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_dismissals_provider_id_order_id_pk" PRIMARY KEY("provider_id","order_id")
);
--> statement-breakpoint
ALTER TABLE "order_dismissals" ADD CONSTRAINT "order_dismissals_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_dismissals" ADD CONSTRAINT "order_dismissals_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;