'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  BarChart, Bar,
} from 'recharts';
import { api, type HistoryEntry, type DailyEntry, type Site } from '@/lib/api';

const COLORS = ['#e63319', '#1a8a4a', '#0a0a0a', '#4a9eff', '#b06be0', '#d97706', '#0ea5e9'];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function fmtDay(date: string): string {
  const [, m, d] = date.split('-');
  return `${d}/${m}`;
}

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

function DailyTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string; payload: DailyEntry & { siteLabel: string } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-time">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="chart-tooltip-row">
          <span className="chart-tooltip-dot" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="chart-tooltip-val">{p.value}%</span>
        </div>
      ))}
      {d && <div style={{ marginTop: 4, fontSize: 10, color: 'var(--muted)' }}>avg {d.latAvg}ms · {d.checks} checks</div>}
    </div>
  );
}

export default function HistorialPage() {
  const [sites, setSites]     = useState<Site[]>([]);
  const [history, setHistory] = useState<Record<string, HistoryEntry[]>>({});
  const [daily, setDaily]     = useState<Record<string, DailyEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>('all');
  const [view, setView] = useState<'48h' | '30d'>('48h');

  const fetchAll = useCallback(async () => {
    try {
      const [sitesList, hist, dly] = await Promise.all([api.sites(), api.history(), api.daily()]);
      setSites(sitesList);
      setHistory(hist);
      setDaily(dly);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 30000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const siteColor = (idx: number) => COLORS[idx % COLORS.length];

  // Stats por sitio (últimas 48 lecturas)
  function siteStats(id: string) {
    const entries = history[id] || [];
    if (!entries.length) return null;
    const lats = entries.filter((e) => e.online).map((e) => e.latencia);
    return {
      uptime:  Math.round((entries.filter((e) => e.online).length / entries.length) * 100),
      avg:     lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0,
      min:     lats.length ? Math.min(...lats) : 0,
      max:     lats.length ? Math.max(...lats) : 0,
      entries: entries.length,
    };
  }

  // Gráfica de latencia (48h)
  const chartData = (() => {
    const byTime: Record<string, Record<string, number | string>> = {};
    sites.forEach(({ id }) => {
      (history[id] || []).forEach((entry) => {
        if (!byTime[entry.timestamp]) byTime[entry.timestamp] = { time: formatTime(entry.timestamp), fullTime: formatDate(entry.timestamp) };
        if (entry.online) byTime[entry.timestamp][id] = entry.latencia;
      });
    });
    return Object.values(byTime).sort((a, b) => (a.fullTime as string).localeCompare(b.fullTime as string));
  })();

  // Gráfica de uptime diario (30d)
  const dailyChart = (() => {
    const allDates = [...new Set(Object.values(daily).flatMap((d) => d.map((e) => e.date)))].sort();
    return allDates.map((date) => {
      const point: Record<string, string | number> = { date, label: fmtDay(date) };
      sites.forEach(({ id }) => {
        const day = (daily[id] || []).find((d) => d.date === date);
        point[id] = day ? day.uptime : 0;
      });
      return point;
    });
  })();

  const cols = sites.length === 4 ? 2 : Math.min(sites.length, 3);
  const visibleSites = selected === 'all' ? sites : sites.filter((s) => s.id === selected);

  return (
    <>
      <div className="sec-marker reveal in">
        <span className="num">// 002</span>
        <span className="ttl">HISTORIAL</span>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button className={`btn-check-now${view === '48h' ? '' : ''}`} style={{ opacity: view === '48h' ? 1 : 0.45 }} onClick={() => setView('48h')}>48h</button>
          <button className="btn-check-now" style={{ opacity: view === '30d' ? 1 : 0.45 }} onClick={() => setView('30d')}>30d</button>
        </div>
      </div>

      {/* Stats cards */}
      <div
        className="hist-stats reveal in"
        style={{ '--cols': cols } as React.CSSProperties}
      >
        {sites.map(({ id, nombre }, idx) => {
          const stats = siteStats(id);
          const color = siteColor(idx);
          const dailyArr = daily[id] || [];
          const avgUptime30 = dailyArr.length ? Math.round(dailyArr.reduce((a, d) => a + d.uptime, 0) / dailyArr.length) : null;
          return (
            <div key={id} className={`hist-stat-card ${selected === id ? 'is-selected' : ''}`}
              onClick={() => setSelected(selected === id ? 'all' : id)}
              style={{ cursor: 'pointer', borderRight: (idx + 1) % cols === 0 || idx === sites.length - 1 ? 0 : undefined }}>
              <div className="hist-stat-head">
                <span className="hist-stat-name" style={{ color }}>{nombre}</span>
                <span className="hist-stat-dot" style={{ background: color }} />
              </div>
              {loading || !stats ? (
                <div className="skeleton" style={{ height: 32, marginTop: 8 }} />
              ) : (
                <>
                  <div className="hist-stat-uptime" style={{ color: stats.uptime < 99 ? 'var(--warn)' : 'var(--up)' }}>
                    {view === '48h' ? `${stats.uptime}%` : avgUptime30 !== null ? `${avgUptime30}%` : '—'}
                  </div>
                  <div className="hist-stat-sub">
                    {view === '48h' ? `uptime · ${stats.entries} lecturas` : `uptime 30d · ${dailyArr.length} días`}
                  </div>
                  {view === '48h' && (
                    <div className="hist-stat-metrics">
                      <div><span className="hist-metric-label">avg</span><span>{stats.avg}ms</span></div>
                      <div><span className="hist-metric-label">min</span><span>{stats.min}ms</span></div>
                      <div><span className="hist-metric-label">max</span><span>{stats.max}ms</span></div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {view === '48h' ? (
        <>
          {/* Gráfica latencia */}
          <div className="sec-marker reveal in d1" style={{ marginTop: 48 }}>
            <span className="num">// latencia</span>
            <span className="ttl">RESPUESTA EN MS</span>
            <span className="meta">{selected === 'all' ? 'todos los sitios' : sites.find((s) => s.id === selected)?.nombre}</span>
          </div>
          <div className="hist-chart reveal in d1">
            {loading ? <div className="skeleton" style={{ height: 280 }} /> : chartData.length === 0 ? (
              <p className="empty-state">— Sin datos todavía.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={{ stroke: 'var(--rule)' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}ms`} width={52} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }} />
                  {visibleSites.map(({ id, nombre }, idx) => (
                    <Line key={id} type="monotone" dataKey={id} name={nombre} stroke={siteColor(idx)} strokeWidth={1.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} connectNulls={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Tabla últimas lecturas */}
          <div className="sec-marker reveal in d2" style={{ marginTop: 48 }}>
            <span className="num">// lecturas</span>
            <span className="ttl">ÚLTIMAS ENTRADAS</span>
            <span className="meta">más reciente primero</span>
          </div>
          <div className="hist-table reveal in d2">
            <div className="hist-row hist-row-head">
              <span>Sitio</span><span>Timestamp</span><span>Estado</span><span>Latencia</span><span>HTTP</span><span>SSL días</span>
            </div>
            {loading ? [1,2,3,4,5].map((i) => (
              <div key={i} className="hist-row">{[1,2,3,4,5,6].map((j) => <div key={j} className="skeleton" style={{ height: 12 }} />)}</div>
            )) : sites.flatMap(({ id, nombre }) =>
              [...(history[id] || [])].reverse().slice(0, 5).map((e, i) => (
                <div key={`${id}-${i}`} className="hist-row">
                  <span className="hist-row-site">{nombre}</span>
                  <span className="hist-row-time">{formatDate(e.timestamp)}</span>
                  <span>
                    <span className={`status-pill ${e.online ? 'up' : 'down'}`} style={{ padding: '2px 8px', fontSize: 9 }}>
                      <span className="status-pill-dot" />{e.online ? 'online' : 'down'}
                    </span>
                  </span>
                  <span className={e.latencia > 2000 ? 'hist-crit' : e.latencia > 800 ? 'hist-warn' : ''}>{e.latencia}ms</span>
                  <span className={e.status >= 400 ? 'hist-crit' : ''}>{e.status || '—'}</span>
                  <span className={e.ssl && e.ssl.diasRestantes < 30 ? 'hist-warn' : ''}>{e.ssl ? `${e.ssl.diasRestantes}d` : '—'}</span>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          {/* Vista 30 días */}
          <div className="sec-marker reveal in d1" style={{ marginTop: 48 }}>
            <span className="num">// uptime</span>
            <span className="ttl">ÚLTIMOS 30 DÍAS</span>
            <span className="meta">{selected === 'all' ? 'todos los sitios' : sites.find((s) => s.id === selected)?.nombre}</span>
          </div>
          <div className="hist-chart reveal in d1">
            {loading ? <div className="skeleton" style={{ height: 280 }} /> : dailyChart.length === 0 ? (
              <p className="empty-state">— Sin datos diarios todavía. Volvé mañana.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dailyChart} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={{ stroke: 'var(--rule)' }} interval="preserveStartEnd" />
                  <YAxis domain={[0, 100]} tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={40} />
                  <Tooltip content={<DailyTooltip />} />
                  <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }} />
                  {visibleSites.map(({ id, nombre }, idx) => (
                    <Bar key={id} dataKey={id} name={nombre} fill={siteColor(idx)} radius={[2, 2, 0, 0]} maxBarSize={20} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Tabla 30 días */}
          <div className="sec-marker reveal in d2" style={{ marginTop: 48 }}>
            <span className="num">// tabla</span>
            <span className="ttl">UPTIME POR DÍA</span>
          </div>
          <div className="hist-table reveal in d2">
            <div className="hist-row hist-row-head">
              <span>Fecha</span>
              {visibleSites.map((s) => <span key={s.id}>{s.nombre}</span>)}
            </div>
            {dailyChart.slice().reverse().map((row) => (
              <div key={row.date as string} className="hist-row">
                <span className="hist-row-time">{fmtDay(row.date as string)}</span>
                {visibleSites.map(({ id }, idx) => {
                  const val = row[id] as number;
                  return (
                    <span key={id} className={val < 90 ? 'hist-crit' : val < 99 ? 'hist-warn' : ''} style={{ color: val === 100 ? 'var(--up)' : undefined }}>
                      {val}%
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
