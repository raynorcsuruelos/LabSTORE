import React from 'react';
import { AlertTriangle, X, ExternalLink, CheckCircle } from 'lucide-react';
import { InventoryItem } from '../types/inventory';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  lowStockItems: InventoryItem[];
  globalThreshold: number;
  onOpenAllAlerts: () => void;
  onQuickAdjust: (item: InventoryItem) => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
  lowStockItems,
  globalThreshold,
  onOpenAllAlerts,
  onQuickAdjust
}) => {
  if (!isOpen) return null;

  const thresholdOf = (item: InventoryItem) => {
    return item.threshold !== undefined && item.threshold !== null && item.threshold !== 0
      ? item.threshold
      : (item.threshold === 0 ? 0 : globalThreshold);
  };

  const previewItems = lowStockItems.slice(0, 5);

  return (
    <div className="bg-[#fff9e6] border-b-4 border-black px-5 py-3.5 transition-all text-[#5a3200] shadow-inner">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-300 flex-wrap gap-2">
        <div className="flex items-center gap-2 font-bold text-amber-900 text-sm sm:text-base">
          <AlertTriangle className="w-5 h-5 text-amber-600 animate-pulse" />
          <span>Low-Stock &amp; Out-of-Stock Alerts ({lowStockItems.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAllAlerts}
            className="text-xs font-semibold px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-black rounded border border-black cursor-pointer shadow-sm flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Show All Alerts</span>
          </button>
          <button
            onClick={onClose}
            className="p-1 text-amber-900 hover:text-black hover:bg-amber-200 rounded cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {lowStockItems.length === 0 ? (
        <div className="py-2 text-sm flex items-center gap-2 text-emerald-800">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>All Wireline inventory stock levels are healthy!</span>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-amber-200 text-xs sm:text-sm">
          {previewItems.map(item => {
            const minT = thresholdOf(item);
            const isOut = item.quantity <= 0;
            return (
              <div key={item.partNumber} className="py-1.5 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${isOut ? 'bg-[#c0392b]' : 'bg-[#e67e22]'}`} />
                  <span className="font-bold text-black">{item.partNumber}</span>
                  <span className="text-gray-700 hidden sm:inline">— {item.description}</span>
                  <span className="text-gray-500 text-xs">({item.location})</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className={`font-bold ${isOut ? 'text-[#c0392b]' : 'text-amber-800'}`}>
                    Qty: {item.quantity} <span className="font-normal text-xs text-gray-600">(min: {minT})</span>
                  </span>
                  <button
                    onClick={() => onQuickAdjust(item)}
                    className="px-2 py-0.5 bg-[#0066a1] hover:bg-[#004e7c] text-white rounded text-xs font-medium border border-black cursor-pointer"
                  >
                    Adjust
                  </button>
                </div>
              </div>
            );
          })}
          {lowStockItems.length > 5 && (
            <div className="pt-2 text-xs text-amber-800 flex justify-between items-center">
              <span>...and {lowStockItems.length - 5} more parts require attention.</span>
              <button
                onClick={onOpenAllAlerts}
                className="underline font-bold text-[#0066a1] hover:text-[#004e7c] cursor-pointer"
              >
                View all {lowStockItems.length} alerts &rarr;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
