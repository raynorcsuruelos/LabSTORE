CREATE TABLE "kit_parts" (
	"id" text PRIMARY KEY,
	"kit_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kits" (
	"id" text PRIMARY KEY,
	"data" jsonb NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE INDEX "kit_parts_kit_idx" ON "kit_parts" ("kit_id");--> statement-breakpoint
CREATE INDEX "kits_deleted_idx" ON "kits" ("deleted");--> statement-breakpoint
ALTER TABLE "kit_parts" ADD CONSTRAINT "kit_parts_kit_id_kits_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "kits"("id") ON DELETE CASCADE;