import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Lock,
  Plus,
  Minus,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Package
} from 'lucide-react';
import { InventoryItem } from '../types/inventory';

interface InventoryTableProps {
  items: InventoryItem[];
  globalThreshold: number;
  onStockAdd: (item: InventoryItem) => void;
  onStockSub: (item: InventoryItem) => void;
  onOpenAdjust: (item: InventoryItem) => void;
  isAdmin: boolean;
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
  items,
  globalThreshold,
  onStockAdd,
  onStockSub,
  onOpenAdjust,
  isAdmin
}) => {
  // Pagination state: default 10 rows per page
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Active balloon popup on mobile tap
  const [activeBalloonPn, setActiveBalloonPn] = useState<string | null>(null);

  // Reset to first page when item list changes (e.g. search, filter, store switch)
  useEffect(() => {
    setCurrentPage(1);
  }, [items.length]);

  const getThreshold = (item: InventoryItem) => {
    return item.threshold !== undefined && item.threshold !== null && item.threshold !== 0
      ? item.threshold
      : (item.threshold === 0 ? 0 : globalThreshold);
  };

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const pagedItems = items.slice(startIndex, startIndex + pageSize);

  if (items.length === 0) {
    return (
      <div className="py-16 px-4 text-center text-gray-500 bg-[#f8fafc] border-2 border-dashed border-gray-300 rounded-xl m-4 sm:m-6">
        <Package className="w-12 h-12 mx-auto mb-2 text-gray-400 stroke-1" />
        <h3 className="text-base font-bold text-gray-700">No Inventory Items Found</h3>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Try clearing your search query or add a new part in the Admin panel.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5 flex-1 flex flex-col justify-between">
      {/* Table Container */}
      <div className="overflow-x-auto border-3 border-black rounded-lg shadow-sm bg-white">
        <table className="w-full border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="bg-[#003057] text-white select-none">
              <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] sm:text-xs border-r border-blue-900/60 whitespace-nowrap">
                Part Number
              </th>
              <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] sm:text-xs border-r border-blue-900/60">
                Description
              </th>
              <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] sm:text-xs border-r border-blue-900/60 whitespace-nowrap">
                Location
              </th>
              <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] sm:text-xs border-r border-blue-900/60 text-center whitespace-nowrap min-w-[130px] sm:min-w-[145px]">
                Stock Quantity
              </th>
              <th className="py-2.5 px-2.5 font-bold uppercase tracking-wider text-[11px] sm:text-xs border-r border-blue-900/60 text-center whitespace-nowrap w-14 sm:w-16">
                Min
              </th>
              <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] sm:text-xs text-center whitespace-nowrap">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {pagedItems.map(item => {
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
                  <td className="py-2.5 px-3 font-bold text-gray-950 font-mono border-r border-gray-100 whitespace-nowrap text-xs sm:text-sm">
                    <span>{item.partNumber}</span>
                  </td>

                  {/* Description with Remark Balloon Popup */}
                  <td className="py-2.5 px-3 text-gray-900 font-medium border-r border-gray-100 text-xs sm:text-sm">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{item.description}</span>

                      {/* Remark Balloon Tooltip Indicator */}
                      {item.remarks && item.remarks.trim() !== '' && (
                        <div className="relative inline-flex items-center group/balloon">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setActiveBalloonPn(activeBalloonPn === item.partNumber ? null : item.partNumber);
                            }}
                            title="Hover or tap to view remarks"
                            className="p-0.5 text-[#0066a1] hover:text-[#004e7c] rounded cursor-pointer transition inline-flex items-center"
                          >
                            <MessageSquare className="w-3.5 h-3.5 fill-[#0066a1]/20 text-[#0066a1]" />
                          </button>

                          {/* Floating Balloon Popup */}
                          <div
                            className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-40 w-52 sm:w-64 p-2.5 bg-gray-950 text-white text-[11px] sm:text-xs rounded-lg shadow-2xl border border-gray-700 transition-all duration-150 ${
                              activeBalloonPn === item.partNumber ? 'block' : 'hidden group-hover/balloon:block'
                            }`}
                          >
                            <div className="font-bold text-[10px] text-amber-300 uppercase tracking-wider mb-1 flex items-center justify-between border-b border-gray-800 pb-1">
                              <span>Remark / Note</span>
                              <span className="font-mono text-gray-400">{item.partNumber}</span>
                            </div>
                            <p className="text-gray-200 leading-relaxed font-normal">{item.remarks}</p>
                            {/* Balloon Pointer Arrow */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-950"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Location */}
                  <td className="py-2.5 px-3 text-gray-700 border-r border-gray-100 whitespace-nowrap text-xs">
                    <span className="inline-flex items-center gap-1 font-medium bg-gray-100 px-2 py-0.5 rounded border border-gray-300">
                      <MapPin className="w-3 h-3 text-gray-500 shrink-0" />
                      <span>{item.location}</span>
                    </span>
                  </td>

                  {/* Stock Quantity with [+] and [-] Signs (Admin Protected) */}
                  <td className="py-2.5 px-3 border-r border-gray-100 text-center whitespace-nowrap">
                    <div className="inline-flex items-center justify-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-300 shadow-xs">
                      {/* Minus button (-) */}
                      <button
                        onClick={() => onStockSub(item)}
                        disabled={item.quantity <= 0}
                        title={
                          item.quantity <= 0
                            ? 'Stock is already zero'
                            : isAdmin
                            ? 'Withdraw / Deduct stock (-1)'
                            : 'Withdraw Stock (Requires Admin Password)'
                        }
                        className="w-7 h-7 flex items-center justify-center rounded bg-white hover:bg-red-50 hover:border-red-400 border border-gray-300 text-gray-800 hover:text-red-700 font-bold active:scale-90 transition cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      {/* Quantity Value Badge (Clickable to adjust in Admin Mode) */}
                      <button
                        onClick={() => onOpenAdjust(item)}
                        title={isAdmin ? 'Click to adjust stock' : 'Stock count (Click to adjust - requires Admin Password)'}
                        className={`text-sm sm:text-base font-black px-2.5 py-0.5 rounded min-w-[42px] cursor-pointer transition ${
                          isOut
                            ? 'text-[#c0392b] bg-red-50 hover:bg-red-100'
                            : isLow
                            ? 'text-amber-800 bg-amber-50 hover:bg-amber-100'
                            : 'text-gray-900 bg-white hover:bg-gray-100'
                        }`}
                      >
                        {item.quantity}
                      </button>

                      {/* Plus button (+) */}
                      <button
                        onClick={() => onStockAdd(item)}
                        title={
                          isAdmin
                            ? 'Add stock (+1)'
                            : 'Add Stock (Requires Admin Password)'
                        }
                        className="w-7 h-7 flex items-center justify-center rounded bg-white hover:bg-emerald-50 hover:border-emerald-400 border border-gray-300 text-gray-800 hover:text-emerald-700 font-bold active:scale-90 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      {!isAdmin && (
                        <span title="Action requires Admin Authentication" className="ml-0.5 text-gray-400">
                          <Lock className="w-3 h-3 text-amber-500" />
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Min Column (Narrowed) */}
                  <td className="py-2.5 px-2.5 text-center text-gray-700 font-bold border-r border-gray-100 whitespace-nowrap w-14 sm:w-16 text-xs sm:text-sm">
                    {thr}
                  </td>

                  {/* Status Badge */}
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <span
                      className={`inline-block px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border ${badgeClass}`}
                    >
                      {badgeText}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls - First 10 rows on opening */}
      <div className="mt-3.5 pt-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs select-none">
        <div className="text-gray-600 font-medium">
          Showing <strong className="text-gray-900">{startIndex + 1}</strong> to{' '}
          <strong className="text-gray-900">{Math.min(startIndex + pageSize, items.length)}</strong> of{' '}
          <strong className="text-gray-900">{items.length}</strong> parts
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-100 text-gray-800 font-semibold disabled:opacity-30 disabled:pointer-events-none cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            <span className="px-2.5 py-1 text-gray-700 font-bold">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-100 text-gray-800 font-semibold disabled:opacity-30 disabled:pointer-events-none cursor-pointer flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
