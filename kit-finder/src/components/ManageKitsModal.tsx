import React, { useMemo, useState } from 'react';
import { X, Pencil, Trash2, Search } from 'lucide-react';
import type { Kit } from '../types';

interface ManageKitsModalProps {
  kits: Kit[];
  onClose: () => void;
  onEdit: (kit: Kit) => void;
  onDelete: (kit: Kit) => void;
}

export const ManageKitsModal: React.FC<ManageKitsModalProps> = ({ kits, onClose, onEdit, onDelete }) => {
  const [filter, setFilter] = useState('');

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const sorted = [...kits].sort((a, b) =>
      `${a.family} ${a.asset} ${a.maintenance} ${a.level}`.localeCompare(`${b.family} ${b.asset} ${b.maintenance} ${b.level}`, undefined, { numeric: true })
    );
    if (!q) return sorted;
    return sorted.filter(k => `${k.family} ${k.asset} ${k.maintenance} ${k.level} ${k.kit}`.toLowerCase().includes(q));
  }, [kits, filter]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black rounded-xl max-w-4xl w-full max-h-[92vh] shadow-2xl overflow-hidden animate-pop-in flex flex-col">
        <div className="bg-[#003057] text-white px-5 py-3.5 flex items-center justify-between border-b-3 border-black shrink-0">
          <h3 className="font-bold text-base sm:text-lg">Manage Kits ({kits.length})</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded cursor-pointer transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-3 border-b-2 border-black flex items-center gap-2 shrink-0">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            autoFocus
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by family, asset, maintenance, level or kit #..."
            className="flex-1 text-sm py-1.5 outline-none"
          />
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="sticky top-0">
              <tr className="bg-[#003057] text-white text-[11px] uppercase tracking-wider">
                <th className="py-2 px-3">Family</th>
                <th className="py-2 px-3">Asset</th>
                <th className="py-2 px-3">Maint.</th>
                <th className="py-2 px-3">Level</th>
                <th className="py-2 px-3">Kit #</th>
                <th className="py-2 px-3 text-center">BOM</th>
                <th className="py-2 px-3 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(k => (
                <tr key={k.id} className="border-b border-slate-200 odd:bg-white even:bg-slate-50 hover:bg-blue-50">
                  <td className="py-1.5 px-3 text-xs">{k.family}</td>
                  <td className="py-1.5 px-3 font-mono font-bold text-[#003057]">{k.asset}</td>
                  <td className="py-1.5 px-3 text-xs">{k.maintenance}</td>
                  <td className="py-1.5 px-3 text-xs">{k.level}</td>
                  <td className="py-1.5 px-3 font-mono text-xs max-w-[240px] truncate" title={k.kit}>{k.kit}</td>
                  <td className="py-1.5 px-3 text-center text-xs font-mono">{k.parts.length || '—'}</td>
                  <td className="py-1.5 px-3">
                    <div className="flex justify-center gap-1">
                      <button title="Edit" onClick={() => onEdit(k)} className="p-1.5 rounded border-2 border-black bg-white hover:bg-blue-100 cursor-pointer">
                        <Pencil className="w-3.5 h-3.5 text-[#0066a1]" />
                      </button>
                      <button title="Delete" onClick={() => onDelete(k)} className="p-1.5 rounded border-2 border-black bg-white hover:bg-red-100 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5 text-[#c0392b]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-xs text-slate-500">No kits match.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
