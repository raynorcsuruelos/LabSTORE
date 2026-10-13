import React, { useMemo, useState } from 'react';
import { Copy, FileSpreadsheet, FileJson, X, Filter, Upload } from 'lucide-react';
import type { Kit } from '../types';
import { bomAsText, copyText, exportBom } from '../bom';
import { useToast } from './Toast';

interface BomViewerProps {
  kit: Kit;
  isAdmin: boolean;
  onEdit: () => void;
}

const smallBtn =
  'inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-[#003057] text-xs font-bold rounded-md border-2 border-black cursor-pointer active:scale-95 transition';

export const BomViewer: React.FC<BomViewerProps> = ({ kit, isAdmin, onEdit }) => {
  const { showToast } = useToast();
  const [filter, setFilter] = useState('');

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return kit.parts;
    return kit.parts.filter(p => `${p.partNumber} ${p.description}`.toLowerCase().includes(q));
  }, [kit.parts, filter]);

  if (kit.parts.length === 0) {
    return (
      <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 text-sm text-slate-600 flex flex-wrap items-center justify-between gap-2">
        <span>No BOM has been added for this kit yet.</span>
        {isAdmin && (
          <button onClick={onEdit} className={smallBtn}>
            <Upload className="w-3.5 h-3.5" /> Add BOM
          </button>
        )}
      </div>
    );
  }

  const handleExport = async (format: 'xlsx' | 'ods' | 'json') => {
    try {
      await exportBom(kit, format);
    } catch {
      showToast('Export failed', 'error');
    }
  };

  return (
    <div className="border-2 border-black rounded-lg overflow-hidden">
      <div className="bg-slate-100 px-3 py-2 border-b-2 border-black flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold text-[#003057] uppercase tracking-wide">
          Bill of Materials · {kit.parts.length} {kit.parts.length === 1 ? 'line' : 'lines'}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            className={smallBtn}
            onClick={async () => showToast((await copyText(bomAsText(kit))) ? 'BOM copied' : 'Could not copy', 'success')}
          >
            <Copy className="w-3.5 h-3.5" /> Copy
          </button>
          <button className={smallBtn} onClick={() => handleExport('xlsx')}>
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#1a7a3c]" /> Excel
          </button>
          <button className={smallBtn} onClick={() => handleExport('ods')}>
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#0066a1]" /> ODS
          </button>
          <button className={smallBtn} onClick={() => handleExport('json')}>
            <FileJson className="w-3.5 h-3.5 text-amber-600" /> JSON
          </button>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-slate-200 flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-slate-400" />
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter BOM by part # or description..."
          className="flex-1 text-sm py-1 outline-none bg-transparent"
        />
        {filter && (
          <button onClick={() => setFilter('')} className="p-0.5 text-slate-500 hover:text-black cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-sm text-left">
          <thead className="sticky top-0">
            <tr className="bg-[#003057] text-white select-none">
              <th className="py-2 px-3 font-bold uppercase tracking-wider text-[11px] border-r border-blue-900/60 w-10">#</th>
              <th className="py-2 px-3 font-bold uppercase tracking-wider text-[11px] border-r border-blue-900/60">Part Number</th>
              <th className="py-2 px-3 font-bold uppercase tracking-wider text-[11px] border-r border-blue-900/60">Description</th>
              <th className="py-2 px-3 font-bold uppercase tracking-wider text-[11px] text-center w-20">Qty</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={i} className="border-b border-slate-200 odd:bg-white even:bg-slate-50 hover:bg-blue-50">
                <td className="py-1.5 px-3 text-xs text-slate-400 font-mono">{kit.parts.indexOf(p) + 1}</td>
                <td className="py-1.5 px-3 font-mono font-bold text-[#003057]">{p.partNumber}</td>
                <td className="py-1.5 px-3 text-slate-700">{p.description}</td>
                <td className="py-1.5 px-3 text-center font-mono font-bold">{p.qty}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-xs text-slate-500">
                  No BOM lines match “{filter}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
