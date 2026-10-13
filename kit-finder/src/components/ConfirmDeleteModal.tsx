import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { Kit } from '../types';

interface ConfirmDeleteModalProps {
  kit: Kit;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({ kit, onCancel, onConfirm }) => {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black rounded-xl max-w-md w-full shadow-2xl overflow-hidden animate-pop-in">
        <div className="bg-[#c0392b] text-white px-5 py-3.5 flex items-center gap-2 border-b-3 border-black">
          <AlertTriangle className="w-5 h-5" />
          <h3 className="font-bold text-base sm:text-lg">Delete Kit?</h3>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <p>
            This removes <span className="font-bold">{kit.asset}</span> ({kit.maintenance} · Level {kit.level}) and its BOM for
            all users.
          </p>
          <div className="p-2.5 bg-slate-100 border-2 border-black rounded-lg font-mono font-bold text-[#003057] break-words">{kit.kit}</div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onCancel} className="px-4 py-2 bg-white hover:bg-slate-100 font-bold rounded-lg border-2 border-black cursor-pointer">
              Cancel
            </button>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                } finally {
                  setBusy(false);
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#c0392b] hover:bg-[#a5301f] text-white font-bold rounded-lg border-2 border-black cursor-pointer disabled:opacity-60"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
