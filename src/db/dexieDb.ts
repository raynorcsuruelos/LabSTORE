import Dexie, { type Table } from 'dexie';
import { InventoryItem, HistoryEntry, SyncQueueItem, OneDriveConfig } from '../types/inventory';
import { initializeSecurity } from '../services/security';

export class WLLabDatabase extends Dexie {
  inventory!: Table<InventoryItem, string>;
  history!: Table<HistoryEntry, number>;
  syncQueue!: Table<SyncQueueItem, number>;
  settings!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('WLLabInventoryDB');
    this.version(1).stores({
      inventory: 'partNumber, description, location, quantity, updatedAt',
      history: '++id, ts, action, partNumber',
      syncQueue: '++id, status, timestamp, action, partNumber',
      settings: 'key'
    });
  }
}

export const db = new WLLabDatabase();

export const INITIAL_ITEMS: InventoryItem[] = [
  { partNumber: 'WL-1001', description: 'O-Ring Kit 2" Standard', location: 'Shelf A-1', quantity: 12, threshold: 0, remarks: 'For 5110 tool head', updatedAt: new Date().toISOString() },
  { partNumber: 'WL-1002', description: 'Centralizer Spring Pack', location: 'Bin B-3', quantity: 3, threshold: 5, remarks: 'Check expiry date', updatedAt: new Date().toISOString() },
  { partNumber: 'WL-1003', description: 'Pressure Transducer 10kpsi', location: 'Shelf C-2', quantity: 0, threshold: 0, remarks: 'Critical – reorder immediately', updatedAt: new Date().toISOString() },
  { partNumber: 'WL-1004', description: 'Fishing Tool Overshot 3.5"', location: 'Rack D-7', quantity: 7, threshold: 3, remarks: '', updatedAt: new Date().toISOString() },
  { partNumber: 'WL-1005', description: 'Cable Head Assembly', location: 'Shelf A-2', quantity: 2, threshold: 4, remarks: 'Inspect before use', updatedAt: new Date().toISOString() },
  { partNumber: 'WL-1006', description: 'Torque Anchor Set', location: 'Bin E-1', quantity: 15, threshold: 0, remarks: '', updatedAt: new Date().toISOString() },
  { partNumber: 'WL-1007', description: 'CCL Sensor Module', location: 'Cabinet F', quantity: 1, threshold: 3, remarks: 'Pre-calibrated', updatedAt: new Date().toISOString() },
  { partNumber: 'WL-1008', description: 'Hydraulic Seal Kit', location: 'Shelf A-4', quantity: 8, threshold: 0, remarks: '', updatedAt: new Date().toISOString() },
];

export const DEFAULT_ONEDRIVE_CONFIG: OneDriveConfig = {
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
};

// Seed database on first launch
export async function initDatabase() {
  const count = await db.inventory.count();
  if (count === 0) {
    // Check if there was old localStorage data to migrate
    let itemsToInsert = INITIAL_ITEMS;
    try {
      const oldStorage = localStorage.getItem('wllab_inventory');
      if (oldStorage) {
        const parsed = JSON.parse(oldStorage);
        if (Array.isArray(parsed) && parsed.length > 0) {
          itemsToInsert = parsed.map(item => ({
            ...item,
            updatedAt: new Date().toISOString()
          }));
        }
      }
    } catch {
      // ignore fallback
    }

    await db.inventory.bulkPut(itemsToInsert);
    await logHistory('Database Initialized', 'SYSTEM', 'Seeded initial inventory in IndexedDB', itemsToInsert.length, 'Offline IndexedDB storage active');
  }

  // Ensure secure hashed admin credentials exist
  await initializeSecurity();

  const gthresh = await getSetting('globalThreshold', null);
  if (gthresh === null) {
    const legacyThresh = localStorage.getItem('wllab_global_threshold');
    await setSetting('globalThreshold', legacyThresh !== null ? parseInt(legacyThresh, 10) : 0);
  }

  const odConfig = await getSetting('oneDriveConfig', null);
  if (!odConfig) {
    await setSetting('oneDriveConfig', DEFAULT_ONEDRIVE_CONFIG);
  }
}

export async function getSetting<T = any>(key: string, defaultValue: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : defaultValue;
}

export async function setSetting(key: string, value: any): Promise<void> {
  await db.settings.put({ key, value });
}

export async function logHistory(
  action: string,
  partNumber: string,
  description: string,
  qty: number | string,
  note: string = ''
) {
  const entry: HistoryEntry = {
    ts: new Date().toISOString(),
    action,
    partNumber,
    description,
    qty,
    note
  };
  await db.history.add(entry);

  // Keep history table bounded to latest 1000 records
  const count = await db.history.count();
  if (count > 1000) {
    const oldest = await db.history.orderBy('id').limit(count - 1000).keys();
    await db.history.bulkDelete(oldest as number[]);
  }
}

export async function enqueueSync(action: SyncQueueItem['action'], partNumber: string, payload: any) {
  const queueItem: SyncQueueItem = {
    action,
    partNumber,
    payload,
    timestamp: new Date().toISOString(),
    status: 'pending',
    retryCount: 0
  };
  await db.syncQueue.add(queueItem);
}

// Instant Stock Update Helper
export async function adjustItemStock(
  partNumber: string,
  actionType: 'set' | 'add' | 'sub' | 'withdraw' | 'quick_step',
  amount: number,
  reason: string = '',
  newThreshold?: number
): Promise<{ success: boolean; newItem?: InventoryItem; error?: string }> {
  return await db.transaction('rw', db.inventory, db.history, db.syncQueue, async () => {
    const item = await db.inventory.get(partNumber);
    if (!item) {
      return { success: false, error: 'Item not found in IndexedDB' };
    }

    const oldQty = item.quantity;
    let newQty = oldQty;

    if (actionType === 'set') {
      newQty = Math.max(0, amount);
    } else if (actionType === 'add') {
      newQty = oldQty + amount;
    } else if (actionType === 'sub') {
      if (amount > oldQty) {
        return { success: false, error: `Cannot subtract ${amount}; current stock is only ${oldQty}` };
      }
      newQty = oldQty - amount;
    } else if (actionType === 'withdraw') {
      newQty = 0;
    } else if (actionType === 'quick_step') {
      newQty = Math.max(0, oldQty + amount);
    }

    const updatedItem: InventoryItem = {
      ...item,
      quantity: newQty,
      updatedAt: new Date().toISOString(),
      ...(newThreshold !== undefined && newThreshold !== null && !isNaN(newThreshold)
        ? { threshold: Math.max(0, newThreshold) }
        : {})
    };

    await db.inventory.put(updatedItem);

    const logAction =
      actionType === 'withdraw'
        ? 'Full Withdraw'
        : actionType === 'quick_step'
        ? (amount > 0 ? 'Quick +1' : 'Quick -1')
        : `Adjustment (${actionType})`;

    const loggedDelta = actionType === 'withdraw' ? oldQty : actionType === 'set' ? newQty : Math.abs(amount);

    await logHistory(logAction, partNumber, item.description, loggedDelta, reason || `Stock changed from ${oldQty} to ${newQty}`);

    // Queue for OneDrive sync
    await enqueueSync('ADJUST', partNumber, {
      partNumber,
      previousQuantity: oldQty,
      quantity: newQty,
      action: actionType,
      updatedAt: updatedItem.updatedAt
    });

    return { success: true, newItem: updatedItem };
  });
}
