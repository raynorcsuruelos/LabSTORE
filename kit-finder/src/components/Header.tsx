import React from 'react';
import {
  Bell,
  Lock,
  HelpCircle,
  Cloud,
  RefreshCw,
  AlertTriangle,
  WifiOff,
  CheckCircle2,
  ShieldCheck,
  LogOut,
  Building2,
  ChevronDown,
  UserCircle2,
  Download,
  HardDrive
} from 'lucide-react';
import { SyncServiceState } from '../services/cloudSync';
import { OilRigLogo } from './OilRigLogo';
import { IS_STANDALONE, STANDALONE_FILE_NAME } from '../standalone';

interface HeaderProps {
  lowStockCount: number;
  onToggleNotif: () => void;
  onOpenAdmin: () => void;
  onOpenHelp: () => void;
  onOpenSync: () => void;
  syncState: SyncServiceState;
  onQuickSync: () => void;
  isAdmin: boolean;
  isMaster?: boolean;
  onLockAdmin: () => void;
  currentStoreName: string;
  currentStoreCode: string;
  onOpenStoreSelect: () => void;
  userEmail?: string;
  onSignOut: () => void;
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
  isMaster,
  onLockAdmin,
  currentStoreName,
  currentStoreCode,
  onOpenStoreSelect,
  userEmail,
  onSignOut
}) => {
  const getSyncBadge = () => {
    if (!syncState.isOnline) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-900/60 text-amber-200 border border-amber-500/50 text-xs font-medium">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline (IndexedDB)</span>
        </span>
      );
    }

    switch (syncState.status) {
      case 'syncing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-900/60 text-sky-200 border border-sky-400 text-xs font-medium animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-300" />
            <span>Syncing...</span>
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-900/60 text-amber-200 border border-amber-400 text-xs font-medium">
            <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
            <span>{syncState.pendingCount} Pending</span>
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-900/60 text-red-200 border border-red-400 text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5 text-red-300" />
            <span>Sync Error</span>
          </span>
        );
      case 'synced':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-200 border border-emerald-500/50 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cloud: Synced</span>
          </span>
        );
    }
  };

  return (
    <header className="bg-[#003057] text-white px-3 sm:px-5 py-2.5 sm:py-3.5 border-b-4 border-black flex flex-wrap items-center justify-between gap-2.5 sm:gap-4 select-none">
      {/* Brand Identity */}
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        <div className="bg-white rounded px-2 py-0.5 sm:px-2.5 sm:py-1 flex items-center justify-center border-2 border-black/30 shadow-sm shrink-0">
          <OilRigLogo className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight leading-tight flex items-center gap-1.5 sm:gap-2">
            WL Lab Inventory
            <span className="hidden lg:inline-block text-[10px] font-mono uppercase bg-[#0066a1] text-white px-2 py-0.5 rounded border border-white/20">
              Offline + Cloud Database Sync
            </span>
          </h1>
          <p className="text-[11px] sm:text-xs text-blue-200/80 font-normal">
            Wireline Labs · Parts &amp; Stock Manager
          </p>
        </div>
      </div>

      {/* Header Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
        {/* Sub-Store Selector Button */}
        <button
          onClick={onOpenStoreSelect}
          title="Switch Sub-Store (Sonde Lab, E-Lab, WHE...)"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#002240] hover:bg-[#001830] text-white rounded-lg border-2 border-black/40 text-xs sm:text-sm font-bold cursor-pointer shadow-sm active:scale-95 transition"
        >
          <Building2 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span className="font-bold text-amber-100">{currentStoreName}</span>
          <span className="text-[10px] bg-[#0066a1] px-1.5 py-0.5 rounded font-mono text-white hidden sm:inline border border-white/20">
            {currentStoreCode}
          </span>
          <ChevronDown className="w-3 h-3 text-blue-200" />
        </button>

        {/* Cloud Sync Pill and Trigger */}
        {IS_STANDALONE ? (
          <span
            title="Offline copy: data is saved in this browser only and is not shared with the cloud database"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-900/60 text-amber-200 border border-amber-500/50 text-xs font-medium"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Offline copy</span>
          </span>
        ) : (
          <div className="flex items-center gap-1 bg-black/25 p-1 rounded-lg border border-white/10">
            <button
              onClick={onOpenSync}
              title="Open Cloud Sync Center"
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
        )}

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
              <span>{isMaster ? 'Master Admin' : 'Store Admin'}</span>
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

        {/* Download Offline Copy */}
        {!IS_STANDALONE && (
          <a
            href={`/${STANDALONE_FILE_NAME}`}
            download={STANDALONE_FILE_NAME}
            title="Download a standalone HTML copy that runs offline from a single file"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#0066a1] hover:bg-[#0077bb] text-white text-xs sm:text-sm font-semibold rounded-lg border-2 border-black cursor-pointer shadow-sm active:scale-95 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </a>
        )}

        {/* App Sign Out */}
        {!IS_STANDALONE && (
          <button
            onClick={onSignOut}
            title={userEmail ? `Signed in as ${userEmail}. Click to sign out.` : 'Sign out'}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#7f1d1d] hover:bg-[#991b1b] text-white text-xs sm:text-sm font-semibold rounded-lg border-2 border-black cursor-pointer shadow-sm active:scale-95 transition"
          >
            <UserCircle2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        )}
      </div>
    </header>
  );
};
