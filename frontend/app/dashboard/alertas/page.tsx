'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, type Alert } from '@/lib/api';

const SITIOS: Record<string, string> = {
  mesoft: 'MeSoft',
  agro:   'AgroManager',
  cancha: 'ReservaTuCancha',
};

const TIPOS = ['todos', 'caido', 'latencia', 'ssl'] as const;
const ESTADOS = ['todos', 'activas', 'resueltas'] as const;

type FiltroTipo   = typeof TIPOS[number];
type FiltroEstado = typeof ESTADOS[number];

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AlertasPage() {
  const [alerts, setAlerts]       = useState<Alert[]>([]);
  const [loading, setLoading]     = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [tipo, setTipo]           = useState<FiltroTipo>('todos');
  const [estado, setEstado]       = useState<FiltroEstado>('activas');

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await api.alertas();
      setAlerts(data.reverse());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const id = setInterval(fetchAlerts, 30000);
    return () => clearInterval(id);
  }, [fetchAlerts]);

  async function handleResolve(id: string) {
    setResolving(id);
    try {
      await api.resolverAlerta(id);
      setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, resuelta: true, resueltaEn: new Date().toISOString() } : a));
    } finally {
      setResolving(null);
    }
  }

  const filtered = alerts.filter((a) => {
    const matchTipo   = tipo === 'todos' || a.tipo === tipo;
    const matchEstado = estado === 'todos'
      ? true
      : estado === 'activas' ? !a.resuelta : a.resuelta;
    return matchTipo && matchEstado;
  });

  const activas   = alerts.filter((a) => !a.resuelta).length;
  const resueltas = alerts.filter((a) => a.resuelta).length;

  return (
    <>
      <div className="sec-marker reveal in">
        <span className="num">// 003</span>
        <span className="ttl">ALERTAS</span>
        <span className="meta">{loading ? '—' : `${activas} activas · ${resueltas} resueltas`}</span>
      </div>

      {/* Stats rápidas */}
      <div className="alert-stats reveal in">
        <div className="alert-stat">
          <div className="alert-stat-val" style={{ color: activas > 0 ? 'var(--down)' : 'var(--up)' }}>
            {loading ? '—' : activas}
          </div>
          <div className="alert-stat-label">Sin resolver</div>
        </div>
        <div className="alert-stat">
          <div className="alert-stat-val">{loading ? '—' : resueltas}</div>
          <div className="alert-stat-label">Resueltas</div>
        </div>
        <div className="alert-stat">
          <div className="alert-stat-val">{loading ? '—' : alerts.length}</div>
          <div className="alert-stat-label">Total historial</div>
        </div>
        <div className="alert-stat">
          <div className="alert-stat-val" style={{ color: 'var(--down)' }}>
            {loading ? '—' : alerts.filter((a) => a.tipo === 'caido').length}
          </div>
          <div className="alert-stat-label">Caídas</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="alert-filters reveal in d1">
        <div className="filter-group">
          <span className="filter-label">Tipo</span>
          {TIPOS.map((t) => (
            <button
              key={t}
              className={`filter-btn ${tipo === t ? 'is-active' : ''}`}
              onClick={() => setTipo(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <span className="filter-label">Estado</span>
          {ESTADOS.map((e) => (
            <button
              key={e}
              className={`filter-btn ${estado === e ? 'is-active' : ''}`}
              onClick={() => setEstado(e)}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="alerts-full-list">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="alerts-full-row">
              <div className="skeleton" style={{ height: 14, width: '10%' }} />
              <div className="skeleton" style={{ height: 14, width: '12%' }} />
              <div className="skeleton" style={{ height: 14, width: '40%' }} />
              <div className="skeleton" style={{ height: 14, width: '15%' }} />
              <div className="skeleton" style={{ height: 14, width: '10%' }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="empty-state">— Sin alertas con estos filtros</p>
      ) : (
        <div className="alerts-full-list reveal in d2">
          <div className="alerts-full-row alerts-full-head">
            <span>Severidad</span>
            <span>Sitio</span>
            <span>Mensaje</span>
            <span>Cuando</span>
            <span>Estado</span>
            <span />
          </div>
          {filtered.map((alert) => (
            <div key={alert.id} className={`alerts-full-row ${alert.resuelta ? 'is-resolved' : ''}`}>
              <span>
                <span className={`alert-badge ${alert.severidad}`}>
                  <span className="alert-badge-dot" />
                  {alert.severidad}
                </span>
              </span>
              <span className="alerts-full-sitio">{SITIOS[alert.sitio] ?? alert.sitio}</span>
              <span className="alerts-full-msg">{alert.mensaje}</span>
              <span className="alerts-full-time" title={formatDate(alert.timestamp)}>
                {timeAgo(alert.timestamp)}
              </span>
              <span>
                {alert.resuelta ? (
                  <span className="alerts-resolved-badge">✓ resuelta</span>
                ) : (
                  <span className="alerts-active-badge">● activa</span>
                )}
              </span>
              <span>
                {!alert.resuelta && (
                  <button
                    className="btn-resolve"
                    onClick={() => handleResolve(alert.id)}
                    disabled={resolving === alert.id}
                  >
                    {resolving === alert.id ? '...' : '✓'}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
