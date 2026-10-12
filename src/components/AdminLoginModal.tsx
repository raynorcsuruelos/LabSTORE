import React, { useState } from 'react';
import { X, Lock, AlertCircle } from 'lucide-react';
import { getSetting } from '../db/dexieDb';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess
}) => {
  if (!isOpen) return null;

  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const storedPass = await getSetting<string>('adminPass', 'WLAdmin2025');
    if (password === storedPass) {
      setPassword('');
      onLoginSuccess();
    } else {
      setError(true);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black rounded-xl max-w-sm w-full shadow-2xl overflow-hidden animate-pop-in">
        <div className="bg-[#003057] text-white px-5 py-3.5 flex items-center justify-between border-b-3 border-black">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-300" />
            <h3 className="font-bold text-base">Admin Authentication</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded cursor-pointer transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Enter Administrator Password</label>
            <input
              type="password"
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                setError(false);
              }}
              placeholder="Password (Default: WLAdmin2025)"
              className="w-full p-2.5 border-2 border-black rounded-lg text-sm"
              autoFocus
              required
            />
            {error && (
              <div className="mt-2 p-2 bg-red-50 border border-red-300 text-[#c0392b] text-xs font-semibold rounded flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Incorrect password. Default is WLAdmin2025.</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded text-xs font-bold border border-black cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 bg-[#2c3e50] hover:bg-[#1a252f] text-white rounded text-xs font-bold border-2 border-black cursor-pointer shadow-sm"
            >
              Unlock Admin Panel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
