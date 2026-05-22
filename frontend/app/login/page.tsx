'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { setToken, isAuthenticated } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [usuario, setUsuario]         = useState('');
  const [password, setPassword]       = useState('');
  const [totp, setTotp]               = useState('');
  const [requires2fa, setRequires2fa] = useState(false);
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [dark, setDark]               = useState(false);

  useEffect(() => {
    if (isAuthenticated()) { router.replace('/dashboard'); return; }
    const d = localStorage.getItem('mhq_dark') === '1';
    setDark(d);
    document.body.classList.toggle('dark', d);
  }, [router]);

  function toggleDark() {
    setDark((d) => {
      const next = !d;
      document.body.classList.toggle('dark', next);
      localStorage.setItem('mhq_dark', next ? '1' : '0');
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(usuario, password, totp || undefined);
      setToken(res.token);
      router.push('/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión';
      if (msg.includes('2FA')) { setRequires2fa(true); setError('Ingresa tu código 2FA'); }
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <button className="login-theme-btn" type="button" onClick={toggleDark} aria-label="Cambiar tema">
        {dark ? (
          <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
            <path d="M13.2 9.8a5.4 5.4 0 0 1-7-7 .5.5 0 0 0-.7-.6 6.5 6.5 0 1 0 8.3 8.3.5.5 0 0 0-.6-.7Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" width="16" height="16">
            <circle cx="8" cy="8" r="3" />
            <path d="M8 1.5v1.6M8 12.9v1.6M14.5 8h-1.6M3.1 8H1.5M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1M12.6 12.6l-1.1-1.1M4.5 4.5L3.4 3.4" />
          </svg>
        )}
      </button>

      <div className="login-box">
        <div className="login-header">
          <div className="login-brand">MARTIN<span className="dot">.</span>HQ</div>
          <div className="login-subtitle">// panel de control — acceso restringido</div>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label" htmlFor="usuario">Usuario</label>
            <input id="usuario" className="field-input" type="text" autoComplete="username"
              placeholder="martin" value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="password">Contraseña</label>
            <input id="password" className="field-input" type="password" autoComplete="current-password"
              placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {requires2fa && (
            <div className="field-group">
              <label className="field-label" htmlFor="totp">Código 2FA</label>
              <input id="totp" className="field-input" type="text" inputMode="numeric"
                placeholder="123456" maxLength={6} value={totp} onChange={(e) => setTotp(e.target.value)} autoFocus />
            </div>
          )}
          {error && <p className="login-error">{error}</p>}
          <button className="btn-login" type="submit" disabled={loading}>
            <span>{loading ? 'Verificando...' : 'Acceder'}</span>
            <span>→</span>
          </button>
        </form>
      </div>
    </div>
  );
}
