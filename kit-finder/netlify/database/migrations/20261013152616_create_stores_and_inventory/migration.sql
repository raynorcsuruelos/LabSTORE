CREATE TABLE "inventory_items" (
	"id" text PRIMARY KEY,
	"store_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"client_updated_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" text PRIMARY KEY,
	"data" jsonb NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "inventory_items_updated_at_idx" ON "inventory_items" ("updated_at");--> statement-breakpoint
CREATE INDEX "inventory_items_store_idx" ON "inventory_items" ("store_id");