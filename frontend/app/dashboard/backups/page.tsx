'use client';

import { useEffect, useRef, useState } from 'react';
import { SiMysql, SiMongodb, SiPostgresql, SiNginx } from 'react-icons/si';
import { FaFolder } from 'react-icons/fa';
import { api, type BackupDetect, type BackupEntry } from '@/lib/api';
import { useToast } from '@/components/Toast';

const COMPONENTS: Record<string, {
  label: string;
  icon: React.ReactNode;
  color: string;
  key: keyof BackupDetect | 'nginx' | 'www';
  detailKey: string;
  detailTitle: string;
}> = {
  mysql:    { label: 'MySQL',      icon: <SiMysql    size={38} color="#4479A1" />, color: '#4479A1', key: 'mysql',    detailKey: 'mysql',    detailTitle: 'Bases de datos MySQL' },
  mongo:    { label: 'MongoDB',    icon: <SiMongodb  size={38} color="#13AA52" />, color: '#13AA52', key: 'mongo',    detailKey: 'mongo',    detailTitle: 'Bases de datos MongoDB' },
  postgres: { label: 'PostgreSQL', icon: <SiPostgresql size={38} color="#336791" />, color: '#336791', key: 'postgres', detailKey: 'postgres', detailTitle: 'Bases de datos PostgreSQL' },
  nginx:    { label: 'Nginx',      icon: <SiNginx    size={38} color="#009900" />, color: '#009900', key: 'nginx',    detailKey: 'nginx',    detailTitle: 'Configuraciones Nginx' },
  www:      { label: '/var/www',   icon: <FaFolder   size={38} color="#4a9eff" />, color: '#4a9eff', key: 'www',      detailKey: 'www',      detailTitle: 'Directorios en /var/www' },
};

