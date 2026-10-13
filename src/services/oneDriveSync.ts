import { db, getSetting, setSetting, logHistory } from '../db/dexieDb';
import {
  OneDriveConfig,
  SyncState,
  SyncQueueItem,
  InventoryItem,
  SubStore,
  OneDriveCloudSnapshot
} from '../types/inventory';
import { msalAuth } from './msalAuth';

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
  logs: SyncLogEntry[];
}

class OneDriveSyncService {
  private timer: any = null;
  private isSyncing: boolean = false;
  private listeners: Set<SyncListener> = new Set();
  private logs: SyncLogEntry[] = [];
  private currentStatus: SyncState = 'synced';
  private errorMessage: string | null = null;

  constructor() {
    this.addLog('info', 'OneDrive Background Two-Way Sync engine initialized.');
    this.setupNetworkListeners();
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
    const config = await getSetting<OneDriveConfig>('oneDriveConfig', {
      enabled: true,
      mode: 'msal_popup',
      accessToken: '',
      msalClientId: '',
      msalTenantId: 'common',
      userDisplayName: '',
      userEmail: '',
      isAuthenticated: false,
      folderPath: 'WLLabInventory',
      fileName: 'inventory_sync.json',
      autoSyncIntervalSeconds: 30,
      lastSyncTime: null,
      lastSyncStatus: 'synced',
      conflictResolution: 'last_write_wins',
      remoteLastModified: null
    });

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const pendingCount = await db.syncQueue.where('status').equals('pending').count();

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
    const config = await getSetting<OneDriveConfig>('oneDriveConfig', {
      enabled: true,
      mode: 'msal_popup',
      folderPath: 'WLLabInventory',
      fileName: 'inventory_sync.json',
      autoSyncIntervalSeconds: 30,
      lastSyncTime: null,
      lastSyncStatus: 'synced',
      conflictResolution: 'last_write_wins'
    });

    if (!config.enabled) {
      this.addLog('info', 'Background auto-sync is currently paused.');
      return;
    }

    const intervalMs = Math.max(10, config.autoSyncIntervalSeconds || 30) * 1000;
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
    const current = await getSetting<OneDriveConfig>('oneDriveConfig', {
      enabled: true,
      mode: 'msal_popup',
      folderPath: 'WLLabInventory',
      fileName: 'inventory_sync.json',
      autoSyncIntervalSeconds: 30,
      lastSyncTime: null,
      lastSyncStatus: 'synced',
      conflictResolution: 'last_write_wins'
    });

    const merged: OneDriveConfig = { ...current, ...newConfig };
    await setSetting('oneDriveConfig', merged);
    this.addLog('info', 'OneDrive sync configuration updated.');
    await this.startBackgroundWorker();
    await this.notifyListeners();
  }

  // One-click Microsoft 365 sign in
  public async loginWithMicrosoft(): Promise<{ success: boolean; error?: string }> {
    try {
      this.addLog('info', 'Opening Microsoft corporate sign-in popup...');
      const result = await msalAuth.loginPopup();
      if (!result.success || !result.account) {
        const msg = result.error || 'Microsoft login cancelled';
        this.addLog('warn', `Microsoft sign-in: ${msg}`);
        return { success: false, error: msg };
      }

      const account = result.account;
      const token = result.token || (await msalAuth.getAccessToken()) || '';

      await this.updateConfig({
        mode: 'msal_popup',
        isAuthenticated: true,
        accessToken: token,
        userDisplayName: account.name || account.username || 'Microsoft User',
        userEmail: account.username || '',
      });

      this.addLog('success', `Signed in as ${account.name} (${account.username}). Starting initial cloud sync.`);
      // Immediately run sync to download any remote inventory
      setTimeout(() => this.triggerSync('after_login'), 500);
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Microsoft sign-in failed';
      this.addLog('error', `Sign in error: ${msg}`);
      return { success: false, error: msg };
    }
  }

