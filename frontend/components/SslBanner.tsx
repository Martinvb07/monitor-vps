'use client';

import { useEffect, useState } from 'react';
import { api, type SiteStatus } from '@/lib/api';

export default function SslBanner() {
  const [warnings, setWarnings] = useState<{ nombre: string; dias: number }[]>([]);

  useEffect(() => {
    api.status().then((sites: SiteStatus[]) => {
      const w = sites
        .filter((s) => s.ssl && s.ssl.diasRestantes < 30)
        .map((s) => ({ nombre: s.nombre, dias: s.ssl!.diasRestantes }));
      setWarnings(w);
    }).catch(() => {});
  }, []);

  if (warnings.length === 0) return null;

  return (
    <div className={`ssl-banner ${warnings.some((w) => w.dias < 14) ? 'ssl-banner-crit' : 'ssl-banner-warn'}`}>
      <span className="ssl-banner-ico">⚠</span>
      <span>
        {warnings.map((w) => (
          <span key={w.nombre}>
            <strong>{w.nombre}</strong>: SSL vence en <strong>{w.dias} días</strong>
            {w !== warnings[warnings.length - 1] ? ' · ' : ''}
          </span>
        ))}
      </span>
      <span className="ssl-banner-hint">Renovar con: <code>certbot renew</code></span>
    </div>
  );
}