function fmtDateOnly(ts: string) {
  try { return new Date(ts).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return ts; }
}
function fmtTimeOnly(ts: string) {
  try { return new Date(ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

const COMP_FILE: Record<string, string> = {
  mysql: 'mysql.sql.gz', mongo: 'mongodb.gz', postgres: 'postgres.sql.gz',
  nginx: 'nginx.tar.gz', www: 'www.tar.gz',
};

// ── Modal de detalles ─────────────────────────────────────────────
function DetailsModal({ type, onClose, onBackupDone }: { type: string; onClose: () => void; onBackupDone?: () => void }) {
  const meta = COMPONENTS[type];
  const [items, setItems]       = useState<{ name: string; meta?: string }[] | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [dlItem, setDlItem]     = useState<string | null>(null);  // name of item being downloaded
  const [dlErr, setDlErr]       = useState('');
  const [allStatus, setAllStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [allMsg, setAllMsg]     = useState('');

  useEffect(() => {
    api.backupDetails(meta.detailKey)
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [type]);

  async function triggerDownload(id: string, file: string) {
    const res = await api.backupDownloadFile(id, file);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Descarga UN ítem individual — el backend lo guarda en backup dir y devuelve { id, file }
  async function downloadItem(name: string) {
    setDlItem(name);
    setDlErr('');
    try {
      const res = await api.backupDownloadItem(type, name);
      const body = await res.json().catch(() => ({})) as { error?: string; id?: string; file?: string };
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      await triggerDownload(body.id!, body.file!);
      onBackupDone?.();
    } catch (e) {
      setDlErr(e instanceof Error ? e.message : 'Error al descargar');
    } finally {
      setDlItem(null);
    }
  }

  // Backup completo del componente → descarga el archivo
  async function downloadAll() {
    setAllStatus('running');
    setAllMsg('Generando backup completo...');
    try {
      const res = await api.backupRun([type]);
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value);
        full += chunk;
        const line = chunk.split('\n').filter((l) => l && !l.startsWith('COMPLETE:')).pop();
        if (line) setAllMsg(line.replace(/^\[.*?\]\s*/, '').trim());
      }
      const match = full.match(/COMPLETE:([^E\n].+)/);
      if (!match) throw new Error('No se recibió confirmación');
      const id = match[1].trim();
      const file = COMP_FILE[type];
      await triggerDownload(id, file);
      setAllStatus('done');
      setAllMsg(`Descargando ${file}`);
      onBackupDone?.();
    } catch (e) {
      setAllStatus('error');
      setAllMsg(e instanceof Error ? e.message : 'Error');
    }
  }

  const allColor = allStatus === 'done' ? 'var(--up)' : allStatus === 'error' ? 'var(--down)' : 'var(--warn)';

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--paper)', border: '1px solid var(--ink)', minWidth: 420, maxWidth: 560, width: '92%', maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--rule)' }}>
          <div style={{ flexShrink: 0 }}>{meta.icon}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{meta.detailTitle}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Clic en ↓ para descargar individualmente</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', fontSize: 18, color: 'var(--muted)', lineHeight: 1 }}>✕</button>
        </div>

        {/* Lista de ítems con botón de descarga individual */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '24px 20px', color: 'var(--muted)', fontSize: 13 }}>Consultando servidor...</div>
          ) : error ? (
            <div style={{ padding: '24px 20px', color: 'var(--down)', fontSize: 13 }}>{error}</div>
          ) : !items?.length ? (
            <div style={{ padding: '24px 20px', color: 'var(--muted)', fontSize: 13 }}>— Sin datos disponibles</div>
          ) : (
            <>
              {items.map((item, i) => {
                const displayName = item.name?.split('/').pop() || item.name;
                const isDownloading = dlItem === item.name;
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px 9px 20px',
                    borderBottom: i < items.length - 1 ? '1px solid var(--rule)' : 'none',
                    background: isDownloading ? 'var(--hover)' : 'transparent',
                  }}>
                    <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600 }}>
                      {displayName}
                    </span>
                    {item.meta && (
                      <span style={{ fontSize: 11, color: item.meta === 'enabled' ? 'var(--up)' : 'var(--muted)', flexShrink: 0 }}>
                        {item.meta === 'enabled' ? '● activo' : item.meta === 'disabled' ? '○ inactivo' : item.meta}
                      </span>
                    )}
                    <button
                      onClick={() => downloadItem(item.name)}
                      disabled={dlItem !== null}
                      title={`Descargar ${displayName}`}
                      style={{
                        flexShrink: 0, border: '1px solid var(--rule)', background: 'transparent',
                        borderRadius: 3, padding: '4px 10px', fontSize: 12, cursor: dlItem ? 'not-allowed' : 'pointer',
                        color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: 30,
                      }}
                    >
                      {isDownloading
                        ? <span className="spinner spinner-sm" style={{ borderTopColor: meta.color }} />
                        : '↓'}
                    </button>
                  </div>
                );
              })}
              {dlErr && (
                <div style={{ padding: '8px 20px', fontSize: 11, color: 'var(--down)', borderTop: '1px solid var(--rule)' }}>
                  ✗ {dlErr}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — descargar TODO el componente de una vez */}
        <div style={{ borderTop: '1px solid var(--rule)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn-check-now"
            onClick={downloadAll}
            disabled={allStatus === 'running' || dlItem !== null}
            style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 7 }}
          >
            {allStatus === 'running'
              ? <><span className="spinner spinner-sm" style={{ borderTopColor: meta.color }} /> Generando...</>
              : `↓ Descargar todo (${COMP_FILE[type]})`}
          </button>
          {allStatus !== 'idle' && (
            <span style={{ fontSize: 11, color: allColor, fontFamily: 'var(--font-mono)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {allStatus === 'done' ? '✓' : allStatus === 'error' ? '✗' : '●'} {allMsg}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────
export default function BackupsPage() {
  const { toast } = useToast();
  const termRef   = useRef<HTMLPreElement>(null);

  const [detect, setDetect]           = useState<BackupDetect | null>(null);
  const [detecting, setDetecting]     = useState(true);
  const [backups, setBackups]         = useState<BackupEntry[]>([]);
  const [backupDir, setBackupDir]     = useState('');
  const [newDir, setNewDir]           = useState('');
  const [savingDir, setSavingDir]     = useState(false);
  const [selected, setSelected]       = useState<Record<string, boolean>>({});
  const [running, setRunning]         = useState(false);
  const [output, setOutput]           = useState('');
  const [deleting, setDeleting]       = useState<string | null>(null);
  const [modal, setModal]             = useState<string | null>(null);

  useEffect(() => { loadDetect(); loadBackups(); }, []);
  useEffect(() => { if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight; }, [output]);

  async function triggerDownload(id: string, file: string) {
    const res = await api.backupDownloadFile(id, file);
    if (!res.ok) { toast(`Error al descargar (HTTP ${res.status})`, 'error'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = file; a.click();
    URL.revokeObjectURL(url);
  }

  async function loadDetect() {
    setDetecting(true);
    try {
      const d = await api.backupDetect();
      setDetect(d);
      // Preseleccionar componentes detectados
      setSelected({
        mysql:    d.mysql,
        mongo:    d.mongo,
        postgres: d.postgres,
        nginx:    true,
        www:      true,
      });
    } catch { /* sin SSH */ }
    finally { setDetecting(false); }
  }

  async function loadBackups() {
    try {
      const data = await api.backupList();
      setBackups(data.backups);
      setBackupDir(data.backupDir);
      setNewDir(data.backupDir);
    } catch { /* silencioso */ }
  }

  async function handleSaveDir() {
    if (!newDir.trim()) return;
    setSavingDir(true);
    try {
      const r = await api.backupSetConfig(newDir.trim());
      setBackupDir(r.backupDir);
      toast('Carpeta de backup guardada');
      await loadBackups();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al guardar', 'error');
    } finally { setSavingDir(false); }
  }

  async function handleRun() {
    const types = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (!types.length) { toast('Seleccioná al menos un componente', 'warn'); return; }
    setRunning(true);
    setOutput('');
    try {
      const res = await api.backupRun(types);
      const reader = res.body!.getReader();
      const dec    = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setOutput((p) => p + dec.decode(value));
      }
      toast('Backup completado');
      await loadBackups();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error en el backup', 'error');
    } finally { setRunning(false); }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await api.backupDelete(id);
      toast('Backup eliminado');
      setBackups((b) => b.filter((x) => x.id !== id));
    } catch { toast('Error al eliminar', 'error'); }
    finally { setDeleting(null); }
  }

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <>
      {modal && <DetailsModal type={modal} onClose={() => setModal(null)} onBackupDone={loadBackups} />}

      {/* Header */}
      <div className="sec-marker reveal in">
        <span className="num">// backup</span>
        <span className="ttl">SISTEMA_DE_BACKUPS</span>
        <span className="meta">guardados localmente · {selectedCount} componentes</span>
        <button
          className="btn-deploy"
          onClick={handleRun}
          disabled={running || detecting}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {running
            ? <><span className="spinner spinner-sm" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /><span>Realizando backup...</span></>
            : <><span>{`Backup (${selectedCount})`}</span><span>→</span></>}
        </button>
      </div>

      {/* Componentes detectados — click abre modal, checkbox selecciona */}
      <div className="sec-marker reveal in d1" style={{ marginTop: 8, borderTop: 'none' }}>
        <span className="num">// detectado</span>
        <span className="ttl">COMPONENTES</span>
        <span className="meta" style={{ fontSize: 11, color: 'var(--muted)' }}>
          clic para ver detalles · checkbox para incluir en backup
        </span>
      </div>

      <div className="sites-grid reveal in d1" style={{ '--cols': 5 } as React.CSSProperties}>
        {Object.entries(COMPONENTS).map(([key, comp], idx) => {
          const isLast    = idx === Object.keys(COMPONENTS).length - 1;
          const isActive  = detect ? !!detect[comp.key as keyof BackupDetect] : false;
          const isChecked = !!selected[key];

          return (
            <div
              key={key}
              className="site-card"
              style={{
                borderRight: isLast ? 0 : undefined,
                opacity: isActive ? 1 : 0.4,
                cursor: isActive ? 'pointer' : 'default',
                position: 'relative',
                transition: 'background 0.15s',
              }}
              onClick={() => isActive && setModal(key)}
            >
              {/* Checkbox arriba a la derecha */}
              <div
                style={{ position: 'absolute', top: 12, right: 12 }}
                onClick={(e) => { e.stopPropagation(); if (isActive) setSelected((s) => ({ ...s, [key]: !s[key] })); }}
              >
                <div style={{
                  width: 16, height: 16, border: `2px solid ${isChecked && isActive ? comp.color : 'var(--rule)'}`,
                  background: isChecked && isActive ? comp.color : 'transparent',
                  borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}>
                  {isChecked && isActive && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>{comp.icon}</div>
              <div className="site-card-name" style={{ fontSize: 13 }}>{comp.label}</div>

              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {detecting ? (
                  <div className="skeleton" style={{ height: 18, width: '70%' }} />
                ) : (
                  <>
                    <span className={`status-pill ${isActive ? 'up' : 'down'}`} style={{ fontSize: 9, width: 'fit-content' }}>
                      <span className="status-pill-dot" />
                      {isActive ? 'Detectado' : 'No instalado'}
                    </span>
                    {isActive && (
                      <span style={{ fontSize: 10, color: comp.color, marginTop: 2 }}>
                        Ver detalles →
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Carpeta de destino configurable */}
      <div style={{ marginTop: 0, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderTop: '1px solid var(--rule)' }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>Carpeta destino:</span>
        <input
          className="field-input"
          style={{ flex: 1, minWidth: 200, fontSize: 12, padding: '6px 10px' }}
          value={newDir}
          onChange={(e) => setNewDir(e.target.value)}
          placeholder="C:\Users\marti\Desktop\backups"
          onKeyDown={(e) => e.key === 'Enter' && handleSaveDir()}
        />
        <button className="btn-check-now" onClick={handleSaveDir} disabled={savingDir || newDir === backupDir}>
          {savingDir ? 'Guardando...' : 'Guardar →'}
        </button>
      </div>

      {/* Terminal de progreso */}
      {output && (
        <>
          <div className="sec-marker reveal in d2" style={{ marginTop: 32 }}>
            <span className="num">// output</span>
            <span className="ttl">PROGRESO</span>
            <span className="meta" style={{ color: running ? 'var(--warn)' : 'var(--up)' }}>
              {running ? '● corriendo' : '✓ completado'}
            </span>
          </div>
          <div className="deploy-terminal reveal in d2">
            <div className="deploy-terminal-bar">
              <span className="deploy-terminal-dot" /><span className="deploy-terminal-dot" /><span className="deploy-terminal-dot" />
              <span className="deploy-terminal-title">{running ? '● backup en curso...' : '✓ backup completado'}</span>
            </div>
            <pre className="deploy-terminal-output" ref={termRef} style={{ maxHeight: 320 }}>{output}</pre>
          </div>
        </>
      )}

      {/* Lista de backups */}
      <div className="sec-marker reveal in d2" style={{ marginTop: 32 }}>
        <span className="num">// guardados</span>
        <span className="ttl">BACKUPS</span>
        <span className="meta">{backups.length} {backups.length === 1 ? 'backup' : 'backups'}</span>
        <button className="btn-check-now" onClick={loadBackups} style={{ marginLeft: 'auto' }}>Refrescar →</button>
      </div>

      {backups.length === 0 ? (
        <p className="empty-state">— Aún no hay backups guardados.</p>
      ) : (
        backups.map((b) => (
          <div key={b.id} className="settings-card reveal in" style={{ marginBottom: 12 }}>
            <div className="settings-row" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                {/* Nombre del archivo o "Backup completo" */}
                <div style={{ fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-mono)', marginBottom: 5 }}>
                  {b.files.length === 1 ? b.files[0].name : `Backup completo · ${b.files.length} archivos`}
                </div>
                {/* Fecha | Hora */}
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{fmtDateOnly(b.timestamp)}</span>
                  <span style={{ color: 'var(--rule)' }}>|</span>
                  <span>{fmtTimeOnly(b.timestamp)}</span>
                </div>
                {/* Fuente · tamaño */}
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{b.source === 'ssh' ? `SSH → ${b.host}` : `Local — ${b.host}`}</span>
                  <span style={{ color: 'var(--rule)' }}>·</span>
                  <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{b.totalSizeHuman}</span>
                </div>
                {/* Badges de componentes */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(b.components).map(([key, comp]) => {
                    const meta = COMPONENTS[key] || COMPONENTS.www;
                    return (
                      <span key={key} style={{
                        fontSize: 10, padding: '2px 8px',
                        border: `1px solid ${comp.ok ? meta.color : 'var(--down)'}`,
                        color: comp.ok ? meta.color : 'var(--down)', borderRadius: 2,
                      }}>
                        {meta.label} {comp.ok ? '' : '✗'}
                      </span>
                    );
                  })}
                </div>
              </div>
              <button
                className="btn-resolve" title="Eliminar"
                onClick={() => handleDelete(b.id)} disabled={deleting === b.id}
                style={{ color: 'var(--down)', fontSize: 14 }}
              >
                {deleting === b.id ? '...' : '✕'}
              </button>
            </div>

            <div style={{ marginTop: 14, borderTop: '1px solid var(--rule)', paddingTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {b.files.map((f) => (
                <button
                  key={f.name}
                  className="btn-check-now"
                  onClick={() => triggerDownload(b.id, f.name)}
                  style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  ↓ {f.name}
                  <span style={{ color: 'var(--muted)', fontSize: 10 }}>{f.sizeHuman}</span>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}
