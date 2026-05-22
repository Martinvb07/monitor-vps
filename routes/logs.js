const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const router = express.Router();

const NGINX_LOG = process.env.NGINX_LOG || '/var/log/nginx/access.log';
const NGINX_ERROR = NGINX_LOG.replace('access', 'error');

router.get('/', (req, res) => {
  const { source = 'pm2', name = '', lines = '80' } = req.query;
  const n = Math.min(parseInt(lines) || 80, 300);

  if (source === 'nginx-access') {
    try {
      const content = fs.existsSync(NGINX_LOG)
        ? fs.readFileSync(NGINX_LOG, 'utf8').trim().split('\n').slice(-n)
        : [];
      return res.json({ source, lines: content });
    } catch { return res.json({ source, lines: [] }); }
  }

  if (source === 'nginx-error') {
    try {
      const content = fs.existsSync(NGINX_ERROR)
        ? fs.readFileSync(NGINX_ERROR, 'utf8').trim().split('\n').slice(-n)
        : [];
      return res.json({ source, lines: content });
    } catch { return res.json({ source, lines: [] }); }
  }

  // PM2
  const cmd = name
    ? `pm2 logs ${name} --nostream --lines ${n} --raw`
    : `pm2 logs --nostream --lines ${n} --raw`;

  exec(cmd, { timeout: 10000 }, (err, stdout, stderr) => {
    if (err && !stdout) {
      return res.json({ source: 'pm2', lines: ['PM2 no disponible en este entorno.'] });
    }
    const lines = (stdout || stderr || '').trim().split('\n').slice(-n);
    res.json({ source: 'pm2', name, lines });
  });
});

router.get('/pm2-processes', (req, res) => {
  exec('pm2 jlist', { timeout: 8000 }, (err, stdout) => {
    if (err) return res.json([]);
    try {
      const list = JSON.parse(stdout);
      res.json(list.map((p) => p.name));
    } catch { res.json([]); }
  });
});

module.exports = router;
