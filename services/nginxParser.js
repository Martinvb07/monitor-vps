const fs = require('fs');
const { geolocate } = require('./geoip');

const LOG_PATH = process.env.NGINX_LOG || '/var/log/nginx/access.log';
const MAX_ENTRIES = 500;

// Nginx combined log format
const LOG_REGEX = /^(\S+) - \S+ \[([^\]]+)\] "(\S+) (\S+) \S+" (\d+) \d+ "([^"]*)" "([^"]*)"/;

const BOT_PATTERNS = [
  /bot/i, /crawler/i, /spider/i, /scraper/i, /curl/i, /wget/i,
  /python-requests/i, /go-http/i, /java\//i, /libwww/i, /httpie/i,
  /semrush/i, /ahrefs/i, /mj12bot/i, /dotbot/i, /bingpreview/i,
];

function isBot(ua) {
  return BOT_PATTERNS.some((p) => p.test(ua));
}

let _entries = [];
let _lastSize = 0;
let _lastMtime = 0;

function parseLines(lines) {
  const results = [];
  for (const line of lines) {
    const m = line.match(LOG_REGEX);
    if (!m) continue;
    const [, ip, timeStr, method, path, status, referrer, ua] = m;
    results.push({
      ip,
      timestamp: new Date(timeStr.replace(':', ' ')).toISOString(),
      method,
      path,
      status: parseInt(status),
      referrer: referrer === '-' ? null : referrer,
      ua,
      bot: isBot(ua),
    });
  }
  return results;
}

async function loadLog() {
  if (!fs.existsSync(LOG_PATH)) return [];
  try {
    const stat = fs.statSync(LOG_PATH);
    if (stat.mtimeMs === _lastMtime) return _entries;
    _lastMtime = stat.mtimeMs;

    const content = fs.readFileSync(LOG_PATH, 'utf8');
    const lines = content.trim().split('\n').slice(-MAX_ENTRIES);
    _entries = parseLines(lines);
    return _entries;
  } catch {
    return _entries;
  }
}

async function getVisitantes() {
  const entries = await loadLog();
  const today = new Date().toISOString().slice(0, 10);
  const todayEntries = entries.filter((e) => e.timestamp.startsWith(today));

  const uniqueIPs = new Set(todayEntries.map((e) => e.ip));
  const bots = todayEntries.filter((e) => e.bot).length;
  const errors = todayEntries.filter((e) => e.status >= 400).length;

  const byHour = Array(24).fill(0);
  for (const e of todayEntries) {
    const h = new Date(e.timestamp).getHours();
    byHour[h]++;
  }

  const countryCounts = {};
  const referrerCounts = {};

  for (const e of todayEntries) {
    if (e.referrer) {
      referrerCounts[e.referrer] = (referrerCounts[e.referrer] || 0) + 1;
    }
  }

  // Geolocalizar muestra
  const sampleIPs = [...new Set(todayEntries.slice(-50).map((e) => e.ip))];
  const geoResults = await Promise.all(sampleIPs.map((ip) => geolocate(ip)));
  const geoMap = {};
  sampleIPs.forEach((ip, i) => { geoMap[ip] = geoResults[i]; });

  for (const ip of sampleIPs) {
    const g = geoMap[ip];
    const key = g.pais;
    if (!countryCounts[key]) countryCounts[key] = { pais: g.pais, bandera: g.bandera, count: 0 };
    countryCounts[key].count++;
  }

  const live = await Promise.all(
    todayEntries.slice(-20).reverse().map(async (e) => ({
      ...e,
      geo: geoMap[e.ip] || (await geolocate(e.ip)),
    }))
  );

  return {
    total: todayEntries.length,
    unicos: uniqueIPs.size,
    bots,
    errores: errors,
    porHora: byHour,
    paises: Object.values(countryCounts).sort((a, b) => b.count - a.count).slice(0, 15),
    referrers: Object.entries(referrerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([url, count]) => ({ url, count })),
    live,
  };
}

async function getSeguridad() {
  const entries = await loadLog();
  const loginFails = entries.filter((e) => e.path.includes('/api/auth/login') && e.status === 429);
  const blocked = entries.filter((e) => e.status === 403 || e.status === 429);
  const bots = entries.filter((e) => e.bot);

  const failsByIP = {};
  for (const e of loginFails) {
    failsByIP[e.ip] = (failsByIP[e.ip] || 0) + 1;
  }

  const blockedIPs = Object.entries(failsByIP)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([ip, count]) => ({ ip, count, razon: 'Demasiados intentos de login', estado: 'bloqueada' }));

  const failsByEndpoint = {};
  for (const e of entries.filter((e) => e.status === 401 || e.status === 403)) {
    failsByEndpoint[e.path] = (failsByEndpoint[e.path] || 0) + 1;
  }

  return {
    ipsBlockeadas: blockedIPs.length,
    intentosFallidos: loginFails.length,
    porcentajeBots: entries.length ? Math.round((bots.length / entries.length) * 100) : 0,
    reqsBloqueadas: blocked.length,
    ipsBlockeadasLista: blockedIPs,
    fallosPorEndpoint: Object.entries(failsByEndpoint)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count })),
  };
}

module.exports = { getVisitantes, getSeguridad, loadLog };
