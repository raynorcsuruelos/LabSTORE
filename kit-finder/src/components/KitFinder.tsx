import React, { useEffect, useMemo } from 'react';
import { Search, Copy, ClipboardList, Pencil, Trash2, PackageX, StickyNote } from 'lucide-react';
import type { Kit } from '../types';
import { copyText } from '../bom';
import { useToast } from './Toast';
import { BomViewer } from './BomViewer';

export interface Selection {
  family: string;
  asset: string;
  maintenance: string;
  level: string;
}

export const EMPTY_SELECTION: Selection = { family: '', asset: '', maintenance: '', level: '' };

const uniqSorted = (values: string[]) =>
  Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

interface KitFinderProps {
  kits: Kit[];
  selection: Selection;
  onSelect: (s: Selection) => void;
  isAdmin: boolean;
  bomKitId: string | null;
  onToggleBom: (kitId: string) => void;
  onEdit: (kit: Kit) => void;
  onDelete: (kit: Kit) => void;
}

const selectClass =
  'w-full p-2.5 border-2 border-black rounded-lg text-sm font-semibold bg-white focus:outline-none focus:border-[#0066a1] disabled:bg-slate-100 disabled:text-slate-400 cursor-pointer disabled:cursor-not-allowed';

export const KitFinder: React.FC<KitFinderProps> = ({
  kits,
  selection,
  onSelect,
  isAdmin,
  bomKitId,
  onToggleBom,
  onEdit,
  onDelete
}) => {
  const { showToast } = useToast();
  const { family, asset, maintenance, level } = selection;

  const families = useMemo(() => uniqSorted(kits.map(k => k.family)), [kits]);
  const assets = useMemo(() => uniqSorted(kits.filter(k => k.family === family).map(k => k.asset)), [kits, family]);
  const maintenances = useMemo(
    () => uniqSorted(kits.filter(k => k.family === family && k.asset === asset).map(k => k.maintenance)),
    [kits, family, asset]
  );
  const levels = useMemo(
    () =>
      uniqSorted(
        kits.filter(k => k.family === family && k.asset === asset && k.maintenance === maintenance).map(k => k.level)
      ),
    [kits, family, asset, maintenance]
  );

  // Picks the only available option automatically, like the original finder
  useEffect(() => {
    if (family && !asset && assets.length === 1) onSelect({ ...selection, asset: assets[0] });
    else if (asset && !maintenance && maintenances.length === 1) onSelect({ ...selection, maintenance: maintenances[0] });
    else if (maintenance && !level && levels.length === 1) onSelect({ ...selection, level: levels[0] });
  }, [selection, assets, maintenances, levels, onSelect]);

  // Usually one kit; a few legacy combinations have more than one, so all of them are shown
  const matches =
    family && asset && maintenance && level
      ? kits.filter(k => k.family === family && k.asset === asset && k.maintenance === maintenance && k.level === level)
      : [];

  const handleCopy = async (kit: Kit) => {
    showToast((await copyText(kit.kit)) ? `Copied ${kit.kit}` : 'Could not copy to clipboard', 'success');
  };

  return (
    <section className="p-5 sm:p-6 border-b-4 border-black bg-white">
      <h2 className="text-sm sm:text-base font-bold text-[#003057] uppercase tracking-wide flex items-center gap-2 mb-3">
        <Search className="w-4 h-4 text-[#0066a1]" />
        <span>Find a Maintenance Kit</span>
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="block">
          <span className="block text-xs font-bold text-gray-700 mb-1">Family</span>
          <select
            className={selectClass}
            value={family}
            onChange={e => onSelect({ ...EMPTY_SELECTION, family: e.target.value })}
          >
            <option value="">Select Family</option>
            {families.map(f => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-bold text-gray-700 mb-1">Asset Name</span>
          <select
            className={selectClass}
            value={asset}
            disabled={!family}
            onChange={e => onSelect({ family, asset: e.target.value, maintenance: '', level: '' })}
          >
            <option value="">Select Asset</option>
            {assets.map(a => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-bold text-gray-700 mb-1">Maintenance Type</span>
          <select
            className={selectClass}
            value={maintenance}
            disabled={!asset}
            onChange={e => onSelect({ family, asset, maintenance: e.target.value, level: '' })}
          >
            <option value="">Select Maintenance Type</option>
            {maintenances.map(m => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-bold text-gray-700 mb-1">Level</span>
          <select
            className={selectClass}
            value={level}
            disabled={!maintenance}
            onChange={e => onSelect({ family, asset, maintenance, level: e.target.value })}
          >
            <option value="">Select Level</option>
            {levels.map(l => (
              <option key={l} value={l}>
                Level {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 space-y-4">
        {matches.length === 0 ? (
          <div className="p-6 border-2 border-dashed border-slate-300 rounded-xl text-center text-sm text-slate-500 bg-slate-50">
            {family && asset && maintenance && level
              ? 'No kit found for this combination.'
              : 'Select a family, asset, maintenance type and level to see the kit part number.'}
          </div>
        ) : (
          matches.map(found => {
            const noKitAvailable = !/\d/.test(found.kit);
            const showBom = bomKitId === found.id;
            return (
          <div key={found.id} className="border-4 border-black rounded-xl overflow-hidden shadow-lg animate-pop-in">
            <div className="bg-[#003057] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b-3 border-black">
              <div className="font-bold text-base sm:text-lg">
                {found.asset}
                {matches.length > 1 && (
                  <span className="ml-2 text-[10px] font-mono uppercase bg-amber-400 text-black px-1.5 py-0.5 rounded align-middle">
                    {matches.indexOf(found) + 1} of {matches.length}
                  </span>
                )}
              </div>
              <div className="text-xs text-blue-200 font-mono">
                {found.family} · {found.maintenance} · Level {found.level}
              </div>
            </div>
            <div className="p-4 sm:p-5 bg-white">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Kit Part Number</div>
              <div
                className={`font-mono font-extrabold break-words ${
                  noKitAvailable
                    ? 'text-base sm:text-lg text-[#c0392b] flex items-start gap-2'
                    : 'text-3xl sm:text-4xl text-[#003057] tracking-wide'
                }`}
              >
                {noKitAvailable && <PackageX className="w-5 h-5 shrink-0 mt-0.5" />}
                {found.kit}
              </div>
              {found.notes && (
                <div className="mt-3 p-2.5 bg-amber-50 border-2 border-amber-300 rounded-lg text-sm text-amber-900 flex items-start gap-2">
                  <StickyNote className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="whitespace-pre-wrap">{found.notes}</span>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => handleCopy(found)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#003057] hover:bg-[#002240] text-white text-sm font-bold rounded-lg border-2 border-black cursor-pointer shadow-sm active:scale-95 transition"
                >
                  <Copy className="w-4 h-4" /> Copy Part Number
                </button>
                <button
                  onClick={() => onToggleBom(found.id)}
                  className={`relative inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold rounded-lg border-2 border-black cursor-pointer shadow-sm active:scale-95 transition ${
                    showBom ? 'bg-amber-400 text-black' : 'bg-white hover:bg-amber-50 text-[#003057]'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" /> BOM
                  {found.parts.length > 0 && (
                    <span className="ml-0.5 text-[10px] font-mono bg-[#1a7a3c] text-white px-1.5 py-0.5 rounded">
                      {found.parts.length}
                    </span>
                  )}
                </button>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => onEdit(found)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0066a1] hover:bg-[#00558a] text-white text-sm font-bold rounded-lg border-2 border-black cursor-pointer shadow-sm active:scale-95 transition"
                    >
                      <Pencil className="w-4 h-4" /> Edit Kit
                    </button>
                    <button
                      onClick={() => onDelete(found)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#c0392b] hover:bg-[#a5301f] text-white text-sm font-bold rounded-lg border-2 border-black cursor-pointer shadow-sm active:scale-95 transition"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </>
                )}
              </div>

              {showBom && (
                <div className="mt-4">
                  <BomViewer kit={found} isAdmin={isAdmin} onEdit={() => onEdit(found)} />
                </div>
              )}
            </div>
          </div>
            );
          })
        )}
      </div>
    </section>
  );
};
