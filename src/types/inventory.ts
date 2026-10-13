export interface SubStore {
  id: string; // e.g. "sonde-lab", "e-lab", "whe"
  name: string; // e.g. "Sonde Lab", "E-Lab", "WHE"
  code: string; // e.g. "SONDE", "ELAB", "WHE"
  description: string;
  adminPasswordHash?: {
    hash: string;
    salt: string;
  };
  createdAt: string;
}

export interface InventoryItem {
  id?: string; // unique key: `${storeId}:${partNumber}`
  storeId: string; // sub-store identifier
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
  storeId?: string;
  ts: string;
  action: string;
  partNumber: string;
  description: string;
  qty: number | string;
  note?: string;
}

export type SyncActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'ADJUST' | 'BULK_IMPORT' | 'STORE_MUTATION';

export interface SyncQueueItem {
  id?: number;
  storeId?: string;
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
  mode: 'simulated' | 'msal_popup' | 'graph_token';
  accessToken?: string;
  msalClientId?: string;
  msalTenantId?: string; // 'common' or corporate tenant ID
  userDisplayName?: string;
  userEmail?: string;
  isAuthenticated?: boolean;
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
  stores?: SubStore[];
  itemCount: number;
  items: InventoryItem[];
  historyCount: number;
}
