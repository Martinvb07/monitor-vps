'use client';

import { useEffect, useState } from 'react';
import { api, type Snippet, type RemoteServer } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import Select from '@/components/Select';

type RunResult = { snippetId: string; ok: boolean; output: string; duration: number };

type ModalState = { mode: 'create' } | { mode: 'edit'; snippet: Snippet };

export default function SnippetsPage() {
  const { toast }  = useToast();
  const confirm    = useConfirm();
  const [snippets, setSnippets]   = useState<Snippet[]>([]);
  const [servers, setServers]     = useState<RemoteServer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [running, setRunning]     = useState<string | null>(null);
  const [results, setResults]     = useState<Record<string, RunResult>>({});
  const [modal, setModal]         = useState<ModalState | null>(null);

  useEffect(() => {
    Promise.all([api.snippets(), api.servers()]).then(([s, srv]) => {
      setSnippets(s);
      setServers(srv);
    }).finally(() => setLoading(false));
  }, []);

  async function handleRun(snippet: Snippet) {
    setRunning(snippet.id);
    try {
      const res = await api.snippetRun(snippet.id);
      setResults(prev => ({ ...prev, [snippet.id]: { snippetId: snippet.id, ...res } }));
      toast(res.ok ? `${snippet.name} completado en ${res.duration}s` : `Error en ${snippet.name}`, res.ok ? 'success' : 'error');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error', 'error');
    } finally { setRunning(null); }
  }

  async function handleDelete(snippet: Snippet) {
    if (!await confirm({ message: `¿Eliminar "${snippet.name}"?`, danger: true, confirmLabel: 'Eliminar', title: 'Eliminar snippet' })) return;
    await api.snippetDelete(snippet.id);
    setSnippets(prev => prev.filter(s => s.id !== snippet.id));
    toast('Snippet eliminado');
  }

  const serverLabel = (id: string) => id ? (servers.find(s => s.id === id)?.name ?? `Servidor ${id}`) : 'Local';

  return (
    <>
      <div className="sec-marker reveal in">
        <span className="num">// devops</span>
        <span className="ttl">SNIPPETS</span>
        <span className="meta">{snippets.length} comandos guardados</span>
        <button className="btn-check-now" style={{ marginLeft: 'auto' }}
          onClick={() => setModal({ mode: 'create' })}>+ Nuevo →</button>
      </div>

      {loading ? (
        <div className="snippets-grid">
          {[1, 2, 3].map(i => (
            <div key={i} className="snippet-card">
              <div className="skeleton" style={{ height: 14, width: '50%', marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 12, width: '90%', marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 12, width: '70%' }} />
            </div>
          ))}
        </div>
      ) : snippets.length === 0 ? (
        <div style={{ padding: '64px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13, border: '1px solid var(--ink)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', marginBottom: 8 }}>— Sin snippets guardados</div>
          <div style={{ fontSize: 12 }}>Creá uno con el botón + Nuevo →</div>
        </div>
      ) : (
        <div className="snippets-grid">
          {snippets.map(snippet => {
            const result = results[snippet.id];
            const isRunning = running === snippet.id;
            return (
              <div key={snippet.id} className="snippet-card">
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                      {snippet.name}
                    </div>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
                      textTransform: 'uppercase', color: 'var(--muted)',
                      border: '1px solid var(--rule)', padding: '2px 8px',
                    }}>
                      {serverLabel(snippet.serverId)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setModal({ mode: 'edit', snippet })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--muted)', fontSize: 12, padding: '2px 6px',
                        fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
                      editar
                    </button>
                    <button onClick={() => handleDelete(snippet)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--muted)', fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
                  </div>
                </div>

                {/* Command */}
                <pre style={{
                  background: 'var(--paper-2)', border: '1px solid var(--rule)',
                  padding: '10px 14px', fontFamily: 'monospace', fontSize: 12,
                  lineHeight: 1.5, margin: '0 0 16px', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)',
                }}>
                  $ {snippet.command}
                </pre>

                {/* Output del último run */}
                {result && (
                  <div style={{
                    background: '#111110', border: `1px solid ${result.ok ? 'var(--up)' : 'var(--down)'}`,
                    padding: '10px 14px', marginBottom: 14,
                    fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6,
                    color: result.ok ? '#f0ece2' : 'var(--down)',
                    maxHeight: 120, overflowY: 'auto',
                  }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: result.ok ? 'var(--up)' : 'var(--down)', marginBottom: 6, letterSpacing: '0.08em' }}>
                      {result.ok ? `✓ completado en ${result.duration}s` : `✗ error tras ${result.duration}s`}
                    </div>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{result.output}</pre>
                  </div>
                )}

                {/* Run button */}
                <button
                  onClick={() => handleRun(snippet)}
                  disabled={isRunning || running !== null}
                  className="btn-deploy btn-deploy-run"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }}
                >
                  <span>{isRunning ? 'Ejecutando...' : '▶ Ejecutar'}</span>
                  {isRunning ? <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> : <span>→</span>}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal crear/editar */}
      {modal && (
        <SnippetModal
          mode={modal.mode}
          snippet={modal.mode === 'edit' ? modal.snippet : undefined}
          servers={servers}
          onClose={() => setModal(null)}
          onSave={saved => {
            if (modal.mode === 'create') setSnippets(prev => [...prev, saved]);
            else setSnippets(prev => prev.map(s => s.id === saved.id ? saved : s));
            setModal(null);
            toast(modal.mode === 'create' ? 'Snippet creado' : 'Snippet actualizado');
          }}
        />
      )}
    </>
  );
}

function SnippetModal({ mode, snippet, servers, onClose, onSave }: {
  mode: 'create' | 'edit';
  snippet?: Snippet;
  servers: RemoteServer[];
  onClose: () => void;
  onSave: (s: Snippet) => void;
}) {
  const [name, setName]         = useState(snippet?.name ?? '');
  const [command, setCommand]   = useState(snippet?.command ?? '');
  const [serverId, setServerId] = useState(snippet?.serverId ?? '');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const serverOptions = [
    { value: '', label: 'Local (mismo VPS que el panel)' },
    ...servers.map(s => ({ value: s.id, label: `${s.name} (${s.host})` })),
  ];

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  async function handleSave() {
    if (!name.trim()) { setError('El nombre es requerido'); return; }
    if (!command.trim()) { setError('El comando es requerido'); return; }
    setSaving(true);
    try {
      let saved: Snippet;
      if (mode === 'create') saved = await api.snippetCreate(name.trim(), command.trim(), serverId);
      else saved = await api.snippetUpdate(snippet!.id, { name: name.trim(), command: command.trim(), serverId });
      onSave(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 100 }}>
      <div className="modal-box" style={{ maxWidth: 560, fontFamily: 'var(--font-mono)',
        animation: 'slideUp 0.2s cubic-bezier(0.16,1,0.3,1) both' }}>

        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
            {mode === 'create' ? '+ Nuevo snippet' : 'Editar snippet'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}>✕</button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field-group">
            <label className="field-label">Nombre</label>
            <input className="field-input" autoFocus value={name} onChange={e => setName(e.target.value)}
              placeholder="Reiniciar Nginx, Limpiar logs..." />
          </div>

          <div className="field-group">
            <label className="field-label">Servidor</label>
            <Select value={serverId} onChange={setServerId} options={serverOptions} />
          </div>

          <div className="field-group">
            <label className="field-label">Comando</label>
            <textarea
              value={command}
              onChange={e => setCommand(e.target.value)}
              placeholder={'nginx -t && systemctl reload nginx\npm2 restart all\ndf -h && free -m'}
              rows={4}
              style={{ resize: 'vertical', background: '#111110', color: '#f0ece2',
                fontFamily: 'monospace', fontSize: 13, lineHeight: 1.7,
                border: '1px solid var(--rule)', outline: 'none', padding: '12px 14px',
                width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          {error && <p style={{ color: 'var(--down)', fontSize: 12, margin: 0 }}>{error}</p>}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--ink)',
          display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn-check-now" onClick={onClose}>Cancelar</button>
          <button className="btn-deploy btn-deploy-run" onClick={handleSave}
            disabled={saving} style={{ padding: '8px 20px' }}>
            <span>{saving ? 'Guardando...' : mode === 'create' ? 'Crear snippet' : 'Guardar cambios'}</span>
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
