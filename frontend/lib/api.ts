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
    const body = await res.json().catch(() => ({})) as { error?: string; requires2fa?: boolean };
    if (body.requires2fa) throw new Error(body.error || 'Código 2FA requerido');
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

export type DailyEntry = {
  date: string;
  uptime: number;
  checks: number;
  latAvg: number;
  latMin: number;
  latMax: number;
};

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
  daily: () => req<Record<string, DailyEntry[]>>('/daily'),
  dailySite: (id: string) => req<DailyEntry[]>(`/daily/${id}`),

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

  deployScriptRead: (sitio: string) => req<{ content: string }>(`/deploys/scripts/${sitio}`),
  deployScriptSave: (sitio: string, content: string, customPath?: string) => req<{ ok: boolean; path: string }>(`/deploys/scripts/${sitio}`, { method: 'PUT', body: JSON.stringify({ content, customPath }) }),

  sites: () => req<Site[]>('/sites'),
  addSite: (url: string, nombre: string) => req<Site>('/sites', { method: 'POST', body: JSON.stringify({ url, nombre }) }),
  deleteSite: (id: string) => req<{ ok: boolean }>(`/sites/${id}`, { method: 'DELETE' }),

  notes: () => req<Note[]>('/notes'),
  noteGet: (id: string) => req<Note>(`/notes/${id}`),
  noteCreate: (title: string) => req<Note>('/notes', { method: 'POST', body: JSON.stringify({ title }) }),
  noteSave: (id: string, content: string) => req<Note>(`/notes/${id}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  noteRename: (id: string, title: string) => req<Note>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  noteDelete: (id: string) => req<{ ok: boolean }>(`/notes/${id}`, { method: 'DELETE' }),

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

  systemMetrics: () => req<SystemMetrics>('/system/metrics'),
  systemMetricsHistory: () => req<MetricsPoint[]>('/system/metrics/history'),
  systemProcesses: () => req<ProcessEntry[]>('/system/processes'),
  systemDiskBreakdown: () => req<{ dir: string; entries: DiskEntry[] }>('/system/disk-breakdown'),

  changePassword: (currentPassword: string, newPassword: string) =>
    req<{ ok: boolean }>('/system/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  snippets: () => req<Snippet[]>('/snippets'),
  snippetCreate: (name: string, command: string, serverId: string) => req<Snippet>('/snippets', { method: 'POST', body: JSON.stringify({ name, command, serverId }) }),
  snippetUpdate: (id: string, data: Partial<Snippet>) => req<Snippet>(`/snippets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  snippetDelete: (id: string) => req<{ ok: boolean }>(`/snippets/${id}`, { method: 'DELETE' }),
  snippetRun: (id: string) => req<{ ok: boolean; output: string; duration: number }>(`/snippets/${id}/run`, { method: 'POST' }),

  envFiles: (server?: string) => req<EnvFile[]>(`/envfiles${server ? `?server=${server}` : ''}`),
  envFileRead: (id: string, server?: string) => req<{ content: string; path: string }>(`/envfiles/content?id=${id}${server ? `&server=${server}` : ''}`),
  envFileSave: (id: string, content: string, server?: string) => req<{ ok: boolean; backup: string }>('/envfiles/content', { method: 'PUT', body: JSON.stringify({ id, content, server }) }),

  nginxConfigs: (server?: string) => req<NginxConfig[]>(`/nginx${server ? `?server=${server}` : ''}`),
  nginxRead: (path: string, server?: string) => req<{ content: string; path: string }>(`/nginx/content?path=${encodeURIComponent(path)}${server ? `&server=${server}` : ''}`),
  nginxSave: (path: string, content: string, server?: string) => req<{ ok: boolean; backup: string }>('/nginx/content', { method: 'PUT', body: JSON.stringify({ path, content, server }) }),
  nginxTest: (server?: string) => req<{ ok: boolean; output: string }>('/nginx/test', { method: 'POST', body: JSON.stringify({ server }) }),
  nginxReload: (server?: string) => req<{ ok: boolean; output: string }>('/nginx/reload', { method: 'POST', body: JSON.stringify({ server }) }),
  nginxToggle: (name: string, enable: boolean, server?: string) => req<{ ok: boolean }>('/nginx/toggle', { method: 'POST', body: JSON.stringify({ name, enable, server }) }),

  pushVapidKey: () => req<{ publicKey: string }>('/push/vapid-key'),
  pushSubscribe: (sub: PushSubscriptionJSON) => req<{ ok: boolean }>('/push/subscribe', { method: 'POST', body: JSON.stringify(sub) }),
  pushTest: () => req<{ ok: boolean }>('/push/test', { method: 'POST' }),
  pushUnsubscribe: (endpoint: string) => req<{ ok: boolean }>('/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) }),

  servers: () => req<RemoteServer[]>('/servers'),
  serverMetrics: (id: string) => req<SystemMetrics>(`/servers/${id}/metrics`),
  serverPm2: (id: string) => req<Pm2Process[]>(`/servers/${id}/pm2`),
  serverPm2Restart: (id: string, name: string) => req<{ ok: boolean; output: string }>(`/servers/${id}/pm2/${name}/restart`, { method: 'POST' }),
  serverScriptRead: (id: string, sitio: string) => req<{ content: string }>(`/servers/${id}/scripts/${sitio}`),
  serverScriptSave: (id: string, sitio: string, content: string) => req<{ ok: boolean; path: string }>(`/servers/${id}/scripts/${sitio}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  serverDeploy: (id: string, sitio: string) => req<{ ok: boolean; output: string }>(`/servers/${id}/deploy/${sitio}`, { method: 'POST' }),

  backupDetect: () => req<BackupDetect>('/backup/detect'),
  backupList: () => req<{ backupDir: string; backups: BackupEntry[] }>('/backup'),
  backupConfig: () => req<{ backupDir: string }>('/backup/config'),
  backupSetConfig: (backupDir: string) => req<{ ok: boolean; backupDir: string }>('/backup/config', { method: 'POST', body: JSON.stringify({ backupDir }) }),
  backupDetails: (type: string) => req<{ type: string; items: { name: string; meta?: string }[] }>(`/backup/details/${type}`),
  backupRun: (types?: string[]) =>
    fetch('/api/backup/run', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken() ?? ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ types }),
    }),

  backupDownloadItem: (type: string, name: string) =>
    fetch(`/api/backup/download-item?type=${encodeURIComponent(type)}&name=${encodeURIComponent(name)}`, {
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
    }),
  backupDelete: (id: string) => req<{ ok: boolean }>(`/backup/${id}`, { method: 'DELETE' }),
  backupDownloadFile: (id: string, file: string) =>
    fetch(`/api/backup/${id}/download/${file}`, {
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
    }),

  systemUpdate: () =>
    fetch(`${BASE}/system/update`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
    }),
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

export type Snippet = {
  id: string;
  name: string;
  command: string;
  serverId: string;
  createdAt: string;
};

export type EnvFile = {
  id: string;
  project: string;
  file: string;
  path: string;
  size: number;
  mtime: string;
};

export type NginxConfig = {
  name: string;
  path: string;
  enabled: boolean;
  size: number;
  mtime: string;
};

export type RemoteServer = {
  id: string;
  name: string;
  host: string;
  user: string;
  port: number;
};

export type SystemMetrics = {
  cpu: { pct: number; load: [number, number, number]; cores: number };
  ram: { total: number; used: number; free: number; pct: number };
  disk: { total: number; used: number; free: number; pct: number } | null;
  uptime: number;
  hostname: string;
  platform: string;
};

export type MetricsPoint = {
  timestamp: string;
  cpu: number;
  ram: number;
  disk: number | null;
};

export type ProcessEntry = {
  user: string;
  pid: string;
  cpu: number;
  mem: number;
  stat: string;
  cmd: string;
};

export type DiskEntry = {
  size: string;
  path: string;
  name: string;
};

export type BackupDetect = {
  mysql: boolean;
  mongo: boolean;
  postgres: boolean;
  nginx: boolean;
  www: boolean;
  host: string;
};

export type BackupFile = {
  name: string;
  size: number;
  sizeHuman: string;
};

export type BackupEntry = {
  id: string;
  timestamp: string;
  host: string;
  source: 'ssh' | 'local';
  components: Record<string, { file: string; size: number; ok: boolean }>;
  files: BackupFile[];
  totalSize: number;
  totalSizeHuman: string;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
};

export type Deploy = {
  id: string;
  sitio: string;
  mensaje: string;
  timestamp: string;
  estado: 'ok' | 'error';
};
