import { getUser } from '@netlify/identity';
import type { Kit, KitInput } from './types';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Refreshes the session cookie if the token is close to expiry
  await getUser();
  const res = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error || `Request failed (${res.status})`, res.status);
  return body as T;
}

export const fetchKits = () => request<{ kits: Kit[]; isAdmin: boolean; email: string | null }>('/api/kits');

export const createKit = (kit: KitInput) =>
  request<Kit>('/api/kits', { method: 'POST', body: JSON.stringify(kit) });

export const updateKit = (id: string, kit: KitInput) =>
  request<Kit>(`/api/kits/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(kit) });

export const deleteKit = (id: string) =>
  request<{ ok: true }>(`/api/kits/${encodeURIComponent(id)}`, { method: 'DELETE' });
