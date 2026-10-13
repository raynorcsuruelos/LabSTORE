import React, { useCallback, useEffect, useState } from 'react';
import { logout, type User } from '@netlify/identity';
import { Loader2, AlertTriangle } from 'lucide-react';
import { AuthGate } from './components/LoginScreen';
import { ToastProvider, useToast } from './components/Toast';
import { Header } from './components/Header';
import { KitFinder, EMPTY_SELECTION, type Selection } from './components/KitFinder';
import { PartSearch } from './components/PartSearch';
import { KitEditorModal } from './components/KitEditorModal';
import { ManageKitsModal } from './components/ManageKitsModal';
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal';
import { HelpModal } from './components/HelpModal';
import { fetchKits, deleteKit, ApiError } from './api';
import type { Kit } from './types';

const WIDE_KEY = 'wl_kit_finder_widescreen';

const selectionOf = (k: Kit): Selection => ({ family: k.family, asset: k.asset, maintenance: k.maintenance, level: k.level });

const KitFinderApp: React.FC<{ user: User }> = ({ user }) => {
  const { showToast } = useToast();
  const [kits, setKits] = useState<Kit[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [bomKitId, setBomKitId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Kit | null | undefined>(undefined); // undefined = closed, null = new kit
  const [managing, setManaging] = useState(false);
  const [deleting, setDeleting] = useState<Kit | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [wide, setWide] = useState(() => localStorage.getItem(WIDE_KEY) === 'true');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchKits();
      setKits(res.kits);
      setIsAdmin(res.isAdmin);
      setLoadError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await logout().catch(() => {});
        return;
      }
      setLoadError(err instanceof Error ? err.message : 'Could not load kits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    localStorage.setItem(WIDE_KEY, String(wide));
  }, [wide]);

  const handleSelect = useCallback((s: Selection) => {
    setSelection(s);
    setBomKitId(null);
  }, []);

  const handleSaved = async (saved: Kit) => {
    setEditing(undefined);
    await load();
    setSelection(selectionOf(saved));
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteKit(deleting.id);
      showToast('Kit deleted for all users', 'success');
      setDeleting(null);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#e9edf2] flex flex-col items-center p-0 sm:py-3 sm:px-2">
      <div
        className={`w-full ${wide ? 'max-w-[1600px]' : 'max-w-[1150px]'} bg-white border-x-0 sm:border-4 border-black min-h-screen sm:min-h-0 sm:rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all`}
      >
        <Header
          kitCount={kits.length}
          email={user.email ?? null}
          isAdmin={isAdmin}
          wide={wide}
          loading={loading}
          onToggleWide={() => setWide(w => !w)}
          onRefresh={load}
          onAddKit={() => setEditing(null)}
          onManageKits={() => setManaging(true)}
          onOpenHelp={() => setHelpOpen(true)}
          onSignOut={() => logout().catch(() => {})}
        />

        {loadError && (
          <div className="m-4 p-3 bg-red-50 border-2 border-[#c0392b] text-[#c0392b] text-sm font-semibold rounded-lg flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {loadError}
            </span>
            <button onClick={load} className="px-3 py-1 bg-white border-2 border-black rounded-md text-black text-xs cursor-pointer">
              Retry
            </button>
          </div>
        )}

        {loading && kits.length === 0 ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#003057]" />
          </div>
        ) : (
          <>
            <KitFinder
              kits={kits}
              selection={selection}
              onSelect={handleSelect}
              isAdmin={isAdmin}
              bomKitId={bomKitId}
              onToggleBom={id => setBomKitId(cur => (cur === id ? null : id))}
              onEdit={k => setEditing(k)}
              onDelete={k => setDeleting(k)}
            />
            <PartSearch
              kits={kits}
              onPick={k => {
                setSelection(selectionOf(k));
                setBomKitId(k.parts.length > 0 ? k.id : null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </>
        )}

        <footer className="mt-auto bg-slate-100 border-t-4 border-black px-4 py-2 text-[11px] text-slate-600 flex flex-wrap justify-between gap-2">
          <span>WL Kit Finder · {kits.length} kits · Netlify Database</span>
          <span className="font-mono">{isAdmin ? 'ADMIN' : 'VIEWER'}</span>
        </footer>
      </div>

      {editing !== undefined && (
        <KitEditorModal kit={editing} kits={kits} onClose={() => setEditing(undefined)} onSaved={handleSaved} />
      )}
      {managing && (
        <ManageKitsModal
          kits={kits}
          onClose={() => setManaging(false)}
          onEdit={k => setEditing(k)}
          onDelete={k => setDeleting(k)}
        />
      )}
      {deleting && <ConfirmDeleteModal kit={deleting} onCancel={() => setDeleting(null)} onConfirm={handleDelete} />}
      {helpOpen && <HelpModal isAdmin={isAdmin} onClose={() => setHelpOpen(false)} />}
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AuthGate>{user => <KitFinderApp user={user} />}</AuthGate>
    </ToastProvider>
  );
}
