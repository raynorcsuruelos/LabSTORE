import { refreshSession } from '@netlify/identity';
import { db, getSetting, setSetting, DEFAULT_CLOUD_SYNC_CONFIG } from '../db/dexieDb';
import {
  CloudSyncConfig,
  CloudChanges,
  CloudRecord,
  SyncState,
  SyncQueueItem,
  InventoryItem,
  SubStore
} from '../types/inventory';

type SyncListener = (status: SyncServiceState) => void;

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warn' | 'error';
  message: string;
  details?: any;
}

export interface SyncServiceState {
  status: SyncState;
  isOnline: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  errorMessage: string | null;
  config: CloudSyncConfig;
  logs: SyncLogEntry[];
}

interface PushPayload {
  items: CloudRecord<InventoryItem>[];
  stores: CloudRecord<SubStore>[];
  clearStores: { storeId: string; before: string }[];
}

const SYNC_ENDPOINT = '/api/sync';
// Push local edits this long after the last one, batched
const EDIT_DEBOUNCE_MS = 1500;
// Re-read a little before the cursor so writes committed during the previous pull are not missed
const CURSOR_OVERLAP_MS = 30000;

class CloudSyncService {
  private timer: any = null;
  private isSyncing: boolean = false;
  private listeners: Set<SyncListener> = new Set();
  private logs: SyncLogEntry[] = [];
  private errorMessage: string | null = null;
  private editTimer: any = null;
  private resyncRequested = false;

  constructor() {
    this.addLog('info', 'Cloud database sync engine initialized.');
    this.setupNetworkListeners();
    db.syncQueue.hook('creating', () => {
      this.scheduleSyncAfterEdit();
    });
  }

  private scheduleSyncAfterEdit() {
    if (this.editTimer) clearTimeout(this.editTimer);
    this.editTimer = setTimeout(() => {
      this.editTimer = null;
      this.triggerSync('local_edit');
    }, EDIT_DEBOUNCE_MS);
  }

  private async getConfig(): Promise<CloudSyncConfig> {
    const stored = await getSetting<CloudSyncConfig>('cloudSyncConfig', DEFAULT_CLOUD_SYNC_CONFIG);
    return { ...DEFAULT_CLOUD_SYNC_CONFIG, ...stored };
  }

