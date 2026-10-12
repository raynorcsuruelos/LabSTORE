import React from 'react';
import { X, Mail, Database, Cloud, WifiOff, CheckCircle } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black rounded-xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col animate-pop-in">
        <div className="bg-[#003057] text-white px-5 py-3.5 flex items-center justify-between border-b-3 border-black">
          <h3 className="font-bold text-base sm:text-lg">Wireline Lab Help &amp; Support</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded cursor-pointer transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs sm:text-sm">
          {/* Contact Box */}
          <div className="p-4 bg-[#e8f4fd] border-2 border-[#0066a1] rounded-xl text-center space-y-2">
            <div className="text-3xl">📬</div>
            <div className="font-bold text-gray-900 text-sm">
              For help, updates, upgrades, and feature requests please contact:
            </div>
            <a
              href="mailto:rsuruelos@slb.com"
              className="inline-block text-[#0066a1] text-base font-bold underline hover:text-[#004e7c]"
            >
              rsuruelos@slb.com
            </a>
            <div className="text-gray-500 text-xs">WL Lab Inventory · Wireline Lab · SLB</div>
          </div>

          {/* Architecture info */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-[#003057] uppercase text-xs tracking-wider">
              System Architecture &amp; Sync Guide
            </h4>

            <div className="flex items-start gap-2.5">
              <Database className="w-4 h-4 text-[#0066a1] shrink-0 mt-0.5" />
              <div>
                <strong>IndexedDB (Dexie.js):</strong> All button clicks, stock deductions (+1, -1, withdraw),
                searches, and part additions run locally with 0ms latency in the browser's persistent IndexedDB storage.
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Cloud className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>OneDrive Background Sync:</strong> Changes are placed into a local mutation queue and
                automatically uploaded in the background to Microsoft OneDrive (<code>WLLabInventory/inventory_sync.json</code>).
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <WifiOff className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>100% Offline Resilient:</strong> If the rig, lab, or offshore facility loses Internet
                connection, stock operations continue without interruption. Once reconnected, pending mutations
                auto-reconcile with OneDrive.
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 bg-gray-100 border-t border-gray-300 flex justify-end">
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
