import { getToken, clearToken } from './auth';

const BASE = '/api';

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });
  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

export type SiteStatus = {
  id: string;
  nombre: string;
  url: string;
  timestamp: string;
  online: boolean;
  status: number;
  latencia: number;
  headers: {
    server: string | null;
    xPoweredBy: string | null;
    hsts: string | null;
    http2: boolean;
  };
  ssl: {
    emisor: string;
    vencimiento: string;
    diasRestantes: number;
    subject: string;
  } | null;
  ip: string | null;
};

export type Alert = {
  id: string;
  sitio: string;
  tipo: 'caido' | 'latencia' | 'ssl';
  severidad: 'critica' | 'warning';
  mensaje: string;
  timestamp: string;
  resuelta: boolean;
  resueltaEn?: string;
};

export type HistoryEntry = SiteStatus;

export const api = {
  login: (usuario: string, password: string, token?: string) =>
    req<{ token: string; usuario: string; twoFaEnabled: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usuario, password, ...(token ? { token } : {}) }),
    }),

  logout: () => req('/auth/logout', { method: 'POST' }),

  status: () => req<SiteStatus[]>('/status'),

  history: () => req<Record<string, HistoryEntry[]>>('/history'),

  historySite: (id: string) => req<HistoryEntry[]>(`/history/${id}`),

  alertas: () => req<Alert[]>('/alertas'),

  resolverAlerta: (id: string) =>
    req<Alert>(`/alertas/${id}/resolver`, { method: 'POST' }),

  deploys: () => req<Deploy[]>('/deploys'),

  deployScripts: () => req<Record<string, boolean>>('/deploys/scripts'),

  registrarDeploy: (sitio: string, mensaje: string) =>
    req<Deploy>('/deploys', {
      method: 'POST',
      body: JSON.stringify({ sitio, mensaje }),
    }),

  ejecutarDeploy: (sitio: string, mensaje: string) =>
    req<{ ok: boolean; deploy: Deploy; output: string; duracion: number }>(
      `/deploys/${sitio}/run`,
      { method: 'POST', body: JSON.stringify({ mensaje }) }
    ),

  visitantes: () => req<Visitantes>('/visitantes'),
  visitantesLive: () => req<LiveEntry[]>('/visitantes/live'),

  seguridad: () => req<Seguridad>('/seguridad'),

  forceCheck: () => req<SiteStatus[]>('/status/check', { method: 'POST' }),

  pm2: () => req<Pm2Process[]>('/pm2'),
  pm2Restart: (name: string) => req<{ ok: boolean; output: string }>(`/pm2/${name}/restart`, { method: 'POST' }),

  sites: () => req<Site[]>('/sites'),
  addSite: (url: string, nombre: string) => req<Site>('/sites', { method: 'POST', body: JSON.stringify({ url, nombre }) }),
  deleteSite: (id: string) => req<{ ok: boolean }>(`/sites/${id}`, { method: 'DELETE' }),

  notes: () => req<{ content: string; updatedAt?: string }>('/notes'),
  saveNotes: (content: string) => req<{ content: string }>('/notes', { method: 'PUT', body: JSON.stringify({ content }) }),

  logs: (source: string, name?: string, lines?: number) =>
    req<{ source: string; lines: string[] }>(`/logs?source=${source}${name ? `&name=${name}` : ''}&lines=${lines ?? 80}`),
  logsPm2Processes: () => req<string[]>('/logs/pm2-processes'),

  ports: () => req<PortResult[]>('/ports'),

  tfa: {
    status: () => req<{ enabled: boolean }>('/auth/2fa/status'),
    setup: () => req<{ secret: string; otpauthUrl: string; qrUrl: string }>('/auth/2fa/setup'),
    enable: (token: string) => req<{ ok: boolean }>('/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ token }) }),
    disable: (token: string) => req<{ ok: boolean }>('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ token }) }),
  },

  changePassword: (currentPassword: string, newPassword: string) =>
    req<{ ok: boolean }>('/system/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  systemUpdate: () => {
    const { getToken } = require('@/lib/auth');
    return fetch(`${BASE}/system/update`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
    });
  },
};

export type PortResult = {
  id: string;
  nombre: string;
  hostname: string;
  ports: { port: number; open: boolean; latency: number }[];
};

export type Pm2Process = {
  id: number;
  name: string;
  status: 'online' | 'stopped' | 'errored' | 'launching';
  uptime: number;
  cpu: number;
  memory: number;
  restarts: number;
  pid: number;
};

export type Site = {
  id: string;
  url: string;
  nombre: string;
};

export type LiveEntry = {
  ip: string;
  timestamp: string;
  method: string;
  path: string;
  status: number;
  referrer: string | null;
  ua: string;
  bot: boolean;
  geo?: { pais: string; bandera: string };
};

export type Visitantes = {
  total: number;
  unicos: number;
  bots: number;
  errores: number;
  porHora: number[];
  paises: { pais: string; bandera: string; count: number }[];
  referrers: { url: string; count: number }[];
  live: LiveEntry[];
};

export type Seguridad = {
  ipsBlockeadas: number;
  intentosFallidos: number;
  porcentajeBots: number;
  reqsBloqueadas: number;
  ipsBlockeadasLista: { ip: string; count: number; razon: string; estado: string }[];
  fallosPorEndpoint: { path: string; count: number }[];
  headersCheck: {
    sitio: string;
    nombre: string;
    https: boolean;
    hsts: boolean;
    http2: boolean;
    xPoweredBy: boolean;
  }[];
};

export type Deploy = {
  id: string;
  sitio: string;
  mensaje: string;
  timestamp: string;
  estado: 'ok' | 'error';
};
