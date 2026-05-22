'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, type Site } from '@/lib/api';

export default function SitiosPage() {
  const [sites, setSites]     = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl]         = useState('');
  const [nombre, setNombre]   = useState('');
  const [adding, setAdding]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const fetchSites = useCallback(async () => {
    try { setSites(await api.sites()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSites(); }, [fetchSites]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    setAdding(true);
    try {
      const site = await api.addSite(url, nombre);
      setSites((prev) => [...prev, site]);
      setUrl(''); setNombre('');
      setSuccess(`✓ ${site.nombre} agregado correctamente`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agregar');
    } finally { setAdding(false); }
  }

  async function handleDelete(id: string, nombre: string) {
    if (!confirm(`¿Eliminar ${nombre}? Se borrarán sus datos del historial.`)) return;
    setDeleting(id);
    try {
      await api.deleteSite(id);
      setSites((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally { setDeleting(null); }
  }

  return (
    <>
      <div className="sec-marker reveal in">
        <span className="num">// sitios</span>
        <span className="ttl">SITIOS_MONITOREADOS</span>
        <span className="meta">{loading ? '—' : `${sites.length} sitios`}</span>
      </div>

      {/* Lista */}
      <div className="sites-manage-list reveal in">
        <div className="sites-manage-row sites-manage-head">
          <span>Nombre</span>
          <span>URL</span>
          <span>ID</span>
          <span />
        </div>
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="sites-manage-row">
              {[1, 2, 3].map((j) => <div key={j} className="skeleton" style={{ height: 14 }} />)}
              <span />
            </div>
          ))
        ) : sites.map((s) => (
          <div key={s.id} className="sites-manage-row">
            <span className="sites-manage-name">{s.nombre}</span>
            <a href={s.url} target="_blank" rel="noreferrer" className="sites-manage-url">{s.url}</a>
            <span className="sites-manage-id">{s.id}</span>
            <button
              className="btn-delete"
              onClick={() => handleDelete(s.id, s.nombre)}
              disabled={deleting === s.id}
              title="Eliminar sitio"
            >
              {deleting === s.id ? '...' : '✕'}
            </button>
          </div>
        ))}
      </div>

      {/* Agregar */}
      <div className="sec-marker reveal in d2" style={{ marginTop: 48 }}>
        <span className="num">// agregar</span>
        <span className="ttl">NUEVO SITIO</span>
      </div>

      <div className="deploy-form-wrapper reveal in d2">
        <div className="deploy-form-label">// datos del sitio a monitorear</div>
        <form className="deploy-form" onSubmit={handleAdd}>
          <div className="deploy-form-fields">
            <div className="field-group">
              <label className="field-label">Nombre</label>
              <input className="field-input" type="text" placeholder="Mi Sitio" value={nombre}
                onChange={(e) => setNombre(e.target.value)} required />
            </div>
            <div className="field-group" style={{ flex: 1 }}>
              <label className="field-label">URL</label>
              <input className="field-input" type="text" placeholder="https://misitio.com"
                value={url} onChange={(e) => setUrl(e.target.value)} required />
            </div>
            <button className="btn-deploy" type="submit" disabled={adding}>
              <span>{adding ? '...' : 'Agregar'}</span>
              <span>→</span>
            </button>
          </div>
          {error   && <p className="login-error"   style={{ marginTop: 8 }}>{error}</p>}
          {success && <p className="deploy-success" style={{ marginTop: 8 }}>{success}</p>}
        </form>
      </div>
    </>
  );
}
