import Dexie, { type Table } from 'dexie';
import { InventoryItem, HistoryEntry, SyncQueueItem, CloudSyncConfig, SubStore } from '../types/inventory';
import { initializeSecurity, hashPassword } from '../services/security';

export class WLLabDatabase extends Dexie {
  stores!: Table<SubStore, string>;
  inventory!: Table<InventoryItem, string>;
  history!: Table<HistoryEntry, number>;
  syncQueue!: Table<SyncQueueItem, number>;
  settings!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('WLLabInventoryDB_v2');
    this.version(1).stores({
      stores: 'id, name, code, createdAt',
      inventory: 'id, storeId, partNumber, description, location, quantity, updatedAt',
      history: '++id, storeId, ts, action, partNumber',
      syncQueue: '++id, storeId, status, timestamp, action, partNumber',
      settings: 'key'
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

const DEMO_REMARKS = 'DemoParts only/raynor';
const DEMO_SEED_VERSION = 2;
// Part IDs of the earlier demo data set, removed when upgrading to DEMO_SEED_VERSION 2
const LEGACY_DEMO_ITEM_IDS = [
  'sonde-lab:WL-1003', 'sonde-lab:WL-1005', 'sonde-lab:WL-1007', 'sonde-lab:SL-3001', 'sonde-lab:SL-3002',
  'e-lab:EL-2001', 'e-lab:EL-2002', 'e-lab:EL-2003', 'e-lab:EL-2004', 'e-lab:EL-2005',
  'whe:WL-1001', 'whe:WL-1002', 'whe:WL-1004', 'whe:WL-1006', 'whe:WL-1008'
];

function demoItem(storeId: string, partNumber: string, description: string, location: string, quantity: number, threshold: number): InventoryItem {
  return {
    id: `${storeId}:${partNumber}`,
    storeId,
    partNumber,
    description,
    location,
    quantity,
    threshold,
    remarks: DEMO_REMARKS,
    updatedAt: new Date().toISOString()
  };
}

export const INITIAL_ITEMS_PER_STORE: Record<string, InventoryItem[]> = {
  'sonde-lab': [
    demoItem('sonde-lab', 'OR-2-012', 'O-Ring', 'Shelf C-2', 0, 0),
    demoItem('sonde-lab', 'OR-2-118', 'O-Ring', 'Shelf A-2', 2, 4),
    demoItem('sonde-lab', 'OR-2-226', 'O-Ring', 'Cabinet F', 1, 3),
    demoItem('sonde-lab', 'OR-2-334', 'O-Ring', 'Rack S-1', 4, 2),
    demoItem('sonde-lab', 'OR-2-347', 'O-Ring', 'Cabinet S-3', 6, 3),
  ],
  'e-lab': [
    demoItem('e-lab', 'EL-2001', 'Resistor 10k Ohm 1/4W', 'ESD Bin 12', 3, 2),
    demoItem('e-lab', 'EL-2002', 'Ceramic Capacitor 100nF', 'Shelf E-4', 25, 10),
    demoItem('e-lab', 'EL-2003', 'Diode 1N4007', 'ESD Drawer 3', 5, 3),
    demoItem('e-lab', 'EL-2004', 'LED 5mm Red', 'Cabinet E-2', 2, 2),
    demoItem('e-lab', 'EL-2005', 'NPN Transistor 2N2222', 'Bin E-8', 40, 15),
  ],
  'whe': [
    demoItem('whe', 'PG-1001', 'Pressure Gauge 0-100 psi', 'Shelf A-1', 12, 0),
    demoItem('whe', 'PG-1002', 'Pressure Gauge 0-1,000 psi', 'Bin B-3', 3, 5),
    demoItem('whe', 'PG-1004', 'Pressure Gauge 0-5,000 psi', 'Rack D-7', 7, 3),
    demoItem('whe', 'PG-1006', 'Pressure Gauge 0-10,000 psi', 'Bin E-1', 15, 0),
    demoItem('whe', 'PG-1008', 'Pressure Gauge 0-15,000 psi', 'Shelf A-4', 8, 0),
  ]
};

// Placeholder text for the "Description" field when adding a part, per sub-store
export const DESCRIPTION_PLACEHOLDERS: Record<string, string> = {
  'sonde-lab': 'e.g. O-Ring',
  'e-lab': 'e.g. Resistor 10k Ohm, Capacitor 100nF, Diode 1N4007',
  'whe': 'e.g. Pressure Gauge 0-5,000 psi'
};
export const DEFAULT_REMARKS_PLACEHOLDER = DEMO_REMARKS;

export const DEFAULT_CLOUD_SYNC_CONFIG: CloudSyncConfig = {
  enabled: true,
  autoSyncIntervalSeconds: 10,
  lastSyncTime: null,
  lastSyncStatus: 'synced',
  conflictResolution: 'last_write_wins',
  cursor: null
};

// Seed database on first launch
export async function initDatabase() {
  try {
    Dexie.delete('WLLabInventoryDB').catch(() => {});
  } catch {
    // ignore
  }

  if (!db.isOpen()) {
    await db.open();
  }

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

  // 3. Replace the previous demo parts with the current demo set (one-time, keeps any real parts)
  const seedVersion = await getSetting<number>('demoSeedVersion', 1);
  if (seedVersion < DEMO_SEED_VERSION) {
    if (itemCount > 0) {
      await db.inventory.bulkDelete(LEGACY_DEMO_ITEM_IDS);
      const currentIds = new Set((await db.inventory.toCollection().primaryKeys()) as string[]);
      const demoItems = Object.values(INITIAL_ITEMS_PER_STORE).flat().filter(i => !currentIds.has(i.id!));
      await db.inventory.bulkPut(demoItems);
    }
    await setSetting('demoSeedVersion', DEMO_SEED_VERSION);
  }

  // Ensure default global threshold and sync config
  const gthresh = await getSetting('globalThreshold', null);
  if (gthresh === null) {
    await setSetting('globalThreshold', 0);
  }

  const syncConfig = await getSetting<CloudSyncConfig | null>('cloudSyncConfig', null);
  if (!syncConfig) {
    await setSetting('cloudSyncConfig', DEFAULT_CLOUD_SYNC_CONFIG);
  }
  // OneDrive sync was replaced by the cloud database; drop its leftovers
  await db.settings.delete('oneDriveConfig');
  await db.settings.delete('oneDriveFolderHandle');
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

    // Queue for cloud sync
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
