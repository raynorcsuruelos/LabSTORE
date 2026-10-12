import Dexie, { type Table } from 'dexie';
import { InventoryItem, HistoryEntry, SyncQueueItem, OneDriveConfig, SubStore } from '../types/inventory';
import { initializeSecurity, hashPassword } from '../services/security';

export class WLLabDatabase extends Dexie {
  stores!: Table<SubStore, string>;
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

    // Version 2: Multi-Store Support with SubStore table and compound item keys
    this.version(2).stores({
      stores: 'id, name, code, createdAt',
      inventory: 'id, storeId, partNumber, description, location, quantity, updatedAt',
      history: '++id, storeId, ts, action, partNumber',
      syncQueue: '++id, storeId, status, timestamp, action, partNumber',
      settings: 'key'
    }).upgrade(async tx => {
      // Migration: assign legacy inventory items to the default store
      const legacyItems = await tx.table('inventory').toArray();
      for (const item of legacyItems) {
        if (!item.storeId) {
          item.storeId = 'whe';
          item.id = `whe:${item.partNumber}`;
          await tx.table('inventory').put(item);
        }
      }
    });
  }
}

export const db = new WLLabDatabase();

export const DEFAULT_STORES: SubStore[] = [
  {
    id: 'sonde-lab',
    name: 'Sonde Lab',
    code: 'SONDE',
    description: 'Wireline Sonde Laboratory (Downhole tool sondes, acoustic mandrels, transducers & sensors)',
    createdAt: new Date().toISOString()
  },
  {
    id: 'e-lab',
    name: 'E-Lab',
    code: 'ELAB',
    description: 'Electronics Laboratory (Telemetry cartridges, high-temp PCB electronics & cabling)',
    createdAt: new Date().toISOString()
  },
  {
    id: 'whe',
    name: 'WHE',
    code: 'WHE',
    description: 'Wireline Hardware & Equipment (Mechanical assemblies, cable heads, overshots & springs)',
    createdAt: new Date().toISOString()
  }
];

export const INITIAL_ITEMS_PER_STORE: Record<string, InventoryItem[]> = {
  'sonde-lab': [
    { id: 'sonde-lab:WL-1003', storeId: 'sonde-lab', partNumber: 'WL-1003', description: 'Pressure Transducer 10kpsi', location: 'Shelf C-2', quantity: 0, threshold: 0, remarks: 'Critical – reorder immediately', updatedAt: new Date().toISOString() },
    { id: 'sonde-lab:WL-1005', storeId: 'sonde-lab', partNumber: 'WL-1005', description: 'Cable Head Assembly', location: 'Shelf A-2', quantity: 2, threshold: 4, remarks: 'Inspect before use', updatedAt: new Date().toISOString() },
    { id: 'sonde-lab:WL-1007', storeId: 'sonde-lab', partNumber: 'WL-1007', description: 'CCL Sensor Module', location: 'Cabinet F', quantity: 1, threshold: 3, remarks: 'Pre-calibrated', updatedAt: new Date().toISOString() },
    { id: 'sonde-lab:SL-3001', storeId: 'sonde-lab', partNumber: 'SL-3001', description: 'Acoustic Sonde Mandrel 3-3/8"', location: 'Rack S-1', quantity: 4, threshold: 2, remarks: 'High-temp 400F rated', updatedAt: new Date().toISOString() },
    { id: 'sonde-lab:SL-3002', storeId: 'sonde-lab', partNumber: 'SL-3002', description: 'Dual Induction Coil Assembly', location: 'Cabinet S-3', quantity: 6, threshold: 3, remarks: 'Calibrated 20k ohm-m', updatedAt: new Date().toISOString() },
  ],
  'e-lab': [
    { id: 'e-lab:EL-2001', storeId: 'e-lab', partNumber: 'EL-2001', description: 'Telemetry Digital Cartridge', location: 'ESD Bin 12', quantity: 3, threshold: 2, remarks: 'Firmware v4.8 loaded', updatedAt: new Date().toISOString() },
    { id: 'e-lab:EL-2002', storeId: 'e-lab', partNumber: 'EL-2002', description: 'High-Temp Capacitor Pack 200C', location: 'Shelf E-4', quantity: 25, threshold: 10, remarks: 'Mil-spec high temp', updatedAt: new Date().toISOString() },
    { id: 'e-lab:EL-2003', storeId: 'e-lab', partNumber: 'EL-2003', description: 'Power Distribution Board (PDB)', location: 'ESD Drawer 3', quantity: 5, threshold: 3, remarks: 'For 5700 tool series', updatedAt: new Date().toISOString() },
    { id: 'e-lab:EL-2004', storeId: 'e-lab', partNumber: 'EL-2004', description: 'Gamma Ray Scintillation PMT', location: 'Cabinet E-2', quantity: 2, threshold: 2, remarks: 'Store in padded shock box', updatedAt: new Date().toISOString() },
    { id: 'e-lab:EL-2005', storeId: 'e-lab', partNumber: 'EL-2005', description: 'Ceramic Resistor Array 10k', location: 'Bin E-8', quantity: 40, threshold: 15, remarks: 'Precision 0.1%', updatedAt: new Date().toISOString() },
  ],
  'whe': [
    { id: 'whe:WL-1001', storeId: 'whe', partNumber: 'WL-1001', description: 'O-Ring Kit 2" Standard', location: 'Shelf A-1', quantity: 12, threshold: 0, remarks: 'For 5110 tool head', updatedAt: new Date().toISOString() },
    { id: 'whe:WL-1002', storeId: 'whe', partNumber: 'WL-1002', description: 'Centralizer Spring Pack', location: 'Bin B-3', quantity: 3, threshold: 5, remarks: 'Check expiry date', updatedAt: new Date().toISOString() },
    { id: 'whe:WL-1004', storeId: 'whe', partNumber: 'WL-1004', description: 'Fishing Tool Overshot 3.5"', location: 'Rack D-7', quantity: 7, threshold: 3, remarks: '', updatedAt: new Date().toISOString() },
    { id: 'whe:WL-1006', storeId: 'whe', partNumber: 'WL-1006', description: 'Torque Anchor Set', location: 'Bin E-1', quantity: 15, threshold: 0, remarks: '', updatedAt: new Date().toISOString() },
    { id: 'whe:WL-1008', storeId: 'whe', partNumber: 'WL-1008', description: 'Hydraulic Seal Kit', location: 'Shelf A-4', quantity: 8, threshold: 0, remarks: '', updatedAt: new Date().toISOString() },
  ]
};

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
  await initializeSecurity();

  // 1. Initialize Sub-Stores
  const storeCount = await db.stores.count();
  if (storeCount === 0) {
    const seededStores: SubStore[] = [];
    for (const s of DEFAULT_STORES) {
      const salt = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      // Default initial password for each store: e.g. "SondeAdmin2025", "ELabAdmin2025", "WHEAdmin2025", or general "WLAdmin2025"
      const storeDefaultPass = `${s.code}Admin2025`;
      const hash = await hashPassword(storeDefaultPass, salt);
      seededStores.push({
        ...s,
        adminPasswordHash: { hash, salt }
      });
    }
    await db.stores.bulkPut(seededStores);
  }

  // 2. Initialize items per store if empty
  const itemCount = await db.inventory.count();
  if (itemCount === 0) {
    const allInitialItems: InventoryItem[] = [
      ...INITIAL_ITEMS_PER_STORE['sonde-lab'],
      ...INITIAL_ITEMS_PER_STORE['e-lab'],
      ...INITIAL_ITEMS_PER_STORE['whe']
    ];
    await db.inventory.bulkPut(allInitialItems);
    await logHistory('Database Initialized', 'SYSTEM', 'Seeded initial multi-store inventory in IndexedDB', allInitialItems.length, 'Sonde Lab, E-Lab, and WHE stores loaded');
  }

  // Ensure default global threshold and sync config
  const gthresh = await getSetting('globalThreshold', null);
  if (gthresh === null) {
    await setSetting('globalThreshold', 0);
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
  note: string = '',
  storeId: string = ''
) {
  const entry: HistoryEntry = {
    storeId,
    ts: new Date().toISOString(),
    action,
    partNumber,
    description,
    qty,
    note
  };
  await db.history.add(entry);

  const count = await db.history.count();
  if (count > 1000) {
    const oldest = await db.history.orderBy('id').limit(count - 1000).keys();
    await db.history.bulkDelete(oldest as number[]);
  }
}

