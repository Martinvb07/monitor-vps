'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, type Deploy } from '@/lib/api';
import Select from '@/components/Select';
import { useToast } from '@/components/Toast';

const GH_USER = process.env.NEXT_PUBLIC_GITHUB_USER || '';

type GHCommit = {
  sha: string;
  commit: { message: string; author: { name: string; date: string } };
};
type GHRepo = {
  id: number;
  name: string;
  pushed_at: string;
  default_branch: string;
  private: boolean;
};
type RepoInfo = GHRepo & { commit: GHCommit | null };

function matchSitio(name: string, sitios: { value: string; label: string }[]): string | null {
  const n = name.toLowerCase();
  return sitios.find((s) => n.includes(s.value) || n.includes(s.label.toLowerCase()))?.value ?? null;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function shortSha(sha: string) { return sha.slice(0, 7); }

export default function DeploysPage() {
  const { toast } = useToast();
  const [deploys, setDeploys]       = useState<Deploy[]>([]);
  const [scripts, setScripts]       = useState<Record<string, boolean>>({});
  const [sitios, setSitios]         = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading]       = useState(true);
  const [sitio, setSitio]           = useState('');
  const [mensaje, setMensaje]       = useState('');
  const [running, setRunning]       = useState(false);
  const [output, setOutput]         = useState<string | null>(null);
  const [runOk, setRunOk]           = useState<boolean | null>(null);
  const [duracion, setDuracion]     = useState<number | null>(null);
  const [error, setError]           = useState('');
  const [repos, setRepos]           = useState<RepoInfo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [scriptModal, setScriptModal] = useState<{ sitio: string; content: string; path: string } | null>(null);
  const [savingScript, setSavingScript] = useState(false);

  const fetchDeploys = useCallback(async () => {
    try {
      const [data, sc, sitesList] = await Promise.all([api.deploys(), api.deployScripts(), api.sites()]);
      setDeploys(data);
      setScripts(sc);
      const mapped = sitesList.map((s) => ({ value: s.id, label: s.nombre }));
      setSitios(mapped);
      if (mapped.length > 0) setSitio((prev) => prev || mapped[0].value);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDeploys(); }, [fetchDeploys]);

  // Fetch GitHub repos + last commit
  useEffect(() => {
    if (!GH_USER) return;
    setReposLoading(true);
    fetch(`https://api.github.com/users/${GH_USER}/repos?sort=pushed&per_page=20`)
      .then((r) => r.json())
      .then(async (data: GHRepo[]) => {
        const public_ = data.filter((r) => !r.private).slice(0, 12);
        const withCommits = await Promise.all(
          public_.map(async (repo) => {
            try {
              const res = await fetch(
                `https://api.github.com/repos/${GH_USER}/${repo.name}/commits?per_page=1`
              );
              const [commit] = await res.json();
              return { ...repo, commit: commit ?? null };
            } catch {
              return { ...repo, commit: null };
            }
          })
        );
        setRepos(withCommits);
      })
      .catch(() => {})
      .finally(() => setReposLoading(false));
  }, []);

  function useCommit(repo: RepoInfo) {
    const matched = matchSitio(repo.name, sitios);
    if (matched) setSitio(matched);
    const msg = repo.commit
      ? `${repo.commit.commit.message.split('\n')[0]} (${shortSha(repo.commit.sha)})`
      : `Deploy ${repo.name}`;
    setMensaje(msg);
    document.getElementById('deploy-form-anchor')?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleEjecutar(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setOutput(null);
    setRunOk(null);
    setError('');
    try {
      const res = await api.ejecutarDeploy(sitio, mensaje || 'Deploy desde dashboard');
      setOutput(res.output);
      setRunOk(res.ok);
      setDuracion(res.duracion);
      setDeploys((prev) => [res.deploy, ...prev]);
      setMensaje('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al ejecutar deploy');
      setRunOk(false);
    } finally {
      setRunning(false);
    }
  }

  async function handleRegistrar(e: React.FormEvent) {
    e.preventDefault();
    if (!mensaje.trim()) return;
    setError('');
    try {
      const nuevo = await api.registrarDeploy(sitio, mensaje.trim());
      setDeploys((prev) => [nuevo, ...prev]);
      setMensaje('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar');
    }
  }

  const hasScript = scripts[sitio];
  const sitioLabel = (id: string) => sitios.find((s) => s.value === id)?.label ?? id;

  async function openScriptModal() {
    const { content } = await api.deployScriptRead(sitio).catch(() => ({ content: '' }));
    setScriptModal({ sitio, content, path: `/root/deploy_${sitio}.sh` });
  }

  async function saveScript() {
    if (!scriptModal) return;
    setSavingScript(true);
    try {
      const res = await api.deployScriptSave(scriptModal.sitio, scriptModal.content, scriptModal.path);
      const sc = await api.deployScripts();
      setScripts(sc);
      setError('');
      setScriptModal(null);
      toast(`Guardado en ${res.path}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al guardar'); }
    finally { setSavingScript(false); }
  }

  return (
    <>
      <div className="sec-marker reveal in">
        <span className="num">// 006</span>
        <span className="ttl">DEPLOYS</span>
        <span className="meta">{loading ? '—' : `${deploys.length} registros`}</span>
      </div>

      {/* ── GitHub Section ── */}
      {GH_USER && (
        <div className="reveal in" style={{ marginBottom: 48 }}>
          <div className="sec-marker" style={{ marginBottom: 0 }}>
            <span className="num" style={{ color: 'var(--muted)' }}>github</span>
            <span className="ttl">COMMITS RECIENTES</span>
            <span className="meta">@{GH_USER}</span>
          </div>

          {reposLoading ? (
            <div className="gh-grid">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="gh-card">
                  <div className="skeleton" style={{ height: 16, width: '60%', marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 12, width: '90%', marginBottom: 4 }} />
                  <div className="skeleton" style={{ height: 12, width: '70%' }} />
                </div>
              ))}
            </div>
          ) : repos.length === 0 ? (
            <p className="empty-state">— No se encontraron repositorios públicos</p>
          ) : (
            <div className="gh-grid">
              {repos.map((repo) => {
                const matched = matchSitio(repo.name, sitios);
                return (
                  <div key={repo.id} className="gh-card">
                    <div className="gh-card-head">
                      <span className="gh-card-name">{repo.name}</span>
                      <span className="gh-card-branch">{repo.default_branch}</span>
                    </div>

                    {repo.commit && (
                      <p className="gh-card-commit">
                        {repo.commit.commit.message.split('\n')[0]}
                      </p>
                    )}

                    <div className="gh-card-meta">
                      {repo.commit && (
                        <>
                          <span className="gh-card-sha">{shortSha(repo.commit.sha)}</span>
                          <span>{repo.commit.commit.author.name}</span>
                          <span>{timeAgo(repo.commit.commit.author.date)}</span>
                        </>
                      )}
                    </div>

                    <div className="gh-card-footer">
                      {matched && (
                        <span className="gh-card-site">
                          → {sitioLabel(matched)}
                        </span>
                      )}
                      <button className="btn-gh-use" onClick={() => useCommit(repo)}>
                        Usar en deploy →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Deploy Form ── */}
      <div id="deploy-form-anchor" />
      <div className="deploy-form-wrapper reveal in">
        <div className="deploy-form-label">
          // {hasScript ? 'ejecutar deploy automático' : 'registrar deploy manual'}
        </div>
        <form className="deploy-form" onSubmit={hasScript ? handleEjecutar : handleRegistrar}>
          <div className="deploy-form-fields">
            <div className="field-group">
              <label className="field-label">Sitio</label>
              <Select
                value={sitio}
                onChange={(v) => { setSitio(v); setOutput(null); setRunOk(null); }}
                options={sitios}
              />
            </div>
            <div className="field-group" style={{ flex: 1 }}>
              <label className="field-label">
                {hasScript ? 'Nota / commit (opcional)' : 'Descripción'}
              </label>
              <input
                className="field-input"
                type="text"
                placeholder={hasScript ? 'Fix login, nueva feature... o usa "Usar en deploy" ↑' : 'Descripción del deploy...'}
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                maxLength={200}
                required={!hasScript}
              />
            </div>
            <button
              className={`btn-deploy ${hasScript ? 'btn-deploy-run' : ''}`}
              type="submit"
              disabled={running}
            >
              <span>{running ? 'Ejecutando...' : hasScript ? 'Deployar' : 'Registrar'}</span>
              <span>{running ? '⟳' : '→'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            {!hasScript && (
              <p className="deploy-no-script" style={{ margin: 0, flex: 1 }}>
                Sin script configurado — solo registro manual.
              </p>
            )}
            <button type="button" className="btn-check-now" style={{ marginLeft: 'auto', fontSize: 11 }} onClick={openScriptModal}>
              {hasScript ? 'Editar script →' : '+ Crear script'}
            </button>
          </div>

          {error && <p className="login-error" style={{ marginTop: 12 }}>{error}</p>}
        </form>

        {(running || output !== null) && (
          <div className="deploy-terminal">
            <div className="deploy-terminal-bar">
              <span className="deploy-terminal-dot" />
              <span className="deploy-terminal-dot" />
              <span className="deploy-terminal-dot" />
              <span className="deploy-terminal-title">
                {running
                  ? `● ejecutando ${sitioLabel(sitio)}...`
                  : runOk
                  ? `✓ completado en ${duracion}s`
                  : `✗ error tras ${duracion}s`}
              </span>
            </div>
            <pre className="deploy-terminal-output">
              {running
                ? '$ ' + (sitio === 'cancha' ? 'bash ~/deploy_reservatucancha.sh' : `bash ~/deploy_${sitio}.sh`) + '\n\nEsperando respuesta del VPS...'
                : output}
            </pre>
          </div>
        )}
      </div>

      {/* ── Historial ── */}
      <div className="sec-marker reveal in d2" style={{ marginTop: 48 }}>
        <span className="num">// historial</span>
        <span className="ttl">REGISTROS</span>
        <span className="meta">últimos 100</span>
      </div>

      {loading ? (
        <div className="deploy-table">
          {[1, 2, 3].map((i) => (
            <div key={i} className="deploy-row">
              <div className="skeleton" style={{ height: 14, width: '15%' }} />
              <div className="skeleton" style={{ height: 14, width: '45%' }} />
              <div className="skeleton" style={{ height: 14, width: '20%' }} />
              <div className="skeleton" style={{ height: 14, width: '10%' }} />
            </div>
          ))}
        </div>
      ) : deploys.length === 0 ? (
        <p className="empty-state">— Sin registros aún</p>
      ) : (
        <div className="deploy-table reveal in d2">
          <div className="deploy-row deploy-row-head">
            <span>Sitio</span>
            <span>Descripción</span>
            <span>Tipo</span>
            <span>Hace</span>
            <span>Estado</span>
          </div>
          {deploys.map((d) => (
            <div key={d.id} className="deploy-row">
              <span className="deploy-sitio">{sitioLabel(d.sitio)}</span>
              <span className="deploy-mensaje">{d.mensaje}</span>
              <span className="deploy-tipo">{(d as Deploy & { tipo?: string }).tipo ?? 'manual'}</span>
              <span className="deploy-fecha" title={formatDate(d.timestamp)}>{timeAgo(d.timestamp)}</span>
              <span>
                <span className={`deploy-estado ${d.estado}`}>
                  <span className="deploy-estado-dot" />
                  {d.estado}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Modal editor de script */}
      {scriptModal && (
        <div className="modal-overlay" style={{ zIndex: 100 }}>
          <div className="modal-box" style={{ maxWidth: 900, maxHeight: '88vh' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--ink)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
                Script de deploy — {sitioLabel(scriptModal.sitio)}
              </span>
              <button onClick={() => setScriptModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', fontSize: 16, padding: 4 }}>✕</button>
            </div>

            {/* Ruta editable */}
            <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--ink)', background: 'var(--paper-2)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink)', whiteSpace: 'nowrap', fontWeight: 600 }}>RUTA EN VPS</span>
              <input
                className="field-input"
                style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
                value={scriptModal.path}
                onChange={(e) => setScriptModal({ ...scriptModal, path: e.target.value })}
                placeholder="/root/deploy_mesoft.sh"
              />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>chmod +x automático</span>
            </div>

            {/* Editor */}
            <textarea
              value={scriptModal.content}
              onChange={(e) => setScriptModal({ ...scriptModal, content: e.target.value })}
              placeholder={'#!/bin/bash\nset -e\n\ncd /var/www/mi-sitio\ngit pull origin main\nnpm install --production\npm2 restart mi-app\n\necho "Deploy completado"'}
              style={{
                flex: 1, resize: 'none', background: '#111110', color: '#f0ece2',
                fontFamily: '"Cascadia Code", "Fira Code", monospace', fontSize: 13, lineHeight: 1.75,
                border: 0, outline: 'none', padding: '20px 24px', minHeight: 320,
              }}
            />

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--ink)', display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
              {error && <span style={{ color: 'var(--down)', fontSize: 12, marginRight: 'auto' }}>{error}</span>}
              <button className="btn-check-now" onClick={() => setScriptModal(null)}>Cancelar</button>
              <button className="btn-deploy btn-deploy-run" onClick={saveScript} disabled={savingScript || !scriptModal.path.trim()}>
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