  private setupNetworkListeners() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
      this.addLog('info', 'Network connection restored. Syncing queued changes.');
      this.triggerSync('network_online');
    });
    window.addEventListener('offline', () => {
      this.addLog('warn', 'Device is offline. Changes are kept on this device and queued.');
      this.notifyListeners();
    });
    // Pick up other terminals' changes as soon as this tab is looked at again
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.triggerSync('tab_visible');
    });
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    this.notifyListeners();
    return () => this.listeners.delete(listener);
  }

  private async notifyListeners() {
    const state = await this.getState();
    this.listeners.forEach(fn => fn(state));
  }

  public async getState(): Promise<SyncServiceState> {
    const config = await this.getConfig();
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const pendingCount = await db.syncQueue.where('status').equals('pending').count();

    let status: SyncState = 'synced';
    if (!isOnline) status = 'offline';
    else if (this.isSyncing) status = 'syncing';
    else if (this.errorMessage) status = 'error';
    else if (pendingCount > 0) status = 'pending';

    return {
      status,
      isOnline,
      pendingCount,
      lastSyncTime: config.lastSyncTime,
      errorMessage: this.errorMessage,
      config,
      logs: this.logs.slice(-50)
    };
  }

  public addLog(type: SyncLogEntry['type'], message: string, details?: any) {
    this.logs.push({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      details
    });
    if (this.logs.length > 100) this.logs.shift();
  }

  public async startBackgroundWorker() {
    this.stopBackgroundWorker();
    const config = await this.getConfig();

    if (!config.enabled) {
      this.addLog('info', 'Background auto-sync is paused.');
      await this.notifyListeners();
      return;
    }

    const intervalSec = Math.max(5, config.autoSyncIntervalSeconds || 10);
    this.timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        this.triggerSync('timer');
      }
    }, intervalSec * 1000);

    this.addLog('info', `Checking the cloud database for changes every ${intervalSec}s.`);
    this.triggerSync('initial_boot');
  }

  public stopBackgroundWorker() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async updateConfig(newConfig: Partial<CloudSyncConfig>) {
    const current = await this.getConfig();
    await setSetting('cloudSyncConfig', { ...current, ...newConfig });
    this.addLog('info', 'Sync settings updated.');
    await this.startBackgroundWorker();
    await this.notifyListeners();
  }

  // Forget the local copy and reload everything from the cloud database
  public async resetFromCloud(): Promise<{ success: boolean; message: string }> {
    await db.syncQueue.clear();
    await this.updateConfig({ cursor: null });
    return this.triggerSync('reset_from_cloud', { replaceLocal: true });
  }

  private async request(method: 'GET' | 'POST', query = '', body?: unknown): Promise<any> {
    // Make sure the login cookie is fresh before calling the API
    await refreshSession().catch(() => null);
    const res = await fetch(`${SYNC_ENDPOINT}${query}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 401) throw new Error('Not signed in. Please sign in again to sync.');
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || `Cloud database responded with HTTP ${res.status}`);
    }
    return res.json();
  }

  // Turn queued local mutations into records to upsert in the cloud database
  private async buildPushPayload(queue: SyncQueueItem[]): Promise<PushPayload> {
    const touchedItems = new Map<string, string>(); // item id -> latest mutation time
    const touchedStores = new Map<string, string>();
    const clearStores: PushPayload['clearStores'] = [];
    const touch = (map: Map<string, string>, id: string, ts: string) => {
      if (!map.has(id) || map.get(id)! < ts) map.set(id, ts);
    };

    for (const q of queue) {
      const storeId = q.storeId || q.payload?.storeId || '';
      if (q.action === 'STORE_MUTATION') {
        touch(touchedStores, q.partNumber, q.timestamp);
      } else if (q.action === 'BULK_IMPORT') {
        const ids = await db.inventory.where('storeId').equals(storeId).primaryKeys();
        ids.forEach(id => touch(touchedItems, id as string, q.timestamp));
      } else if (q.action === 'DELETE' && q.partNumber === 'STORE_ALL') {
        clearStores.push({ storeId, before: q.timestamp });
      } else if (storeId) {
        touch(touchedItems, `${storeId}:${q.partNumber}`, q.timestamp);
      }
    }

    const items: PushPayload['items'] = [];
    for (const [id, ts] of touchedItems) {
      const local = await db.inventory.get(id);
      if (local) {
        items.push({ id, storeId: local.storeId, data: local, deleted: false, clientUpdatedAt: local.updatedAt || ts });
      } else {
        const storeId = id.slice(0, id.indexOf(':'));
        items.push({ id, storeId, data: { id, storeId } as InventoryItem, deleted: true, clientUpdatedAt: ts });
      }
    }

    const stores: PushPayload['stores'] = [];
    for (const id of touchedStores.keys()) {
      const local = await db.stores.get(id);
      if (local) {
        stores.push({ id, data: local, deleted: false });
      } else {
        stores.push({ id, data: { id } as SubStore, deleted: true });
        clearStores.push({ storeId: id, before: new Date().toISOString() });
      }
    }

    return { items, stores, clearStores };
  }

  private async pushEverything(): Promise<number> {
    const now = new Date().toISOString();
    const localStores = await db.stores.toArray();
    const localItems = await db.inventory.toArray();
    await this.request('POST', '', {
      stores: localStores.map(s => ({ id: s.id, data: s, deleted: false })),
      items: localItems.map(i => ({
        id: i.id || `${i.storeId}:${i.partNumber}`,
        storeId: i.storeId,
        data: i,
        deleted: false,
        clientUpdatedAt: i.updatedAt || now
      })),
      clearStores: []
    });
    return localItems.length;
  }

  // Apply changes from the cloud to the local IndexedDB copy
  private async applyRemoteChanges(changes: CloudChanges, policy: CloudSyncConfig['conflictResolution']): Promise<number> {
    let applied = 0;
    await db.transaction('rw', db.inventory, db.stores, db.syncQueue, async () => {
      // Local edits made while this sync was running stay untouched until they are pushed
      const pending = await db.syncQueue.where('status').equals('pending').toArray();
      const pendingKeys = new Set(pending.map(p => `${p.storeId || p.payload?.storeId || ''}:${p.partNumber}`));
      const pendingStores = new Set(pending.filter(p => p.action === 'STORE_MUTATION').map(p => p.partNumber));

      for (const s of changes.stores) {
        if (pendingStores.has(s.id)) continue;
        if (s.deleted) {
          if (await db.stores.get(s.id)) {
            await db.stores.delete(s.id);
            await db.inventory.where('storeId').equals(s.id).delete();
            this.addLog('info', `Store "${s.id}" was removed on another terminal.`);
            applied++;
          }
        } else {
          await db.stores.put({ ...s.data, id: s.id });
          applied++;
        }
      }

      for (const r of changes.items) {
        if (pendingKeys.has(r.id)) continue;
        const local = await db.inventory.get(r.id);
        const remoteTime = new Date(r.clientUpdatedAt || 0).getTime();
        const localTime = new Date(local?.updatedAt || 0).getTime();

        let accept: boolean;
        if (!local) accept = !r.deleted;
        else if (policy === 'remote_priority') accept = true;
        else if (policy === 'local_priority') accept = false;
        else accept = r.deleted ? remoteTime >= localTime : remoteTime > localTime; // last write wins
        if (!accept) continue;

        if (r.deleted) {
          await db.inventory.delete(r.id);
        } else {
          await db.inventory.put({ ...r.data, id: r.id, storeId: r.storeId || r.data.storeId });
        }
        applied++;
      }
    });
    return applied;
  }

  private async replaceLocalWith(changes: CloudChanges) {
    await db.transaction('rw', db.inventory, db.stores, db.syncQueue, async () => {
      await db.syncQueue.clear();
      await db.inventory.clear();
      await db.stores.clear();
      await db.stores.bulkPut(changes.stores.filter(s => !s.deleted).map(s => ({ ...s.data, id: s.id })));
      await db.inventory.bulkPut(
        changes.items
          .filter(i => !i.deleted)
          .map(i => ({ ...i.data, id: i.id, storeId: i.storeId || i.data.storeId }))
      );
    });
  }

  // Push queued local changes, then pull everything other terminals changed since the last sync
  public async triggerSync(
    source: string = 'manual',
    options: { replaceLocal?: boolean } = {}
  ): Promise<{ success: boolean; message: string }> {
    if (this.isSyncing) {
      this.resyncRequested = true;
      return { success: false, message: 'Sync already in progress.' };
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await this.notifyListeners();
      return { success: false, message: 'Device is offline. Changes remain queued on this device.' };
    }

    const config = await this.getConfig();
    this.isSyncing = true;
    this.errorMessage = null;
    await this.notifyListeners();

    try {
      // Step 1: push queued local mutations
      const queue = await db.syncQueue.where('status').equals('pending').toArray();
      let pushed = 0;
      if (queue.length > 0 && !options.replaceLocal) {
        const payload = await this.buildPushPayload(queue);
        if (payload.items.length || payload.stores.length || payload.clearStores.length) {
          await this.request('POST', '', payload);
        }
        pushed = payload.items.length + payload.stores.length;
        await db.syncQueue.bulkDelete(queue.map(q => q.id!).filter(Boolean));
      }

      // Step 2: pull changes
      let pulled = 0;
      let message: string;
      if (!config.cursor) {
        const full: CloudChanges = await this.request('GET');
        if (full.items.length === 0 && full.stores.length === 0) {
          // Empty cloud database: this terminal's data becomes the shared copy
          const count = await this.pushEverything();
          message = `Cloud database was empty. Uploaded ${count} parts from this terminal.`;
        } else {
          // This terminal joins existing shared data: take the cloud copy so local sample data can't overwrite it
          await this.replaceLocalWith(full);
          pulled = full.items.length;
          message = `Loaded ${full.items.length} parts and ${full.stores.length} stores from the cloud database.`;
        }
        config.cursor = full.serverTime;
      } else {
        const since = new Date(new Date(config.cursor).getTime() - CURSOR_OVERLAP_MS).toISOString();
        const changes: CloudChanges = await this.request('GET', `?since=${encodeURIComponent(since)}`);
        pulled = await this.applyRemoteChanges(changes, config.conflictResolution);
        config.cursor = changes.serverTime;
        message = `Synchronized: ${pushed} uploaded, ${pulled} updated from cloud.`;
      }

      const latest = await this.getConfig();
      await setSetting('cloudSyncConfig', {
        ...latest,
        cursor: config.cursor,
        lastSyncTime: new Date().toISOString(),
        lastSyncStatus: 'synced'
      });

      if (pushed > 0 || pulled > 0 || source === 'manual_button' || !latest.cursor) {
        this.addLog('success', message);
      }
      return { success: true, message };
    } catch (err: any) {
      console.error('Cloud sync error:', err);
      this.errorMessage = err?.message || 'Sync failed';
      this.addLog('error', `Sync failed: ${this.errorMessage}`);

      const pendingItems = await db.syncQueue.where('status').equals('pending').toArray();
      for (const item of pendingItems) {
        if (item.id) {
          await db.syncQueue.update(item.id, {
            retryCount: (item.retryCount || 0) + 1,
            errorMessage: this.errorMessage || 'Error'
          });
        }
      }
      return { success: false, message: this.errorMessage || 'Sync failed' };
    } finally {
      this.isSyncing = false;
      await this.notifyListeners();
      if (this.resyncRequested) {
        this.resyncRequested = false;
        setTimeout(() => this.triggerSync('queued'), 200);
      }
    }
  }

  // Read the current cloud copy for the inspector tab
  public async getCloudSnapshot(): Promise<CloudChanges | null> {
    try {
      return await this.request('GET');
    } catch (err: any) {
      this.addLog('warn', `Could not read the cloud database: ${err.message}`);
      return null;
    }
  }
}

export const cloudSyncService = new CloudSyncService();
