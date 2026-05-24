'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, type RemoteServer, type SystemMetrics, type Pm2Process } from '@/lib/api';
import { useToast } from '@/components/Toast';

function pctColor(p: number) { return p > 85 ? 'crit' : p > 65 ? 'warn' : ''; }
function fmtUptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

type ServerState = {
  server: RemoteServer;
  metrics: SystemMetrics | null;
  pm2: Pm2Process[];
  metricsLoading: boolean;
  pm2Loading: boolean;
  error: string | null;
};

export default function ServidoresPage() {
  const { toast } = useToast();
  const [states, setStates] = useState<ServerState[]>([]);
  const [restarting, setRestarting] = useState<string | null>(null);
  const [scriptModal, setScriptModal] = useState<{ serverId: string; sitio: string; content: string } | null>(null);
  const [savingScript, setSavingScript] = useState(false);

  const loadAll = useCallback(async () => {
    const servers = await api.servers().catch(() => [] as RemoteServer[]);
    if (servers.length === 0) return;

    setStates(servers.map((s) => ({
      server: s, metrics: null, pm2: [], metricsLoading: true, pm2Loading: true, error: null,
    })));

    servers.forEach((srv) => {
      api.serverMetrics(srv.id)
        .then((m) => setStates((prev) => prev.map((s) => s.server.id === srv.id ? { ...s, metrics: m, metricsLoading: false } : s)))
        .catch((e) => setStates((prev) => prev.map((s) => s.server.id === srv.id ? { ...s, metricsLoading: false, error: e.message } : s)));

      api.serverPm2(srv.id)
        .then((p) => setStates((prev) => prev.map((s) => s.server.id === srv.id ? { ...s, pm2: p, pm2Loading: false } : s)))
        .catch(() => setStates((prev) => prev.map((s) => s.server.id === srv.id ? { ...s, pm2Loading: false } : s)));
    });
  }, []);

  useEffect(() => {
    loadAll();
    const t = setInterval(loadAll, 30000);
    return () => clearInterval(t);
  }, [loadAll]);

  async function handleRestart(serverId: string, name: string) {
    const key = `${serverId}:${name}`;
    setRestarting(key);
    try {
      await api.serverPm2Restart(serverId, name);
      toast(`${name} reiniciado`);
      const pm2 = await api.serverPm2(serverId);
      setStates((prev) => prev.map((s) => s.server.id === serverId ? { ...s, pm2 } : s));
    } catch { toast('Error al reiniciar', 'error'); }
    finally { setRestarting(null); }
  }

  async function openScriptModal(serverId: string, sitio: string) {
    const { content } = await api.serverScriptRead(serverId, sitio).catch(() => ({ content: '' }));
    setScriptModal({ serverId, sitio, content });
  }

  async function saveScript() {
    if (!scriptModal) return;
    setSavingScript(true);
    try {
      const res = await api.serverScriptSave(scriptModal.serverId, scriptModal.sitio, scriptModal.content);
      toast(`Script guardado en ${res.path}`);
      setScriptModal(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al guardar', 'error');
    } finally { setSavingScript(false); }
  }

  if (states.length === 0) {
    return (
      <>
        <div className="sec-marker reveal in">
          <span className="num">// 008</span>
          <span className="ttl">SERVIDORES</span>
        </div>
        <div className="empty-state" style={{ marginTop: 48 }}>
          <p>— No hay servidores remotos configurados</p>
          <p style={{ marginTop: 12, color: 'var(--muted)', fontSize: 12 }}>
            Agregá en el <code>.env</code> del VPS:
          </p>
          <pre style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', lineHeight: 1.8 }}>
{`SERVER_1_NAME=VPS Principal
SERVER_1_HOST=72.60.167.35
SERVER_1_USER=root
SERVER_1_PASSWORD=tu_password

SERVER_2_NAME=VPS Secundario
SERVER_2_HOST=xxx.xxx.xxx.xxx
SERVER_2_USER=root
SERVER_2_PASSWORD=tu_password`}
          </pre>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="sec-marker reveal in">
        <span className="num">// 008</span>
        <span className="ttl">SERVIDORES</span>
        <span className="meta">{states.length} configurados</span>
      </div>

      {states.map(({ server, metrics, pm2, metricsLoading, pm2Loading, error }) => (
        <div key={server.id} style={{ marginBottom: 56 }}>
          {/* Header del servidor */}
          <div className="sec-marker" style={{ marginBottom: 0, borderBottom: '1px solid var(--ink)' }}>
            <span className="num" style={{ color: 'var(--muted)' }}>{server.id}</span>
            <span className="ttl">{server.name.toUpperCase()}</span>
            <span className="meta">{server.user}@{server.host}:{server.port}</span>
          </div>

          {error ? (
            <div className="site-card" style={{ border: '1px solid var(--ink)', borderTop: 0 }}>
              <span style={{ color: 'var(--down)' }}>✗ {error}</span>
            </div>
          ) : (
            <>
              {/* Métricas */}
              <div className="sites-grid srv-metrics" style={{ '--cols': 3, marginBottom: 0 } as React.CSSProperties}>
                <div className="site-card">
                  <div className="site-card-name" style={{ marginBottom: 12 }}>CPU</div>
                  {metricsLoading ? <div className="skeleton" style={{ height: 32 }} /> : (
                    <>
                      <div className={`site-metric-value ${pctColor(metrics!.cpu.pct)}`} style={{ fontSize: 28, fontWeight: 700 }}>{metrics!.cpu.pct}%</div>
                      <div className="site-metric-label" style={{ marginTop: 6 }}>load {metrics!.cpu.load[0].toFixed(2)} · {metrics!.cpu.cores} cores</div>
                    </>
                  )}
                </div>
                <div className="site-card">
                  <div className="site-card-name" style={{ marginBottom: 12 }}>RAM</div>
                  {metricsLoading ? <div className="skeleton" style={{ height: 32 }} /> : (
                    <>
                      <div className={`site-metric-value ${pctColor(metrics!.ram.pct)}`} style={{ fontSize: 28, fontWeight: 700 }}>{metrics!.ram.pct}%</div>
                      <div className="site-metric-label" style={{ marginTop: 6 }}>{metrics!.ram.used}MB / {metrics!.ram.total}MB</div>
                    </>
                  )}
                </div>
                <div className="site-card" style={{ borderRight: 0 }}>
                  <div className="site-card-name" style={{ marginBottom: 12 }}>DISCO + UPTIME</div>
                  {metricsLoading ? <div className="skeleton" style={{ height: 32 }} /> : (
                    <>
                      {metrics!.disk && (
                        <div className={`site-metric-value ${pctColor(metrics!.disk.pct)}`} style={{ fontSize: 28, fontWeight: 700 }}>{metrics!.disk.pct}%</div>
                      )}
                      <div className="site-metric-label" style={{ marginTop: 6 }}>
                        {metrics!.disk ? `${metrics!.disk.used}MB / ${metrics!.disk.total}MB` : '—'}
                        {' · '}{fmtUptime(metrics!.uptime)}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* PM2 */}
              {(pm2Loading || pm2.length > 0) && (
                <div className="pm2-list" style={{ borderTop: 0 }}>
                  <div className="pm2-row pm2-row-head">
                    <span>Proceso</span><span>Estado</span><span>CPU</span><span>RAM</span><span>Reinicios</span><span />
                  </div>
                  {pm2Loading ? (
                    <div className="pm2-row"><div className="skeleton" style={{ height: 14, width: '60%' }} /></div>
                  ) : pm2.map((p) => (
                    <div key={p.id} className="pm2-row">
                      <span className="pm2-name">{p.name}</span>
                      <span><span className={`pm2-status ${p.status}`}><span className="pm2-status-dot" />{p.status}</span></span>
                      <span className={p.cpu > 80 ? 'hist-warn' : ''}>{p.cpu}%</span>
                      <span>{(p.memory / 1024 / 1024).toFixed(1)}MB</span>
                      <span className={p.restarts > 5 ? 'hist-warn' : ''}>{p.restarts}</span>
                      <span>
                        <button className="btn-resolve" onClick={() => handleRestart(server.id, p.name)} disabled={restarting === `${server.id}:${p.name}`}>
                          {restarting === `${server.id}:${p.name}` ? '...' : '↺'}
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ))}

      {/* Modal script */}
      {scriptModal && (
        <div className="modal-overlay" style={{ zIndex: 100 }}>
          <div className="modal-box" style={{ maxWidth: 800, maxHeight: '80vh' }}>
            <div className="sec-marker" style={{ margin: 0, padding: '16px 24px', borderBottom: '1px solid var(--ink)' }}>
              <span className="ttl">SCRIPT — {scriptModal.sitio}</span>
              <span className="meta" style={{ marginLeft: 'auto', cursor: 'pointer', color: 'var(--muted)' }} onClick={() => setScriptModal(null)}>✕ cerrar</span>
            </div>
            <textarea
              value={scriptModal.content}
              onChange={(e) => setScriptModal({ ...scriptModal, content: e.target.value })}
              placeholder={'#!/bin/bash\n\n# Tu script de deploy aquí\ncd /var/www/mi-sitio\ngit pull origin main\nnpm install\npm2 restart mi-app'}
              style={{
                flex: 1, resize: 'none', background: '#111110', color: '#f0ece2',
                fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6,
                border: 0, outline: 'none', padding: 24, minHeight: 320,
              }}
            />
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--ink)', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn-check-now" onClick={() => setScriptModal(null)}>Cancelar</button>
              <button className="btn-deploy btn-deploy-run" onClick={saveScript} disabled={savingScript}>
                <span>{savingScript ? 'Guardando...' : 'Guardar en VPS'}</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
