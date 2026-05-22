'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';

type ToastType = 'success' | 'error' | 'warn' | 'info';
type ToastItem = { id: number; message: string; type: ToastType };
type ToastCtx  = { toast: (msg: string, type?: ToastType) => void };

const ToastContext = createContext<ToastCtx>({ toast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++counter.current;
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);

  const icons: Record<ToastType, string> = {
    success: '✓',
    error:   '✗',
    warn:    '⚠',
    info:    '●',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-ico">{icons[t.type]}</span>
            <span className="toast-msg">{t.message}</span>
            <button className="toast-close" onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
