import React from 'react';
import { Edit3, MapPin, Lock, ShieldCheck } from 'lucide-react';
import { InventoryItem } from '../types/inventory';

interface InventoryTableProps {
  items: InventoryItem[];
  globalThreshold: number;
  onOpenAdjust: (item: InventoryItem) => void;
  onQuickWithdraw: (item: InventoryItem) => void;
  onOpenEdit: (item: InventoryItem) => void;
  isAdmin: boolean;
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
  items,
  globalThreshold,
  onOpenAdjust,
  onQuickWithdraw,
  onOpenEdit,
  isAdmin
}) => {
  const getThreshold = (item: InventoryItem) => {
    return item.threshold !== undefined && item.threshold !== null && item.threshold !== 0
      ? item.threshold
      : (item.threshold === 0 ? 0 : globalThreshold);
  };

  if (items.length === 0) {
    return (
      <div className="py-20 text-center text-gray-500 bg-[#f8fafc] border-2 border-dashed border-gray-300 rounded-xl m-6">
        <div className="text-4xl mb-2">📦</div>
        <h3 className="text-base font-bold text-gray-700">No Inventory Items Found</h3>
        <p className="text-sm text-gray-500 mt-1">Try clearing your search query or add a new part in the Admin panel.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 flex-1">
      <div className="overflow-x-auto border-3 border-black rounded-lg shadow-sm bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-[#003057] text-white">
              <th className="py-3 px-3.5 font-bold uppercase tracking-wider text-xs border-r border-blue-900/60 whitespace-nowrap">
                Part Number
              </th>
              <th className="py-3 px-3.5 font-bold uppercase tracking-wider text-xs border-r border-blue-900/60">
                Description
              </th>
              <th className="py-3 px-3.5 font-bold uppercase tracking-wider text-xs border-r border-blue-900/60 whitespace-nowrap">
                Location
              </th>
              <th className="py-3 px-3.5 font-bold uppercase tracking-wider text-xs border-r border-blue-900/60 text-center whitespace-nowrap min-w-[120px]">
                Stock Quantity
              </th>
              <th className="py-3 px-3.5 font-bold uppercase tracking-wider text-xs border-r border-blue-900/60 text-center whitespace-nowrap">
                Min Threshold
              </th>
              <th className="py-3 px-3.5 font-bold uppercase tracking-wider text-xs border-r border-blue-900/60 whitespace-nowrap">
                Status
              </th>
              <th className="py-3 px-3.5 font-bold uppercase tracking-wider text-xs border-r border-blue-900/60">
                Remarks / Notes
              </th>
              <th className="py-3 px-3.5 font-bold uppercase tracking-wider text-xs text-center whitespace-nowrap min-w-[170px]">
                <div className="flex items-center justify-center gap-1">
                  {isAdmin ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" /> : <Lock className="w-3.5 h-3.5 text-amber-300" />}
                  <span>Quick Actions {isAdmin ? '(Admin Active)' : '(Admin Protected)'}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map(item => {
              const thr = getThreshold(item);
              const isOut = item.quantity <= 0;
              const isLow = !isOut && item.quantity <= thr;

              let badgeClass = 'bg-emerald-100 text-[#1a7a3c] border-emerald-400';
              let badgeText = 'In Stock';

              if (isOut) {
                badgeClass = 'bg-red-100 text-[#c0392b] border-red-400';
                badgeText = 'Out of Stock';
              } else if (isLow) {
                badgeClass = 'bg-amber-100 text-[#d97706] border-amber-400';
                badgeText = 'Low Stock';
              }

              return (
                <tr
                  key={item.partNumber}
                  className="hover:bg-[#f0f7fd] transition-colors group"
                >
                  {/* Part Number */}
                  <td className="py-3 px-3.5 font-bold text-gray-950 font-mono border-r border-gray-100 whitespace-nowrap">
                    <span>{item.partNumber}</span>
                  </td>

                  {/* Description */}
                  <td className="py-3 px-3.5 text-gray-900 font-medium border-r border-gray-100">
                    {item.description}
                  </td>

                  {/* Location */}
                  <td className="py-3 px-3.5 text-gray-700 border-r border-gray-100 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-gray-100 px-2 py-0.5 rounded border border-gray-300">
                      <MapPin className="w-3 h-3 text-gray-500" />
                      {item.location}
                    </span>
                  </td>

                  {/* Actual Stock Quantity Only - No + or - Steppers */}
                  <td className="py-3 px-3.5 border-r border-gray-100 text-center whitespace-nowrap">
                    <span
                      className={`text-base font-bold px-3 py-1 rounded-md inline-block min-w-[50px] shadow-xs ${
                        isOut
                          ? 'text-[#c0392b] bg-red-50 border border-red-200 font-black'
                          : isLow
                          ? 'text-amber-800 bg-amber-50 border border-amber-200'
                          : 'text-gray-900 bg-gray-50 border border-gray-200'
                      }`}
                    >
                      {item.quantity}
                    </span>
                  </td>

                  {/* Min Threshold */}
                  <td className="py-3 px-3.5 text-center text-gray-600 font-semibold border-r border-gray-100 whitespace-nowrap">
                    {thr}
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-3.5 border-r border-gray-100 whitespace-nowrap">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border-1.5 ${badgeClass}`}
                    >
                      {badgeText}
                    </span>
                  </td>

                  {/* Remarks */}
                  <td className="py-3 px-3.5 text-gray-500 italic text-xs border-r border-gray-100 max-w-[200px] truncate" title={item.remarks}>
                    {item.remarks || '—'}
                  </td>

                  {/* Quick Actions (Admin Controlled) */}
                  <td className="py-3 px-3.5 text-center whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => onOpenAdjust(item)}
                        title={isAdmin ? "Adjust Stock Quantity or Threshold" : "Adjust Stock (Requires Admin Password)"}
                        className="px-2.5 py-1 text-xs font-semibold bg-[#0066a1] hover:bg-[#004e7c] text-white rounded border border-black cursor-pointer shadow-xs active:scale-95 transition flex items-center gap-1"
                      >
                        {!isAdmin && <Lock className="w-3 h-3 text-amber-200" />}
                        <span>Adjust</span>
                      </button>

                      <button
                        onClick={() => onQuickWithdraw(item)}
                        disabled={item.quantity <= 0}
                        title={
                          item.quantity <= 0
                            ? "Stock is already zero"
                            : isAdmin
                            ? "Withdraw all remaining stock (set to 0)"
                            : "Withdraw Stock (Requires Admin Password)"
                        }
                        className="px-2 py-1 text-xs font-semibold bg-[#c0392b] hover:bg-[#962d22] text-white rounded border border-black cursor-pointer shadow-xs active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1"
                      >
                        {!isAdmin && <Lock className="w-3 h-3 text-red-200" />}
                        <span>Withdraw</span>
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => onOpenEdit(item)}
                          title="Admin Edit Part Metadata"
                          className="p-1 text-gray-600 hover:text-black hover:bg-gray-200 rounded border border-gray-300 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