export async function enqueueSync(
  action: SyncQueueItem['action'],
  partNumber: string,
  payload: any,
  storeId: string = ''
) {
  const queueItem: SyncQueueItem = {
    storeId,
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
  storeId: string,
  partNumber: string,
  actionType: 'set' | 'add' | 'sub' | 'withdraw',
  amount: number,
  reason: string = '',
  newThreshold?: number
): Promise<{ success: boolean; newItem?: InventoryItem; error?: string }> {
  return await db.transaction('rw', db.inventory, db.history, db.syncQueue, async () => {
    const itemId = `${storeId}:${partNumber}`;
    let item = await db.inventory.get(itemId);
    
    // Fallback lookup by storeId and partNumber if id format differed
    if (!item) {
      item = await db.inventory.where({ storeId, partNumber }).first();
    }

    if (!item) {
      return { success: false, error: `Part ${partNumber} not found in this sub-store` };
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
    }

    const updatedItem: InventoryItem = {
      ...item,
      id: itemId,
      storeId,
      quantity: newQty,
      updatedAt: new Date().toISOString(),
      ...(newThreshold !== undefined && newThreshold !== null && !isNaN(newThreshold)
        ? { threshold: Math.max(0, newThreshold) }
        : {})
    };

    await db.inventory.put(updatedItem);

    const logAction = actionType === 'withdraw' ? 'Full Withdraw' : `Adjustment (${actionType})`;
    const loggedDelta = actionType === 'withdraw' ? oldQty : actionType === 'set' ? newQty : Math.abs(amount);

    await logHistory(
      logAction,
      partNumber,
      item.description,
      loggedDelta,
      reason || `Stock updated from ${oldQty} to ${newQty}`,
      storeId
    );

    // Queue for OneDrive sync
    await enqueueSync(
      'ADJUST',
      partNumber,
      {
        storeId,
        partNumber,
        previousQuantity: oldQty,
        quantity: newQty,
        action: actionType,
        updatedAt: updatedItem.updatedAt
      },
      storeId
    );

    return { success: true, newItem: updatedItem };
  });
}
