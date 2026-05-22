'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { getToken } from '@/lib/auth';
import type { SiteStatus, Alert } from '@/lib/api';

type StatusData = {
  sites: SiteStatus[];
  alerts: Alert[];
  connected: boolean;
  lastUpdate: string;
};

const StatusContext = createContext<StatusData>({
  sites: [], alerts: [], connected: false, lastUpdate: '—',
});

const WS_PORT = process.env.NEXT_PUBLIC_WS_STATUS_PORT || '3003';

export function StatusProvider({ children }: { children: React.ReactNode }) {
  const [sites, setSites]           = useState<SiteStatus[]>([]);
  const [alerts, setAlerts]         = useState<Alert[]>([]);
  const [connected, setConnected]   = useState(false);
  const [lastUpdate, setLastUpdate] = useState('—');
  const wsRef       = useRef<WebSocket | null>(null);
  const retryRef    = useRef<ReturnType<typeof setTimeout>>();
  const unmounted   = useRef(false);

  const connect = useCallback(() => {
    if (unmounted.current) return;
    const token = getToken();
    if (!token) return;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.hostname}:${WS_PORT}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => { if (!unmounted.current) setConnected(true); };

    ws.onmessage = (e) => {
      if (unmounted.current) return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'update') {
          setSites(msg.sites ?? []);
          setAlerts(msg.alerts ?? []);
          setLastUpdate(new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }));
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      if (unmounted.current) return;
      setConnected(false);
      retryRef.current = setTimeout(connect, 4000);
    };

    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return (
    <StatusContext.Provider value={{ sites, alerts, connected, lastUpdate }}>
      {children}
    </StatusContext.Provider>
  );
}

export const useStatus = () => useContext(StatusContext);
