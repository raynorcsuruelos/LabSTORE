import React, { useState, useEffect } from 'react';
import { X, Lock, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { verifyAdminPassword } from '../services/security';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (isMasterAdmin: boolean) => void;
  storeId?: string;
  storeName?: string;
  actionTitle?: string;
  actionDescription?: string;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  storeId,
  storeName,
  actionTitle = 'Admin Authentication Required',
  actionDescription = 'Stock adjustments, withdrawals, and inventory configurations require verified administrator access.'
}) => {
  if (!isOpen) return null;

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockoutTimer, setLockoutTimer] = useState<number | null>(null);

  useEffect(() => {
    let interval: any = null;
    if (lockoutTimer !== null && lockoutTimer > 0) {
      interval = setInterval(() => {
        setLockoutTimer(prev => (prev && prev > 1 ? prev - 1 : null));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [lockoutTimer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTimer && lockoutTimer > 0) return;

    setLoading(true);
    setErrorMessage('');

    const res = await verifyAdminPassword(password, storeId);
    setLoading(false);

    if (res.success) {
      setPassword('');
      setErrorMessage('');
      onLoginSuccess(Boolean(res.isSuperAdmin));
    } else {
      setErrorMessage(res.message || 'Incorrect password.');
      if (res.lockoutSeconds) {
        setLockoutTimer(res.lockoutSeconds);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black rounded-xl max-w-sm w-full shadow-2xl overflow-hidden animate-pop-in">
        <div className="bg-[#003057] text-white px-5 py-3.5 flex items-center justify-between border-b-3 border-black">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-300" />
            <h3 className="font-bold text-base">{actionTitle}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded cursor-pointer transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 leading-relaxed flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>{actionDescription}</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Enter Administrator Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                disabled={Boolean(lockoutTimer && lockoutTimer > 0)}
                onChange={e => {
                  setPassword(e.target.value);
                  setErrorMessage('');
                }}
                placeholder={storeName ? `Password for ${storeName} or master password` : 'Administrator password'}
                className="w-full pl-3 pr-10 py-2.5 border-2 border-black rounded-lg text-sm font-medium focus:outline-none focus:border-[#0066a1]"
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-black cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {errorMessage && (
              <div className="mt-2 p-2.5 bg-red-50 border border-red-300 text-[#c0392b] text-xs font-semibold rounded-lg flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {lockoutTimer ? `${errorMessage} (${lockoutTimer}s remaining)` : errorMessage}
                </span>
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
              disabled={loading || Boolean(lockoutTimer && lockoutTimer > 0)}
              className="px-4 py-1.5 bg-[#003057] hover:bg-[#002240] text-white rounded text-xs font-bold border-2 border-black cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Authenticate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
