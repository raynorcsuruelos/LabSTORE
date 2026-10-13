import React, { useState, useEffect } from 'react';
import { X, Check, ArrowDownToLine, AlertCircle } from 'lucide-react';
import { InventoryItem } from '../types/inventory';

interface QuickAdjustModalProps {
  item: InventoryItem | null;
  globalThreshold: number;
  onClose: () => void;
  onApply: (
    partNumber: string,
    action: 'set' | 'add' | 'sub',
    qty: number,
    threshold: number | undefined,
    reason: string
  ) => void;
  onWithdraw: (partNumber: string, reason: string) => void;
}

export const QuickAdjustModal: React.FC<QuickAdjustModalProps> = ({
  item,
  globalThreshold,
  onClose,
  onApply,
  onWithdraw
}) => {
  if (!item) return null;

  const [action, setAction] = useState<'set' | 'add' | 'sub'>('set');
  const [qty, setQty] = useState<string>('');
  const [threshold, setThreshold] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (item) {
      setQty('');
      setThreshold(item.threshold !== undefined && item.threshold !== null ? String(item.threshold) : '');
      setReason('');
      setError('');
      setAction('set');
    }
  }, [item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsedQty = parseInt(qty, 10);
    if (isNaN(parsedQty) || parsedQty < 0) {
      setError('Please enter a valid non-negative quantity number.');
      return;
    }

    if (action === 'sub' && parsedQty > item.quantity) {
      setError(`Cannot subtract ${parsedQty}; only ${item.quantity} units are in stock.`);
      return;
    }

    const parsedThreshold = threshold.trim() === '' ? undefined : Math.max(0, parseInt(threshold, 10) || 0);

    onApply(item.partNumber, action, parsedQty, parsedThreshold, reason);
    onClose();
  };

  const handleWithdrawAll = () => {
    if (item.quantity <= 0) {
      setError('Stock is already 0.');
      return;
    }
    onWithdraw(item.partNumber, reason || 'Full withdraw from adjust modal');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black rounded-xl max-w-lg w-full shadow-2xl overflow-hidden animate-pop-in">
        <div className="bg-[#003057] text-white px-5 py-3.5 flex items-center justify-between border-b-3 border-black">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base sm:text-lg">Adjust Stock Quantity</h3>
            <span className="font-mono text-xs bg-white/20 px-2 py-0.5 rounded">{item.partNumber}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded cursor-pointer transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-[#f0f7fd] p-3 rounded-lg border-2 border-[#0066a1]/30 text-xs sm:text-sm">
            <div className="font-bold text-[#003057]">{item.description}</div>
            <div className="text-gray-600 mt-1 flex justify-between">
              <span>Location: <strong>{item.location}</strong></span>
              <span>Current Stock: <strong className="text-base text-black">{item.quantity}</strong></span>
            </div>
          </div>

          {error && (
            <div className="p-2.5 bg-red-50 border-2 border-[#c0392b] text-[#c0392b] text-xs font-semibold rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Adjustment Action</label>
              <select
                value={action}
                onChange={e => setAction(e.target.value as any)}
                className="w-full p-2.5 border-2 border-black rounded-lg text-sm font-semibold bg-white"
              >
                <option value="set">Set New Quantity</option>
                <option value="add">Add to Stock (+)</option>
                <option value="sub">Subtract from Stock (-)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Quantity Value *</label>
              <input
                type="number"
                min="0"
                value={qty}
                onChange={e => setQty(e.target.value)}
                placeholder="Enter count..."
                className="w-full p-2.5 border-2 border-black rounded-lg text-sm font-bold"
                required
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Low-Stock Alert Threshold <span className="font-normal text-gray-500">(0 = alert only when 0)</span>
            </label>
            <input
              type="number"
              min="0"
              value={threshold}
              onChange={e => setThreshold(e.target.value)}
              placeholder={`Global default is ${globalThreshold}`}
              className="w-full p-2 border-2 border-black rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Reason / Notes for Audit Trail</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Job #421 prep, replenishment, damaged..."
              className="w-full p-2 border-2 border-black rounded-lg text-sm"
            />
          </div>

          <div className="pt-2 flex items-center justify-between gap-2 border-t border-gray-200">
            <button
              type="button"
              onClick={handleWithdrawAll}
              disabled={item.quantity <= 0}
              className="px-3 py-2 bg-[#c0392b] hover:bg-[#962d22] text-white rounded-lg text-xs font-bold border-2 border-black flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              <span>Withdraw All ({item.quantity})</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs font-bold border-2 border-black cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#0066a1] hover:bg-[#004e7c] text-white rounded-lg text-xs font-bold border-2 border-black flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>Apply Instant Update</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
