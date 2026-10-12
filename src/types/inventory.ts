export interface InventoryItem {
  id?: number;
  partNumber: string;
  description: string;
  location: string;
  quantity: number;
  threshold?: number; // min threshold for low-stock alert; 0 means alert when 0
  remarks?: string;
  updatedAt: string; // ISO string for conflict resolution
  version?: number;
}

export interface HistoryEntry {
  id?: number;
  ts: string;
  action: string;
  partNumber: string;
  description: string;
  qty: number | string;
  note?: string;
}

export type SyncActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'ADJUST' | 'BULK_IMPORT';

export interface SyncQueueItem {
  id?: number;
  action: SyncActionType;
  partNumber: string;
  payload: any;
  timestamp: string;
  status: 'pending' | 'syncing' | 'failed';
  retryCount: number;
  errorMessage?: string;
}

export type SyncState = 'synced' | 'syncing' | 'pending' | 'offline' | 'error';

export interface OneDriveConfig {
  enabled: boolean;
  mode: 'simulated' | 'graph_token';
  accessToken?: string;
  folderPath: string; // e.g. "WLLabInventory"
  fileName: string;   // e.g. "inventory_sync.json"
  autoSyncIntervalSeconds: number; // e.g. 15, 30, 60
  lastSyncTime: string | null;
  lastSyncStatus: SyncState;
  conflictResolution: 'last_write_wins' | 'local_priority' | 'remote_priority';
  remoteLastModified?: string | null;
}

export interface OneDriveCloudSnapshot {
  lastUpdated: string;
  source: string;
  itemCount: number;
  items: InventoryItem[];
  historyCount: number;
}
