import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
  ListTree,
  Database,
  Download
} from 'lucide-react';
import { SyncServiceState, cloudSyncService } from '../services/cloudSync';
import { CloudChanges } from '../types/inventory';
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
  const [cloudSnapshot, setCloudSnapshot] = useState<CloudChanges | null>(null);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  // Local settings draft
  const [intervalSec, setIntervalSec] = useState(syncState.config.autoSyncIntervalSeconds || 10);
  const [conflictPolicy, setConflictPolicy] = useState(syncState.config.conflictResolution || 'last_write_wins');
  const [isAutoEnabled, setIsAutoEnabled] = useState(syncState.config.enabled);

  useEffect(() => {
    db.syncQueue.toArray().then(items => setQueueItems(items)).catch(() => setQueueItems([]));
  }, [syncState.pendingCount, syncState.status]);

  const loadCloudData = async () => {
    setLoadingCloud(true);
    const snap = await cloudSyncService.getCloudSnapshot();
    setCloudSnapshot(snap);
    setLoadingCloud(false);
  };

  const handleResetFromCloud = async () => {
    if (!window.confirm('Replace ALL local inventory on this terminal with the cloud database copy? Unsynced local changes will be lost.')) return;
    setNotice(null);
    const res = await cloudSyncService.resetFromCloud();
    setNotice({ ok: res.success, text: res.message });
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await cloudSyncService.updateConfig({
      autoSyncIntervalSeconds: Number(intervalSec),
      conflictResolution: conflictPolicy,
      enabled: isAutoEnabled
    });
    setActiveTab('status');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-300 rounded-xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#002B49] text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-5 h-5 text-sky-400" />
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight">Cloud Database Sync Center</h3>
              <p className="text-[11px] text-sky-200">Local IndexedDB copy &harr; shared Postgres cloud database (JSONB)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded cursor-pointer transition text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-1 flex-wrap">
          <button
            onClick={() => setActiveTab('status')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-md transition border-t-2 border-x -mb-[1px] cursor-pointer ${
              activeTab === 'status'
                ? 'bg-white border-sky-600 border-x-slate-200 text-[#002B49]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            📊 Cloud Status
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-md transition border-t-2 border-x -mb-[1px] cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-white border-sky-600 border-x-slate-200 text-[#002B49]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            ⚙️ Sync Settings
          </button>
          <button
            onClick={() => {
              setActiveTab('inspector');
              loadCloudData();
            }}
            className={`px-3 py-2 text-xs font-semibold rounded-t-md transition border-t-2 border-x -mb-[1px] cursor-pointer ${
              activeTab === 'inspector'
                ? 'bg-white border-sky-600 border-x-slate-200 text-[#002B49]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            ☁️ Cloud Storage Inspector
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-md transition border-t-2 border-x -mb-[1px] cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-white border-sky-600 border-x-slate-200 text-[#002B49]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            📜 Live Activity Logs
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 text-xs sm:text-sm">
          {activeTab === 'status' && (
            <div className="space-y-4">
              {/* Cloud Database Card */}
              <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#002B49] text-white flex items-center justify-center shrink-0">
                      <Database className="w-5 h-5 text-sky-300" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <span>Shared cloud database</span>
                        {syncState.status !== 'error' && syncState.isOnline && syncState.lastSyncTime && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Connected
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        Every signed-in terminal reads and writes the same database. Changes from other terminals appear within a few seconds.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleResetFromCloud}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-[#002B49] border border-slate-300 rounded font-semibold text-xs cursor-pointer flex items-center gap-1.5 transition shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Reload from cloud (replace local)</span>
                  </button>
                </div>

                {syncState.errorMessage && (
                  <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{syncState.errorMessage}</span>
                  </div>
                )}
                {notice && (
                  <div className={`mt-3 p-2.5 border rounded text-xs flex items-center gap-2 ${notice.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                    {notice.ok ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
                    <span>{notice.text}</span>
                  </div>
                )}
              </div>

              {/* Status Summary Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                  <div className="text-slate-500 text-xs font-semibold">Network State</div>
                  <div className="mt-1 flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                    {syncState.isOnline ? (
                      <>
                        <Wifi className="w-4 h-4 text-emerald-600" />
                        <span>Online (Ready)</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-4 h-4 text-amber-600" />
                        <span>Offline (IndexedDB Local)</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                  <div className="text-slate-500 text-xs font-semibold">Pending Local Queue</div>
                  <div className="mt-1 flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                    <ListTree className="w-4 h-4 text-sky-600" />
                    <span>{syncState.pendingCount} Local Mutations</span>
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                  <div className="text-slate-500 text-xs font-semibold">Last Cloud Sync</div>
                  <div className="mt-1 font-bold text-slate-900 text-xs font-mono">
                    {syncState.lastSyncTime
                      ? new Date(syncState.lastSyncTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })
                      : 'Never'}
                  </div>
                </div>
              </div>

              {/* Sync Trigger Action */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900 text-sm">Two-Way Background Sync</div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {syncState.config.enabled
                      ? `Edits upload within seconds; other terminals' changes are checked every ${syncState.config.autoSyncIntervalSeconds}s.`
                      : 'Automatic background sync is currently paused.'}
                  </p>
                </div>

                <button
                  onClick={onTriggerSync}
                  disabled={syncState.status === 'syncing'}
                  className="px-4 py-2 bg-[#002B49] hover:bg-[#003d66] text-white rounded font-bold cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 flex items-center gap-2 justify-center transition"
                >
                  <RefreshCw className={`w-4 h-4 ${syncState.status === 'syncing' ? 'animate-spin' : ''}`} />
                  <span>{syncState.status === 'syncing' ? 'Syncing...' : 'Sync Now'}</span>
                </button>
              </div>

              {/* Pending Queue List */}
              <div>
                <h4 className="font-bold text-slate-800 text-xs tracking-wide mb-2 flex items-center justify-between">
                  <span>Queued Local Changes (IndexedDB syncQueue)</span>
                  <span className="text-slate-500 font-mono text-[11px]">{queueItems.length} items</span>
                </h4>

                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto bg-white text-xs">
                  {queueItems.length === 0 ? (
                    <div className="p-6 text-center text-slate-500">
                      ✅ Queue empty. All local updates are saved in the cloud database.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {queueItems.map(item => (
                        <div key={item.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                          <div>
                            <span className="font-mono font-bold text-slate-900">{item.partNumber}</span>
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-semibold text-[10px]">
                              {item.action}
                            </span>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Store: {item.storeId || 'Current'} · {JSON.stringify(item.payload)}
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
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
              <div className="bg-sky-50 p-3 rounded-lg border border-sky-200 text-xs text-slate-700">
                <strong>How cloud sync works:</strong> Every change is saved instantly on this device (IndexedDB), queued, and uploaded to the shared Postgres database a moment later. Each part is stored as a JSONB record with its edit time. Other terminals pull new changes every few seconds and when the tab is reopened, so offline edits upload automatically once the connection is back.
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Auto-Sync Frequency
                  </label>
                  <select
                    value={intervalSec}
                    onChange={e => setIntervalSec(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
                  >
                    <option value={5}>Every 5 seconds</option>
                    <option value={10}>Every 10 seconds (Recommended)</option>
                    <option value={30}>Every 30 seconds</option>
                    <option value={60}>Every 1 minute</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Conflict Resolution Strategy</label>
                <select
                  value={conflictPolicy}
                  onChange={e => setConflictPolicy(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                >
                  <option value="last_write_wins">Last Write Wins (Compares ISO timestamps across devices)</option>
                  <option value="local_priority">Local Terminal Priority (Always preserve local updates)</option>
                  <option value="remote_priority">Remote Priority (Always favor the cloud version)</option>
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
                <label htmlFor="auto-enabled-chk" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Enable continuous background sync worker
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('status')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold border border-slate-300 cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#002B49] hover:bg-[#003d66] text-white rounded font-bold cursor-pointer text-xs"
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
                  <h4 className="font-bold text-slate-900 text-xs tracking-wide">
                    Cloud database contents
                  </h4>
                  <p className="text-xs text-slate-500">Live read of the stores and parts saved in the shared database</p>
                </div>
                <button
                  onClick={loadCloudData}
                  disabled={loadingCloud}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded border border-slate-300 text-xs font-semibold cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingCloud ? 'animate-spin' : ''}`} />
                  <span>Refresh Cloud Data</span>
                </button>
              </div>

              {loadingCloud ? (
                <div className="p-8 text-center text-slate-500">Loading cloud database...</div>
              ) : cloudSnapshot ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 bg-slate-50 rounded border border-slate-200">
                      <strong>Parts in Cloud:</strong> {cloudSnapshot.items.length}
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-slate-200">
                      <strong>Read At:</strong>{' '}
                      {new Date(cloudSnapshot.serverTime).toLocaleTimeString()}
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-slate-200 truncate">
                      <strong>Sub-Stores:</strong> {cloudSnapshot.stores.length}
                    </div>
                  </div>

                  <pre className="p-3 bg-slate-900 text-emerald-300 rounded-lg text-[11px] font-mono max-h-64 overflow-y-auto border border-slate-800">
                    {JSON.stringify(
                      {
                        stores: cloudSnapshot.stores.map(({ data: { adminPasswordHash, ...store } }) => store),
                        items: cloudSnapshot.items.map(i => i.data)
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  Could not read the cloud database. Check the connection and that you are signed in, then refresh.
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div>
              <h4 className="font-bold text-slate-900 text-xs tracking-wide mb-2">
                Real-Time Background Sync Stream
              </h4>
              <div className="p-3 bg-slate-950 text-slate-200 rounded-lg font-mono text-[11px] max-h-72 overflow-y-auto space-y-1.5 border border-slate-800">
                {syncState.logs.length === 0 ? (
                  <div className="text-slate-500">No activity logged yet.</div>
                ) : (
                  syncState.logs.map(log => {
                    let color = 'text-slate-300';
                    if (log.type === 'success') color = 'text-emerald-400';
                    if (log.type === 'warn') color = 'text-amber-400';
                    if (log.type === 'error') color = 'text-rose-400';
                    if (log.type === 'info') color = 'text-sky-300';

                    return (
                      <div key={log.id} className="flex gap-2">
                        <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
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
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center">
          <span className="text-[11px] text-slate-500">
            WL Lab Sync Engine · IndexedDB &amp; Netlify Database (Postgres)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
