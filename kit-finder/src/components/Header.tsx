import React from 'react';
import { HelpCircle, LogOut, Maximize2, Minimize2, Plus, ShieldCheck, ListChecks, Package, RefreshCw } from 'lucide-react';
import { OilRigLogo } from './OilRigLogo';

interface HeaderProps {
  kitCount: number;
  email: string | null;
  isAdmin: boolean;
  wide: boolean;
  loading: boolean;
  onToggleWide: () => void;
  onRefresh: () => void;
  onAddKit: () => void;
  onManageKits: () => void;
  onOpenHelp: () => void;
  onSignOut: () => void;
}

const iconBtn =
  'p-2 rounded-lg bg-[#002240] hover:bg-[#001830] border-2 border-black/40 text-amber-300 transition-colors cursor-pointer disabled:opacity-50';

export const Header: React.FC<HeaderProps> = ({
  kitCount,
  email,
  isAdmin,
  wide,
  loading,
  onToggleWide,
  onRefresh,
  onAddKit,
  onManageKits,
  onOpenHelp,
  onSignOut
}) => (
  <header className="bg-[#003057] text-white px-3 sm:px-5 py-2.5 sm:py-3.5 border-b-4 border-black flex flex-wrap items-center justify-between gap-2.5 sm:gap-4 select-none">
    {/* Brand Identity */}
    <div className="flex items-center gap-2.5 sm:gap-3.5">
      <div className="bg-white rounded px-2 py-0.5 sm:px-2.5 sm:py-1 flex items-center justify-center border-2 border-black/30 shadow-sm shrink-0">
        <OilRigLogo className="w-8 h-8 sm:w-10 sm:h-10" />
      </div>
      <div>
        <h1 className="text-lg sm:text-2xl font-bold tracking-tight leading-tight flex items-center gap-1.5 sm:gap-2">
          WL Kit Finder
          <span className="hidden lg:inline-flex items-center gap-1 text-[10px] font-mono uppercase bg-[#0066a1] text-white px-2 py-0.5 rounded border border-white/20">
            <Package className="w-3 h-3" /> {kitCount} kits
          </span>
        </h1>
        <p className="text-[11px] sm:text-xs text-blue-200/80 font-normal">Wireline Labs · Maintenance Kit Finder</p>
      </div>
    </div>

    {/* Header Controls */}
    <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
      {isAdmin && (
        <div className="flex items-center gap-1 bg-[#1a7a3c]/30 p-0.5 rounded-lg border border-emerald-400/50">
          <span className="hidden sm:inline-flex items-center gap-1 px-2 text-[11px] font-bold text-emerald-200 uppercase">
            <ShieldCheck className="w-3.5 h-3.5" /> Admin
          </span>
          <button
            onClick={onAddKit}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1a7a3c] hover:bg-[#145a2c] text-white text-xs sm:text-sm font-semibold rounded-md border border-black cursor-pointer shadow-sm active:scale-95 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Add Kit
          </button>
          <button
            onClick={onManageKits}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0066a1] hover:bg-[#00558a] text-white text-xs sm:text-sm font-semibold rounded-md border border-black cursor-pointer shadow-sm active:scale-95 transition"
          >
            <ListChecks className="w-3.5 h-3.5" /> Manage
          </button>
        </div>
      )}

      <button onClick={onRefresh} disabled={loading} title="Reload kits from the database" className={iconBtn}>
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
      </button>
      <button
        onClick={onToggleWide}
        title={wide ? 'Switch to standard view' : 'Switch to widescreen view'}
        className={`${iconBtn} hidden md:inline-flex`}
      >
        {wide ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>
      <button onClick={onOpenHelp} title="Help" className={iconBtn}>
        <HelpCircle className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-1.5 bg-black/25 p-1 pl-2.5 rounded-lg border border-white/10">
        <span className="hidden sm:inline text-xs text-blue-100 max-w-[180px] truncate" title={email ?? ''}>
          {email}
        </span>
        <button
          onClick={onSignOut}
          className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-md cursor-pointer transition"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>
    </div>
  </header>
);
