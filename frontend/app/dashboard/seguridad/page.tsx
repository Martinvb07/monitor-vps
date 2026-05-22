'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, type Seguridad } from '@/lib/api';

function Check({ ok }: { ok: boolean }) {
  return (
    <span style={{ color: ok ? 'var(--up)' : 'var(--down)', fontWeight: 600 }}>
      {ok ? '✓' : '✗'}
    </span>
  );
}

export default function SeguridadPage() {
  const [data, setData]       = useState<Seguridad | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const d = await api.seguridad();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60000);
    return () => clearInterval(id);
  }, [fetchData]);

  const isEmpty = !loading && !data;

  return (
    <>
      <div className="sec-marker reveal in">
        <span className="num">// 005</span>
        <span className="ttl">SEGURIDAD</span>
        <span className="meta">análisis de logs</span>
      </div>

      {isEmpty ? (
        <p className="empty-state">— Sin datos. El log de Nginx solo está disponible en el VPS.</p>
      ) : (
        <>
          {/* Stats */}
          <div className="hist-stats reveal in" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            {[
              { label: 'IPs bloqueadas',     val: data?.ipsBlockeadas ?? '—',     crit: (data?.ipsBlockeadas ?? 0) > 0 },
              { label: 'Intentos de login',  val: data?.intentosFallidos ?? '—',  crit: (data?.intentosFallidos ?? 0) > 5 },
              { label: 'Reqs bloqueadas',    val: data?.reqsBloqueadas ?? '—',    warn: (data?.reqsBloqueadas ?? 0) > 20 },
              { label: '% Bots',             val: data ? `${data.porcentajeBots}%` : '—', warn: (data?.porcentajeBots ?? 0) > 30 },
            ].map((s) => (
              <div key={s.label} className="hist-stat-card" style={{ cursor: 'default' }}>
                <div className="hist-stat-uptime" style={
                  s.crit ? { color: 'var(--down)' } :
                  s.warn ? { color: 'var(--warn)' } : {}
                }>
                  {loading ? '—' : s.val}
                </div>
                <div className="hist-stat-sub">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Headers check */}
          <div className="sec-marker reveal in d1" style={{ marginTop: 48 }}>
            <span className="num">// headers</span>
            <span className="ttl">SEGURIDAD DE CABECERAS</span>
            <span className="meta">por sitio</span>
          </div>

          <div className="seg-headers reveal in d1">
            <div className="seg-headers-row seg-headers-head">
              <span>Sitio</span>
              <span>HTTPS</span>
              <span>HSTS</span>
              <span>HTTP/2</span>
              <span>X-Powered-By oculto</span>
            </div>
            {loading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="seg-headers-row">
                  <div className="skeleton" style={{ height: 14, width: '80%' }} />
                  {[1,2,3,4].map((j) => <div key={j} className="skeleton" style={{ height: 14, width: 20 }} />)}
                </div>
              ))
            ) : (data?.headersCheck ?? []).map((h) => (
              <div key={h.sitio} className="seg-headers-row">
                <span className="seg-sitio">{h.nombre}</span>
                <span><Check ok={h.https} /></span>
                <span><Check ok={h.hsts} /></span>
                <span><Check ok={h.http2} /></span>
                <span><Check ok={!h.xPoweredBy} /></span>
              </div>
            ))}
          </div>

          {/* IPs bloqueadas */}
          <div className="sec-marker reveal in d2" style={{ marginTop: 48 }}>
            <span className="num">// ips</span>
            <span className="ttl">IPS BLOQUEADAS</span>
            <span className="meta">{data?.ipsBlockeadas ?? 0} detectadas</span>
          </div>

          {(data?.ipsBlockeadasLista ?? []).length === 0 ? (
            <p className="empty-state">— Sin IPs bloqueadas</p>
          ) : (
            <div className="vis-table reveal in d2">
              <div className="vis-row vis-row-head" style={{ gridTemplateColumns: '1fr 1fr 80px' }}>
                <span>IP</span>
                <span>Razón</span>
                <span>Intentos</span>
              </div>
              {(data?.ipsBlockeadasLista ?? []).map((ip, i) => (
                <div key={i} className="vis-row" style={{ gridTemplateColumns: '1fr 1fr 80px' }}>
                  <span className="vis-ip" style={{ color: 'var(--down)' }}>{ip.ip}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 11 }}>{ip.razon}</span>
                  <span style={{ fontWeight: 600, color: 'var(--down)' }}>{ip.count}</span>
                </div>
              ))}
            </div>
          )}

          {/* Endpoints con fallos */}
          <div className="sec-marker reveal in d3" style={{ marginTop: 48 }}>
            <span className="num">// endpoints</span>
            <span className="ttl">FALLOS POR ENDPOINT</span>
            <span className="meta">401 / 403</span>
          </div>

          {(data?.fallosPorEndpoint ?? []).length === 0 ? (
            <p className="empty-state">— Sin fallos registrados</p>
          ) : (
            <div className="vis-table reveal in d3">
              <div className="vis-row vis-row-head" style={{ gridTemplateColumns: '1fr 80px' }}>
                <span>Ruta</span>
                <span>Fallos</span>
              </div>
              {(data?.fallosPorEndpoint ?? []).map((e, i) => (
                <div key={i} className="vis-row" style={{ gridTemplateColumns: '1fr 80px' }}>
                  <span className="vis-path">{e.path}</span>
                  <span style={{ fontWeight: 600, color: e.count > 10 ? 'var(--down)' : 'var(--ink)' }}>{e.count}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
