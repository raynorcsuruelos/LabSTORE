import React, { useState } from 'react';
import { X, BarChart3, Clock, Trash2, Search, ArrowUpRight } from 'lucide-react';
import { HistoryEntry } from '../types/inventory';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  onClearHistory: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onClearHistory
}) => {
  if (!isOpen) return null;

  const [searchFilter, setSearchFilter] = useState('');

  // Calculate usage trends (parts withdrawn or subtracted)
  const trendsMap: Record<string, { desc: string; totalWithdrawn: number }> = {};
  history.forEach(entry => {
    const act = (entry.action || '').toLowerCase();
    if (act.includes('withdraw') || act.includes('sub') || act.includes('quick -1')) {
      const pn = entry.partNumber;
      if (!trendsMap[pn]) {
        trendsMap[pn] = { desc: entry.description, totalWithdrawn: 0 };
      }
      const qtyNum = typeof entry.qty === 'number' ? entry.qty : parseInt(String(entry.qty), 10) || 0;
      trendsMap[pn].totalWithdrawn += qtyNum;
    }
  });

  const sortedTrends = Object.entries(trendsMap)
    .sort((a, b) => b[1].totalWithdrawn - a[1].totalWithdrawn)
    .slice(0, 8);

  const maxWithdrawn = sortedTrends.length > 0 ? Math.max(...sortedTrends.map(t => t[1].totalWithdrawn), 1) : 1;

  const filteredHistory = history.filter(h => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      h.partNumber.toLowerCase().includes(q) ||
      h.description.toLowerCase().includes(q) ||
      h.action.toLowerCase().includes(q) ||
      (h.note || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black rounded-xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-[#003057] text-white px-5 py-3.5 flex items-center justify-between border-b-3 border-black">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base sm:text-lg">Inventory History &amp; Usage Trends</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded cursor-pointer transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-6">
          {/* Trends Section */}
          <div>
            <h4 className="text-xs font-bold text-[#003057] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4 text-blue-600" />
              <span>Usage Trends (Top Withdrawn &amp; Consumed Items)</span>
            </h4>

            {sortedTrends.length === 0 ? (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 text-center">
                No withdrawal or deduction transactions logged yet.
              </div>
            ) : (
              <div className="space-y-2 bg-[#f8fafc] p-3.5 rounded-lg border-2 border-gray-200">
                {sortedTrends.map(([pn, item]) => {
                  const pct = Math.round((item.totalWithdrawn / maxWithdrawn) * 100);
                  return (
                    <div key={pn} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-gray-900 font-mono">
                          {pn} <span className="font-normal text-gray-600 font-sans">— {item.desc}</span>
                        </span>
                        <span className="font-bold text-[#0066a1]">{item.totalWithdrawn} units consumed</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden border border-gray-300">
                        <div
                          className="bg-[#0066a1] h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pct, 4)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Audit Log / History */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <h4 className="text-xs font-bold text-[#003057] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>Transaction &amp; Stock Audit Log ({history.length})</span>
              </h4>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter log..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="pl-7 pr-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-[#0066a1]"
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="border-2 border-gray-300 rounded-lg max-h-72 overflow-y-auto divide-y divide-gray-200 bg-white text-xs">
              {filteredHistory.length === 0 ? (
                <div className="p-6 text-center text-gray-400">No transaction records match.</div>
              ) : (
                filteredHistory.map(entry => (
                  <div key={entry.id || Math.random()} className="p-2.5 hover:bg-gray-50 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-black">{entry.partNumber}</span>
                        <span className="font-medium text-gray-700">{entry.description}</span>
                        <span className="px-1.5 py-0.2 rounded bg-gray-100 text-gray-700 border border-gray-300 text-[10px] font-semibold">
                          {entry.action}
                        </span>
                      </div>
                      <div className="text-gray-500 text-[11px] mt-0.5">
                        {entry.qty !== '' && <span className="font-semibold text-gray-700">Qty: {entry.qty} · </span>}
                        <span>{entry.note || 'No notes provided'}</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-400 whitespace-nowrap">
                      {new Date(entry.ts).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-gray-100 border-t border-gray-300 flex justify-between items-center">
          <button
            onClick={onClearHistory}
            className="px-3 py-1.5 bg-[#c0392b] hover:bg-[#962d22] text-white text-xs font-bold rounded border border-black cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-black text-white text-xs font-bold rounded border border-black cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
