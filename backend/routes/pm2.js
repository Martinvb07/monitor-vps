const express = require('express');
const { exec } = require('child_process');
const router = express.Router();

router.get('/', (req, res) => {
  exec('pm2 jlist', { timeout: 10000 }, (err, stdout) => {
    if (err) return res.status(500).json({ error: 'PM2 no disponible en este entorno' });
    try {
      const list = JSON.parse(stdout);
      const processes = list.map((p) => ({
        id:     p.pm_id,
        name:   p.name,
        status: p.pm2_env.status,
        uptime: p.pm2_env.pm_uptime,
        cpu:    p.monit?.cpu ?? 0,
        memory: p.monit?.memory ?? 0,
        restarts: p.pm2_env.restart_time,
        pid:    p.pid,
      }));
      res.json(processes);
    } catch {
      res.status(500).json({ error: 'Error al parsear output de PM2' });
    }
  });
});

router.post('/:name/restart', (req, res) => {
  exec(`pm2 restart ${req.params.name}`, { timeout: 15000 }, (err, stdout) => {
    if (err) return res.status(500).json({ error: `Error al reiniciar: ${err.message}` });
    res.json({ ok: true, output: stdout.trim() });
  });
});

module.exports = router;
