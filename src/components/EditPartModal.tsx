import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { InventoryItem } from '../types/inventory';

interface EditPartModalProps {
  item: InventoryItem | null;
  globalThreshold: number;
  onClose: () => void;
  onSave: (updatedItem: InventoryItem, originalPartNumber: string) => void;
}

export const EditPartModal: React.FC<EditPartModalProps> = ({
  item,
  globalThreshold,
  onClose,
  onSave
}) => {
  if (!item) return null;

  const [partNumber, setPartNumber] = useState(item.partNumber);
  const [description, setDescription] = useState(item.description);
  const [location, setLocation] = useState(item.location);
  const [quantity, setQuantity] = useState(item.quantity);
  const [threshold, setThreshold] = useState<number | ''>(
    item.threshold !== undefined && item.threshold !== null ? item.threshold : ''
  );
  const [remarks, setRemarks] = useState(item.remarks || '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (item) {
      setPartNumber(item.partNumber);
      setDescription(item.description);
      setLocation(item.location);
      setQuantity(item.quantity);
      setThreshold(item.threshold !== undefined && item.threshold !== null ? item.threshold : '');
      setRemarks(item.remarks || '');
      setError('');
    }
  }, [item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partNumber.trim() || !description.trim() || !location.trim()) {
      setError('Part number, description, and location are required.');
      return;
    }

    if (quantity < 0) {
      setError('Quantity cannot be negative.');
      return;
    }

    const updated: InventoryItem = {
      partNumber: partNumber.trim(),
      description: description.trim(),
      location: location.trim(),
      quantity: Number(quantity),
      threshold: threshold === '' ? 0 : Math.max(0, Number(threshold)),
      remarks: remarks.trim(),
      updatedAt: new Date().toISOString()
    };

    onSave(updated, item.partNumber);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black rounded-xl max-w-lg w-full shadow-2xl overflow-hidden animate-pop-in">
        <div className="bg-[#003057] text-white px-5 py-3.5 flex items-center justify-between border-b-3 border-black">
          <h3 className="font-bold text-base sm:text-lg">Edit Part: {item.partNumber}</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded cursor-pointer transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {error && (
            <div className="p-2.5 bg-red-50 border-2 border-[#c0392b] text-[#c0392b] text-xs font-semibold rounded-lg flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Part Number *</label>
              <input
                type="text"
                value={partNumber}
                onChange={e => setPartNumber(e.target.value)}
                className="w-full p-2 border-2 border-black rounded-lg text-sm font-mono font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Location / Bin *</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full p-2 border-2 border-black rounded-lg text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Description *</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full p-2 border-2 border-black rounded-lg text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Stock Quantity *</label>
              <input
                type="number"
                min="0"
                value={quantity}
                onChange={e => setQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full p-2 border-2 border-black rounded-lg text-sm font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Low-Stock Alert Min</label>
              <input
                type="number"
                min="0"
                value={threshold}
                onChange={e => setThreshold(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))}
                placeholder={`Global: ${globalThreshold}`}
                className="w-full p-2 border-2 border-black rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Remarks / Notes</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Operational notes, compatible tool string, inspection date..."
              className="w-full p-2 border-2 border-black rounded-lg text-sm"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded text-xs font-bold border border-black cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#1a7a3c] hover:bg-[#145a2c] text-white rounded text-xs font-bold border-2 border-black cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
