import React, { createContext, useContext, useState, useCallback } from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warn';
  message: string;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastMessage['type']) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {}
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map(t => {
          let bgClass = 'bg-[#0066a1]';
          if (t.type === 'success') bgClass = 'bg-[#1a7a3c]';
          if (t.type === 'error') bgClass = 'bg-[#c0392b]';
          if (t.type === 'warn') bgClass = 'bg-[#d97706]';

          return (
            <div
              key={t.id}
              className={`${bgClass} text-white px-4 py-3 rounded-lg border-2 border-black shadow-lg font-medium text-sm pointer-events-auto transition-all animate-bounce-in flex items-center justify-between gap-3`}
            >
              <span>{t.message}</span>
              <button
                onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
                className="text-white/80 hover:text-white font-bold ml-2 text-base leading-none"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
