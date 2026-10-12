import React from 'react';
import { X, AlertTriangle, MapPin, CheckCircle, Lock } from 'lucide-react';
import { InventoryItem } from '../types/inventory';

interface AllAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lowStockItems: InventoryItem[];
  globalThreshold: number;
  onAdjust: (item: InventoryItem) => void;
  isAdmin: boolean;
}

export const AllAlertsModal: React.FC<AllAlertsModalProps> = ({
  isOpen,
  onClose,
  lowStockItems,
  globalThreshold,
  onAdjust,
  isAdmin
}) => {
  if (!isOpen) return null;

  const thresholdOf = (item: InventoryItem) => {
    return item.threshold !== undefined && item.threshold !== null && item.threshold !== 0
      ? item.threshold
      : (item.threshold === 0 ? 0 : globalThreshold);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="bg-[#003057] text-white px-5 py-3.5 flex items-center justify-between border-b-3 border-black">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base sm:text-lg">All Low-Stock Alerts ({lowStockItems.length})</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded cursor-pointer transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 font-medium">
          Parts listed below have inventory quantities less than or equal to their configured safety threshold.
        </div>

        <div className="p-4 overflow-y-auto flex-1 divide-y divide-gray-200">
          {lowStockItems.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
              <p className="font-bold text-base text-gray-800">No Low-Stock Items</p>
              <p className="text-xs text-gray-500 mt-1">All inventory items are currently well stocked above threshold.</p>
            </div>
          ) : (
            lowStockItems.map(item => {
              const thr = thresholdOf(item);
              const isOut = item.quantity <= 0;

              return (
                <div key={item.partNumber} className="py-3 flex items-center justify-between gap-3 flex-wrap hover:bg-gray-50 px-2 rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${isOut ? 'bg-[#c0392b]' : 'bg-[#d97706]'}`} />
                      <span className="font-bold font-mono text-black text-sm">{item.partNumber}</span>
                      <span className="text-gray-800 font-medium text-sm">{item.description}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        {item.location}
                      </span>
                      {item.remarks && <span className="italic text-gray-500">Note: {item.remarks}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${
                          isOut ? 'bg-red-100 text-[#c0392b] border-red-300' : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        {isOut ? 'OUT OF STOCK' : 'LOW STOCK'}
                      </span>
                      <div className="text-xs font-bold text-gray-800 mt-0.5">
                        Stock: <span className={isOut ? 'text-[#c0392b]' : 'text-amber-700'}>{item.quantity}</span> / Min: {thr}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onClose();
                        onAdjust(item);
                      }}
                      title={isAdmin ? "Adjust Stock Quantity" : "Adjust Stock (Requires Admin Password)"}
                      className="px-3 py-1.5 bg-[#0066a1] hover:bg-[#004e7c] text-white text-xs font-bold rounded border border-black cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5"
                    >
                      {!isAdmin && <Lock className="w-3 h-3 text-amber-200" />}
                      <span>Adjust</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 bg-gray-100 border-t border-gray-300 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-black text-white rounded text-xs font-bold border border-black cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
