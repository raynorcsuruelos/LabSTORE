import { db, getSetting, setSetting, logHistory } from '../db/dexieDb';
import {
  OneDriveConfig,
  SyncState,
  SyncQueueItem,
  InventoryItem,
  OneDriveCloudSnapshot
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
    this.addLog('info', 'OneDrive Background Sync engine initialized.');
    this.setupNetworkListeners();
  }

  private setupNetworkListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.addLog('info', 'Network connection restored (online). Triggering sync.');
        this.triggerSync('network_online');
      });

      window.addEventListener('offline', () => {
        this.addLog('warn', 'Device is offline. Local IndexedDB updates will be queued.');
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
      mode: 'simulated',
      accessToken: '',
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
      mode: 'simulated',
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

    const intervalMs = Math.max(5, config.autoSyncIntervalSeconds || 30) * 1000;
    this.timer = setInterval(() => {
      this.triggerSync('timer');
    }, intervalMs);

    this.addLog('info', `Background sync worker scheduled every ${config.autoSyncIntervalSeconds}s.`);
    // Initial check
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
      mode: 'simulated',
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
      mode: 'simulated',
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
      this.addLog('info', `Sync started [Trigger: ${source}] (Mode: ${config.mode.toUpperCase()}).`);

      // 1. Fetch pending mutations from Dexie
      const pendingItems = await db.syncQueue.where('status').equals('pending').toArray();
      const currentInventory = await db.inventory.toArray();
      const historyCount = await db.history.count();

      const snapshot: OneDriveCloudSnapshot = {
        lastUpdated: new Date().toISOString(),
        source: 'WL Lab Inventory Web Client (Dexie IndexedDB)',
        itemCount: currentInventory.length,
        items: currentInventory,
        historyCount
      };

      if (config.mode === 'graph_token') {
        await this.syncWithMicrosoftGraph(config, snapshot, pendingItems);
      } else {
        await this.syncWithSimulatedOneDrive(config, snapshot, pendingItems);
      }

      // Mark all pending queue items as synced / clean up
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
      this.addLog('success', `Successfully synced ${pendingItems.length} queued updates with OneDrive.`);

      return { success: true, message: `Synced with OneDrive (${pendingItems.length} updates pushed)` };
    } catch (err: any) {
      console.error('OneDrive sync error:', err);
      this.currentStatus = 'error';
      this.errorMessage = err.message || 'Sync failed';
      this.addLog('error', `Sync failed: ${this.errorMessage}`);

      // Mark items as failed or increment retry
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

  // Real Microsoft Graph API Integration
  private async syncWithMicrosoftGraph(
    config: OneDriveConfig,
    snapshot: OneDriveCloudSnapshot,
    pending: SyncQueueItem[]
  ) {
    if (!config.accessToken || config.accessToken.trim() === '') {
      throw new Error('Microsoft Graph Access Token is missing. Provide an access token in OneDrive Settings.');
    }

    const cleanFolder = (config.folderPath || 'WLLabInventory').replace(/^\/+|\/+$/g, '');
    const cleanFile = config.fileName || 'inventory_sync.json';
    const graphEndpoint = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(cleanFolder)}/${encodeURIComponent(cleanFile)}:/content`;

    this.addLog('info', `Uploading snapshot to Microsoft Graph endpoint: /me/drive/root:/${cleanFolder}/${cleanFile}`);

    const res = await fetch(graphEndpoint, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${config.accessToken.trim()}`,
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
        // use fallback
      }
      throw new Error(`OneDrive Graph API error: ${errMsg}`);
    }

    this.addLog('success', 'Microsoft Graph PUT succeeded. File updated in OneDrive.');
  }

  // Simulated OneDrive Cloud Integration (for prototyping and offline demonstrations)
  private async syncWithSimulatedOneDrive(
    config: OneDriveConfig,
    snapshot: OneDriveCloudSnapshot,
    pending: SyncQueueItem[]
  ) {
    // Simulate real network request latency
    await new Promise(res => setTimeout(res, 500));

    const cloudKey = `wllab_onedrive_cloud_${config.folderPath}_${config.fileName}`;
    
    // Check if remote version exists to handle conflict resolution if required
    const existingCloudDataStr = localStorage.getItem(cloudKey);
    if (existingCloudDataStr && config.conflictResolution === 'remote_priority') {
      try {
        const remoteSnapshot: OneDriveCloudSnapshot = JSON.parse(existingCloudDataStr);
        if (remoteSnapshot && Array.isArray(remoteSnapshot.items)) {
          // Remote priority: pull from cloud
          await db.inventory.bulkPut(remoteSnapshot.items);
          this.addLog('info', `Applied remote priority: Reconciled ${remoteSnapshot.items.length} items from OneDrive.`);
          return;
        }
      } catch {
        // proceed
      }
    }

    // Save cloud snapshot
    localStorage.setItem(cloudKey, JSON.stringify(snapshot));
    this.addLog('info', `Simulated OneDrive cloud storage updated (${snapshot.items.length} items, ${pending.length} deltas applied).`);
  }

  // Inspect what's currently stored in OneDrive Cloud
  public async getCloudSnapshot(): Promise<OneDriveCloudSnapshot | null> {
    const config = await getSetting<OneDriveConfig>('oneDriveConfig', {
      enabled: true,
      mode: 'simulated',
      folderPath: 'WLLabInventory',
      fileName: 'inventory_sync.json',
      autoSyncIntervalSeconds: 30,
      lastSyncTime: null,
      lastSyncStatus: 'synced',
      conflictResolution: 'last_write_wins'
    });

    if (config.mode === 'graph_token' && config.accessToken) {
      try {
        const cleanFolder = (config.folderPath || 'WLLabInventory').replace(/^\/+|\/+$/g, '');
        const cleanFile = config.fileName || 'inventory_sync.json';
        const graphEndpoint = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(cleanFolder)}/${encodeURIComponent(cleanFile)}:/content`;

        const res = await fetch(graphEndpoint, {
          headers: { Authorization: `Bearer ${config.accessToken}` }
        });
        if (res.ok) {
          return await res.json();
        }
      } catch {
        return null;
      }
    }

    const cloudKey = `wllab_onedrive_cloud_${config.folderPath}_${config.fileName}`;
    const raw = localStorage.getItem(cloudKey);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export const oneDriveSyncService = new OneDriveSyncService();
