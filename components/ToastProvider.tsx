import React, { createContext, useCallback, useContext, useState } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

type Toast = { id: string; message: string; type?: 'success' | 'error' | 'info'; };

const ToastContext = createContext<{ show: (message: string, type?: Toast['type']) => void } | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.show;
};

const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    const t: Toast = { id, message, type };
    setToasts(s => [t, ...s]);
    window.setTimeout(() => setToasts(s => s.filter(x => x.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3">
        {toasts.map(t => (
          <div key={t.id} className={`w-full max-w-xs rounded-2xl px-4 py-3 text-white shadow-lg flex items-start gap-3 ${t.type === 'error' ? 'bg-rose-600' : t.type === 'success' ? 'bg-emerald-600' : 'bg-slate-800'}`}>
            <div className="mt-0.5">
              {t.type === 'error' ? <AlertCircle size={18} /> : t.type === 'success' ? <CheckCircle2 size={18} /> : <Info size={18} />}
            </div>
            <div className="flex-1 text-sm font-black">{t.message}</div>
            <button onClick={() => setToasts(s => s.filter(x => x.id !== t.id))} className="opacity-80 hover:opacity-100 p-1 rounded-full">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
