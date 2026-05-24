const https = require('https');
const http = require('http');

const cache = new Map();
const CACHE_TTL = 3600000; // 1 hora

function geolocate(ip) {
  if (!ip || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return Promise.resolve({ ciudad: 'Local', pais: 'Local', bandera: '🏠', lat: 0, lon: 0 });
  }

  const cached = cache.get(ip);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return Promise.resolve(cached.data);

  return new Promise((resolve) => {
    const url = `http://ip-api.com/json/${ip}?fields=status,city,country,countryCode,lat,lon`;
    http.get(url, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        try {
          const d = JSON.parse(body);
          if (d.status === 'success') {
            const data = {
              ciudad: d.city || 'Desconocida',
              pais: d.country || 'Desconocido',
              bandera: countryFlag(d.countryCode),
              lat: d.lat,
              lon: d.lon,
            };
            cache.set(ip, { data, ts: Date.now() });
            resolve(data);
          } else {
            resolve({ ciudad: 'Desconocida', pais: 'Desconocido', bandera: '🌐', lat: 0, lon: 0 });
          }
        } catch {
          resolve({ ciudad: 'Desconocida', pais: 'Desconocido', bandera: '🌐', lat: 0, lon: 0 });
        }
      });
    }).on('error', () => {
      resolve({ ciudad: 'Desconocida', pais: 'Desconocido', bandera: '🌐', lat: 0, lon: 0 });
    });
  });
}

function countryFlag(code) {
  if (!code || code.length !== 2) return '🌐';
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0))
  );
}

module.exports = { geolocate };
