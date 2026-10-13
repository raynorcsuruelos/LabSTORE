import { db, getSetting, setSetting, logHistory, DEFAULT_ONEDRIVE_CONFIG } from '../db/dexieDb';
import {
  OneDriveConfig,
  SyncState,
  SyncQueueItem,
  InventoryItem,
  SubStore,
  OneDriveCloudSnapshot
} from '../types/inventory';
import {
  FolderPermission,
  getFolderPermission,
  readFolderSnapshot,
  writeFolderSnapshot,
  writeDailyBackup,
  readConflictCopies
} from './oneDriveFolder';

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
  config: OneDriveConfig;
  folderPermission: FolderPermission;
  logs: SyncLogEntry[];
}

// Wait this long after the last local edit before pushing to OneDrive
const EDIT_DEBOUNCE_MS = 5000;

class OneDriveSyncService {
  private timer: any = null;
  private isSyncing: boolean = false;
  private listeners: Set<SyncListener> = new Set();
  private logs: SyncLogEntry[] = [];
  private currentStatus: SyncState = 'synced';
  private errorMessage: string | null = null;
  private editTimer: any = null;

  constructor() {
    this.addLog('info', 'OneDrive Background Two-Way Sync engine initialized.');
    this.setupNetworkListeners();
    // Push local edits shortly after they happen, batched
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

  private async getConfig(): Promise<OneDriveConfig> {
    return getSetting<OneDriveConfig>('oneDriveConfig', DEFAULT_ONEDRIVE_CONFIG);
  }

  private setupNetworkListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.addLog('info', 'Network connection restored (online). Triggering automatic background sync.');
        this.triggerSync('network_online');
      });

      window.addEventListener('offline', () => {
        this.addLog('warn', 'Device is offline. Local IndexedDB changes will be preserved and queued.');
        this.currentStatus = 'offline';
        this.notifyListeners();
      });
    }
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
    const folderPermission = await getFolderPermission().catch(() => 'none' as FolderPermission);

    let computedStatus = this.currentStatus;
    if (!isOnline) {
      computedStatus = 'offline';
    } else if (this.isSyncing) {
      computedStatus = 'syncing';
    } else if (this.errorMessage) {
      computedStatus = 'error';
    } else if (pendingCount > 0) {
      computedStatus = 'pending';
    } else {
      computedStatus = 'synced';
    }

    return {
      status: computedStatus,
      isOnline,
      pendingCount,
      lastSyncTime: config.lastSyncTime,
      errorMessage: this.errorMessage,
      config,
      folderPermission,
      logs: this.logs.slice(-50)
    };
  }

  public addLog(type: SyncLogEntry['type'], message: string, details?: any) {
    const entry: SyncLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      details
    };
    this.logs.push(entry);
    if (this.logs.length > 100) this.logs.shift();
  }

  public async startBackgroundWorker() {
    this.stopBackgroundWorker();
    const config = await this.getConfig();

    if (!config.enabled) {
      this.addLog('info', 'Background auto-sync is currently paused.');
      return;
    }

    const intervalMs = Math.max(10, config.autoSyncIntervalSeconds || 60) * 1000;
    this.timer = setInterval(() => {
      this.triggerSync('timer');
    }, intervalMs);

    this.addLog('info', `Background sync worker scheduled every ${config.autoSyncIntervalSeconds}s.`);
    // Initial check on boot
    setTimeout(() => this.triggerSync('initial_boot'), 1500);
  }

  public stopBackgroundWorker() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async updateConfig(newConfig: Partial<OneDriveConfig>) {
    const current = await this.getConfig();

    const merged: OneDriveConfig = { ...current, ...newConfig };
    await setSetting('oneDriveConfig', merged);
    this.addLog('info', 'OneDrive sync configuration updated.');
    await this.startBackgroundWorker();
    await this.notifyListeners();
  }

  // Called after the user links or reconnects the OneDrive folder
  public async onFolderLinked(folderName: string): Promise<void> {
    await this.updateConfig({ mode: 'local_folder', linkedFolderName: folderName });
    this.addLog('success', `Linked OneDrive folder "${folderName}". Starting initial sync.`);
    setTimeout(() => this.triggerSync('folder_linked'), 300);
  }

  // Replace this terminal's local data with the OneDrive copy (use when setting up a new terminal,
  // otherwise freshly seeded sample data would look newer and overwrite the shared file)
  public async forceDownloadFromFolder(): Promise<{ success: boolean; message: string }> {
    try {
      const config = await this.getConfig();
      const remote = await readFolderSnapshot(config.fileName);
      if (!remote || !Array.isArray(remote.snapshot.items)) {
        return { success: false, message: `${config.fileName} was not found in the linked folder.` };
      }
      const { snapshot } = remote;
      await db.transaction('rw', db.inventory, db.stores, db.syncQueue, async () => {
        await db.syncQueue.clear();
        await db.inventory.clear();
        await db.inventory.bulkPut(snapshot.items);
        if (Array.isArray(snapshot.stores) && snapshot.stores.length > 0) {
          await db.stores.clear();
          await db.stores.bulkPut(snapshot.stores);
        }
      });
      await this.updateConfig({ remoteLastModified: remote.lastModified, lastSyncTime: new Date().toISOString() });
      const msg = `Replaced local data with OneDrive copy (${snapshot.items.length} items).`;
      this.addLog('success', msg);
      return { success: true, message: msg };
    } catch (err: any) {
      this.addLog('error', `Download failed: ${err.message}`);
      return { success: false, message: err.message };
    }
  }

  // Master synchronization trigger
  public async triggerSync(source: string = 'manual'): Promise<{ success: boolean; message: string }> {
    if (this.isSyncing) {
      return { success: false, message: 'Sync already in progress.' };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.currentStatus = 'offline';
      this.notifyListeners();
      return { success: false, message: 'Device is offline. Changes remain queued in IndexedDB.' };
    }

    const config = await this.getConfig();

    this.isSyncing = true;
    this.currentStatus = 'syncing';
    this.errorMessage = null;
    await this.notifyListeners();

    try {
      this.addLog('info', `Two-way sync initiated [Source: ${source}] (Mode: ${config.mode}).`);

      const useFolder = config.mode === 'local_folder';

      // Step 1: Pull remote snapshot (Two-Way Sync)
      let remoteSnapshot: OneDriveCloudSnapshot | null = null;
      if (useFolder) {
        const remote = await readFolderSnapshot(config.fileName);
        if (remote) {
          remoteSnapshot = remote.snapshot;
          config.remoteLastModified = remote.lastModified;
        } else {
          this.addLog('info', `${config.fileName} not found in the linked folder yet. It will be created now.`);
        }
      } else {
        remoteSnapshot = await this.fetchRemoteSnapshotSimulated(config);
      }

      // Step 2: Reconcile remote changes into local Dexie database
      let pulledCount = 0;
      if (remoteSnapshot && Array.isArray(remoteSnapshot.items)) {
        pulledCount = await this.reconcileRemoteData(remoteSnapshot, config.conflictResolution);
      }

      // Step 2b: Merge OneDrive conflict copies (created when two PCs saved at the same time)
      if (useFolder) {
        const copies = await readConflictCopies(config.fileName);
        for (const copy of copies) {
          if (Array.isArray(copy.snapshot?.items)) {
            pulledCount += await this.reconcileRemoteData(copy.snapshot, 'last_write_wins');
          }
          this.addLog('warn', `Merged OneDrive conflict copy "${copy.name}". Delete it from the folder once all terminals have synced.`);
        }
      }

      // Step 3: Fetch updated local dataset and queue
      const pendingItems = await db.syncQueue.where('status').equals('pending').toArray();
      const currentInventory = await db.inventory.toArray();
      const currentStores = await db.stores.toArray();
      const historyCount = await db.history.count();

      const mergedSnapshot: OneDriveCloudSnapshot = {
        lastUpdated: new Date().toISOString(),
        source: 'WL Lab Inventory (Dexie.js IndexedDB Client)',
        stores: currentStores,
        itemCount: currentInventory.length,
        items: currentInventory,
        historyCount
      };

      // Step 4: Write reconciled snapshot only when something changed,
      // so idle terminals don't keep rewriting the file (and causing OneDrive conflict copies)
      const needsUpload =
        !remoteSnapshot ||
        pendingItems.length > 0 ||
        (remoteSnapshot.items?.length || 0) !== currentInventory.length ||
        (remoteSnapshot.stores?.length || 0) !== currentStores.length;

      if (needsUpload) {
        if (useFolder) {
          await writeFolderSnapshot(config.fileName, mergedSnapshot);
          this.addLog('info', `Wrote ${config.fileName} to the OneDrive folder (${currentInventory.length} items). OneDrive will upload it.`);
        } else {
          await this.uploadSnapshotSimulated(config, mergedSnapshot);
        }
      }
      if (useFolder && (await writeDailyBackup(config.fileName, mergedSnapshot))) {
        this.addLog('info', 'Saved daily backup to backups/ in the OneDrive folder.');
      }

      // Step 5: Mark all pending mutations as resolved
      if (pendingItems.length > 0) {
        const ids = pendingItems.map(p => p.id!).filter(Boolean);
        await db.syncQueue.bulkDelete(ids);
      }

      const nowIso = new Date().toISOString();
      config.lastSyncTime = nowIso;
      config.lastSyncStatus = 'synced';
      await setSetting('oneDriveConfig', config);

      this.currentStatus = 'synced';
      this.errorMessage = null;

      const summaryMsg = `Synchronized: ${pendingItems.length} uploaded, ${pulledCount} updated from cloud.`;
      this.addLog('success', summaryMsg);

      return { success: true, message: summaryMsg };
    } catch (err: any) {
      console.error('OneDrive sync error:', err);
      this.currentStatus = 'error';
      this.errorMessage = err.message || 'Sync failed';
      this.addLog('error', `Sync failed: ${this.errorMessage}`);

      // Record retry on pending items
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
    }
  }

  // Reconcile remote data into local Dexie IndexedDB
  private async reconcileRemoteData(
    remote: OneDriveCloudSnapshot,
    policy: 'last_write_wins' | 'local_priority' | 'remote_priority' = 'last_write_wins'
  ): Promise<number> {
    let updatedCount = 0;

    // 1. Reconcile sub-stores
    if (Array.isArray(remote.stores)) {
      for (const remoteStore of remote.stores) {
        const existing = await db.stores.get(remoteStore.id);
        if (!existing) {
          await db.stores.add(remoteStore);
          this.addLog('info', `Imported new store from cloud: "${remoteStore.name}"`);
        }
      }
    }

    // 2. Reconcile items
    if (Array.isArray(remote.items)) {
      const localPending = await db.syncQueue.where('status').equals('pending').toArray();
      const pendingKeys = new Set(localPending.map(p => `${p.storeId || ''}:${p.partNumber}`));

      for (const remoteItem of remote.items) {
        const itemKey = remoteItem.id || `${remoteItem.storeId}:${remoteItem.partNumber}`;
        const localItem = await db.inventory.get(itemKey);

        if (!localItem) {
          // Brand new remote item - add to local database
          await db.inventory.put(remoteItem);
          updatedCount++;
        } else {
          // Both exist: resolve by conflict policy
          if (policy === 'remote_priority') {
            await db.inventory.put(remoteItem);
            updatedCount++;
          } else if (policy === 'local_priority') {
            // Keep local
            continue;
          } else {
            // Default: last_write_wins
            const isLocalPending = pendingKeys.has(itemKey);
            const remoteTime = new Date(remoteItem.updatedAt || 0).getTime();
            const localTime = new Date(localItem.updatedAt || 0).getTime();

            if (!isLocalPending && remoteTime > localTime) {
              await db.inventory.put(remoteItem);
              updatedCount++;
            }
          }
        }
      }
    }

    return updatedCount;
  }

  // Fetch simulated cloud snapshot
  private async fetchRemoteSnapshotSimulated(config: OneDriveConfig): Promise<OneDriveCloudSnapshot | null> {
    const cloudKey = `wllab_onedrive_cloud_${config.folderPath}_${config.fileName}`;
    const raw = localStorage.getItem(cloudKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // Upload simulated cloud snapshot
  private async uploadSnapshotSimulated(config: OneDriveConfig, snapshot: OneDriveCloudSnapshot) {
    await new Promise(res => setTimeout(res, 400));
    const cloudKey = `wllab_onedrive_cloud_${config.folderPath}_${config.fileName}`;
    localStorage.setItem(cloudKey, JSON.stringify(snapshot));
    this.addLog('info', `Simulated OneDrive cloud storage updated (${snapshot.items.length} items across all stores).`);
  }

  // Inspect current cloud snapshot for UI inspection
  public async getCloudSnapshot(): Promise<OneDriveCloudSnapshot | null> {
    const config = await this.getConfig();

    if (config.mode === 'local_folder') {
      try {
        const remote = await readFolderSnapshot(config.fileName);
        return remote ? remote.snapshot : null;
      } catch (err: any) {
        this.addLog('warn', `Could not read OneDrive folder: ${err.message}`);
        return null;
      }
    }

    return await this.fetchRemoteSnapshotSimulated(config);
  }
}

export const oneDriveSyncService = new OneDriveSyncService();
