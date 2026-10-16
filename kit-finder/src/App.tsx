import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  initDatabase,
  getSetting,
  setSetting,
  adjustItemStock,
  logHistory,
  enqueueSync,
  DEFAULT_STORES,
  DEFAULT_CLOUD_SYNC_CONFIG
} from './db/dexieDb';
import { cloudSyncService, SyncServiceState } from './services/cloudSync';
import { InventoryItem, SubStore } from './types/inventory';
import { hashPassword } from './services/security';
import { ToastProvider, useToast } from './components/Toast';
import { Header } from './components/Header';
import { NotificationPanel } from './components/NotificationPanel';
import { SearchSection } from './components/SearchSection';
import { InventoryTable } from './components/InventoryTable';
import { QuickAdjustModal } from './components/QuickAdjustModal';
import { AllAlertsModal } from './components/AllAlertsModal';
import { HistoryModal } from './components/HistoryModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminModal } from './components/AdminModal';
import { EditPartModal } from './components/EditPartModal';
import { SyncStatusModal } from './components/SyncStatusModal';
import { HelpModal } from './components/HelpModal';
import { StoreSelectModal } from './components/StoreSelectModal';
import { AuthGate } from './components/LoginScreen';
import { logout, type User } from '@netlify/identity';
import { BarChart3, ExternalLink } from 'lucide-react';
import { IS_STANDALONE } from './standalone';

interface PendingAdminAction {
  type: 'adjust' | 'withdraw' | 'add_stock' | 'sub_stock' | 'admin_panel';
  item?: InventoryItem;
}

