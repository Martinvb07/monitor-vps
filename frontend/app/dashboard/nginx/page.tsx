'use client';

import { useEffect, useState } from 'react';
import { api, type NginxConfig, type RemoteServer } from '@/lib/api';
import { useToast } from '@/components/Toast';
import Select from '@/components/Select';


export default function NginxPage() {
  const { toast } = useToast();
  const [servers, setServers]   = useState<RemoteServer[]>([]);
  const [serverId, setServerId] = useState<string>('');
  const [configs, setConfigs]   = useState<NginxConfig[]>([]);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState<NginxConfig | null>(null);
  const [content, setContent]   = useState('');
  const [original, setOriginal] = useState('');
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]   = useState(false);
  const [reloading, setReloading] = useState(false);
  const [testOutput, setTestOutput] = useState<{ ok: boolean; output: string } | null>(null);

  useEffect(() => {
    api.servers().then(s => { setServers(s); if (s.length > 0) setServerId(s[0].id); }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true); setSelected(null); setConfigs([]);
    api.nginxConfigs(serverId || undefined).then(setConfigs).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  }, [serverId]);

  async function openConfig(c: NginxConfig) {
    setSelected(c); setContent(''); setOriginal(''); setTestOutput(null);
    try {
      const { content: txt } = await api.nginxRead(c.path, serverId || undefined);
      setContent(txt); setOriginal(txt);
    } catch (e) { toast(e instanceof Error ? e.message : 'Error', 'error'); }
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      await api.nginxSave(selected.path, content, serverId || undefined);
      setOriginal(content);
      toast('Guardado · backup .bak creado');
    } catch (e) { toast(e instanceof Error ? e.message : 'Error', 'error'); }
    finally { setSaving(false); }
  }

  async function test() {
    setTesting(true);
    try {
      const res = await api.nginxTest(serverId || undefined);
      setTestOutput(res);
      toast(res.ok ? 'nginx -t OK' : 'Error en config', res.ok ? 'success' : 'error');
    } finally { setTesting(false); }
  }

  async function reload() {
    setReloading(true);
    try {
      const res = await api.nginxReload(serverId || undefined);
      toast(res.ok ? 'Nginx recargado' : res.output, res.ok ? 'success' : 'error');
    } finally { setReloading(false); }
  }

  async function toggle(c: NginxConfig) {
    try {
      await api.nginxToggle(c.name, !c.enabled, serverId || undefined);
      setConfigs(prev => prev.map(x => x.name === c.name ? { ...x, enabled: !x.enabled } : x));
      toast(`${c.name} ${!c.enabled ? 'habilitado' : 'deshabilitado'}`);
    } catch (e) { toast(e instanceof Error ? e.message : 'Error', 'error'); }
  }

  const isDirty = content !== original;

  return (
    <>
      <div className="sec-marker reveal in">
        <span className="num">// nginx</span>
        <span className="ttl">NGINX EDITOR</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>SERVIDOR</span>
          <Select
            value={serverId}
            onChange={setServerId}
            options={[
              { value: '', label: 'Local' },
              ...servers.map(s => ({ value: s.id, label: `${s.name} (${s.host})` })),
            ]}
          />
          <button className="btn-check-now" onClick={test} disabled={testing || !selected}>
            {testing ? 'Testeando...' : 'nginx -t →'}
          </button>
          <button className="btn-deploy btn-deploy-run" onClick={reload} disabled={reloading} style={{ padding: '6px 14px' }}>
            <span>{reloading ? 'Recargando...' : 'Reload'}</span><span>↺</span>
          </button>
        </div>
      </div>

      <div className="split-panel">
        <div className="split-panel-sidebar">
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.06em' }}>
            SITES-AVAILABLE
          </div>
          {loading ? (
            <div style={{ padding: 16 }}><div className="skeleton" style={{ height: 14 }} /></div>
          ) : configs.length === 0 ? (
            <p style={{ padding: 16, color: 'var(--muted)', fontSize: 12 }}>
              {serverId ? '— Sin configs vía SSH' : '— Sin configs locales'}
            </p>
          ) : configs.map(c => (
            <div key={c.name}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--rule)',
                background: selected?.name === c.name ? 'var(--paper-2)' : undefined,
                display: 'flex', alignItems: 'center', gap: 8 }}
              onClick={() => openConfig(c)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600 }}>{c.name}</div>
                {c.size != null && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{(c.size/1024).toFixed(1)}KB</div>}
              </div>
              {c.name !== 'nginx.conf' && (
                <button onClick={e => { e.stopPropagation(); toggle(c); }}
                  style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 7px',
                    border: '1px solid currentColor', background: 'none', cursor: 'pointer',
                    color: c.enabled ? 'var(--up)' : 'var(--muted)', letterSpacing: '0.05em' }}>
                  {c.enabled ? 'ON' : 'OFF'}
                </button>
              )}
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
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--ink)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, flex: 1, color: 'var(--muted)' }}>{selected.path}</span>
                {isDirty && <span style={{ fontSize: 10, color: 'var(--warn)', fontFamily: 'var(--font-mono)' }}>● sin guardar</span>}
                <button className="btn-check-now" onClick={() => setContent(original)} disabled={!isDirty} style={{ fontSize: 11 }}>Descartar</button>
                <button className="btn-deploy btn-deploy-run" onClick={save} disabled={saving || !isDirty} style={{ padding: '6px 14px' }}>
                  <span>{saving ? 'Guardando...' : 'Guardar'}</span><span>→</span>
                </button>
              </div>
              <textarea value={content} onChange={e => setContent(e.target.value)}
                style={{ flex: 1, resize: 'none', background: '#111110', color: '#f0ece2',
                  fontFamily: '"Cascadia Code","Fira Code",monospace', fontSize: 13,
                  lineHeight: 1.75, border: 0, outline: 'none', padding: '16px 20px', minHeight: 460 }} />
              {testOutput && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--ink)',
                  background: testOutput.ok ? 'rgba(26,138,74,0.08)' : 'rgba(230,51,25,0.08)',
                  fontFamily: 'monospace', fontSize: 12, color: testOutput.ok ? 'var(--up)' : 'var(--down)' }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{testOutput.output}</pre>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <p style={{ marginTop: 12, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
        Backup automático (.bak) · Siempre hacé nginx -t antes de reload
      </p>
    </>
  );
}
