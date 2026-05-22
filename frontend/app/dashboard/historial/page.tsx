'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { api, type HistoryEntry } from '@/lib/api';

const SITES = [
  { id: 'mesoft', label: 'MeSoft',          color: '#e63319' },
  { id: 'agro',   label: 'AgroManager',     color: '#1a8a4a' },
  { id: 'cancha', label: 'ReservaTuCancha', color: '#0a0a0a' },
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

type ChartPoint = {
  time: string;
  fullTime: string;
  mesoft?: number;
  agro?: number;
  cancha?: number;
};

type SelectedSite = 'all' | 'mesoft' | 'agro' | 'cancha';

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-time">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="chart-tooltip-row">
          <span className="chart-tooltip-dot" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="chart-tooltip-val">{p.value}ms</span>
        </div>
      ))}
    </div>
  );
}

export default function HistorialPage() {
  const [history, setHistory] = useState<Record<string, HistoryEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedSite>('all');

  const fetchHistory = useCallback(async () => {
    try {
      const data = await api.history();
      setHistory(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    const id = setInterval(fetchHistory, 30000);
    return () => clearInterval(id);
  }, [fetchHistory]);

  // Merge all sites into a single timeline (últimas 48 entradas)
  const chartData: ChartPoint[] = (() => {
    const byTime: Record<string, ChartPoint> = {};

    SITES.forEach(({ id }) => {
      (history[id] || []).forEach((entry) => {
        const key = entry.timestamp;
        if (!byTime[key]) {
          byTime[key] = {
            time: formatTime(key),
            fullTime: formatDate(key),
          };
        }
        byTime[key][id as keyof Omit<ChartPoint, 'time' | 'fullTime'>] = entry.online ? entry.latencia : undefined;
      });
    });

    return Object.values(byTime).sort((a, b) => a.fullTime.localeCompare(b.fullTime));
  })();

  // Estadísticas por sitio
  function siteStats(id: string) {
    const entries = history[id] || [];
    if (!entries.length) return null;
    const lats = entries.filter((e) => e.online).map((e) => e.latencia);
    const uptime = Math.round((entries.filter((e) => e.online).length / entries.length) * 100);
    return {
      uptime,
      avg: lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0,
      min: lats.length ? Math.min(...lats) : 0,
      max: lats.length ? Math.max(...lats) : 0,
      entries: entries.length,
    };
  }

  const visibleSites = selected === 'all' ? SITES : SITES.filter((s) => s.id === selected);

  return (
    <>
      <div className="sec-marker reveal in">
        <span className="num">// 002</span>
        <span className="ttl">HISTORIAL</span>
        <span className="meta">últimas 48 lecturas · intervalo 30s</span>
      </div>

      {/* Stats por sitio */}
      <div className="hist-stats reveal in">
        {SITES.map(({ id, label, color }) => {
          const stats = siteStats(id);
          return (
            <div
              key={id}
              className={`hist-stat-card ${selected === id ? 'is-selected' : ''}`}
              onClick={() => setSelected(selected === id ? 'all' : id as SelectedSite)}
              style={{ cursor: 'pointer' }}
            >
              <div className="hist-stat-head">
                <span className="hist-stat-name" style={{ color }}>{label}</span>
                <span className="hist-stat-dot" style={{ background: color }} />
              </div>
              {loading || !stats ? (
                <div className="skeleton" style={{ height: 32, marginTop: 8 }} />
              ) : (
                <>
                  <div className="hist-stat-uptime" style={{ color: stats.uptime < 99 ? 'var(--warn)' : 'var(--up)' }}>
                    {stats.uptime}%
                  </div>
                  <div className="hist-stat-sub">uptime · {stats.entries} lecturas</div>
                  <div className="hist-stat-metrics">
                    <div><span className="hist-metric-label">avg</span><span>{stats.avg}ms</span></div>
                    <div><span className="hist-metric-label">min</span><span>{stats.min}ms</span></div>
                    <div><span className="hist-metric-label">max</span><span>{stats.max}ms</span></div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Gráfica */}
      <div className="sec-marker reveal in d1" style={{ marginTop: 48 }}>
        <span className="num">// latencia</span>
        <span className="ttl">RESPUESTA EN MS</span>
        <span className="meta">
          {selected === 'all' ? 'todos los sitios' : SITES.find((s) => s.id === selected)?.label}
        </span>
      </div>

      <div className="hist-chart reveal in d1">
        {loading ? (
          <div className="skeleton" style={{ height: 280 }} />
        ) : chartData.length === 0 ? (
          <p className="empty-state">— Sin datos todavía. El monitor lleva menos de 30 segundos activo.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--muted)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--rule)' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--muted)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}ms`}
                width={52}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}
              />
              {visibleSites.map(({ id, label, color }) => (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={id}
                  name={label}
                  stroke={color}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Tabla de últimas lecturas */}
      <div className="sec-marker reveal in d2" style={{ marginTop: 48 }}>
        <span className="num">// lecturas</span>
        <span className="ttl">ÚLTIMAS ENTRADAS</span>
        <span className="meta">más reciente primero</span>
      </div>

      <div className="hist-table reveal in d2">
        <div className="hist-row hist-row-head">
          <span>Sitio</span>
          <span>Timestamp</span>
          <span>Estado</span>
          <span>Latencia</span>
          <span>HTTP</span>
          <span>SSL días</span>
        </div>
        {loading ? (
          [1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="hist-row">
              {[1, 2, 3, 4, 5, 6].map((j) => (
                <div key={j} className="skeleton" style={{ height: 12 }} />
              ))}
            </div>
          ))
        ) : (
          SITES.flatMap(({ id, label }) =>
            [...(history[id] || [])].reverse().slice(0, 5).map((e, i) => (
              <div key={`${id}-${i}`} className="hist-row">
                <span className="hist-row-site">{label}</span>
                <span className="hist-row-time">{formatDate(e.timestamp)}</span>
                <span>
                  <span className={`status-pill ${e.online ? 'up' : 'down'}`} style={{ padding: '2px 8px', fontSize: 9 }}>
                    <span className="status-pill-dot" />
                    {e.online ? 'online' : 'down'}
                  </span>
                </span>
                <span className={e.latencia > 2000 ? 'hist-crit' : e.latencia > 800 ? 'hist-warn' : ''}>
                  {e.latencia}ms
                </span>
                <span className={e.status >= 400 ? 'hist-crit' : ''}>{e.status || '—'}</span>
                <span className={e.ssl && e.ssl.diasRestantes < 30 ? 'hist-warn' : ''}>
                  {e.ssl ? `${e.ssl.diasRestantes}d` : '—'}
                </span>
              </div>
            ))
          ).sort((a, b) => 0)
        )}
      </div>
    </>
  );
}
