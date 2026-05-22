'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, type PortResult } from '@/lib/api';

const PORT_LABELS: Record<number, string> = {
  22: 'SSH', 80: 'HTTP', 443: 'HTTPS', 3000: 'App', 3001: 'Dev',
  5432: 'Postgres', 3306: 'MySQL', 6379: 'Redis', 27017: 'MongoDB',
};

export default function PuertosPage() {
  const [results, setResults] = useState<PortResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const fetchPorts = useCallback(async () => {
    try {
      const data = await api.ports();
      setResults(data);
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }, []);

  useEffect(() => { fetchPorts(); }, [fetchPorts]);

  const allPorts = results[0]?.ports.map((p) => p.port) ?? [];
  const openCount = results.flatMap((r) => r.ports).filter((p) => p.open).length;
  const total = results.flatMap((r) => r.ports).length;

  return (
    <>
      <div className="sec-marker reveal in">
        <span className="num">// puertos</span>
        <span className="ttl">MONITOREO_DE_PUERTOS</span>
        <span className="meta">{loading ? '—' : `${openCount}/${total} abiertos`}</span>
        <button className="btn-check-now" onClick={() => { setChecking(true); fetchPorts(); }} disabled={checking}>
          {checking ? 'Checking...' : 'Check ahora →'}
        </button>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200, marginTop: 8 }} />
      ) : results.length === 0 ? (
        <p className="empty-state">— Sin datos</p>
      ) : (
        <div className="ports-table reveal in">
          {/* Header */}
          <div className="ports-row ports-row-head">
            <span>Sitio</span>
            {allPorts.map((p) => (
              <span key={p}>{PORT_LABELS[p] ?? p}<br /><small>:{p}</small></span>
            ))}
          </div>
          {results.map((site) => (
            <div key={site.id} className="ports-row">
              <span className="ports-site">
                <span>{site.nombre}</span>
                <small className="ports-host">{site.hostname}</small>
              </span>
              {site.ports.map((p) => (
                <span key={p.port} className="ports-cell">
                  <span className={`ports-status ${p.open ? 'open' : 'closed'}`}>
                    {p.open ? '●' : '○'}
                  </span>
                  {p.open && <small className="ports-latency">{p.latency}ms</small>}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
