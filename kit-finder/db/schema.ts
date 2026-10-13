import { pgTable, text, jsonb, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";

// One maintenance kit (family, asset, maintenance type, level, kit part number, notes). Full record kept as JSONB.
export const kits = pgTable(
  "kits",
  {
    id: text().primaryKey(),
    data: jsonb().notNull(),
    deleted: boolean().notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updatedBy: text("updated_by"),
  },
  (t) => [index("kits_deleted_idx").on(t.deleted)]
);

// One BOM line of a kit (part number, description, quantity). Full record kept as JSONB.
export const kitParts = pgTable(
  "kit_parts",
  {
    id: text().primaryKey(),
    kitId: text("kit_id")
      .notNull()
      .references(() => kits.id, { onDelete: "cascade" }),
    position: integer().notNull().default(0),
    data: jsonb().notNull(),
  },
  (t) => [index("kit_parts_kit_idx").on(t.kitId)]
);
