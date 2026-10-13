import type { Config } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { and, eq, gt, lte, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { stores, inventoryItems } from "../../db/schema.js";

interface PushItem {
  id: string;
  storeId: string;
  data: Record<string, unknown>;
  deleted?: boolean;
  clientUpdatedAt: string;
}

interface PushStore {
  id: string;
  data: Record<string, unknown>;
  deleted?: boolean;
}

interface PushBody {
  items?: PushItem[];
  stores?: PushStore[];
  // Soft-delete every part of these stores edited before the given time ("Clear All" / "Delete Store")
  clearStores?: { storeId: string; before: string }[];
}

const MAX_BATCH = 2000;

export default async (req: Request) => {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please sign in to sync." }, { status: 401 });

  if (req.method === "GET") {
    const since = new URL(req.url).searchParams.get("since");
    // Read the server clock before querying so the next cursor never skips rows written meanwhile
    const [{ now }] = (await db.execute(sql`SELECT now()::text AS now`)).rows as { now: string }[];

    const storeRows = since
      ? await db.select().from(stores).where(gt(stores.updatedAt, since))
      : await db.select().from(stores).where(eq(stores.deleted, false));
    const itemRows = since
      ? await db.select().from(inventoryItems).where(gt(inventoryItems.updatedAt, since))
      : await db.select().from(inventoryItems).where(eq(inventoryItems.deleted, false));

    return Response.json({
      serverTime: new Date(now).toISOString(),
      full: !since,
      stores: storeRows.map(s => ({ id: s.id, data: s.data, deleted: s.deleted })),
      items: itemRows.map(i => ({
        id: i.id,
        storeId: i.storeId,
        data: i.data,
        deleted: i.deleted,
        clientUpdatedAt: i.clientUpdatedAt,
      })),
    });
  }

  if (req.method === "POST") {
    let body: PushBody;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const pushItems = (body.items ?? []).filter(i => i && typeof i.id === "string" && typeof i.storeId === "string");
    const pushStores = (body.stores ?? []).filter(s => s && typeof s.id === "string");
    if (pushItems.length > MAX_BATCH || pushStores.length > MAX_BATCH) {
      return Response.json({ error: `Batch too large (max ${MAX_BATCH}).` }, { status: 413 });
    }

    const who = user.email ?? user.id;

    await db.transaction(async tx => {
      for (const c of body.clearStores ?? []) {
        if (!c?.storeId || !c.before) continue;
        await tx
          .update(inventoryItems)
          .set({ deleted: true, updatedAt: sql`now()`, updatedBy: who })
          .where(
            and(
              eq(inventoryItems.storeId, c.storeId),
              eq(inventoryItems.deleted, false),
              lte(inventoryItems.clientUpdatedAt, c.before)
            )
          );
      }

      for (const s of pushStores) {
        await tx
          .insert(stores)
          .values({ id: s.id, data: s.data ?? {}, deleted: !!s.deleted })
          .onConflictDoUpdate({
            target: stores.id,
            set: { data: sql`excluded.data`, deleted: sql`excluded.deleted`, updatedAt: sql`now()` },
          });
      }

      for (const i of pushItems) {
        const clientUpdatedAt = isNaN(Date.parse(i.clientUpdatedAt)) ? new Date().toISOString() : i.clientUpdatedAt;
        // Last write wins: only overwrite when this edit is at least as new as the stored one
        await tx
          .insert(inventoryItems)
          .values({
            id: i.id,
            storeId: i.storeId,
            data: i.data ?? {},
            deleted: !!i.deleted,
            clientUpdatedAt,
            updatedBy: who,
          })
          .onConflictDoUpdate({
            target: inventoryItems.id,
            set: {
              storeId: sql`excluded.store_id`,
              data: sql`excluded.data`,
              deleted: sql`excluded.deleted`,
              clientUpdatedAt: sql`excluded.client_updated_at`,
              updatedAt: sql`now()`,
              updatedBy: sql`excluded.updated_by`,
            },
            setWhere: sql`excluded.client_updated_at >= ${inventoryItems.clientUpdatedAt}`,
          });
      }
    });

    return Response.json({ ok: true, items: pushItems.length, stores: pushStores.length });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/sync",
};
