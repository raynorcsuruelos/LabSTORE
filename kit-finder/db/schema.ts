import { pgTable, text, jsonb, timestamp, boolean, index } from "drizzle-orm/pg-core";

// Sub-stores (Sonde Lab, E-Lab, WHE...). Full record kept as JSONB.
export const stores = pgTable("stores", {
  id: text().primaryKey(),
  data: jsonb().notNull(),
  deleted: boolean().notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

// Inventory parts, keyed `${storeId}:${partNumber}`. Full record kept as JSONB.
export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: text().primaryKey(),
    storeId: text("store_id").notNull(),
    data: jsonb().notNull(),
    deleted: boolean().notNull().default(false),
    // Client edit time, used for last-write-wins
    clientUpdatedAt: timestamp("client_updated_at", { withTimezone: true, mode: "string" }).notNull(),
    // Server write time, used as the change-feed cursor
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updatedBy: text("updated_by"),
  },
  (t) => [index("inventory_items_updated_at_idx").on(t.updatedAt), index("inventory_items_store_idx").on(t.storeId)]
);
