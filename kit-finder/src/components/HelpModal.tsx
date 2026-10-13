import React from 'react';
import { X, Mail } from 'lucide-react';

export const HelpModal: React.FC<{ isAdmin: boolean; onClose: () => void }> = ({ isAdmin, onClose }) => (
  <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white border-4 border-black rounded-xl max-w-md w-full shadow-2xl overflow-hidden animate-pop-in" onClick={e => e.stopPropagation()}>
      <div className="bg-[#003057] text-white px-5 py-3.5 flex items-center justify-between border-b-3 border-black">
        <h3 className="font-bold text-base sm:text-lg">WL Kit Finder Help</h3>
        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded cursor-pointer transition">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-5 space-y-3 text-sm text-slate-700">
        <ol className="list-decimal pl-5 space-y-1">
          <li>Choose the family, asset, maintenance type and level.</li>
          <li>The kit part number appears. Use <b>Copy Part Number</b> or open the <b>BOM</b>.</li>
          <li>Use <b>Search by Part Number</b> to find every kit that contains a part.</li>
        </ol>
        <p>
          {isAdmin
            ? 'You have the admin role: use Add Kit, Manage, Edit Kit and Delete. Changes are saved to the shared database for every user.'
            : 'Editing kits needs the admin role on your account. Ask an administrator if you need it.'}
        </p>
        <div className="p-3 bg-slate-50 border-2 border-black rounded-lg">
          <div className="text-xs font-bold text-slate-500 uppercase mb-1">Corrections or newly released kits</div>
          <a href="mailto:rsuruelos@slb.com" className="inline-flex items-center gap-1.5 text-[#0066a1] font-bold hover:underline">
            <Mail className="w-4 h-4" /> rsuruelos@slb.com
          </a>
        </div>
      </div>
    </div>
  </div>
);
