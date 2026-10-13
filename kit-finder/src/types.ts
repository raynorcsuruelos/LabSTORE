export interface BomPart {
  partNumber: string;
  description: string;
  qty: string;
}

export interface KitFields {
  family: string;
  asset: string;
  maintenance: string;
  level: string;
  kit: string;
  notes: string;
}

export interface Kit extends KitFields {
  id: string;
  parts: BomPart[];
  updatedAt?: string;
  updatedBy?: string | null;
}

export type KitInput = KitFields & { parts: BomPart[] };
