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
  INITIAL_ITEMS
} from './db/dexieDb';
import { oneDriveSyncService, SyncServiceState } from './services/oneDriveSync';
import { InventoryItem } from './types/inventory';
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
import { BarChart3, ExternalLink } from 'lucide-react';

interface PendingAdminAction {
  type: 'adjust' | 'withdraw' | 'admin_panel';
  item?: InventoryItem;
}

function InventoryApp() {
  const { showToast } = useToast();

  // Dexie Reactive Live Queries (Automatic UI updates on any IndexedDB mutation)
  const items = useLiveQuery(() => db.inventory.toArray(), []) || [];
  const history = useLiveQuery(() => db.history.orderBy('id').reverse().toArray(), []) || [];
  const globalThreshold = useLiveQuery(() => getSetting<number>('globalThreshold', 0), []) ?? 0;

  // Background Sync Engine State
  const [syncState, setSyncState] = useState<SyncServiceState>({
    status: 'synced',
    isOnline: true,
    pendingCount: 0,
    lastSyncTime: null,
    errorMessage: null,
    config: {
      enabled: true,
      mode: 'simulated',
      accessToken: '',
      folderPath: 'WLLabInventory',
      fileName: 'inventory_sync.json',
      autoSyncIntervalSeconds: 30,
      lastSyncTime: null,
      lastSyncStatus: 'synced',
      conflictResolution: 'last_write_wins'
    },
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingAdminAction, setPendingAdminAction] = useState<PendingAdminAction | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Inactivity auto-lock timer (15 minutes)
  const handleLockAdmin = useCallback(() => {
    if (isAdmin) {
      setIsAdmin(false);
      setPendingAdminAction(null);
      setAdjustingItem(null);
      setAdminModalOpen(false);
      showToast('Admin session locked for security.', 'info');
    }
  }, [isAdmin, showToast]);

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
    initDatabase().catch(err => console.error('Failed to init IndexedDB:', err));

    const unsubscribe = oneDriveSyncService.subscribe(state => {
      setSyncState(state);
    });

    oneDriveSyncService.startBackgroundWorker();

    return () => {
      unsubscribe();
      oneDriveSyncService.stopBackgroundWorker();
    };
  }, []);

  // Compute Low-Stock & Out-of-Stock items
  const thresholdOf = (item: InventoryItem) => {
    return item.threshold !== undefined && item.threshold !== null && item.threshold !== 0
      ? item.threshold
      : (item.threshold === 0 ? 0 : globalThreshold);
  };

  const lowStockItems = useMemo(() => {
    return items.filter(item => item.quantity <= thresholdOf(item));
  }, [items, globalThreshold]);

  const outOfStockItems = useMemo(() => {
    return items.filter(item => item.quantity <= 0);
  }, [items]);

  // Filtered Items for Display
  const filteredItems = useMemo(() => {
    let result = items;

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
  }, [items, searchQuery, activeFilter, globalThreshold]);

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

  const handleAdminLoginSuccess = () => {
    setIsAdmin(true);
    setAdminLoginOpen(false);
    lastActivityRef.current = Date.now();
    showToast('Admin access granted!', 'success');

    if (pendingAdminAction) {
      const pending = pendingAdminAction;
      setPendingAdminAction(null);

      if (pending.type === 'adjust' && pending.item) {
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

  // Stock Mutation Actions
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
    const res = await adjustItemStock(partNumber, action, qty, reason, threshold);
    if (res.success && res.newItem) {
      showToast(`Stock updated for ${partNumber} (New Qty: ${res.newItem.quantity})`, 'success');
    } else if (res.error) {
      showToast(res.error, 'error');
    }
  };

  const handleWithdraw = async (partNumber: string, reason: string) => {
    if (!isAdmin) {
      showToast('Admin authorization required to withdraw stock.', 'error');
      return;
    }
    const res = await adjustItemStock(partNumber, 'withdraw', 0, reason);
    if (res.success) {
      showToast(`All units of ${partNumber} withdrawn to 0.`, 'warn');
    } else if (res.error) {
      showToast(res.error, 'error');
    }
  };

  const handleAddNewItem = async (newItemData: Omit<InventoryItem, 'updatedAt'>) => {
    const item: InventoryItem = {
      ...newItemData,
      updatedAt: new Date().toISOString()
    };
    await db.inventory.put(item);
    await logHistory('New Item Added', item.partNumber, item.description, item.quantity, item.remarks || '');
    await enqueueSync('CREATE', item.partNumber, item);
    showToast(`Added part ${item.partNumber} to inventory!`, 'success');
  };

  const handleSaveEditPart = async (updated: InventoryItem, originalPartNumber: string) => {
    if (originalPartNumber !== updated.partNumber) {
      await db.inventory.delete(originalPartNumber);
      await enqueueSync('DELETE', originalPartNumber, { partNumber: originalPartNumber });
    }
    await db.inventory.put(updated);
    await logHistory(
      'Edit',
      updated.partNumber,
      updated.description,
      updated.quantity,
      originalPartNumber !== updated.partNumber ? `Renamed from ${originalPartNumber}` : 'Metadata updated'
    );
    await enqueueSync('UPDATE', updated.partNumber, updated);
    showToast(`Part ${updated.partNumber} updated.`, 'success');
  };

  const handleDeletePart = async (partNumber: string) => {
    if (!window.confirm(`Delete part "${partNumber}" from inventory? This cannot be undone.`)) return;
    const existing = await db.inventory.get(partNumber);
    await db.inventory.delete(partNumber);
    await logHistory('Deleted', partNumber, existing ? existing.description : '', 0, 'Part removed by admin');
    await enqueueSync('DELETE', partNumber, { partNumber });
    showToast(`Part ${partNumber} deleted.`, 'warn');
  };

  const handleImportItems = async (importedList: InventoryItem[], filename: string) => {
    let added = 0;
    let updated = 0;

    for (const record of importedList) {
      if (!record.partNumber) continue;
      const existing = await db.inventory.get(record.partNumber);
      if (existing) {
        await db.inventory.put({ ...existing, ...record, updatedAt: new Date().toISOString() });
        updated++;
      } else {
        await db.inventory.put({ ...record, updatedAt: new Date().toISOString() });
        added++;
      }
    }

    await logHistory('Bulk Import', 'IMPORT', `${added} added / ${updated} updated`, importedList.length, filename);
    await enqueueSync('BULK_IMPORT', 'ALL', { count: importedList.length, file: filename });
    showToast(`Import completed: ${added} added, ${updated} updated.`, 'success');
  };

  const handleExportCSV = () => {
    if (items.length === 0) {
      showToast('No inventory items to export.', 'warn');
      return;
    }

    const headers = 'Part Number,Description,Location,Quantity,Threshold,Remarks,Last Updated';
    const csvRows = items.map(i => {
      const escape = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
      return [
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
    link.setAttribute('download', `WLLabInventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Inventory CSV exported successfully!', 'success');
  };

  const handleClearAll = async () => {
    if (!window.confirm('CRITICAL: Delete ALL inventory items from local database? This cannot be undone.')) return;
    await db.inventory.clear();
    await logHistory('Clear All', 'SYSTEM', 'All inventory cleared', 0, 'Database emptied');
    await enqueueSync('DELETE', 'ALL', { cleared: true });
    showToast('All inventory items cleared.', 'warn');
  };

  const handleResetSampleData = async () => {
    if (!window.confirm('Reset local inventory to Schlumberger Wireline Lab standard sample dataset?')) return;
    await db.inventory.clear();
    const seeded = INITIAL_ITEMS.map(i => ({ ...i, updatedAt: new Date().toISOString() }));
    await db.inventory.bulkPut(seeded);
    await logHistory('Reset Sample Data', 'SYSTEM', 'Loaded Wireline sample items', seeded.length, 'Reset to default');
    await enqueueSync('BULK_IMPORT', 'INITIAL', { seeded: true });
    showToast('Default Wireline items loaded into IndexedDB!', 'success');
  };

  const handleSaveGlobalThreshold = async (val: number) => {
    await setSetting('globalThreshold', val);
    showToast(`Global low-stock threshold default set to ${val}.`, 'success');
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Clear all transaction audit logs? This cannot be undone.')) return;
    await db.history.clear();
    showToast('Transaction audit history cleared.', 'info');
  };

  const handleTriggerSyncNow = async () => {
    const res = await oneDriveSyncService.triggerSync('manual_button');
    if (res.success) {
      showToast(res.message, 'success');
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleOpenBlueMM = () => {
    window.open('https://www.bluemm.slb.com', '_blank', 'noopener,noreferrer');
  };

  // Determine modal copy based on pending action
  const loginActionTitle = pendingAdminAction?.type === 'adjust' && pendingAdminAction.item
    ? `Adjust Stock: ${pendingAdminAction.item.partNumber}`
    : pendingAdminAction?.type === 'withdraw' && pendingAdminAction.item
    ? `Withdraw Stock: ${pendingAdminAction.item.partNumber}`
    : 'Admin Authentication Required';

  const loginActionDesc = pendingAdminAction?.type === 'adjust' && pendingAdminAction.item
    ? `Administrator credentials required to modify stock count or safety threshold for part ${pendingAdminAction.item.partNumber}.`
    : pendingAdminAction?.type === 'withdraw' && pendingAdminAction.item
    ? `Administrator credentials required to withdraw all inventory of part ${pendingAdminAction.item.partNumber}.`
    : 'Stock modifications, withdrawals, part edits, and imports require verified administrator privileges.';

  return (
    <div className="min-h-screen bg-[#e9edf2] flex flex-col items-center py-0 sm:py-4">
      {/* Main Card Container */}
      <div className="w-full max-w-[1150px] bg-white border-x-0 sm:border-5 border-black min-h-screen sm:min-h-0 sm:rounded-xl shadow-2xl flex flex-col overflow-hidden">
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
          onLockAdmin={handleLockAdmin}
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
          totalCount={items.length}
          filteredCount={filteredItems.length}
          lowStockCount={lowStockItems.length}
          outOfStockCount={outOfStockItems.length}
        />

        {/* Live Inventory Results Table (Actual Stock Quantity Only) */}
        <InventoryTable
          items={filteredItems}
          globalThreshold={globalThreshold}
          onOpenAdjust={handleRequestAdjust}
          onQuickWithdraw={handleRequestWithdraw}
          onOpenEdit={item => setEditingItem(item)}
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

            <button
              onClick={handleOpenBlueMM}
              className="px-4 py-2 bg-[#0092d1] hover:bg-[#007cb3] text-white font-bold rounded-lg border-2 border-[#0066a1] cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5 transition"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Check BlueMM</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-gray-500 font-mono text-[11px]">
            <span>Dexie DB: {items.length} items</span>
            <span>·</span>
            <span>
              Role: <strong className={isAdmin ? 'text-emerald-700' : 'text-gray-700'}>{isAdmin ? 'ADMIN' : 'VIEWER'}</strong>
            </span>
            <span>·</span>
            <span>Sync: {syncState.status.toUpperCase()}</span>
          </div>
        </footer>
      </div>

      {/* MODALS */}
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
        history={history}
        onClearHistory={handleClearHistory}
      />

      <AdminLoginModal
        isOpen={adminLoginOpen}
        onClose={() => {
          setAdminLoginOpen(false);
          setPendingAdminAction(null);
        }}
        onLoginSuccess={handleAdminLoginSuccess}
        actionTitle={loginActionTitle}
        actionDescription={loginActionDesc}
      />

      <AdminModal
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        items={items}
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
      <InventoryApp />
    </ToastProvider>
  );
}