  // Microsoft sign out
  public async logoutMicrosoft(): Promise<void> {
    await msalAuth.logout();
    await this.updateConfig({
      isAuthenticated: false,
      accessToken: '',
      userDisplayName: '',
      userEmail: ''
    });
    this.addLog('info', 'Signed out from Microsoft account.');
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

    const config = await getSetting<OneDriveConfig>('oneDriveConfig', {
      enabled: true,
      mode: 'msal_popup',
      folderPath: 'WLLabInventory',
      fileName: 'inventory_sync.json',
      autoSyncIntervalSeconds: 30,
      lastSyncTime: null,
      lastSyncStatus: 'synced',
      conflictResolution: 'last_write_wins'
    });

    this.isSyncing = true;
    this.currentStatus = 'syncing';
    this.errorMessage = null;
    await this.notifyListeners();

    try {
      this.addLog('info', `Two-way sync initiated [Source: ${source}] (Mode: ${config.mode}).`);

      // Determine active bearer token if using Microsoft Graph
      let activeToken = config.accessToken;
      if (config.mode === 'msal_popup') {
        const freshToken = await msalAuth.getAccessToken();
        if (freshToken) {
          activeToken = freshToken;
        } else if (!config.isAuthenticated) {
          // If in MSAL mode but not signed in yet, fall back gracefully to simulated local sync
          this.addLog('info', 'Microsoft 365 not signed in yet. Operating in local simulated cloud synchronization.');
        }
      }

      // Step 1: Pull remote snapshot if available (Two-Way Sync)
      let remoteSnapshot: OneDriveCloudSnapshot | null = null;
      if ((config.mode === 'msal_popup' && activeToken) || (config.mode === 'graph_token' && activeToken)) {
        remoteSnapshot = await this.fetchRemoteSnapshotGraph(config, activeToken);
      } else {
        remoteSnapshot = await this.fetchRemoteSnapshotSimulated(config);
      }

      // Step 2: Reconcile remote changes into local Dexie database
      let pulledCount = 0;
      if (remoteSnapshot && Array.isArray(remoteSnapshot.items)) {
        pulledCount = await this.reconcileRemoteData(remoteSnapshot, config.conflictResolution);
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

      // Step 4: Upload reconciled snapshot to OneDrive
      if ((config.mode === 'msal_popup' && activeToken) || (config.mode === 'graph_token' && activeToken)) {
        await this.uploadSnapshotGraph(config, activeToken, mergedSnapshot);
      } else {
        await this.uploadSnapshotSimulated(config, mergedSnapshot);
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

  // Fetch remote snapshot from Microsoft Graph
  private async fetchRemoteSnapshotGraph(
    config: OneDriveConfig,
    token: string
  ): Promise<OneDriveCloudSnapshot | null> {
    const cleanFolder = (config.folderPath || 'WLLabInventory').replace(/^\/+|\/+$/g, '');
    const cleanFile = config.fileName || 'inventory_sync.json';
    const graphEndpoint = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(cleanFolder)}/${encodeURIComponent(cleanFile)}:/content`;

    try {
      const res = await fetch(graphEndpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.status === 404) {
        // File does not exist yet on OneDrive (first sync)
        this.addLog('info', `File does not exist on OneDrive yet. A new file will be created in /${cleanFolder}/${cleanFile}`);
        return null;
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch cloud snapshot: HTTP ${res.status}`);
      }

      const json = await res.json();
      return json;
    } catch (err: any) {
      this.addLog('warn', `Notice reading OneDrive file: ${err.message}`);
      return null;
    }
  }

  // Upload snapshot to Microsoft Graph API
  private async uploadSnapshotGraph(
    config: OneDriveConfig,
    token: string,
    snapshot: OneDriveCloudSnapshot
  ) {
    const cleanFolder = (config.folderPath || 'WLLabInventory').replace(/^\/+|\/+$/g, '');
    const cleanFile = config.fileName || 'inventory_sync.json';
    const graphEndpoint = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(cleanFolder)}/${encodeURIComponent(cleanFile)}:/content`;

    this.addLog('info', `Uploading synchronized dataset to OneDrive: /${cleanFolder}/${cleanFile}`);

    const res = await fetch(graphEndpoint, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(snapshot, null, 2)
    });

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errJson = await res.json();
        if (errJson.error && errJson.error.message) {
          errMsg = errJson.error.message;
        }
      } catch {
        // fallback
      }
      throw new Error(`OneDrive upload failed: ${errMsg}`);
    }

    this.addLog('success', 'Microsoft Graph upload succeeded. Multi-device cloud sync updated.');
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
    const config = await getSetting<OneDriveConfig>('oneDriveConfig', {
      enabled: true,
      mode: 'msal_popup',
      folderPath: 'WLLabInventory',
      fileName: 'inventory_sync.json',
      autoSyncIntervalSeconds: 30,
      lastSyncTime: null,
      lastSyncStatus: 'synced',
      conflictResolution: 'last_write_wins'
    });

    let token = config.accessToken;
    if (config.mode === 'msal_popup') {
      const fresh = await msalAuth.getAccessToken();
      if (fresh) token = fresh;
    }

    if (token) {
      try {
        const snap = await this.fetchRemoteSnapshotGraph(config, token);
        if (snap) return snap;
      } catch {
        // fall back to simulated
      }
    }

    return await this.fetchRemoteSnapshotSimulated(config);
  }
}

export const oneDriveSyncService = new OneDriveSyncService();
