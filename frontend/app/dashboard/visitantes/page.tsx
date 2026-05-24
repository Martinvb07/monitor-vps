'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { api, type Visitantes, type LiveEntry } from '@/lib/api';

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

function statusColor(s: number): string {
  if (s >= 500) return 'var(--down)';
  if (s >= 400) return 'var(--warn)';
  return 'var(--up)';
}

function CustomBarTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-time">{label}:00h</div>
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-dot" style={{ background: 'var(--ink)' }} />
        <span>{payload[0].value} requests</span>
      </div>
    </div>
  );
}

export default function VisitantesPage() {
  const [data, setData]     = useState<Visitantes | null>(null);
  const [live, setLive]     = useState<LiveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState<'paises' | 'referrers' | 'live'>('live');

  const fetchData = useCallback(async () => {
    try {
      const [v, l] = await Promise.all([api.visitantes(), api.visitantesLive()]);
      setData(v);
      setLive(l);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(() => api.visitantesLive().then(setLive), 15000);
    return () => clearInterval(id);
  }, [fetchData]);

  const hourData = Array.from({ length: 24 }, (_, i) => ({
    hour: String(i).padStart(2, '0'),
    requests: data?.porHora[i] ?? 0,
  }));

  const isEmpty = !loading && (!data || data.total === 0);

  return (
    <>
      <div className="sec-marker reveal in">
        <span className="num">// 004</span>
        <span className="ttl">VISITANTES</span>
        <span className="meta">hoy · datos de Nginx</span>
      </div>

      {isEmpty ? (
        <p className="empty-state">— Sin datos. El log de Nginx solo está disponible en el VPS.</p>
      ) : (
        <>
          {/* Stats */}
          <div className="hist-stats reveal in" style={{ '--cols': 4 } as React.CSSProperties}>
            {[
              { label: 'Requests hoy', val: data?.total ?? '—' },
              { label: 'IPs únicas', val: data?.unicos ?? '—' },
              { label: 'Bots',  val: data?.bots ?? '—', warn: (data?.bots ?? 0) > 50 },
              { label: 'Errores 4xx/5xx', val: data?.errores ?? '—', warn: (data?.errores ?? 0) > 10 },
            ].map((s) => (
              <div key={s.label} className="hist-stat-card" style={{ cursor: 'default' }}>
                <div className="hist-stat-uptime" style={s.warn ? { color: 'var(--warn)' } : {}}>
                  {loading ? '—' : s.val}
                </div>
                <div className="hist-stat-sub">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Gráfica por hora */}
          <div className="sec-marker reveal in d1" style={{ marginTop: 48 }}>
            <span className="num">// tráfico</span>
            <span className="ttl">REQUESTS POR HORA</span>
            <span className="meta">hoy</span>
          </div>

          <div className="hist-chart reveal in d1">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--muted)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--rule)' }}
                  tickFormatter={(v) => `${v}h`}
                  interval={2}
                />
                <YAxis
                  tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--muted)' }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'var(--rule)' }} />
                <Bar dataKey="requests" fill="var(--ink)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabs */}
          <div className="sec-marker reveal in d2" style={{ marginTop: 48 }}>
            <span className="num">// detalle</span>
            <div className="filter-group" style={{ marginLeft: 0 }}>
              {(['live', 'paises', 'referrers'] as const).map((t) => (
                <button
                  key={t}
                  className={`filter-btn ${tab === t ? 'is-active' : ''}`}
                  onClick={() => setTab(t)}
                >
                  {t === 'live' ? 'Feed en vivo' : t === 'paises' ? 'Países' : 'Referrers'}
                </button>
              ))}
            </div>
          </div>

          {/* Feed en vivo */}
          {tab === 'live' && (
            <div className="vis-table reveal in">
              <div className="vis-row vis-row-head">
                <span>IP</span>
                <span>País</span>
                <span>Método</span>
                <span>Ruta</span>
                <span>Status</span>
                <span>Hace</span>
                <span>Bot</span>
              </div>
              {live.length === 0 ? (
                <p className="empty-state">— Sin entradas recientes</p>
              ) : live.map((e, i) => (
                <div key={i} className={`vis-row ${e.bot ? 'is-bot' : ''}`}>
                  <span className="vis-ip">{e.ip}</span>
                  <span>{e.geo ? `${e.geo.bandera} ${e.geo.pais}` : '—'}</span>
                  <span className="vis-method">{e.method}</span>
                  <span className="vis-path" title={e.path}>{e.path.length > 40 ? e.path.slice(0, 40) + '…' : e.path}</span>
                  <span style={{ color: statusColor(e.status), fontWeight: 600 }}>{e.status}</span>
                  <span className="vis-time">{timeAgo(e.timestamp)}</span>
                  <span>{e.bot ? <span className="vis-bot-badge">bot</span> : '—'}</span>
                </div>
              ))}
            </div>
          )}

          {/* Países */}
          {tab === 'paises' && (
            <div className="vis-table reveal in">
              <div className="vis-row vis-row-head" style={{ gridTemplateColumns: '2fr 1fr' }}>
                <span>País</span>
                <span>Requests</span>
              </div>
              {(data?.paises ?? []).map((p, i) => (
                <div key={i} className="vis-row" style={{ gridTemplateColumns: '2fr 1fr' }}>
                  <span>{p.bandera} {p.pais}</span>
                  <span style={{ fontWeight: 600 }}>{p.count}</span>
                </div>
              ))}
            </div>
          )}

          {/* Referrers */}
          {tab === 'referrers' && (
            <div className="vis-table reveal in">
              <div className="vis-row vis-row-head" style={{ gridTemplateColumns: '3fr 1fr' }}>
                <span>URL</span>
                <span>Veces</span>
              </div>
              {(data?.referrers ?? []).length === 0 ? (
                <p className="empty-state">— Sin referrers registrados</p>
              ) : (data?.referrers ?? []).map((r, i) => (
                <div key={i} className="vis-row" style={{ gridTemplateColumns: '3fr 1fr' }}>
                  <span className="vis-path" title={r.url}>{r.url.length > 60 ? r.url.slice(0, 60) + '…' : r.url}</span>
                  <span style={{ fontWeight: 600 }}>{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
