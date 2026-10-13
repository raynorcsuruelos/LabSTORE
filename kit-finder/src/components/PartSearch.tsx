import React, { useMemo, useState } from 'react';
import { Search, X, ExternalLink, ArrowRight } from 'lucide-react';
import type { Kit } from '../types';

export const BLUEMM_URL = 'https://fmp.slb.com/pages/logout.html';

interface Hit {
  kit: Kit;
  partNumber: string;
  description: string;
  qty: string;
}

interface PartSearchProps {
  kits: Kit[];
  onPick: (kit: Kit) => void;
}

// Reverse lookup: which kits contain a part number (or match a kit part number)
export const PartSearch: React.FC<PartSearchProps> = ({ kits, onPick }) => {
  const [query, setQuery] = useState('');

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: Hit[] = [];
    for (const kit of kits) {
      const seen = new Set<string>();
      for (const p of kit.parts) {
        if (p.partNumber.toLowerCase().includes(q) && !seen.has(p.partNumber)) {
          seen.add(p.partNumber);
          out.push({ kit, partNumber: p.partNumber, description: p.description, qty: p.qty });
        }
      }
      if (kit.kit.toLowerCase().includes(q)) {
        out.push({
          kit,
          partNumber: kit.kit,
          description: `Kit for ${kit.asset} (${kit.maintenance} Level ${kit.level})`,
          qty: '1 Kit'
        });
      }
    }
    return out.slice(0, 200);
  }, [kits, query]);

  const q = query.trim();

  return (
    <section className="p-5 sm:p-6 bg-white">
      <h2 className="text-sm sm:text-base font-bold text-[#003057] uppercase tracking-wide flex items-center gap-2 mb-3">
        <Search className="w-4 h-4 text-[#0066a1]" />
        <span>Search by Part Number</span>
      </h2>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Enter part # to find kit(s) and quantity across all tools..."
            className="w-full pl-4 pr-10 py-3 text-base border-3 border-black rounded-lg focus:outline-none focus:border-[#0066a1] shadow-sm font-medium"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              title="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-black hover:bg-gray-200 rounded-md cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <a
          href={BLUEMM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-[#0066a1] hover:bg-[#00558a] text-white text-sm font-bold rounded-lg border-2 border-black shadow-sm active:scale-95 transition whitespace-nowrap"
        >
          Check QTY in BlueMM <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {q.length >= 2 && (
        <div className="mt-3 border-2 border-black rounded-lg overflow-hidden animate-pop-in">
          <div className="bg-slate-100 px-3 py-2 border-b-2 border-black text-xs font-bold text-slate-700">
            {hits.length === 0 ? (
              <span>
                No kit contains part <span className="font-mono text-black">“{q}”</span>.{' '}
                <a href={BLUEMM_URL} target="_blank" rel="noopener noreferrer" className="text-[#0066a1] underline">
                  Verify availability in BlueMM ↗
                </a>
              </span>
            ) : (
              <span>
                Results for <span className="font-mono text-black">“{q}”</span>:{' '}
                <span className="text-[#0066a1]">
                  {hits.length} {hits.length === 1 ? 'match' : 'matches'}
                </span>
              </span>
            )}
          </div>
          {hits.length > 0 && (
            <ul className="max-h-[320px] overflow-y-auto divide-y divide-slate-200">
              {hits.map((h, i) => (
                <li key={`${h.kit.id}-${h.partNumber}-${i}`}>
                  <button
                    onClick={() => onPick(h.kit)}
                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span className="uppercase font-bold text-slate-500 text-[10px]">Kit #</span>
                        <span className="font-mono font-bold text-[#003057] break-all">{h.kit.kit}</span>
                        <span className="text-slate-300">•</span>
                        <span className="uppercase font-bold text-slate-500 text-[10px]">Qty in kit</span>
                        <span className="font-mono font-bold text-[#1a7a3c]">{h.qty}</span>
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        {h.kit.asset}{' '}
                        <span className="font-normal text-xs text-slate-500">
                          ({h.kit.family} • {h.kit.maintenance} Level {h.kit.level})
                        </span>
                      </div>
                      <div className="text-xs text-slate-600">
                        <span className="font-mono">{h.partNumber}</span>
                        {h.description && ` — ${h.description}`}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#0066a1] shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};
