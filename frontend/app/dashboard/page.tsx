'use client';

import { useEffect, useState } from 'react';
import { api, type Pm2Process } from '@/lib/api';
import { useStatus } from '@/components/StatusContext';
import { useToast } from '@/components/Toast';

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  return `hace ${Math.floor(diff / 3600)}h`;
}

function sslColor(d: number) { return d < 14 ? 'crit' : d < 30 ? 'warn' : ''; }
function latColor(ms: number) { return ms > 2000 ? 'crit' : ms > 800 ? 'warn' : ''; }

export default function DashboardPage() {
  const { sites, alerts, connected } = useStatus();
  const { toast } = useToast();
  const [pm2, setPm2]           = useState<Pm2Process[]>([]);
  const [checking, setChecking] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [restarting, setRestarting] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateOutput, setUpdateOutput] = useState('');

  useEffect(() => {
    api.pm2().catch(() => []).then(setPm2);
  }, []);

  async function handleForceCheck() {
    setChecking(true);
    try { await api.forceCheck(); }
    finally { setChecking(false); }
  }

  async function handlePm2Restart(name: string) {
    setRestarting(name);
    try {
      await api.pm2Restart(name);
      toast(`${name} reiniciado`);
      setPm2(await api.pm2());
    } catch { toast('Error al reiniciar', 'error'); }
    finally { setRestarting(null); }
  }

  async function handleResolve(id: string) {
    setResolving(id);
    try {
      await api.resolverAlerta(id);
      toast('Alerta resuelta');
    } catch { toast('Error al resolver', 'error'); }
    finally { setResolving(null); }
  }

  async function handleVpsUpdate() {
    setUpdating(true);
    setUpdateOutput('Iniciando actualización...\n');
    try {
      const res = await api.systemUpdate();
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setUpdateOutput((p) => p + decoder.decode(value));
      }
      toast('VPS actualizado correctamente');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al actualizar', 'error');
    } finally {
      setUpdating(false);
    }
  }

  const activeAlerts = alerts.filter((a) => !a.resuelta);
  const loading      = sites.length === 0 && !connected;

  return (
    <>
      {/* ── Estado ── */}
      <div className="sec-marker reveal in">
        <span className="num">// 001</span>
        <span className="ttl">ESTADO_DEL_SISTEMA</span>
        <span className="meta">
          {loading ? 'conectando...' : `${sites.filter((s) => s.online).length}/${sites.length} online`}
          {connected && <span style={{ color: 'var(--up)', marginLeft: 8 }}>● live</span>}
        </span>
        <button className="btn-check-now" onClick={handleForceCheck} disabled={checking}>
          {checking ? 'Checking...' : 'Check ahora →'}
        </button>
      </div>

      {loading ? (
        <div className="sites-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="site-card">
              <div className="skeleton" style={{ height: 24, width: '60%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 80 }} />
              <div className="skeleton" style={{ height: 14, width: '40%' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="sites-grid reveal in">
          {sites.map((site) => (
            <div key={site.id} className="site-card">
              <div className="site-card-head">
                <div>
                  <div className="site-card-name">{site.nombre}</div>
                  <div className="site-card-url">{site.url.replace('https://', '')}</div>
                </div>
                <span className={`status-pill ${site.online ? 'up' : 'down'}`}>
                  <span className="status-pill-dot" />
                  {site.online ? 'Online' : 'Down'}
                </span>
              </div>
              <div className="site-metrics">
                <div className="site-metric">
                  <div className="site-metric-label">Latencia</div>
                  <div className={`site-metric-value ${latColor(site.latencia)}`}>{site.latencia}ms</div>
                </div>
                <div className="site-metric">
                  <div className="site-metric-label">HTTP</div>
                  <div className={`site-metric-value ${site.status >= 400 ? 'crit' : ''}`}>{site.status || '—'}</div>
                </div>
                <div className="site-metric">
                  <div className="site-metric-label">SSL días</div>
                  <div className={`site-metric-value ${site.ssl ? sslColor(site.ssl.diasRestantes) : 'crit'}`}>
                    {site.ssl ? `${site.ssl.diasRestantes}d` : '—'}
                  </div>
                </div>
                <div className="site-metric">
                  <div className="site-metric-label">IP</div>
                  <div className="site-metric-value" style={{ fontSize: 13 }}>{site.ip || '—'}</div>
                </div>
              </div>
              <div className="site-card-footer">Actualizado {timeAgo(site.timestamp)}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Alertas ── */}
      <div className="sec-marker reveal in d2">
        <span className="num">// 002</span>
        <span className="ttl">ALERTAS_ACTIVAS</span>
        <span className="meta">{activeAlerts.length} sin resolver</span>
      </div>

      {activeAlerts.length === 0 ? (
        <p className="empty-state">— Sin alertas activas</p>
      ) : (
        <div className="alert-list reveal in d2">
          <div className="alert-row alert-row-head">
            <span>Severidad</span><span>Mensaje</span><span>Tipo</span>
            <span className="alert-time">Hace</span><span />
          </div>
          {activeAlerts.map((alert) => (
            <div key={alert.id} className="alert-row">
              <span>
                <span className={`alert-badge ${alert.severidad}`}>
                  <span className="alert-badge-dot" />{alert.severidad}
                </span>
              </span>
              <span>{alert.mensaje}</span>
              <span style={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.08em', color: 'var(--muted)' }}>{alert.tipo}</span>
              <span className="alert-time" style={{ color: 'var(--muted)', fontSize: 11 }}>{timeAgo(alert.timestamp)}</span>
              <span>
                <button className="btn-resolve" onClick={() => handleResolve(alert.id)} disabled={resolving === alert.id}>
                  {resolving === alert.id ? '...' : '✓'}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── PM2 ── */}
      {pm2.length > 0 && (
        <>
          <div className="sec-marker reveal in d2" style={{ marginTop: 48 }}>
            <span className="num">// 003</span>
            <span className="ttl">PROCESOS_PM2</span>
            <span className="meta">{pm2.filter((p) => p.status === 'online').length}/{pm2.length} online</span>
          </div>
          <div className="pm2-list reveal in d2">
            <div className="pm2-row pm2-row-head">
              <span>Proceso</span><span>Estado</span><span>CPU</span><span>RAM</span><span>Reinicios</span><span />
            </div>
            {pm2.map((p) => (
              <div key={p.id} className="pm2-row">
                <span className="pm2-name">{p.name}</span>
                <span><span className={`pm2-status ${p.status}`}><span className="pm2-status-dot" />{p.status}</span></span>
                <span className={p.cpu > 80 ? 'hist-warn' : ''}>{p.cpu}%</span>
                <span>{(p.memory / 1024 / 1024).toFixed(1)}MB</span>
                <span className={p.restarts > 5 ? 'hist-warn' : ''}>{p.restarts}</span>
                <span>
                  <button className="btn-resolve" onClick={() => handlePm2Restart(p.name)} disabled={restarting === p.name}>
                    {restarting === p.name ? '...' : '↺'}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── VPS Update ── */}
      <div className="sec-marker reveal in d3" style={{ marginTop: 48 }}>
        <span className="num">// sys</span>
        <span className="ttl">SISTEMA</span>
        <button
          className="btn-check-now"
          onClick={handleVpsUpdate}
          disabled={updating}
          style={{ marginLeft: 'auto' }}
        >
          {updating ? 'Actualizando...' : 'apt upgrade →'}
        </button>
      </div>

      {updateOutput && (
        <div className="deploy-terminal reveal in">
          <div className="deploy-terminal-bar">
            <span className="deploy-terminal-dot" />
            <span className="deploy-terminal-dot" />
            <span className="deploy-terminal-dot" />
            <span className="deploy-terminal-title">
              {updating ? '● apt update && apt upgrade -y' : '✓ Actualización completada'}
            </span>
          </div>
          <pre className="deploy-terminal-output" style={{ maxHeight: 320 }}>{updateOutput}</pre>
        </div>
      )}
    </>
  );
}
