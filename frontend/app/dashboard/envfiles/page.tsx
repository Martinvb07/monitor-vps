'use client';

import { useEffect, useState } from 'react';
import { api, type EnvFile, type RemoteServer } from '@/lib/api';
import { useToast } from '@/components/Toast';
import Select from '@/components/Select';

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return `hace ${d}s`;
  if (d < 3600) return `hace ${Math.floor(d/60)}m`;
  if (d < 86400) return `hace ${Math.floor(d/3600)}h`;
  return `hace ${Math.floor(d/86400)}d`;
}


export default function EnvFilesPage() {
  const { toast } = useToast();
  const [servers, setServers]   = useState<RemoteServer[]>([]);
  const [serverId, setServerId] = useState<string>('');
  const [files, setFiles]       = useState<EnvFile[]>([]);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState<EnvFile | null>(null);
  const [content, setContent]   = useState('');
  const [original, setOriginal] = useState('');
  const [saving, setSaving]     = useState(false);
  const [searching, setSearching] = useState('');

  useEffect(() => {
    api.servers().then(s => { setServers(s); if (s.length > 0) setServerId(s[0].id); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (serverId === undefined) return;
    setLoading(true);
    setSelected(null);
    setFiles([]);
    api.envFiles(serverId || undefined).then(setFiles).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  }, [serverId]);

  async function openFile(f: EnvFile) {
    setSelected(f); setContent(''); setOriginal('');
    try {
      const { content: c } = await api.envFileRead(f.id, serverId || undefined);
      setContent(c); setOriginal(c);
    } catch (e) { toast(e instanceof Error ? e.message : 'Error', 'error'); }
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await api.envFileSave(selected.id, content, serverId || undefined);
      setOriginal(content);
      toast(`Guardado · backup: ${res.backup}`);
    } catch (e) { toast(e instanceof Error ? e.message : 'Error', 'error'); }
    finally { setSaving(false); }
  }

  const filtered = files.filter(f =>
    f.project.toLowerCase().includes(searching.toLowerCase()) ||
    f.file.toLowerCase().includes(searching.toLowerCase())
  );
  const isDirty = content !== original;
  const currentServer = servers.find(s => s.id === serverId);

  return (
    <>
      <div className="sec-marker reveal in">
        <span className="num">// env</span>
        <span className="ttl">VARIABLES DE ENTORNO</span>
        <span className="meta">{files.length} archivos</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>SERVIDOR</span>
          <Select
            value={serverId}
            onChange={setServerId}
            options={[
              { value: '', label: 'Local (VPS donde corre el panel)' },
              ...servers.map(s => ({ value: s.id, label: `${s.name} (${s.host})` })),
            ]}
          />
        </div>
      </div>

      {serverId && currentServer && (
        <div style={{ padding: '8px 0', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>
          SSH → {currentServer.user}@{currentServer.host} · escaneando {process.env.NEXT_PUBLIC_ENV_SEARCH_DIRS || '/var/www'}
        </div>
      )}

      <div className="split-panel">
        <div className="split-panel-sidebar">
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--ink)' }}>
            <input className="field-input" placeholder="Buscar proyecto..." value={searching}
              onChange={e => setSearching(e.target.value)} style={{ fontSize: 12 }} />
          </div>
          {loading ? (
            <div style={{ padding: 16 }}><div className="skeleton" style={{ height: 14, marginBottom: 8 }} /></div>
          ) : filtered.length === 0 ? (
            <p style={{ padding: 16, color: 'var(--muted)', fontSize: 12 }}>
              {files.length === 0
                ? serverId
                  ? '— Sin .env encontrados vía SSH. ¿Está bien configurado ENV_SEARCH_DIRS?'
                  : '— Sin archivos locales. Configura ENV_SEARCH_DIRS=/var/www en .env'
                : '— Sin resultados'}
            </p>
          ) : filtered.map(f => (
            <div key={f.id} onClick={() => openFile(f)}
              style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--rule)',
                background: selected?.id === f.id ? 'var(--paper-2)' : undefined, transition: 'background 0.15s' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{f.project}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.path}</div>
              <span style={{ fontSize: 10, color: 'var(--up)', fontFamily: 'var(--font-mono)' }}>{f.file}</span>
            </div>
          ))}
        </div>

        <div className="split-panel-main">
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
              ← Seleccioná un archivo
            </div>
          ) : (
            <>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--ink)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, flex: 1, color: 'var(--muted)' }}>{selected.path}</span>
                {isDirty && <span style={{ fontSize: 10, color: 'var(--warn)', fontFamily: 'var(--font-mono)' }}>● sin guardar</span>}
                <button className="btn-check-now" onClick={() => setContent(original)} disabled={!isDirty} style={{ fontSize: 11 }}>Descartar</button>
                <button className="btn-deploy btn-deploy-run" onClick={save} disabled={saving || !isDirty} style={{ padding: '6px 16px' }}>
                  <span>{saving ? 'Guardando...' : 'Guardar'}</span><span>→</span>
                </button>
              </div>
              <textarea value={content} onChange={e => setContent(e.target.value)}
                style={{ flex: 1, resize: 'none', background: '#111110', color: '#f0ece2',
                  fontFamily: '"Cascadia Code","Fira Code",monospace', fontSize: 13,
                  lineHeight: 1.75, border: 0, outline: 'none', padding: '16px 20px', minHeight: 460 }} />
            </>
          )}
        </div>
      </div>
      <p style={{ marginTop: 12, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
        Backup automático (.bak) antes de cada guardado
      </p>
    </>
  );
}
