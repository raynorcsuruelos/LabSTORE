import React, { useState } from 'react';
import { SubStore, InventoryItem } from '../types/inventory';
import { Building2, Check, Sparkles, Shield, ArrowRight, X } from 'lucide-react';

interface StoreSelectModalProps {
  isOpen: boolean;
  onClose?: () => void;
  stores: SubStore[];
  currentStoreId: string;
  allItems: InventoryItem[];
  onSelectStore: (storeId: string, setAsDefault: boolean) => void;
  isInitialSelection?: boolean;
}

export const StoreSelectModal: React.FC<StoreSelectModalProps> = ({
  isOpen,
  onClose,
  stores,
  currentStoreId,
  allItems,
  onSelectStore,
  isInitialSelection = false
}) => {
  if (!isOpen) return null;

  const [selectedId, setSelectedId] = useState<string>(currentStoreId || (stores[0]?.id || 'sonde-lab'));
  const [rememberDefault, setRememberDefault] = useState<boolean>(true);

  const getStoreCount = (storeId: string) => {
    return allItems.filter(i => i.storeId === storeId).length;
  };

  const handleConfirm = () => {
    onSelectStore(selectedId, rememberDefault);
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black rounded-xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-pop-in">
        {/* Header */}
        <div className="bg-[#003057] text-white px-5 py-4 border-b-3 border-black flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-amber-300" />
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight">
                {isInitialSelection ? 'Select Wireline Sub-Store' : 'Switch Sub-Store Location'}
              </h3>
              <p className="text-xs text-blue-200">
                Choose the laboratory or hardware store you wish to inspect or manage
              </p>
            </div>
          </div>
          {!isInitialSelection && onClose && (
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded cursor-pointer transition">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Store Options Grid */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          <div className="text-xs font-semibold text-gray-600 mb-1">
            Available Sub-Stores ({stores.length}):
          </div>

          <div className="grid grid-cols-1 gap-3">
            {stores.map(store => {
              const isSelected = selectedId === store.id;
              const itemCount = getStoreCount(store.id);

              return (
                <div
                  key={store.id}
                  onClick={() => setSelectedId(store.id)}
                  className={`p-4 rounded-xl border-3 transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'border-[#0066a1] bg-[#f0f7fd] shadow-md ring-2 ring-[#0066a1]/30'
                      : 'border-black hover:border-[#0066a1] hover:bg-gray-50'
                  }`}
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-base">{store.name}</span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#003057] text-white">
                        {store.code}
                      </span>
                      {store.id === currentStoreId && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Active Store
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                      {store.description}
                    </p>

                    <div className="pt-1 flex items-center gap-3 text-[11px] text-gray-500 font-medium">
                      <span>📦 {itemCount} Inventory Parts</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Shield className="w-3 h-3 text-gray-400" />
                        Dedicated Admin Access
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 mt-1">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? 'border-[#0066a1] bg-[#0066a1] text-white'
                          : 'border-gray-400 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-3" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Remember Preference Checkbox */}
          <div className="pt-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="remember-store-chk"
              checked={rememberDefault}
              onChange={e => setRememberDefault(e.target.checked)}
              className="w-4 h-4 text-[#0066a1] border-2 border-black rounded cursor-pointer"
            />
            <label htmlFor="remember-store-chk" className="text-xs font-semibold text-gray-700 cursor-pointer select-none">
              Remember this as my default sub-store on this device
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-100 border-t-2 border-gray-300 flex items-center justify-between">
          <div className="text-[11px] text-gray-500 hidden sm:block">
            You can switch stores anytime from the header selector.
          </div>

          <div className="flex gap-2 w-full sm:w-auto justify-end">
            {!isInitialSelection && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs font-bold border-2 border-black cursor-pointer"
              >
                Cancel
              </button>
            )}

            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2 bg-[#0066a1] hover:bg-[#004e7c] text-white rounded-lg text-xs font-bold border-2 border-black cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <span>Access {stores.find(s => s.id === selectedId)?.name || 'Store'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
