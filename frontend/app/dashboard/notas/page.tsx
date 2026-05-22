'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';

export default function NotasPage() {
  const [content, setContent] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const [saving, setSaving]   = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    api.notes().then((d) => {
      setContent(d.content);
      if (d.updatedAt) setSavedAt(new Date(d.updatedAt).toLocaleTimeString('es-CO'));
    });
  }, []);

  const save = useCallback(async (text: string) => {
    setSaving(true);
    try {
      const d = await api.saveNotes(text);
      setSavedAt(new Date(d.content ? Date.now() : Date.now()).toLocaleTimeString('es-CO'));
    } finally {
      setSaving(false);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setContent(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(val), 800);
  }

  return (
    <>
      <div className="sec-marker reveal in">
        <span className="num">// notas</span>
        <span className="ttl">SCRATCHPAD</span>
        <span className="meta">
          {saving ? 'Guardando...' : savedAt ? `Guardado ${savedAt}` : 'Auto-guardado'}
        </span>
      </div>

      <textarea
        className="notes-area"
        value={content}
        onChange={handleChange}
        placeholder={`# Comandos frecuentes
pm2 restart reservatucancha
certbot renew
nginx -t && systemctl reload nginx

# IPs importantes
VPS: xxx.xxx.xxx.xxx

# TODOs
- [ ] Renovar SSL de MeSoft
- [ ] Actualizar Node en el VPS`}
        spellCheck={false}
      />
    </>
  );
}
