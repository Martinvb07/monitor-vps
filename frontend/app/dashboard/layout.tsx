'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isAuthenticated, clearToken } from '@/lib/auth';
import SslBanner from '@/components/SslBanner';
import NavDropdown from '@/components/NavDropdown';
import { ToastProvider } from '@/components/Toast';
import { StatusProvider, useStatus } from '@/components/StatusContext';

const NAV_GROUPS = [
  {
    label: 'Monitor',
    items: [
      { href: '/dashboard/historial',  label: 'Historial' },
      { href: '/dashboard/alertas',    label: 'Alertas' },
      { href: '/dashboard/visitantes', label: 'Visitantes' },
      { href: '/dashboard/seguridad',  label: 'Seguridad' },
      { href: '/dashboard/puertos',    label: 'Puertos' },
    ],
  },
  {
    label: 'DevOps',
    items: [
      { href: '/dashboard/deploys',   label: 'Deploys' },
      { href: '/dashboard/logs',      label: 'Logs' },
      { href: '/dashboard/terminal',  label: 'Terminal SSH' },
    ],
  },
  {
    label: 'Config',
    items: [
      { href: '/dashboard/notas',   label: 'Notas' },
      { href: '/dashboard/sitios',  label: 'Sitios' },
      { href: '/dashboard/ajustes', label: 'Ajustes' },
    ],
  },
];

const INTERVAL = 30;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const [dark, setDark]           = useState(false);
  const [hydrated, setHydrated]   = useState(false);
  const [countdown, setCountdown] = useState(INTERVAL);
  const [lastCheck, setLastCheck] = useState('—');
  const [downSites, setDownSites]     = useState<string[]>([]);
  const [alertCount, setAlertCount]   = useState(0);
  const [mobileOpen, setMobileOpen]   = useState(false);

  const { alerts: wsAlerts, sites: wsSites, connected: wsConnected, lastUpdate: wsLastUpdate } = useStatus();

  // Sincronizar alertas y notificaciones desde WebSocket (sin polling)
  useEffect(() => {
    if (!hydrated || wsAlerts.length === 0 && wsSites.length === 0) return;
    setAlertCount(wsAlerts.filter((a) => !a.resuelta).length);
    const down = wsSites.filter((s) => !s.online).map((s) => s.nombre);
    if (down.length > 0 && Notification.permission === 'granted') {
      down.forEach((nombre) => {
        if (!downSites.includes(nombre)) {
          new Notification('⚠ Sitio caído — MartinHQ', { body: `${nombre} no responde`, icon: '/icon.svg' });
        }
      });
    }
    setDownSites(down);
    if (wsLastUpdate !== '—') { setLastCheck(wsLastUpdate); setCountdown(INTERVAL); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsAlerts, wsSites, wsLastUpdate, hydrated]);

  // Session timeout: revisar cada minuto si el JWT expiró
  useEffect(() => {
    const check = () => {
      if (!isAuthenticated()) { clearToken(); router.replace('/login?expired=1'); }
    };
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    setDark(localStorage.getItem('mhq_dark') === '1');
    setHydrated(true);
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [router]);

  // Countdown tick
  useEffect(() => {
    if (!hydrated) return;
    const tick = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : INTERVAL)), 1000);
    return () => clearInterval(tick);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    document.body.classList.toggle('dark', dark);
    localStorage.setItem('mhq_dark', dark ? '1' : '0');
  }, [dark, hydrated]);

  return (
    <ToastProvider>
    <StatusProvider>
    <>
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-left">
            <Link href="/dashboard" className={`nav-link ${pathname === '/dashboard' ? 'is-active' : ''}`}>
              Estado
            </Link>
            {NAV_GROUPS.map((g) => (
              <NavDropdown
                key={g.label}
                label={g.label}
                items={g.items}
                badge={g.label === 'Monitor' ? alertCount : undefined}
              />
            ))}
          </div>
          <Link href="/dashboard" className="nav-brand">MARTIN<span className="dot">.</span>HQ</Link>
          <button
            className="nav-hamburger"
            type="button"
            aria-label="Menú"
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? (
              <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l12 12M16 4L4 16" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 6h14M3 10h14M3 14h14" />
              </svg>
            )}
          </button>
          <div className="nav-right">
            <span className="nav-refresh">
              <span className="nav-refresh-dot" />
              {lastCheck} · <span style={{ color: countdown <= 5 ? 'var(--signal)' : 'inherit' }}>{countdown}s</span>
            </span>
            <button className="nav-theme" type="button" aria-label="Tema" onClick={() => setDark((d) => !d)}>
              <span className="nav-theme-ico nav-theme-sun" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <circle cx="8" cy="8" r="3" />
                  <path d="M8 1.5v1.6M8 12.9v1.6M14.5 8h-1.6M3.1 8H1.5M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1M12.6 12.6l-1.1-1.1M4.5 4.5L3.4 3.4" />
                </svg>
              </span>
              <span className="nav-theme-ico nav-theme-moon" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M13.2 9.8a5.4 5.4 0 0 1-7-7 .5.5 0 0 0-.7-.6 6.5 6.5 0 1 0 8.3 8.3.5.5 0 0 0-.6-.7Z" />
                </svg>
              </span>
            </button>
            <button className="nav-logout" onClick={() => { clearToken(); router.push('/login'); }}>
              Salir →
            </button>
          </div>
        </div>
      </nav>
      {mobileOpen && (
        <div className="mobile-nav">
          <Link href="/dashboard" className={`mobile-nav-link ${pathname === '/dashboard' ? 'is-active' : ''}`}
            onClick={() => setMobileOpen(false)}>Estado</Link>
          {NAV_GROUPS.flatMap((g) => [
            <div key={g.label} className="mobile-nav-group">{g.label}</div>,
            ...g.items.map((item) => (
              <Link key={item.href} href={item.href}
                className={`mobile-nav-link mobile-nav-sub ${pathname === item.href ? 'is-active' : ''}`}
                onClick={() => setMobileOpen(false)}>{item.label}</Link>
            )),
          ])}
          <div className="mobile-nav-footer">
            <button className="mobile-nav-logout" onClick={() => { clearToken(); router.push('/login'); }}>
              Cerrar sesión →
            </button>
          </div>
        </div>
      )}
      <SslBanner />
      <main className="shell page">{children}</main>
    </>
    </StatusProvider>
    </ToastProvider>
  );
}
