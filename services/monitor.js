const https = require('https');
const http = require('http');
const EventEmitter = require('events');
const emitter = new EventEmitter();
const dns = require('dns').promises;
const tls = require('tls');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');
const SITES_FILE = path.join(DATA_DIR, 'sites.json');

const DEFAULT_SITES = [
  { id: 'mesoft', url: 'https://mesoft.store',         nombre: 'MeSoft' },
  { id: 'agro',   url: 'https://agromanager.pro',      nombre: 'AgroManager' },
  { id: 'cancha', url: 'https://reservatucancha.site', nombre: 'ReservaTuCancha' },
];

let SITES = (() => {
  try { return JSON.parse(fs.readFileSync(SITES_FILE, 'utf8')); } catch { return DEFAULT_SITES; }
})();
const MAX_HISTORY = 48;

let _history = loadJSON(HISTORY_FILE, {});
let _alerts = loadJSON(ALERTS_FILE, []);
let _latest = {};

function loadJSON(file, def) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return def; }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function checkHTTP(url) {
  return new Promise((resolve) => {
    const start = Date.now();
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, { method: 'HEAD', timeout: 8000 }, (res) => {
      resolve({
        status: res.statusCode,
        latencia: Date.now() - start,
        headers: {
          server: res.headers['server'] || null,
          xPoweredBy: res.headers['x-powered-by'] || null,
          hsts: res.headers['strict-transport-security'] || null,
          http2: res.httpVersion === '2.0',
        },
      });
    });
    req.on('error', () => resolve({ status: 0, latencia: Date.now() - start, headers: {} }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, latencia: 8000, headers: {} }); });
    req.end();
  });
}

function checkSSL(hostname) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: hostname, port: 443, servername: hostname, timeout: 8000 }, () => {
      const cert = socket.getPeerCertificate();
      socket.destroy();
      if (!cert || !cert.valid_to) return resolve(null);
      const expiry = new Date(cert.valid_to);
      const diasRestantes = Math.floor((expiry - Date.now()) / 86400000);
      resolve({
        emisor: cert.issuer ? (cert.issuer.O || cert.issuer.CN || 'Desconocido') : 'Desconocido',
        vencimiento: expiry.toISOString(),
        diasRestantes,
        subject: cert.subject ? (cert.subject.CN || hostname) : hostname,
      });
    });
    socket.on('error', () => resolve(null));
    socket.on('timeout', () => { socket.destroy(); resolve(null); });
  });
}

async function checkDNS(hostname) {
  try {
    const addrs = await dns.resolve4(hostname);
    return addrs[0] || null;
  } catch { return null; }
}

async function checkSite(site) {
  const url = new URL(site.url);
  const hostname = url.hostname;

  const [http, ssl, ip] = await Promise.all([
    checkHTTP(site.url),
    checkSSL(hostname),
    checkDNS(hostname),
  ]);

  return {
    id: site.id,
    nombre: site.nombre,
    url: site.url,
    timestamp: new Date().toISOString(),
    online: http.status >= 200 && http.status < 400,
    status: http.status,
    latencia: http.latencia,
    headers: http.headers,
    ssl,
    ip,
  };
}

function processAlerts(result) {
  const now = new Date().toISOString();
  const newAlerts = [];

  if (!result.online || result.status === 0) {
    newAlerts.push({
      id: `${result.id}_down_${Date.now()}`,
      sitio: result.id,
      tipo: 'caido',
      severidad: 'critica',
      mensaje: `${result.nombre} está caído (HTTP ${result.status})`,
      timestamp: now,
      resuelta: false,
    });
  } else if (result.latencia > 2000) {
    newAlerts.push({
      id: `${result.id}_latencia_${Date.now()}`,
      sitio: result.id,
      tipo: 'latencia',
      severidad: 'warning',
      mensaje: `${result.nombre} latencia alta: ${result.latencia}ms`,
      timestamp: now,
      resuelta: false,
    });
  }

  if (result.ssl && result.ssl.diasRestantes < 30) {
    const sev = result.ssl.diasRestantes < 14 ? 'critica' : 'warning';
    newAlerts.push({
      id: `${result.id}_ssl_${Date.now()}`,
      sitio: result.id,
      tipo: 'ssl',
      severidad: sev,
      mensaje: `SSL de ${result.nombre} vence en ${result.ssl.diasRestantes} días`,
      timestamp: now,
      resuelta: false,
    });
  }

  // Auto-resolver alertas previas del mismo sitio si ahora está OK
  if (result.online && result.latencia <= 2000) {
    _alerts = _alerts.map((a) => {
      if (a.sitio === result.id && !a.resuelta && (a.tipo === 'caido' || a.tipo === 'latencia')) {
        return { ...a, resuelta: true, resueltaEn: now };
      }
      return a;
    });
  }

  for (const alert of newAlerts) {
    const dup = _alerts.find((a) => !a.resuelta && a.sitio === alert.sitio && a.tipo === alert.tipo);
    if (!dup) _alerts.push(alert);
  }

  // Mantener solo las últimas 200 alertas
  if (_alerts.length > 200) _alerts = _alerts.slice(-200);
  saveJSON(ALERTS_FILE, _alerts);
}

async function runChecks() {
  const results = await Promise.all(SITES.map(checkSite));

  for (const r of results) {
    if (!_history[r.id]) _history[r.id] = [];
    _history[r.id].push(r);
    if (_history[r.id].length > MAX_HISTORY) _history[r.id] = _history[r.id].slice(-MAX_HISTORY);
    _latest[r.id] = r;
    processAlerts(r);
  }

  saveJSON(HISTORY_FILE, _history);
  emitter.emit('update', { sites: results, alerts: _alerts });
  return results;
}

function getLatest() { return Object.values(_latest); }
function getHistory(id) { return id ? (_history[id] || []) : _history; }
function getAlerts() { return _alerts; }
function resolveAlert(id) {
  const a = _alerts.find((x) => x.id === id);
  if (a) { a.resuelta = true; a.resueltaEn = new Date().toISOString(); saveJSON(ALERTS_FILE, _alerts); }
  return a;
}

function start() {
  runChecks();
  setInterval(runChecks, 30000);
}

function reloadSites(newSites) { SITES = newSites; }

module.exports = { start, runChecks, getLatest, getHistory, getAlerts, resolveAlert, reloadSites, emitter, get SITES() { return SITES; } };
