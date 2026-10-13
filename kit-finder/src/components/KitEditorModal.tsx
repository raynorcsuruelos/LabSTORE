import React, { useRef, useState } from 'react';
import { X, AlertCircle, Plus, Trash2, Upload, Loader2, Save } from 'lucide-react';
import type { BomPart, Kit, KitInput } from '../types';
import { createKit, updateKit } from '../api';
import { importBomFile } from '../bom';
import { useToast } from './Toast';

interface KitEditorModalProps {
  kit: Kit | null;
  kits: Kit[];
  onClose: () => void;
  onSaved: (kit: Kit) => void;
}

const DEFAULT_MAINTENANCE = ['SLS', 'WA', 'PM', 'Redress'];
const DEFAULT_LEVELS = ['1', '2', '3', '4', '5'];
const inputClass = 'w-full p-2 border-2 border-black rounded-lg text-sm focus:outline-none focus:border-[#0066a1]';

const uniq = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort();

export const KitEditorModal: React.FC<KitEditorModalProps> = ({ kit, kits, onClose, onSaved }) => {
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<KitInput>(
    kit
      ? { family: kit.family, asset: kit.asset, maintenance: kit.maintenance, level: kit.level, kit: kit.kit, notes: kit.notes, parts: kit.parts.map(p => ({ ...p })) }
      : { family: '', asset: '', maintenance: 'SLS', level: '1', kit: '', notes: '', parts: [] }
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof KitInput>(key: K, value: KitInput[K]) => setForm(f => ({ ...f, [key]: value }));
  const setPart = (i: number, patch: Partial<BomPart>) =>
    setForm(f => ({ ...f, parts: f.parts.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) }));

  const families = uniq(kits.map(k => k.family));
  const assets = uniq(kits.filter(k => !form.family || k.family === form.family).map(k => k.asset));
  const maintenances = uniq([...DEFAULT_MAINTENANCE, ...kits.map(k => k.maintenance)]);
  const levels = uniq([...DEFAULT_LEVELS, ...kits.map(k => k.level)]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parts = await importBomFile(file);
      if (!parts.length) {
        setError('No BOM lines found. Use columns like "Part Number", "Description" and "Quantity".');
        return;
      }
      set('parts', parts);
      setError(null);
      showToast(`Imported ${parts.length} BOM lines from ${file.name}`, 'success');
    } catch {
      setError('Could not read that file. Use Excel (.xlsx/.xls), ODS, CSV or JSON.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = { ...form, parts: form.parts.filter(p => p.partNumber.trim() || p.description.trim()) };
      const saved = kit ? await updateKit(kit.id, payload) : await createKit(payload);
      showToast(kit ? 'Kit updated for all users' : 'Kit added for all users', 'success');
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black rounded-xl max-w-3xl w-full max-h-[92vh] shadow-2xl overflow-hidden animate-pop-in flex flex-col">
        <div className="bg-[#003057] text-white px-5 py-3.5 flex items-center justify-between border-b-3 border-black shrink-0">
          <h3 className="font-bold text-base sm:text-lg">{kit ? `Edit Kit: ${kit.asset}` : 'Add New Kit'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded cursor-pointer transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 overflow-y-auto">
          {error && (
            <div className="p-2.5 bg-red-50 border-2 border-[#c0392b] text-[#c0392b] text-xs font-semibold rounded-lg flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Family *</label>
              <input required list="kf-families" value={form.family} onChange={e => set('family', e.target.value)} placeholder="e.g. Sonic TOOLS" className={inputClass} />
              <datalist id="kf-families">{families.map(v => <option key={v} value={v} />)}</datalist>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Asset Name *</label>
              <input required list="kf-assets" value={form.asset} onChange={e => set('asset', e.target.value)} placeholder="e.g. SPDRS-BA" className={`${inputClass} font-mono`} />
              <datalist id="kf-assets">{assets.map(v => <option key={v} value={v} />)}</datalist>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Maintenance Type *</label>
              <input required list="kf-maint" value={form.maintenance} onChange={e => set('maintenance', e.target.value)} className={inputClass} />
              <datalist id="kf-maint">{maintenances.map(v => <option key={v} value={v} />)}</datalist>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Level *</label>
              <input required list="kf-levels" value={form.level} onChange={e => set('level', e.target.value)} className={inputClass} />
              <datalist id="kf-levels">{levels.map(v => <option key={v} value={v} />)}</datalist>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1">Kit Part Number *</label>
              <input required value={form.kit} onChange={e => set('kit', e.target.value)} placeholder="e.g. 102057866" className={`${inputClass} font-mono font-bold`} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1">Notes (optional)</label>
              <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* BOM editor */}
          <div className="border-2 border-black rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-3 py-2 border-b-2 border-black flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#003057] uppercase tracking-wide">Bill of Materials ({form.parts.length})</span>
              <div className="flex flex-wrap gap-1.5">
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.ods,.csv,.json" onChange={handleImport} className="hidden" />
                <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-xs font-bold rounded-md border-2 border-black cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> Import file
                </button>
                <button type="button" onClick={() => set('parts', [...form.parts, { partNumber: '', description: '', qty: '1' }])} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#1a7a3c] hover:bg-[#145a2c] text-white text-xs font-bold rounded-md border-2 border-black cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> Add line
                </button>
                {form.parts.length > 0 && (
                  <button type="button" onClick={() => set('parts', [])} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-red-50 text-[#c0392b] text-xs font-bold rounded-md border-2 border-black cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" /> Clear
                  </button>
                )}
              </div>
            </div>
            {form.parts.length === 0 ? (
              <div className="p-4 text-xs text-slate-500 text-center">No BOM lines. Add lines by hand or import an Excel, ODS, CSV or JSON file.</div>
            ) : (
              <div className="max-h-[300px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-[#003057] text-white text-[11px] uppercase tracking-wider">
                      <th className="py-1.5 px-2 text-left">Part Number</th>
                      <th className="py-1.5 px-2 text-left">Description</th>
                      <th className="py-1.5 px-2 text-left w-20">Qty</th>
                      <th className="w-9" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.parts.map((p, i) => (
                      <tr key={i} className="border-b border-slate-200">
                        <td className="p-1"><input value={p.partNumber} onChange={e => setPart(i, { partNumber: e.target.value })} className="w-full px-2 py-1 border border-slate-300 rounded font-mono text-xs" /></td>
                        <td className="p-1"><input value={p.description} onChange={e => setPart(i, { description: e.target.value })} className="w-full px-2 py-1 border border-slate-300 rounded text-xs" /></td>
                        <td className="p-1"><input value={p.qty} onChange={e => setPart(i, { qty: e.target.value })} className="w-full px-2 py-1 border border-slate-300 rounded font-mono text-xs" /></td>
                        <td className="p-1 text-center">
                          <button type="button" title="Remove line" onClick={() => set('parts', form.parts.filter((_, idx) => idx !== i))} className="p-1 text-slate-400 hover:text-[#c0392b] cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-white hover:bg-slate-100 text-sm font-bold rounded-lg border-2 border-black cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#003057] hover:bg-[#002240] text-white text-sm font-bold rounded-lg border-2 border-black cursor-pointer shadow-sm active:scale-95 disabled:opacity-60 transition">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {kit ? 'Save Changes' : 'Add Kit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
