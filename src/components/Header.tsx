import React from 'react';
import { Bell, Lock, HelpCircle, Cloud, RefreshCw, AlertTriangle, WifiOff, CheckCircle2, ShieldCheck, LogOut } from 'lucide-react';
import { SyncServiceState } from '../services/oneDriveSync';

interface HeaderProps {
  lowStockCount: number;
  onToggleNotif: () => void;
  onOpenAdmin: () => void;
  onOpenHelp: () => void;
  onOpenSync: () => void;
  syncState: SyncServiceState;
  onQuickSync: () => void;
  isAdmin: boolean;
  onLockAdmin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  lowStockCount,
  onToggleNotif,
  onOpenAdmin,
  onOpenHelp,
  onOpenSync,
  syncState,
  onQuickSync,
  isAdmin,
  onLockAdmin
}) => {
  const getSyncBadge = () => {
    if (!syncState.isOnline) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-900/60 text-amber-200 border border-amber-500/50 text-xs font-semibold">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline (IndexedDB Active)</span>
        </span>
      );
    }

    switch (syncState.status) {
      case 'syncing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-900/60 text-blue-200 border border-blue-400 text-xs font-semibold animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-300" />
            <span>Syncing to OneDrive...</span>
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-900/60 text-amber-200 border border-amber-400 text-xs font-semibold">
            <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
            <span>{syncState.pendingCount} Pending Sync</span>
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-900/60 text-red-200 border border-red-400 text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-red-300" />
            <span>Sync Error</span>
          </span>
        );
      case 'synced':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/70 text-emerald-200 border border-emerald-500/50 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>OneDrive: Synced</span>
          </span>
        );
    }
  };

  return (
    <header className="bg-[#003057] text-white px-5 py-3.5 border-b-4 border-black flex flex-wrap items-center justify-between gap-4 select-none">
      {/* Brand Identity */}
      <div className="flex items-center gap-3.5">
        <div className="bg-white rounded px-2.5 py-1 flex items-center justify-center border-2 border-black/30 shadow-sm">
          <svg viewBox="0 0 120 40" fill="none" className="w-14 h-auto" xmlns="http://www.w3.org/2000/svg">
            <rect width="120" height="40" rx="4" fill="#fff" />
            <text x="6" y="29" fontFamily="Arial" fontWeight="900" fontSize="26" fill="#003057">
              slb
            </text>
            <circle cx="100" cy="20" r="14" fill="#0066a1" />
            <text x="93.5" y="25" fontFamily="Arial" fontWeight="900" fontSize="14" fill="#fff">
              ★
            </text>
          </svg>
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight flex items-center gap-2">
            WL Lab Inventory
            <span className="hidden md:inline-block text-[10px] font-mono uppercase bg-[#0066a1] text-white px-2 py-0.5 rounded border border-white/20">
              Dexie.js Offline + OneDrive Sync
            </span>
          </h1>
          <p className="text-xs text-blue-200/80 font-normal">
            Wireline Laboratory · Parts &amp; Stock Manager
          </p>
        </div>
      </div>

      {/* Header Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
        {/* OneDrive Sync Pill and Trigger */}
        <div className="flex items-center gap-1 bg-black/25 p-1 rounded-lg border border-white/10">
          <button
            onClick={onOpenSync}
            title="Open OneDrive Background Sync Manager"
            className="flex items-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer text-left"
          >
            <Cloud className="w-4 h-4 text-blue-300 ml-1" />
            {getSyncBadge()}
          </button>
          <button
            onClick={onQuickSync}
            disabled={syncState.status === 'syncing'}
            title="Trigger instant sync now"
            className="p-1 hover:bg-white/20 rounded text-blue-200 hover:text-white transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncState.status === 'syncing' ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Low Stock Notification Bell */}
        <button
          onClick={onToggleNotif}
          title="Low-Stock Alerts"
          className="relative p-2 rounded-lg bg-[#002240] hover:bg-[#001830] border-2 border-black/40 text-amber-300 transition-colors cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          {lowStockCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-[#c0392b] text-white rounded-full w-5 h-5 text-[11px] font-bold flex items-center justify-center border-2 border-[#003057] animate-pulse">
              {lowStockCount}
            </span>
          )}
        </button>

        {/* Admin Authentication & Session Controls */}
        {isAdmin ? (
          <div className="flex items-center gap-1 bg-[#1a7a3c]/30 p-0.5 rounded-lg border border-emerald-400/50">
            <button
              onClick={onOpenAdmin}
              title="Open Admin Panel"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1a7a3c] hover:bg-[#145a2c] text-white text-xs sm:text-sm font-semibold rounded-md border border-black cursor-pointer shadow-sm active:scale-95 transition"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
              <span>Admin Panel</span>
            </button>
            <button
              onClick={onLockAdmin}
              title="Lock / Sign Out of Admin Mode"
              className="p-1.5 hover:bg-black/30 rounded-md text-red-200 hover:text-white transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAdmin}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2c3e50] hover:bg-[#34495e] text-white text-xs sm:text-sm font-semibold rounded-lg border-2 border-black cursor-pointer shadow-sm active:scale-95 transition"
          >
            <Lock className="w-3.5 h-3.5 text-amber-300" />
            <span>Admin</span>
          </button>
        )}

        {/* Help */}
        <button
          onClick={onOpenHelp}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#576574] hover:bg-[#6c7a89] text-white text-xs sm:text-sm font-semibold rounded-lg border-2 border-black cursor-pointer shadow-sm active:scale-95 transition"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Help</span>
        </button>
      </div>
    </header>
  );
};
