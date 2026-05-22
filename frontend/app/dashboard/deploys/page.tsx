'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, type Deploy } from '@/lib/api';
import Select from '@/components/Select';

const GH_USER = process.env.NEXT_PUBLIC_GITHUB_USER || '';

const SITIOS = [
  { id: 'cancha', label: 'ReservaTuCancha' },
  { id: 'agro',   label: 'AgroManager Pro' },
  { id: 'mesoft', label: 'MeSoft Store' },
];

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

function matchSitio(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes('cancha') || n.includes('reserva')) return 'cancha';
  if (n.includes('agro')) return 'agro';
  if (n.includes('mesoft')) return 'mesoft';
  return null;
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
  const [deploys, setDeploys]       = useState<Deploy[]>([]);
  const [scripts, setScripts]       = useState<Record<string, boolean>>({});
  const [loading, setLoading]       = useState(true);
  const [sitio, setSitio]           = useState('cancha');
  const [mensaje, setMensaje]       = useState('');
  const [running, setRunning]       = useState(false);
  const [output, setOutput]         = useState<string | null>(null);
  const [runOk, setRunOk]           = useState<boolean | null>(null);
  const [duracion, setDuracion]     = useState<number | null>(null);
  const [error, setError]           = useState('');
  const [repos, setRepos]           = useState<RepoInfo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);

  const fetchDeploys = useCallback(async () => {
    try {
      const [data, sc] = await Promise.all([api.deploys(), api.deployScripts()]);
      setDeploys(data);
      setScripts(sc);
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
    const matched = matchSitio(repo.name);
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
  const sitioLabel = (id: string) => SITIOS.find((s) => s.id === id)?.label ?? id;

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
                const matched = matchSitio(repo.name);
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
                options={SITIOS.map((s) => ({ value: s.id, label: s.label }))}
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

          {!hasScript && (
            <p className="deploy-no-script">
              Sin script configurado para este sitio — solo registro manual.
            </p>
          )}

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
    </>
  );
}