function InventoryApp({ user }: { user: User | null }) {
  const { showToast } = useToast();

  // Dexie Reactive Live Queries (Protected against render crashes)
  const allStores = useLiveQuery(async () => {
    try {
      const s = await db.stores.toArray();
      return s.length > 0 ? s : DEFAULT_STORES;
    } catch {
      return DEFAULT_STORES;
    }
  }, []) ?? DEFAULT_STORES;

  const allItems = useLiveQuery(async () => {
    try {
      return await db.inventory.toArray();
    } catch {
      return [];
    }
  }, []) ?? [];

  const history = useLiveQuery(async () => {
    try {
      return await db.history.orderBy('id').reverse().toArray();
    } catch {
      return [];
    }
  }, []) ?? [];

  const globalThreshold = useLiveQuery(async () => {
    try {
      return await getSetting<number>('globalThreshold', 0);
    } catch {
      return 0;
    }
  }, []) ?? 0;

  // Active Sub-Store State (Initial Store choice prompt if not set)
  const [currentStoreId, setCurrentStoreId] = useState<string>(() => {
    return localStorage.getItem('wllab_default_store') || 'sonde-lab';
  });
  const [storeSelectOpen, setStoreSelectOpen] = useState<boolean>(() => {
    return !localStorage.getItem('wllab_default_store');
  });

  // Effective Current Store
  const currentStore = useMemo(() => {
    return allStores.find(s => s.id === currentStoreId) || allStores[0] || DEFAULT_STORES[0];
  }, [allStores, currentStoreId]);

  // Filter Items strictly belonging to the active Sub-Store
  const storeItems = useMemo(() => {
    const targetStoreId = currentStore?.id || 'sonde-lab';
    return allItems.filter(i => (i.storeId || 'whe') === targetStoreId);
  }, [allItems, currentStore]);

  // Background Sync Engine State
  const [syncState, setSyncState] = useState<SyncServiceState>({
    status: 'synced',
    isOnline: true,
    pendingCount: 0,
    lastSyncTime: null,
    errorMessage: null,
    config: DEFAULT_CLOUD_SYNC_CONFIG,
    logs: []
  });

  // UI & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  // Modals & Drawers
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [allAlertsOpen, setAllAlertsOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Security & Admin Session Management
  // Admin rights are bound to the store they were granted in; the master role is the only one with sub-store settings
  const [adminSession, setAdminSession] = useState<{ role: 'master' | 'store'; storeId: string } | null>(null);
  const isAdmin = !!adminSession && adminSession.storeId === currentStore.id;
  const isMaster = isAdmin && adminSession?.role === 'master';
  const [pendingAdminAction, setPendingAdminAction] = useState<PendingAdminAction | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Inactivity auto-lock timer (15 minutes)
  const handleLockAdmin = useCallback(() => {
    if (adminSession) {
      setAdminSession(null);
      setPendingAdminAction(null);
      setAdjustingItem(null);
      setAdminModalOpen(false);
      showToast('Admin session locked for security.', 'info');
    }
  }, [adminSession, showToast]);

  useEffect(() => {
    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('pointerdown', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);

    const interval = setInterval(() => {
      if (isAdmin && Date.now() - lastActivityRef.current > 15 * 60 * 1000) {
        handleLockAdmin();
      }
    }, 60000);

    return () => {
      window.removeEventListener('pointerdown', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      clearInterval(interval);
    };
  }, [isAdmin, handleLockAdmin]);

  // Initialize DB and background sync worker on mount
  useEffect(() => {
    const unsubscribe = cloudSyncService.subscribe(state => {
      setSyncState(state);
    });

    // Seed/upgrade the local copy first so the first cloud sync sees the final local state
    initDatabase()
      .catch(err => console.error('Failed to init IndexedDB:', err))
      .finally(() => {
        if (!IS_STANDALONE) cloudSyncService.startBackgroundWorker();
      });

    return () => {
      unsubscribe();
      cloudSyncService.stopBackgroundWorker();
    };
  }, []);

  // Compute Low-Stock & Out-of-Stock items for active store
  const thresholdOf = (item: InventoryItem) => {
    return item.threshold !== undefined && item.threshold !== null && item.threshold !== 0
      ? item.threshold
      : (item.threshold === 0 ? 0 : globalThreshold);
  };

  const lowStockItems = useMemo(() => {
    return storeItems.filter(item => item.quantity <= thresholdOf(item));
  }, [storeItems, globalThreshold]);

  const outOfStockItems = useMemo(() => {
    return storeItems.filter(item => item.quantity <= 0);
  }, [storeItems]);

  // Filtered Items for Display
  const filteredItems = useMemo(() => {
    let result = storeItems;

    // Apply Filter Chips
    if (activeFilter === 'in_stock') {
      result = result.filter(item => item.quantity > thresholdOf(item));
    } else if (activeFilter === 'low_stock') {
      result = result.filter(item => item.quantity > 0 && item.quantity <= thresholdOf(item));
    } else if (activeFilter === 'out_of_stock') {
      result = result.filter(item => item.quantity <= 0);
    }

    // Apply Text Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        item =>
          item.partNumber.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q) ||
          (item.remarks || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [storeItems, searchQuery, activeFilter, globalThreshold]);

  // Store Switching & Selection
  // Every store switch drops all admin privileges (master and store admin alike)
  const switchStore = (storeId: string) => {
    if (storeId === currentStoreId) return;
    const hadAdmin = !!adminSession;
    setAdminSession(null);
    setPendingAdminAction(null);
    setAdjustingItem(null);
    setEditingItem(null);
    setAdminModalOpen(false);
    setCurrentStoreId(storeId);
    if (hadAdmin) showToast('Admin privileges removed after switching store. Sign in again as admin for this store.', 'info');
  };

  const handleSelectStore = (storeId: string, setAsDefault: boolean) => {
    switchStore(storeId);
    if (setAsDefault) {
      localStorage.setItem('wllab_default_store', storeId);
    }
    setStoreSelectOpen(false);
    setSearchQuery('');
    const targetStore = allStores.find(s => s.id === storeId);
    showToast(`Switched to ${targetStore?.name || 'Store'}`, 'info');
  };

  // Direct +/- Stock Actions (Admin Protected)
  const handleStockAdd = async (item: InventoryItem) => {
    if (isAdmin) {
      const res = await adjustItemStock(currentStore.id, item.partNumber, 'add', 1, 'Quick +1 stock added by admin');
      if (res.success && res.newItem) {
        showToast(`Added 1 unit to ${item.partNumber} (${currentStore.name}) - Qty: ${res.newItem.quantity}`, 'success');
      }
    } else {
      setPendingAdminAction({ type: 'add_stock', item });
      setAdminLoginOpen(true);
    }
  };

  const handleStockSub = async (item: InventoryItem) => {
    if (item.quantity <= 0) {
      showToast(`Stock for ${item.partNumber} is already zero.`, 'warn');
      return;
    }

    if (isAdmin) {
      const res = await adjustItemStock(currentStore.id, item.partNumber, 'sub', 1, 'Quick -1 stock withdrawn by admin');
      if (res.success && res.newItem) {
        showToast(`Withdrawn 1 unit from ${item.partNumber} (${currentStore.name}) - Qty: ${res.newItem.quantity}`, 'info');
      }
    } else {
      setPendingAdminAction({ type: 'sub_stock', item });
      setAdminLoginOpen(true);
    }
  };

  // Admin Request Handlers
  const handleRequestAdjust = (item: InventoryItem) => {
    if (isAdmin) {
      setAdjustingItem(item);
    } else {
      setPendingAdminAction({ type: 'adjust', item });
      setAdminLoginOpen(true);
    }
  };

  const handleRequestWithdraw = (item: InventoryItem) => {
    if (isAdmin) {
      if (item.quantity <= 0) {
        showToast(`Stock for ${item.partNumber} is already zero.`, 'warn');
        return;
      }
      if (window.confirm(`Withdraw all ${item.quantity} unit(s) of "${item.partNumber}"? Stock will be set to 0.`)) {
        handleWithdraw(item.partNumber, 'Direct row withdraw by admin');
      }
    } else {
      setPendingAdminAction({ type: 'withdraw', item });
      setAdminLoginOpen(true);
    }
  };

  const handleRequestAdminPanel = () => {
    if (isAdmin) {
      setAdminModalOpen(true);
    } else {
      setPendingAdminAction({ type: 'admin_panel' });
      setAdminLoginOpen(true);
    }
  };

  const handleAdminLoginSuccess = async (master: boolean) => {
    setAdminSession({ role: master ? 'master' : 'store', storeId: currentStore.id });
    setAdminLoginOpen(false);
    lastActivityRef.current = Date.now();
    showToast(
      master
        ? `Master admin access granted (${currentStore?.name || 'Store'}).`
        : `Store admin access granted for ${currentStore?.name || 'Store'} only.`,
      'success'
    );

    if (pendingAdminAction) {
      const pending = pendingAdminAction;
      setPendingAdminAction(null);

      if (pending.type === 'add_stock' && pending.item) {
        const res = await adjustItemStock(currentStore.id, pending.item.partNumber, 'add', 1, 'Quick +1 stock added by admin');
        if (res.success && res.newItem) {
          showToast(`Added 1 unit to ${pending.item.partNumber} (New Qty: ${res.newItem.quantity})`, 'success');
        }
      } else if (pending.type === 'sub_stock' && pending.item) {
        if (pending.item.quantity <= 0) {
          showToast(`Stock for ${pending.item.partNumber} is already zero.`, 'warn');
        } else {
          const res = await adjustItemStock(currentStore.id, pending.item.partNumber, 'sub', 1, 'Quick -1 stock withdrawn by admin');
          if (res.success && res.newItem) {
            showToast(`Withdrawn 1 unit from ${pending.item.partNumber} (New Qty: ${res.newItem.quantity})`, 'info');
          }
        }
      } else if (pending.type === 'adjust' && pending.item) {
        setAdjustingItem(pending.item);
      } else if (pending.type === 'withdraw' && pending.item) {
        if (pending.item.quantity <= 0) {
          showToast(`Stock for ${pending.item.partNumber} is already zero.`, 'warn');
        } else if (
          window.confirm(`Withdraw all ${pending.item.quantity} unit(s) of "${pending.item.partNumber}"? Stock will be set to 0.`)
        ) {
          handleWithdraw(pending.item.partNumber, 'Direct row withdraw by admin');
        }
      } else if (pending.type === 'admin_panel') {
        setAdminModalOpen(true);
      }
    } else {
      setAdminModalOpen(true);
    }
  };

  // Stock Mutation Actions for active store
  const handleApplyAdjust = async (
    partNumber: string,
    action: 'set' | 'add' | 'sub',
    qty: number,
    threshold: number | undefined,
    reason: string
  ) => {
    if (!isAdmin) {
      showToast('Admin authorization required to adjust stock.', 'error');
      return;
    }
    const storeId = currentStore.id;
    const res = await adjustItemStock(storeId, partNumber, action, qty, reason, threshold);
    if (res.success && res.newItem) {
      showToast(`Stock updated for ${partNumber} in ${currentStore.name} (New Qty: ${res.newItem.quantity})`, 'success');
    } else if (res.error) {
      showToast(res.error, 'error');
    }
  };

  const handleWithdraw = async (partNumber: string, reason: string) => {
    if (!isAdmin) {
      showToast('Admin authorization required to withdraw stock.', 'error');
      return;
    }
    const storeId = currentStore.id;
    const res = await adjustItemStock(storeId, partNumber, 'withdraw', 0, reason);
    if (res.success) {
      showToast(`All units of ${partNumber} in ${currentStore.name} withdrawn to 0.`, 'warn');
    } else if (res.error) {
      showToast(res.error, 'error');
    }
  };

  const handleAddNewItem = async (newItemData: Omit<InventoryItem, 'updatedAt'>) => {
    const storeId = currentStore.id;
    const item: InventoryItem = {
      ...newItemData,
      storeId,
      id: `${storeId}:${newItemData.partNumber}`,
      updatedAt: new Date().toISOString()
    };
    await db.inventory.put(item);
    await logHistory('New Item Added', item.partNumber, item.description, item.quantity, item.remarks || '', storeId);
    await enqueueSync('CREATE', item.partNumber, item, storeId);
    showToast(`Added part ${item.partNumber} to ${currentStore.name}!`, 'success');
  };

  const handleSaveEditPart = async (updated: InventoryItem, originalPartNumber: string) => {
    const storeId = currentStore.id;
    const originalId = `${storeId}:${originalPartNumber}`;
    const newId = `${storeId}:${updated.partNumber}`;

    if (originalPartNumber !== updated.partNumber) {
      await db.inventory.delete(originalId);
      await enqueueSync('DELETE', originalPartNumber, { partNumber: originalPartNumber, storeId }, storeId);
    }

    const savedItem: InventoryItem = {
      ...updated,
      id: newId,
      storeId
    };

    await db.inventory.put(savedItem);
    await logHistory(
      'Edit',
      savedItem.partNumber,
      savedItem.description,
      savedItem.quantity,
      originalPartNumber !== savedItem.partNumber ? `Renamed from ${originalPartNumber}` : 'Metadata updated',
      storeId
    );
    await enqueueSync('UPDATE', savedItem.partNumber, savedItem, storeId);
    showToast(`Part ${savedItem.partNumber} updated.`, 'success');
  };

  const handleDeletePart = async (partNumber: string) => {
    const storeId = currentStore.id;
    const itemId = `${storeId}:${partNumber}`;
    if (!window.confirm(`Delete part "${partNumber}" from ${currentStore.name}? This cannot be undone.`)) return;

    const existing = await db.inventory.get(itemId);
    await db.inventory.delete(itemId);
    await logHistory('Deleted', partNumber, existing ? existing.description : '', 0, `Part removed from ${currentStore.name}`, storeId);
    await enqueueSync('DELETE', partNumber, { partNumber, storeId }, storeId);
    showToast(`Part ${partNumber} deleted from ${currentStore.name}.`, 'warn');
  };

  // Sub-Store Management
  const requireMaster = () => {
    if (isMaster) return true;
    showToast('Only the master administrator can change sub-store settings.', 'error');
    return false;
  };

  const handleCreateStore = async (name: string, code: string, description: string, password: string) => {
    if (!requireMaster()) return;
    const slugId = code.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);
    const salt = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    const hash = await hashPassword(password, salt);

    const newStore: SubStore = {
      id: slugId,
      name,
      code: code.toUpperCase(),
      description,
      adminPasswordHash: { hash, salt },
      createdAt: new Date().toISOString()
    };

    await db.stores.put(newStore);
    await logHistory('Store Created', 'SYSTEM', `Created sub-store ${name} (${code})`, 0, 'Sub-store added', slugId);
    await enqueueSync('STORE_MUTATION', slugId, { action: 'CREATE_STORE', store: newStore });
    showToast(`Sub-store ${name} created with assigned administrator!`, 'success');
  };

  const handleDeleteStore = async (storeId: string) => {
    if (!requireMaster()) return;
    if (allStores.length <= 1) {
      showToast('Cannot delete the last remaining store.', 'error');
      return;
    }
    const target = allStores.find(s => s.id === storeId);
    if (!window.confirm(`Delete store "${target?.name}" and all its parts? This cannot be undone.`)) return;

    await db.stores.delete(storeId);
    await enqueueSync('STORE_MUTATION', storeId, { action: 'DELETE_STORE' });
    const storeItemIds = allItems.filter(i => i.storeId === storeId).map(i => i.id || `${storeId}:${i.partNumber}`);
    if (storeItemIds.length > 0) {
      await db.inventory.bulkDelete(storeItemIds);
    }

    if (currentStoreId === storeId) {
      const nextStore = allStores.find(s => s.id !== storeId) || allStores[0];
      if (nextStore) {
        switchStore(nextStore.id);
      }
    }
    showToast(`Store ${target?.name} deleted.`, 'warn');
  };

  const handleImportItems = async (importedList: InventoryItem[], filename: string) => {
    const storeId = currentStore.id;
    let added = 0;
    let updated = 0;

    for (const record of importedList) {
      if (!record.partNumber) continue;
      const itemId = `${storeId}:${record.partNumber}`;
      const existing = await db.inventory.get(itemId);
      if (existing) {
        await db.inventory.put({ ...existing, ...record, id: itemId, storeId, updatedAt: new Date().toISOString() });
        updated++;
      } else {
        await db.inventory.put({ ...record, id: itemId, storeId, updatedAt: new Date().toISOString() });
        added++;
      }
    }

    await logHistory('Bulk Import', 'IMPORT', `${added} added / ${updated} updated`, importedList.length, `${filename} (${currentStore.name})`, storeId);
    await enqueueSync('BULK_IMPORT', 'ALL', { count: importedList.length, file: filename, storeId }, storeId);
    showToast(`Import completed for ${currentStore.name}: ${added} added, ${updated} updated.`, 'success');
  };

  const handleExportCSV = () => {
    if (storeItems.length === 0) {
      showToast(`No inventory items to export for ${currentStore.name}.`, 'warn');
      return;
    }

    const headers = 'Store,Part Number,Description,Location,Quantity,Threshold,Remarks,Last Updated';
    const csvRows = storeItems.map(i => {
      const escape = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
      return [
        escape(currentStore.name),
        escape(i.partNumber),
        escape(i.description),
        escape(i.location),
        i.quantity,
        thresholdOf(i),
        escape(i.remarks || ''),
        escape(i.updatedAt)
      ].join(',');
    });

    const csvContent = [headers, ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `WLLab_${currentStore.code}_Inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Inventory CSV exported for ${currentStore.name}!`, 'success');
  };

  const handleClearAll = async () => {
    const storeId = currentStore.id;
    if (!window.confirm(`CRITICAL: Delete ALL inventory items for "${currentStore.name}"? This cannot be undone.`)) return;

    const itemIds = storeItems.map(i => i.id || `${storeId}:${i.partNumber}`);
    await db.inventory.bulkDelete(itemIds);
    await logHistory('Clear All', 'SYSTEM', `All inventory cleared for ${currentStore.name}`, 0, 'Store database emptied', storeId);
    await enqueueSync('DELETE', 'STORE_ALL', { cleared: true, storeId }, storeId);
    showToast(`All inventory items cleared for ${currentStore.name}.`, 'warn');
  };

  const handleResetSampleData = async () => {
    if (!requireMaster()) return;
    if (!window.confirm('Reset ALL stores to the demo sample dataset? This also replaces the shared cloud data for every terminal.')) return;
    const clearedAt = new Date().toISOString();
    const previousStoreIds = allStores.map(s => s.id);
    await db.inventory.clear();
    await db.stores.clear();
    await initDatabase();
    // Stamp the fresh demo parts as newest so they win over the cleared cloud rows
    const now = new Date().toISOString();
    await db.inventory.toCollection().modify({ updatedAt: now });
    const seededStores = await db.stores.toArray();
    const storeIds = new Set([...previousStoreIds, ...seededStores.map(s => s.id)]);
    for (const id of storeIds) {
      await enqueueSync('DELETE', 'STORE_ALL', { cleared: true, storeId: id }, id);
      await enqueueSync('STORE_MUTATION', id, { action: 'RESET_STORE' });
    }
    for (const s of seededStores) {
      await enqueueSync('BULK_IMPORT', 'ALL', { reset: true, storeId: s.id, clearedAt }, s.id);
    }
    showToast('Default Wireline items loaded into Sonde Lab, E-Lab, and WHE!', 'success');
  };

  const handleSaveGlobalThreshold = async (val: number) => {
    if (!requireMaster()) return;
    await setSetting('globalThreshold', val);
    showToast(`Global low-stock threshold default set to ${val}.`, 'success');
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Clear all transaction audit logs? This cannot be undone.')) return;
    await db.history.clear();
    showToast('Transaction audit history cleared.', 'info');
  };

  const handleTriggerSyncNow = async () => {
    const res = await cloudSyncService.triggerSync('manual_button');
    if (res.success) {
      showToast(res.message, 'success');
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleSignOut = async () => {
    if (syncState.pendingCount > 0 && !window.confirm(`${syncState.pendingCount} change(s) have not reached the cloud yet. Sign out anyway? They will upload after the next sign-in.`)) return;
    cloudSyncService.stopBackgroundWorker();
    await logout().catch(() => {});
  };

  // Open BlueMM default browser navigation
  const handleOpenBlueMM = () => {
    window.open('https://imapp.bluemm.gt.slb.com/home', '_blank', 'noopener,noreferrer');
  };

  // Context-aware login modal copy
  const loginActionTitle = pendingAdminAction?.type === 'add_stock' && pendingAdminAction.item
    ? `Authorize Adding Stock: ${pendingAdminAction.item.partNumber}`
    : pendingAdminAction?.type === 'sub_stock' && pendingAdminAction.item
    ? `Authorize Withdrawing Stock: ${pendingAdminAction.item.partNumber}`
    : pendingAdminAction?.type === 'adjust' && pendingAdminAction.item
    ? `Adjust Stock: ${pendingAdminAction.item.partNumber}`
    : pendingAdminAction?.type === 'withdraw' && pendingAdminAction.item
    ? `Withdraw Stock: ${pendingAdminAction.item.partNumber}`
    : `Admin Access: ${currentStore.name}`;

  const loginActionDesc = pendingAdminAction?.type === 'add_stock' && pendingAdminAction.item
    ? `Administrator credentials required to add inventory stock to part ${pendingAdminAction.item.partNumber} in ${currentStore.name}.`
    : pendingAdminAction?.type === 'sub_stock' && pendingAdminAction.item
    ? `Administrator credentials required to withdraw inventory stock from part ${pendingAdminAction.item.partNumber} in ${currentStore.name}.`
    : pendingAdminAction?.type === 'adjust' && pendingAdminAction.item
    ? `Enter administrator password for ${currentStore.name} to modify stock count or safety threshold for part ${pendingAdminAction.item.partNumber}.`
    : pendingAdminAction?.type === 'withdraw' && pendingAdminAction.item
    ? `Enter administrator password for ${currentStore.name} to withdraw inventory for part ${pendingAdminAction.item.partNumber}.`
    : `Enter the assigned administrator password for ${currentStore.name} (or master administrator password) to manage this sub-store.`;

  return (
    <div className="min-h-screen bg-[#e9edf2] flex flex-col items-center p-0 sm:py-3 sm:px-2">
      {/* Main Card Container */}
      <div className="w-full max-w-[1150px] bg-white border-x-0 sm:border-4 border-black min-h-screen sm:min-h-0 sm:rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <Header
          lowStockCount={lowStockItems.length}
          onToggleNotif={() => setNotifPanelOpen(!notifPanelOpen)}
          onOpenAdmin={handleRequestAdminPanel}
          onOpenHelp={() => setHelpModalOpen(true)}
          onOpenSync={() => setSyncModalOpen(true)}
          syncState={syncState}
          onQuickSync={handleTriggerSyncNow}
          isAdmin={isAdmin}
          isMaster={isMaster}
          onLockAdmin={handleLockAdmin}
          currentStoreName={currentStore.name}
          currentStoreCode={currentStore.code}
          onOpenStoreSelect={() => setStoreSelectOpen(true)}
          userEmail={user?.email}
          onSignOut={handleSignOut}
        />

        {/* Low-Stock Notification Drawer */}
        <NotificationPanel
          isOpen={notifPanelOpen}
          onClose={() => setNotifPanelOpen(false)}
          lowStockItems={lowStockItems}
          globalThreshold={globalThreshold}
          onOpenAllAlerts={() => {
            setNotifPanelOpen(false);
            setAllAlertsOpen(true);
          }}
          onQuickAdjust={item => {
            setNotifPanelOpen(false);
            handleRequestAdjust(item);
          }}
          isAdmin={isAdmin}
        />

        {/* Instant Search & Filter Section */}
        <SearchSection
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          totalCount={storeItems.length}
          filteredCount={filteredItems.length}
          lowStockCount={lowStockItems.length}
          outOfStockCount={outOfStockItems.length}
        />

        {/* Live Inventory Results Table (First 10 rows with pagination, +/- stock signs) */}
        <InventoryTable
          items={filteredItems}
          globalThreshold={globalThreshold}
          onStockAdd={handleStockAdd}
          onStockSub={handleStockSub}
          onOpenAdjust={handleRequestAdjust}
          isAdmin={isAdmin}
        />

        {/* Bottom Bar */}
        <footer className="border-t-4 border-black p-4 bg-[#f0f4f8] flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setHistoryModalOpen(true)}
              className="px-4 py-2 bg-[#1a7a3c] hover:bg-[#145a2c] text-white font-bold rounded-lg border-2 border-black cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5 transition"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Inventory History &amp; Usage Trends</span>
            </button>

            {/* Check BlueMM button opening https://imapp.bluemm.gt.slb.com/home */}
            <button
              onClick={handleOpenBlueMM}
              className="px-4 py-2 bg-[#0092d1] hover:bg-[#007cb3] text-white font-bold rounded-lg border-2 border-[#0066a1] cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5 transition"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Check BlueMM</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-gray-500 font-mono text-[11px]">
            <span>
              Store: <strong className="text-gray-900">{currentStore.name}</strong> ({storeItems.length} items)
            </span>
            <span>·</span>
            <span>
              Role: <strong className={isAdmin ? 'text-emerald-700 font-bold' : 'text-gray-700'}>{isMaster ? 'MASTER ADMIN' : isAdmin ? 'STORE ADMIN' : 'OPERATOR'}</strong>
            </span>
            <span>·</span>
            <span>Sync: {syncState.status.toUpperCase()}</span>
          </div>
        </footer>
      </div>

      {/* MODALS */}
      <StoreSelectModal
        isOpen={storeSelectOpen}
        onClose={() => setStoreSelectOpen(false)}
        stores={allStores.length > 0 ? allStores : DEFAULT_STORES}
        currentStoreId={currentStore.id}
        allItems={allItems}
        onSelectStore={handleSelectStore}
        isInitialSelection={!localStorage.getItem('wllab_default_store')}
      />

      <QuickAdjustModal
        item={adjustingItem}
        globalThreshold={globalThreshold}
        onClose={() => setAdjustingItem(null)}
        onApply={handleApplyAdjust}
        onWithdraw={handleWithdraw}
      />

      <AllAlertsModal
        isOpen={allAlertsOpen}
        onClose={() => setAllAlertsOpen(false)}
        lowStockItems={lowStockItems}
        globalThreshold={globalThreshold}
        onAdjust={handleRequestAdjust}
        isAdmin={isAdmin}
      />

      <HistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        history={history.filter(h => !h.storeId || h.storeId === currentStore.id)}
        onClearHistory={handleClearHistory}
      />

      <AdminLoginModal
        isOpen={adminLoginOpen}
        onClose={() => {
          setAdminLoginOpen(false);
          setPendingAdminAction(null);
        }}
        onLoginSuccess={handleAdminLoginSuccess}
        storeId={currentStore.id}
        storeName={currentStore.name}
        actionTitle={loginActionTitle}
        actionDescription={loginActionDesc}
      />

      <AdminModal
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        items={storeItems}
        stores={allStores.length > 0 ? allStores : DEFAULT_STORES}
        currentStoreId={currentStore.id}
        isMaster={isMaster}
        globalThreshold={globalThreshold}
        onApplyAdjust={handleApplyAdjust}
        onWithdraw={handleWithdraw}
        onAddNewItem={handleAddNewItem}
        onEditPart={item => setEditingItem(item)}
        onDeletePart={handleDeletePart}
        onImportItems={handleImportItems}
        onExportCSV={handleExportCSV}
        onClearAll={handleClearAll}
        onResetSampleData={handleResetSampleData}
        onSaveGlobalThreshold={handleSaveGlobalThreshold}
        onCreateStore={handleCreateStore}
        onDeleteStore={handleDeleteStore}
        onSwitchStore={switchStore}
        showToast={showToast}
      />

      <EditPartModal
        item={editingItem}
        globalThreshold={globalThreshold}
        onClose={() => setEditingItem(null)}
        onSave={handleSaveEditPart}
      />

      <SyncStatusModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        syncState={syncState}
        onTriggerSync={handleTriggerSyncNow}
      />

      <HelpModal isOpen={helpModalOpen} onClose={() => setHelpModalOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      {IS_STANDALONE ? (
        <InventoryApp user={null} />
      ) : (
        <AuthGate>{user => <InventoryApp user={user} />}</AuthGate>
      )}
    </ToastProvider>
  );
}
