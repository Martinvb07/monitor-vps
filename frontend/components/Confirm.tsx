'use client';

import { useState, useCallback } from 'react';

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
};

type ConfirmState = ConfirmOptions & {
  resolve: (v: boolean) => void;
};

let _open: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;

export function useConfirm() {
  return useCallback((opts: ConfirmOptions | string): Promise<boolean> => {
    const options = typeof opts === 'string' ? { message: opts } : opts;
    if (_open) return _open(options);
    return Promise.resolve(window.confirm(options.message));
  }, []);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  _open = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, resolve });
    });
  }, []);

  function answer(val: boolean) {
    state?.resolve(val);
    setState(null);
  }

  return (
    <>
      {children}
      {state && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
          animation: 'fadeIn 0.15s ease',
        }}>
          <div style={{
            background: 'var(--paper)', border: '1px solid var(--ink)',
            width: '100%', maxWidth: 400,
            fontFamily: 'var(--font-mono)',
            animation: 'slideUp 0.2s cubic-bezier(0.16,1,0.3,1) both',
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--rule)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{
                fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: state.danger ? 'var(--down)' : 'var(--muted)', fontWeight: 600,
              }}>
                {state.danger ? '⚠ ' : ''}{state.title || 'Confirmar acción'}
              </span>
            </div>

            {/* Body */}
            <div style={{ padding: '20px', fontSize: 13, lineHeight: 1.6, color: 'var(--ink)' }}>
              {state.message}
            </div>

            {/* Footer */}
            <div style={{
              padding: '14px 20px', borderTop: '1px solid var(--rule)',
              display: 'flex', justifyContent: 'flex-end', gap: 10,
            }}>
              <button
                onClick={() => answer(false)}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em',
                  textTransform: 'uppercase', padding: '8px 20px',
                  border: '1px solid var(--rule)', background: 'none',
                  color: 'var(--muted)', cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ink)'; e.currentTarget.style.color = 'var(--ink)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--rule)'; e.currentTarget.style.color = 'var(--muted)'; }}
              >
                Cancelar
              </button>
              <button
                autoFocus
                onClick={() => answer(true)}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em',
                  textTransform: 'uppercase', padding: '8px 20px',
                  border: '1px solid var(--ink)',
                  background: state.danger ? 'var(--down)' : 'var(--ink)',
                  color: 'var(--paper)', cursor: 'pointer',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                {state.confirmLabel || 'Confirmar'} →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
