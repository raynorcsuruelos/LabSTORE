import React, { useState } from 'react';
import {
  X,
  Sliders,
  Edit,
  PlusCircle,
  FileSpreadsheet,
  Key,
  Trash2,
  Download,
  Upload,
  AlertCircle,
  CheckCircle,
  RotateCcw,
  Building2,
  Shield,
  KeyRound,
  ArrowRight
} from 'lucide-react';
import { InventoryItem, SubStore } from '../types/inventory';
import { getSetting, setSetting } from '../db/dexieDb';
import { verifyAdminPassword, setAdminPasswordSecure, setStoreAdminPassword } from '../services/security';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  stores: SubStore[];
  currentStoreId: string;
  isMasterAdmin: boolean;
  globalThreshold: number;
  onApplyAdjust: (
    partNumber: string,
    action: 'set' | 'add' | 'sub',
    qty: number,
    threshold: number | undefined,
    reason: string
  ) => void;
  onWithdraw: (partNumber: string, reason: string) => void;
  onAddNewItem: (item: Omit<InventoryItem, 'updatedAt'>) => void;
  onEditPart: (item: InventoryItem) => void;
  onDeletePart: (partNumber: string) => void;
  onImportItems: (items: InventoryItem[], filename: string) => void;
  onExportCSV: () => void;
  onClearAll: () => void;
  onResetSampleData: () => void;
  onSaveGlobalThreshold: (val: number) => void;
  onCreateStore: (name: string, code: string, description: string, password: string) => void;
  onDeleteStore: (storeId: string) => void;
  onSwitchStore: (storeId: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warn') => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  items,
  stores,
  currentStoreId,
  isMasterAdmin,
  globalThreshold,
  onApplyAdjust,
  onWithdraw,
  onAddNewItem,
  onEditPart,
  onDeletePart,
  onImportItems,
  onExportCSV,
  onClearAll,
  onResetSampleData,
  onSaveGlobalThreshold,
  onCreateStore,
  onDeleteStore,
  onSwitchStore,
  showToast
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'adjust' | 'edit' | 'add' | 'import' | 'stores' | 'settings'>('adjust');

  // Adjust Tab State
  const [selectedPartNumber, setSelectedPartNumber] = useState('');
  const [adjAction, setAdjAction] = useState<'set' | 'add' | 'sub'>('set');
  const [adjQty, setAdjQty] = useState('');
  const [adjThreshold, setAdjThreshold] = useState('');
  const [adjReason, setAdjReason] = useState('');

  // Add Item Tab State
  const [newPn, setNewPn] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newThreshold, setNewThreshold] = useState('');
  const [newRemarks, setNewRemarks] = useState('');

  // Edit list filter
  const [editSearch, setEditSearch] = useState('');

  // Password Settings
  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passError, setPassError] = useState('');

  // Global threshold state
  const [threshInput, setThreshInput] = useState(String(globalThreshold));

  // Store Management Form State
  const [storeNameInput, setStoreNameInput] = useState('');
  const [storeCodeInput, setStoreCodeInput] = useState('');
  const [storeDescInput, setStoreDescInput] = useState('');
  const [storePassInput, setStorePassInput] = useState('');

  // Store Specific Password Change State
  const [editingStorePassId, setEditingStorePassId] = useState<string | null>(null);
  const [targetStoreNewPass, setTargetStoreNewPass] = useState('');

  const currentStore = stores.find(s => s.id === currentStoreId);
  const selectedItem = items.find(i => i.partNumber === selectedPartNumber);

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartNumber) {
      showToast('Please select a part first.', 'error');
      return;
    }
    const q = parseInt(adjQty, 10);
    if (isNaN(q) || q < 0) {
      showToast('Enter a valid non-negative quantity.', 'error');
      return;
    }
    const t = adjThreshold.trim() === '' ? undefined : parseInt(adjThreshold, 10);
    onApplyAdjust(selectedPartNumber, adjAction, q, t, adjReason);
    setAdjQty('');
    setAdjReason('');
  };

  const handleWithdrawClick = () => {
    if (!selectedPartNumber) {
      showToast('Select a part first.', 'error');
      return;
    }
    onWithdraw(selectedPartNumber, adjReason || 'Full withdraw from admin panel');
    setAdjReason('');
  };

  const handleAddNewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPn.trim() || !newDesc.trim() || !newLoc.trim()) {
      showToast('Part number, description, and location are required.', 'error');
      return;
    }
    const q = parseInt(newQty, 10);
    if (isNaN(q) || q < 0) {
      showToast('Enter a valid stock quantity.', 'error');
      return;
    }

    if (items.some(i => i.partNumber.toLowerCase() === newPn.trim().toLowerCase())) {
      showToast(`Part number ${newPn} already exists in ${currentStore?.name || 'this store'}.`, 'error');
      return;
    }

    onAddNewItem({
      storeId: currentStoreId,
      partNumber: newPn.trim(),
      description: newDesc.trim(),
      location: newLoc.trim(),
      quantity: q,
      threshold: newThreshold.trim() === '' ? 0 : Math.max(0, parseInt(newThreshold, 10) || 0),
      remarks: newRemarks.trim()
    });

    setNewPn('');
    setNewDesc('');
    setNewLoc('');
    setNewQty('');
    setNewThreshold('');
    setNewRemarks('');
    showToast(`Added part ${newPn} to ${currentStore?.name || 'store'}!`, 'success');
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');

    if (!isMasterAdmin) {
      setPassError('Master administrator access required.');
      return;
    }
    const verifyRes = await verifyAdminPassword(curPass);
    if (!verifyRes.success || !verifyRes.isSuperAdmin) {
      setPassError(verifyRes.message || 'Current password is incorrect.');
      return;
    }
    if (!newPass.trim()) {
      setPassError('New password cannot be empty.');
      return;
    }
    if (newPass.length < 6) {
      setPassError('Password must be at least 6 characters.');
      return;
    }
    if (newPass !== confirmPass) {
      setPassError('New passwords do not match.');
      return;
    }

    await setAdminPasswordSecure(newPass);
    setCurPass('');
    setNewPass('');
    setConfirmPass('');
    showToast('Admin password securely updated with cryptographic hashing!', 'success');
  };

  const handleCreateStoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeNameInput.trim() || !storeCodeInput.trim()) {
      showToast('Store name and code are required.', 'error');
      return;
    }
    if (storePassInput.length < 6) {
      showToast('Store admin password must be at least 6 characters.', 'error');
      return;
    }

    onCreateStore(
      storeNameInput.trim(),
      storeCodeInput.trim().toUpperCase(),
      storeDescInput.trim() || `${storeNameInput.trim()} Wireline Store`,
      storePassInput
    );

    setStoreNameInput('');
    setStoreCodeInput('');
    setStoreDescInput('');
    setStorePassInput('');
  };

  const handleSaveStoreSpecificPassword = async (storeId: string) => {
    if (!isMasterAdmin) {
      showToast('Master administrator password required for sub-store settings.', 'error');
      return;
    }
    if (targetStoreNewPass.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }
    await setStoreAdminPassword(storeId, targetStoreNewPass);
    setEditingStorePassId(null);
    setTargetStoreNewPass('');
    showToast('Store-specific admin password assigned successfully!', 'success');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      try {
        let records: InventoryItem[] = [];
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          if (!Array.isArray(parsed)) throw new Error('JSON file must contain an array of parts.');
          records = parsed.map(r => ({
            ...r,
            storeId: r.storeId || currentStoreId,
            id: r.id || `${r.storeId || currentStoreId}:${r.partNumber}`
          }));
        } else {
          const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
          if (lines.length < 2) throw new Error('CSV is empty or missing data rows.');
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

          for (let r = 1; r < lines.length; r++) {
            const vals = lines[r].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
            const row: any = {};
            headers.forEach((h, idx) => {
              row[h] = vals[idx] || '';
            });

            const pn = row.partnumber || row['part number'];
            if (pn) {
              records.push({
                id: `${currentStoreId}:${pn}`,
                storeId: currentStoreId,
                partNumber: pn,
                description: row.description || '',
                location: row.location || 'Bin',
                quantity: parseInt(row.quantity || row.qty || '0', 10) || 0,
                threshold: parseInt(row.threshold || row['min threshold'] || '0', 10) || 0,
                remarks: row.remarks || row.notes || '',
                updatedAt: new Date().toISOString()
              });
            }
          }
        }

        if (records.length === 0) throw new Error('No valid inventory records detected.');
        onImportItems(records, file.name);
      } catch (err: any) {
        showToast(`Import failed: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filteredEditList = items.filter(
    i =>
      i.partNumber.toLowerCase().includes(editSearch.toLowerCase()) ||
      i.description.toLowerCase().includes(editSearch.toLowerCase()) ||
      i.location.toLowerCase().includes(editSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black rounded-xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#003057] text-white px-5 py-3.5 flex items-center justify-between border-b-3 border-black">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-300" />
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight">Wireline Admin Panel</h3>
              <p className="text-[11px] text-blue-200">
                Managing Sub-Store: <strong className="text-white">{currentStore?.name || 'Store'}</strong> ({currentStore?.code})
                {' · '}
                <span className={isMasterAdmin ? 'text-amber-300 font-bold' : 'text-emerald-300 font-bold'}>
                  {isMasterAdmin ? 'Master Admin' : 'Store Admin'}
                </span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded cursor-pointer transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b-2 border-gray-300 bg-gray-100 px-4 pt-2 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('adjust')}
            className={`px-3 py-2 text-xs font-bold rounded-t-md transition border-t-2 border-x-2 -mb-[2px] whitespace-nowrap cursor-pointer ${
              activeTab === 'adjust'
                ? 'bg-white border-black text-[#003057]'
                : 'border-transparent text-gray-600 hover:text-black'
            }`}
          >
            📋 Adjust Stock
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`px-3 py-2 text-xs font-bold rounded-t-md transition border-t-2 border-x-2 -mb-[2px] whitespace-nowrap cursor-pointer ${
              activeTab === 'edit'
                ? 'bg-white border-black text-[#003057]'
                : 'border-transparent text-gray-600 hover:text-black'
            }`}
          >
            ✏️ Edit / Delete Parts
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`px-3 py-2 text-xs font-bold rounded-t-md transition border-t-2 border-x-2 -mb-[2px] whitespace-nowrap cursor-pointer ${
              activeTab === 'add'
                ? 'bg-white border-black text-[#003057]'
                : 'border-transparent text-gray-600 hover:text-black'
            }`}
          >
            ➕ Add New Item
          </button>
          {isMasterAdmin && (
          <button
            onClick={() => setActiveTab('stores')}
            className={`px-3 py-2 text-xs font-bold rounded-t-md transition border-t-2 border-x-2 -mb-[2px] whitespace-nowrap cursor-pointer ${
              activeTab === 'stores'
                ? 'bg-white border-black text-[#003057]'
                : 'border-transparent text-gray-600 hover:text-black'
            }`}
          >
            🏢 Sub-Stores ({stores.length})
          </button>
          )}
          <button
            onClick={() => setActiveTab('import')}
            className={`px-3 py-2 text-xs font-bold rounded-t-md transition border-t-2 border-x-2 -mb-[2px] whitespace-nowrap cursor-pointer ${
              activeTab === 'import'
                ? 'bg-white border-black text-[#003057]'
                : 'border-transparent text-gray-600 hover:text-black'
            }`}
          >
            📥 Import / Export
          </button>
          {isMasterAdmin && (
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-2 text-xs font-bold rounded-t-md transition border-t-2 border-x-2 -mb-[2px] whitespace-nowrap cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-white border-black text-[#003057]'
                : 'border-transparent text-gray-600 hover:text-black'
            }`}
          >
            🔑 Admin Settings
          </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 text-xs sm:text-sm">
          {!isMasterAdmin && (
            <div className="mb-4 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-[11px] text-amber-900 flex items-start gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
              <span>
                Signed in as store admin for <strong>{currentStore?.name}</strong>. You can only manage this sub-store.
                Sub-store and admin settings require the master administrator password.
              </span>
            </div>
          )}
          {/* TAB: ADJUST */}
          {activeTab === 'adjust' && (
            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div className="text-sm font-bold text-[#003057] uppercase tracking-wide">
                Adjust Existing Stock Quantities — {currentStore?.name}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Select Part</label>
                  <select
                    value={selectedPartNumber}
                    onChange={e => {
                      setSelectedPartNumber(e.target.value);
                      const itm = items.find(i => i.partNumber === e.target.value);
                      if (itm) {
                        setAdjThreshold(itm.threshold !== undefined && itm.threshold !== null ? String(itm.threshold) : '');
                      }
                    }}
                    className="w-full p-2.5 border-2 border-black rounded-lg text-xs bg-white font-medium"
                  >
                    <option value="">— Select Part —</option>
                    {items.map(i => (
                      <option key={i.partNumber} value={i.partNumber}>
                        {i.partNumber} — {i.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Current Stock Quantity</label>
                  <input
                    type="text"
                    readOnly
                    value={selectedItem ? selectedItem.quantity : 'Select a part above'}
                    className="w-full p-2.5 border-2 border-gray-300 rounded-lg text-xs bg-gray-100 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Action</label>
                  <select
                    value={adjAction}
                    onChange={e => setAdjAction(e.target.value as any)}
                    className="w-full p-2.5 border-2 border-black rounded-lg text-xs bg-white font-medium"
                  >
                    <option value="set">Set Exact Quantity</option>
                    <option value="add">Add (+)</option>
                    <option value="sub">Subtract (-)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Adjustment Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    value={adjQty}
                    onChange={e => setAdjQty(e.target.value)}
                    placeholder="Enter quantity"
                    className="w-full p-2.5 border-2 border-black rounded-lg text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Low-Stock Threshold <span className="font-normal text-gray-500">(0 = alert when empty)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={adjThreshold}
                    onChange={e => setAdjThreshold(e.target.value)}
                    placeholder="Leave blank to keep current"
                    className="w-full p-2.5 border-2 border-black rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Reason / Notes</label>
                  <input
                    type="text"
                    value={adjReason}
                    onChange={e => setAdjReason(e.target.value)}
                    placeholder="e.g. Audit reconciliation, rig dispatched..."
                    className="w-full p-2.5 border-2 border-black rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0066a1] hover:bg-[#004e7c] text-white rounded-lg font-bold border-2 border-black cursor-pointer shadow-sm active:scale-95"
                >
                  ✅ Apply Adjustment
                </button>
                <button
                  type="button"
                  onClick={handleWithdrawClick}
                  disabled={!selectedItem || selectedItem.quantity <= 0}
                  className="px-4 py-2 bg-[#c0392b] hover:bg-[#962d22] text-white rounded-lg font-bold border-2 border-black cursor-pointer shadow-sm active:scale-95 disabled:opacity-40"
                >
                  📤 Withdraw (Max Stock)
                </button>
              </div>
            </form>
          )}

          {/* TAB: EDIT / DELETE */}
          {activeTab === 'edit' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-[#003057] uppercase tracking-wide">
                  Edit or Delete Parts in {currentStore?.name} ({items.length})
                </span>
                <input
                  type="text"
                  placeholder="Filter parts..."
                  value={editSearch}
                  onChange={e => setEditSearch(e.target.value)}
                  className="p-1.5 border-2 border-black rounded-md text-xs w-48"
                />
              </div>

              <div className="border-2 border-gray-300 rounded-lg max-h-80 overflow-y-auto divide-y divide-gray-200 bg-white">
                {filteredEditList.length === 0 ? (
                  <div className="p-6 text-center text-gray-400">No parts found matching filter in {currentStore?.name}.</div>
                ) : (
                  filteredEditList.map(item => (
                    <div key={item.partNumber} className="p-3 flex items-center justify-between gap-2 hover:bg-gray-50 flex-wrap">
                      <div>
                        <div className="font-mono font-bold text-gray-950 text-xs sm:text-sm">{item.partNumber}</div>
                        <div className="text-gray-700 text-xs">
                          {item.description} &nbsp;·&nbsp; 📍{item.location} &nbsp;·&nbsp; Qty: <strong>{item.quantity}</strong>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onEditPart(item)}
                          className="px-2.5 py-1 bg-[#0066a1] hover:bg-[#004e7c] text-white rounded text-xs font-bold border border-black cursor-pointer"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => onDeletePart(item.partNumber)}
                          className="px-2.5 py-1 bg-[#c0392b] hover:bg-[#962d22] text-white rounded text-xs font-bold border border-black cursor-pointer"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: ADD NEW ITEM */}
          {activeTab === 'add' && (
            <form onSubmit={handleAddNewSubmit} className="space-y-4">
              <div className="text-sm font-bold text-[#003057] uppercase tracking-wide">
                Add New Inventory Item to {currentStore?.name}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Part Number *</label>
                  <input
                    type="text"
                    value={newPn}
                    onChange={e => setNewPn(e.target.value)}
                    placeholder="e.g. WL-2040-HD"
                    className="w-full p-2 border-2 border-black rounded-lg text-xs font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Location *</label>
                  <input
                    type="text"
                    value={newLoc}
                    onChange={e => setNewLoc(e.target.value)}
                    placeholder="e.g. Shelf B-4, Drawer 2"
                    className="w-full p-2 border-2 border-black rounded-lg text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description *</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="e.g. Heavy Duty Sinker Bar 1.5-inch"
                  className="w-full p-2 border-2 border-black rounded-lg text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Stock Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    value={newQty}
                    onChange={e => setNewQty(e.target.value)}
                    placeholder="0"
                    className="w-full p-2 border-2 border-black rounded-lg text-xs font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Low-Stock Alert Min</label>
                  <input
                    type="number"
                    min="0"
                    value={newThreshold}
                    onChange={e => setNewThreshold(e.target.value)}
                    placeholder={`Default: ${globalThreshold}`}
                    className="w-full p-2 border-2 border-black rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Remarks / Notes</label>
                <textarea
                  rows={2}
                  value={newRemarks}
                  onChange={e => setNewRemarks(e.target.value)}
                  placeholder="Tool strings, serial notes, certifications..."
                  className="w-full p-2 border-2 border-black rounded-lg text-xs"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1a7a3c] hover:bg-[#145a2c] text-white rounded-lg font-bold border-2 border-black cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Add Item to {currentStore?.name}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB: SUB-STORES MANAGEMENT */}
          {activeTab === 'stores' && isMasterAdmin && (
            <div className="space-y-6">
              {/* Existing Sub-Stores List */}
              <div>
                <div className="text-sm font-bold text-[#003057] uppercase tracking-wide mb-2 flex items-center justify-between">
                  <span>Configured Wireline Sub-Stores ({stores.length})</span>
                  <span className="text-xs text-gray-500 font-normal">Each store maintains its own parts, stock &amp; admin</span>
                </div>

                <div className="space-y-3">
                  {stores.map(s => {
                    const isCurrent = s.id === currentStoreId;
                    return (
                      <div
                        key={s.id}
                        className={`p-3.5 rounded-xl border-2 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isCurrent ? 'border-[#0066a1] bg-[#f0f7fd]' : 'border-gray-300 bg-white'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-900 text-sm sm:text-base">{s.name}</span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#003057] text-white">
                              {s.code}
                            </span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                Active Store
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600">{s.description}</p>
                          <div className="text-[11px] text-gray-500 flex items-center gap-1">
                            <Shield className="w-3 h-3 text-emerald-600" />
                            <span>Assigned Store Admin Password Active</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap shrink-0">
                          {!isCurrent && (
                            <button
                              onClick={() => {
                                onSwitchStore(s.id);
                              }}
                              className="px-3 py-1.5 bg-[#0066a1] hover:bg-[#004e7c] text-white text-xs font-bold rounded-lg border border-black cursor-pointer shadow-xs active:scale-95 flex items-center gap-1"
                            >
                              <span>Switch to Store (Ends Admin Session)</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setEditingStorePassId(editingStorePassId === s.id ? null : s.id);
                              setTargetStoreNewPass('');
                            }}
                            className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg border border-gray-400 cursor-pointer flex items-center gap-1"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Assign Password</span>
                          </button>

                          {stores.length > 1 && (
                            <button
                              onClick={() => onDeleteStore(s.id)}
                              className="p-1.5 text-red-600 hover:text-white hover:bg-red-600 rounded-lg border border-red-300 transition cursor-pointer"
                              title="Delete Sub-Store"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Inline password editor for this store */}
                        {editingStorePassId === s.id && (
                          <div className="w-full pt-3 mt-2 border-t border-gray-200 flex items-center gap-2">
                            <input
                              type="password"
                              placeholder={`New password for ${s.name} (min 6 chars)`}
                              value={targetStoreNewPass}
                              onChange={e => setTargetStoreNewPass(e.target.value)}
                              className="flex-1 p-2 border-2 border-black rounded-lg text-xs"
                            />
                            <button
                              onClick={() => handleSaveStoreSpecificPassword(s.id)}
                              className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                            >
                              Save Password
                            </button>
                            <button
                              onClick={() => setEditingStorePassId(null)}
                              className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs font-bold cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add New Sub-Store Form */}
              <div className="p-4 bg-gray-50 border-2 border-gray-300 rounded-xl space-y-3">
                <div className="text-xs font-bold text-[#003057] uppercase tracking-wide flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#0066a1]" />
                  <span>Create New Sub-Store</span>
                </div>

                <form onSubmit={handleCreateStoreSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Store Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Perforating Lab, Rig Prep Shop"
                        value={storeNameInput}
                        onChange={e => setStoreNameInput(e.target.value)}
                        className="w-full p-2 border-2 border-black rounded-lg text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Store Code * (Short code)</label>
                      <input
                        type="text"
                        placeholder="e.g. PERF, PREP, MECH"
                        value={storeCodeInput}
                        onChange={e => setStoreCodeInput(e.target.value)}
                        className="w-full p-2 border-2 border-black rounded-lg text-xs uppercase font-mono font-bold"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Gun loading, ballistic hardware and detonator store"
                      value={storeDescInput}
                      onChange={e => setStoreDescInput(e.target.value)}
                      className="w-full p-2 border-2 border-black rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Assigned Administrator Password * (Min 6 chars)
                    </label>
                    <input
                      type="password"
                      placeholder="Enter administrator password for this store"
                      value={storePassInput}
                      onChange={e => setStorePassInput(e.target.value)}
                      className="w-full p-2 border-2 border-black rounded-lg text-xs"
                      required
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      This password will authenticate adjustments and withdrawals specifically for this sub-store.
                    </p>
                  </div>

                  <div className="pt-1">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#1a7a3c] hover:bg-[#145a2c] text-white rounded-lg font-bold border-2 border-black cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 text-xs"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Create Sub-Store</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB: IMPORT / EXPORT */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              <div className="text-sm font-bold text-[#003057] uppercase tracking-wide">
                Import / Export Stock List for {currentStore?.name}
              </div>

              <div className="p-3 bg-blue-50 border-2 border-blue-200 rounded-lg text-xs text-blue-900 leading-relaxed">
                Upload a <strong>JSON</strong> or <strong>CSV</strong> file to batch import or update parts for <strong>{currentStore?.name}</strong>.<br />
                <strong>CSV headers expected:</strong> <code>partNumber, description, location, quantity, threshold, remarks</code>
              </div>

              <div className="p-4 border-2 border-dashed border-gray-400 rounded-lg text-center bg-gray-50">
                <label className="cursor-pointer inline-flex flex-col items-center">
                  <Upload className="w-8 h-8 text-gray-500 mb-1" />
                  <span className="font-bold text-xs text-gray-800">Select CSV or JSON File to Import</span>
                  <input
                    type="file"
                    accept=".csv,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="pt-2 flex flex-wrap gap-2.5">
                <button
                  onClick={onExportCSV}
                  className="px-4 py-2 bg-[#1a7a3c] hover:bg-[#145a2c] text-white rounded-lg font-bold border-2 border-black cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Export CSV Report</span>
                </button>

                <button
                  onClick={onClearAll}
                  className="px-4 py-2 bg-[#c0392b] hover:bg-[#962d22] text-white rounded-lg font-bold border-2 border-black cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear Store Inventory</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === 'settings' && isMasterAdmin && (
            <div className="space-y-6">
              {/* Change Password */}
              <form onSubmit={handlePasswordChange} className="space-y-3 max-w-sm">
                <div className="text-xs font-bold text-[#003057] uppercase tracking-wide flex items-center gap-1">
                  <Key className="w-3.5 h-3.5" />
                  <span>Change Master Admin Password</span>
                </div>

                {passError && (
                  <div className="p-2 bg-red-50 text-[#c0392b] border border-red-300 rounded text-xs font-semibold">
                    {passError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Current Password</label>
                  <input
                    type="password"
                    value={curPass}
                    onChange={e => setCurPass(e.target.value)}
                    className="w-full p-2 border-2 border-black rounded-lg text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">New Password (Min 6 chars)</label>
                  <input
                    type="password"
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    className="w-full p-2 border-2 border-black rounded-lg text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPass}
                    onChange={e => setConfirmPass(e.target.value)}
                    className="w-full p-2 border-2 border-black rounded-lg text-xs"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#8e44ad] hover:bg-[#732d91] text-white rounded-lg font-bold border-2 border-black cursor-pointer text-xs"
                >
                  Change Password
                </button>
              </form>

              <hr className="border-gray-300" />

              {/* Global Threshold */}
              <div className="max-w-sm space-y-2">
                <div className="text-xs font-bold text-[#003057] uppercase tracking-wide">
                  Global Low-Stock Threshold Default
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    value={threshInput}
                    onChange={e => setThreshInput(e.target.value)}
                    className="w-24 p-2 border-2 border-black rounded-lg text-xs font-bold"
                  />
                  <button
                    onClick={() => {
                      const v = parseInt(threshInput, 10);
                      if (isNaN(v) || v < 0) {
                        showToast('Enter a valid non-negative number.', 'error');
                        return;
                      }
                      onSaveGlobalThreshold(v);
                    }}
                    className="px-3 py-1.5 bg-[#16a085] hover:bg-[#117a65] text-white rounded-lg font-bold border-2 border-black cursor-pointer text-xs"
                  >
                    Save Default Threshold
                  </button>
                </div>
                <p className="text-[11px] text-gray-500">
                  Applied to items that do not specify a custom threshold. 0 means alerts trigger only when completely
                  depleted.
                </p>
              </div>

              <hr className="border-gray-300" />

              {/* Reset to Wireline Sample Data */}
              <div className="max-w-md space-y-2">
                <div className="text-xs font-bold text-[#003057] uppercase tracking-wide">
                  Reset Demo Wireline Parts
                </div>
                <button
                  onClick={onResetSampleData}
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-bold border-2 border-black cursor-pointer text-xs flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reload Default Stores &amp; Wireline Inventory</span>
                </button>
                <p className="text-[11px] text-gray-500">
                  Resets the IndexedDB table with standard Schlumberger Wireline laboratory parts for Sonde Lab, E-Lab, and WHE.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-gray-100 border-t border-gray-300 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-black text-white text-xs font-bold rounded border border-black cursor-pointer"
          >
            Close Admin Panel
          </button>
        </div>
      </div>
    </div>
  );
};
