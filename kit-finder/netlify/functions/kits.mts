import type { Config, Context } from "@netlify/functions";
import { getUser, verifyRequestOrigin } from "@netlify/identity";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { kits, kitParts } from "../../db/schema.js";

interface KitData {
  family: string;
  asset: string;
  maintenance: string;
  level: string;
  kit: string;
  notes: string;
}

interface PartData {
  partNumber: string;
  description: string;
  qty: string;
}

const MAX_PARTS = 500;

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : typeof value === "number" ? String(value) : "";
}

// Validates and normalises a kit + BOM payload; returns an error message when invalid
function parsePayload(body: unknown): { kit: KitData; parts: PartData[] } | string {
  if (!body || typeof body !== "object") return "Invalid request body.";
  const b = body as Record<string, unknown>;
  const kit: KitData = {
    family: str(b.family, 120),
    asset: str(b.asset, 120),
    maintenance: str(b.maintenance, 60),
    level: str(b.level, 30),
    kit: str(b.kit, 300),
    notes: str(b.notes, 2000),
  };
  if (!kit.family || !kit.asset || !kit.maintenance || !kit.level || !kit.kit) {
    return "Family, asset, maintenance type, level and kit part number are required.";
  }
  const rawParts = Array.isArray(b.parts) ? b.parts : [];
  if (rawParts.length > MAX_PARTS) return `A BOM can have at most ${MAX_PARTS} lines.`;
  const parts = rawParts
    .map((p): PartData => {
      const r = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
      return { partNumber: str(r.partNumber, 200), description: str(r.description, 500), qty: str(r.qty, 40) || "1" };
    })
    .filter((p) => p.partNumber || p.description);
  return { kit, parts };
}

async function listKits() {
  const kitRows = await db.select().from(kits).where(eq(kits.deleted, false));
  const ids = kitRows.map((k) => k.id);
  const partRows = ids.length
    ? await db.select().from(kitParts).where(inArray(kitParts.kitId, ids)).orderBy(asc(kitParts.position))
    : [];
  const partsByKit = new Map<string, PartData[]>();
  for (const p of partRows) {
    const list = partsByKit.get(p.kitId) ?? [];
    list.push(p.data as PartData);
    partsByKit.set(p.kitId, list);
  }
  return kitRows.map((k) => ({
    id: k.id,
    ...(k.data as KitData),
    parts: partsByKit.get(k.id) ?? [],
    updatedAt: k.updatedAt,
    updatedBy: k.updatedBy,
  }));
}

// Another live kit already uses this family/asset/maintenance/level combination
async function isDuplicate(kit: KitData, exceptId?: string) {
  const conditions = [
    eq(kits.deleted, false),
    sql`${kits.data}->>'family' = ${kit.family}`,
    sql`${kits.data}->>'asset' = ${kit.asset}`,
    sql`${kits.data}->>'maintenance' = ${kit.maintenance}`,
    sql`${kits.data}->>'level' = ${kit.level}`,
  ];
  if (exceptId) conditions.push(ne(kits.id, exceptId));
  const rows = await db.select({ id: kits.id }).from(kits).where(and(...conditions)).limit(1);
  return rows.length > 0;
}

export default async (req: Request, context: Context) => {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  const isAdmin = Boolean(user.roles?.includes("admin"));

  if (req.method === "GET") {
    return Response.json({ kits: await listKits(), isAdmin, email: user.email ?? null });
  }

  // Every change below is server-checked against the Identity "admin" role
  if (!isAdmin) return Response.json({ error: "Only admins can change kits." }, { status: 403 });
  // The session travels in a cookie, so reject cross-site write requests (CSRF)
  try {
    verifyRequestOrigin(req);
  } catch {
    return Response.json({ error: "Request origin not allowed." }, { status: 403 });
  }

  const id = context.params.id;
  const editor = user.email ?? user.id;

  if (req.method === "DELETE") {
    if (!id) return Response.json({ error: "Kit id is required." }, { status: 400 });
    const rows = await db
      .update(kits)
      .set({ deleted: true, updatedAt: sql`now()`, updatedBy: editor })
      .where(and(eq(kits.id, id), eq(kits.deleted, false)))
      .returning({ id: kits.id });
    if (!rows.length) return Response.json({ error: "Kit not found." }, { status: 404 });
    return Response.json({ ok: true });
  }

  if (req.method !== "POST" && req.method !== "PUT") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }

  const parsed = parsePayload(await req.json().catch(() => null));
  if (typeof parsed === "string") return Response.json({ error: parsed }, { status: 400 });
  const { kit, parts } = parsed;

  if (req.method === "PUT" && !id) return Response.json({ error: "Kit id is required." }, { status: 400 });
  const kitId = req.method === "PUT" ? id! : crypto.randomUUID();

  // Only block duplicates when a kit is created or moved to a new combination (the seed data has a few legacy duplicates)
  let comboChanged = true;
  if (req.method === "PUT") {
    const [current] = await db.select({ data: kits.data }).from(kits).where(eq(kits.id, kitId)).limit(1);
    const c = current?.data as KitData | undefined;
    comboChanged =
      !c || c.family !== kit.family || c.asset !== kit.asset || c.maintenance !== kit.maintenance || c.level !== kit.level;
  }
  if (comboChanged && (await isDuplicate(kit, req.method === "PUT" ? kitId : undefined))) {
    return Response.json(
      { error: `A kit already exists for ${kit.asset} · ${kit.maintenance} · Level ${kit.level}.` },
      { status: 409 }
    );
  }

  const found = await db.transaction(async (tx) => {
    if (req.method === "PUT") {
      const rows = await tx
        .update(kits)
        .set({ data: kit, updatedAt: sql`now()`, updatedBy: editor })
        .where(and(eq(kits.id, kitId), eq(kits.deleted, false)))
        .returning({ id: kits.id });
      if (!rows.length) return false;
      await tx.delete(kitParts).where(eq(kitParts.kitId, kitId));
    } else {
      await tx.insert(kits).values({ id: kitId, data: kit, updatedBy: editor });
    }
    if (parts.length) {
      await tx
        .insert(kitParts)
        .values(parts.map((p, i) => ({ id: crypto.randomUUID(), kitId, position: i, data: p })));
    }
    return true;
  });
  if (!found) return Response.json({ error: "Kit not found." }, { status: 404 });

  return Response.json({ id: kitId, ...kit, parts }, { status: req.method === "POST" ? 201 : 200 });
};

export const config: Config = {
  path: ["/api/kits", "/api/kits/:id"],
};
