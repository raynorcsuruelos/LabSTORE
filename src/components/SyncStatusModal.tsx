import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
  Settings,
  ListTree,
  FileCode,
  Key,
  FolderSync,
  HelpCircle
} from 'lucide-react';
import { SyncServiceState, oneDriveSyncService } from '../services/oneDriveSync';
import { OneDriveCloudSnapshot } from '../types/inventory';
import { db } from '../db/dexieDb';

interface SyncStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncState: SyncServiceState;
  onTriggerSync: () => void;
}

export const SyncStatusModal: React.FC<SyncStatusModalProps> = ({
  isOpen,
  onClose,
  syncState,
  onTriggerSync
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'status' | 'settings' | 'inspector' | 'logs'>('status');
  const [cloudSnapshot, setCloudSnapshot] = useState<OneDriveCloudSnapshot | null>(null);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [queueItems, setQueueItems] = useState<any[]>([]);

  // Local settings draft
  const [mode, setMode] = useState(syncState.config.mode);
  const [accessToken, setAccessToken] = useState(syncState.config.accessToken || '');
  const [folderPath, setFolderPath] = useState(syncState.config.folderPath || 'WLLabInventory');
  const [fileName, setFileName] = useState(syncState.config.fileName || 'inventory_sync.json');
  const [intervalSec, setIntervalSec] = useState(syncState.config.autoSyncIntervalSeconds || 30);
  const [conflictPolicy, setConflictPolicy] = useState(syncState.config.conflictResolution || 'last_write_wins');
  const [isAutoEnabled, setIsAutoEnabled] = useState(syncState.config.enabled);

  useEffect(() => {
    // Load queued mutations
    db.syncQueue.toArray().then(items => setQueueItems(items));
    // Load cloud snapshot
    if (activeTab === 'inspector') {
      loadCloudData();
    }
  }, [activeTab, syncState.pendingCount, syncState.status]);

  const loadCloudData = async () => {
    setLoadingCloud(true);
    const snap = await oneDriveSyncService.getCloudSnapshot();
    setCloudSnapshot(snap);
    setLoadingCloud(false);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await oneDriveSyncService.updateConfig({
      mode,
      accessToken,
      folderPath,
      fileName,
      autoSyncIntervalSeconds: Number(intervalSec),
      conflictResolution: conflictPolicy,
      enabled: isAutoEnabled
    });
    setActiveTab('status');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black rounded-xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#003057] text-white px-5 py-3.5 flex items-center justify-between border-b-3 border-black">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-5 h-5 text-blue-300" />
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight">OneDrive Background Sync Center</h3>
              <p className="text-[11px] text-blue-200">IndexedDB Local Storage &harr; Microsoft OneDrive Cloud</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded cursor-pointer transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b-2 border-gray-300 bg-gray-50 px-4 pt-2 gap-1 flex-wrap">
          <button
            onClick={() => setActiveTab('status')}
            className={`px-3 py-2 text-xs font-bold rounded-t-md transition border-t-2 border-x-2 -mb-[2px] cursor-pointer ${
              activeTab === 'status'
                ? 'bg-white border-black text-[#003057]'
                : 'border-transparent text-gray-600 hover:text-black'
            }`}
          >
            📊 Sync Status &amp; Queue
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-2 text-xs font-bold rounded-t-md transition border-t-2 border-x-2 -mb-[2px] cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-white border-black text-[#003057]'
                : 'border-transparent text-gray-600 hover:text-black'
            }`}
          >
            ⚙️ OneDrive Settings
          </button>
          <button
            onClick={() => {
              setActiveTab('inspector');
              loadCloudData();
            }}
            className={`px-3 py-2 text-xs font-bold rounded-t-md transition border-t-2 border-x-2 -mb-[2px] cursor-pointer ${
              activeTab === 'inspector'
                ? 'bg-white border-black text-[#003057]'
                : 'border-transparent text-gray-600 hover:text-black'
            }`}
          >
            ☁️ Cloud Inspector
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-2 text-xs font-bold rounded-t-md transition border-t-2 border-x-2 -mb-[2px] cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-white border-black text-[#003057]'
                : 'border-transparent text-gray-600 hover:text-black'
            }`}
          >
            📜 Sync Activity Log
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 text-xs sm:text-sm">
          {activeTab === 'status' && (
            <div className="space-y-4">
              {/* Status Summary Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-[#f0f7fd] border-2 border-[#0066a1] rounded-lg">
                  <div className="text-gray-500 text-xs font-bold uppercase">Network Status</div>
                  <div className="mt-1 flex items-center gap-1.5 font-bold text-gray-900 text-sm">
                    {syncState.isOnline ? (
                      <>
                        <Wifi className="w-4 h-4 text-emerald-600" />
                        <span>Online (Connected)</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-4 h-4 text-amber-600" />
                        <span>Offline (IndexedDB Local)</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-[#f8fafc] border-2 border-gray-300 rounded-lg">
                  <div className="text-gray-500 text-xs font-bold uppercase">Pending Queue</div>
                  <div className="mt-1 flex items-center gap-1.5 font-bold text-gray-900 text-sm">
                    <ListTree className="w-4 h-4 text-[#0066a1]" />
                    <span>{syncState.pendingCount} Local Mutations</span>
                  </div>
                </div>

                <div className="p-3 bg-[#f8fafc] border-2 border-gray-300 rounded-lg">
                  <div className="text-gray-500 text-xs font-bold uppercase">Last Synced</div>
                  <div className="mt-1 font-bold text-gray-900 text-xs">
                    {syncState.lastSyncTime
                      ? new Date(syncState.lastSyncTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })
                      : 'Not synced yet'}
                  </div>
                </div>
              </div>

              {/* Sync Trigger Action */}
              <div className="p-4 bg-gray-50 border-2 border-gray-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-gray-900 text-sm">Background Synchronization</div>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {syncState.config.enabled
                      ? `Auto-sync runs in background every ${syncState.config.autoSyncIntervalSeconds}s (Mode: ${syncState.config.mode === 'graph_token' ? 'Microsoft Graph API' : 'Simulated OneDrive'}).`
                      : 'Automatic background sync is paused.'}
                  </p>
                </div>

                <button
                  onClick={onTriggerSync}
                  disabled={syncState.status === 'syncing'}
                  className="px-4 py-2 bg-[#0066a1] hover:bg-[#004e7c] text-white rounded-lg font-bold border-2 border-black cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-2 justify-center"
                >
                  <RefreshCw className={`w-4 h-4 ${syncState.status === 'syncing' ? 'animate-spin' : ''}`} />
                  <span>{syncState.status === 'syncing' ? 'Syncing...' : 'Sync to OneDrive Now'}</span>
                </button>
              </div>

              {/* Pending Queue List */}
              <div>
                <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wide mb-2 flex items-center justify-between">
                  <span>Queued Local Changes (IndexedDB syncQueue)</span>
                  <span className="text-gray-500">{queueItems.length} items</span>
                </h4>

                <div className="border-2 border-gray-300 rounded-lg overflow-hidden max-h-48 overflow-y-auto bg-white text-xs">
                  {queueItems.length === 0 ? (
                    <div className="p-6 text-center text-gray-400">
                      ✅ Queue empty. All local updates are in sync with OneDrive.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {queueItems.map(item => (
                        <div key={item.id} className="p-2.5 flex items-center justify-between hover:bg-gray-50">
                          <div>
                            <span className="font-mono font-bold text-black">{item.partNumber}</span>
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold text-[10px]">
                              {item.action}
                            </span>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              {JSON.stringify(item.payload)}
                            </div>
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="bg-[#f0f7fd] p-3 rounded-lg border-2 border-[#0066a1]/40 text-xs text-gray-700">
                <strong>How OneDrive Sync Works:</strong> All changes made offline or online are immediately saved to
                Dexie.js IndexedDB. The background worker pushes the synchronized JSON inventory payload to Microsoft
                OneDrive.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Sync Mode</label>
                  <select
                    value={mode}
                    onChange={e => setMode(e.target.value as any)}
                    className="w-full p-2 border-2 border-black rounded-lg text-xs font-semibold bg-white"
                  >
                    <option value="simulated">Simulated OneDrive Cloud (Zero Setup / Sandbox)</option>
                    <option value="graph_token">Microsoft Graph REST API (Production OneDrive)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Auto-Sync Frequency
                  </label>
                  <select
                    value={intervalSec}
                    onChange={e => setIntervalSec(Number(e.target.value))}
                    className="w-full p-2 border-2 border-black rounded-lg text-xs font-semibold bg-white"
                  >
                    <option value={10}>Every 10 seconds</option>
                    <option value={30}>Every 30 seconds (Recommended)</option>
                    <option value={60}>Every 1 minute</option>
                    <option value={300}>Every 5 minutes</option>
                  </select>
                </div>
              </div>

              {mode === 'graph_token' && (
                <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-lg space-y-2">
                  <label className="block text-xs font-bold text-amber-900">
                    Microsoft Graph Access Token (Bearer Token)
                  </label>
                  <input
                    type="password"
                    value={accessToken}
                    onChange={e => setAccessToken(e.target.value)}
                    placeholder="eyJ0eXAiOiJKV1QiLC..."
                    className="w-full p-2 border-2 border-amber-500 rounded-lg text-xs font-mono bg-white"
                  />
                  <p className="text-[11px] text-amber-800">
                    Enter an OAuth Bearer token with <code>Files.ReadWrite</code> permission from your Azure AD /
                    Microsoft Graph App.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">OneDrive Folder Path</label>
                  <input
                    type="text"
                    value={folderPath}
                    onChange={e => setFolderPath(e.target.value)}
                    placeholder="WLLabInventory"
                    className="w-full p-2 border-2 border-black rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Target Sync File Name</label>
                  <input
                    type="text"
                    value={fileName}
                    onChange={e => setFileName(e.target.value)}
                    placeholder="inventory_sync.json"
                    className="w-full p-2 border-2 border-black rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Conflict Resolution Strategy</label>
                <select
                  value={conflictPolicy}
                  onChange={e => setConflictPolicy(e.target.value as any)}
                  className="w-full p-2 border-2 border-black rounded-lg text-xs bg-white font-medium"
                >
                  <option value="last_write_wins">Last Write Wins (Compares ISO Timestamps)</option>
                  <option value="local_priority">Local IndexedDB Priority (Always Push Local)</option>
                  <option value="remote_priority">Remote Priority (Reconcile from OneDrive)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto-enabled-chk"
                  checked={isAutoEnabled}
                  onChange={e => setIsAutoEnabled(e.target.checked)}
                  className="w-4 h-4 cursor-pointer"
                />
                <label htmlFor="auto-enabled-chk" className="text-xs font-bold text-gray-800 cursor-pointer">
                  Enable continuous background sync worker
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('status')}
                  className="px-3 py-1.5 bg-gray-200 text-gray-800 rounded font-bold border border-black cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0066a1] hover:bg-[#004e7c] text-white rounded font-bold border-2 border-black cursor-pointer text-xs"
                >
                  Save Sync Settings
                </button>
              </div>
            </form>
          )}

          {activeTab === 'inspector' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wide">
                    OneDrive File: {syncState.config.folderPath}/{syncState.config.fileName}
                  </h4>
                  <p className="text-xs text-gray-500">Live preview of remote data stored in the cloud</p>
                </div>
                <button
                  onClick={loadCloudData}
                  disabled={loadingCloud}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded border border-gray-400 text-xs font-semibold cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingCloud ? 'animate-spin' : ''}`} />
                  <span>Refresh Cloud Data</span>
                </button>
              </div>

              {loadingCloud ? (
                <div className="p-8 text-center text-gray-500">Loading OneDrive cloud snapshot...</div>
              ) : cloudSnapshot ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 bg-gray-100 rounded border border-gray-300">
                      <strong>Items in Cloud:</strong> {cloudSnapshot.itemCount}
                    </div>
                    <div className="p-2 bg-gray-100 rounded border border-gray-300">
                      <strong>Last Updated:</strong>{' '}
                      {new Date(cloudSnapshot.lastUpdated).toLocaleTimeString()}
                    </div>
                    <div className="p-2 bg-gray-100 rounded border border-gray-300 truncate">
                      <strong>Source:</strong> {cloudSnapshot.source}
                    </div>
                  </div>

                  <pre className="p-3 bg-gray-900 text-emerald-300 rounded-lg text-[11px] font-mono max-h-64 overflow-y-auto border-2 border-black">
                    {JSON.stringify(cloudSnapshot, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  No remote cloud snapshot found yet. Trigger sync to create the file in OneDrive!
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div>
              <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wide mb-2">
                Real-Time Background Sync Stream
              </h4>
              <div className="p-3 bg-gray-950 text-gray-200 rounded-lg font-mono text-[11px] max-h-72 overflow-y-auto space-y-1.5 border-2 border-black">
                {syncState.logs.length === 0 ? (
                  <div className="text-gray-500">No activity logged yet.</div>
                ) : (
                  syncState.logs.map(log => {
                    let color = 'text-gray-300';
                    if (log.type === 'success') color = 'text-emerald-400';
                    if (log.type === 'warn') color = 'text-amber-400';
                    if (log.type === 'error') color = 'text-red-400';
                    if (log.type === 'info') color = 'text-blue-300';

                    return (
                      <div key={log.id} className="flex gap-2">
                        <span className="text-gray-500 shrink-0">[{log.timestamp}]</span>
                        <span className={`${color} font-medium`}>{log.message}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-gray-100 border-t border-gray-300 flex justify-between items-center">
          <span className="text-[11px] text-gray-500">
            WL Lab Sync Engine · Dexie.js IndexedDB &amp; Microsoft OneDrive
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-black text-white text-xs font-bold rounded border border-black cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
