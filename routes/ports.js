const express = require('express');
const net = require('net');
const router = express.Router();
const { SITES } = require('../services/monitor');

const DEFAULT_PORTS = [22, 80, 443, 3000, 3001];

function checkPort(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.on('connect', () => {
      socket.destroy();
      resolve({ open: true, latency: Date.now() - start });
    });
    socket.on('timeout', () => { socket.destroy(); resolve({ open: false, latency: timeout }); });
    socket.on('error', () => { socket.destroy(); resolve({ open: false, latency: Date.now() - start }); });
    socket.connect(port, host);
  });
}

router.get('/', async (req, res) => {
  const ports = (process.env.PORT_CHECK || DEFAULT_PORTS.join(',')).split(',').map(Number);
  const sites = SITES;

  const results = await Promise.all(
    sites.map(async (site) => {
      const hostname = new URL(site.url).hostname;
      const checks = await Promise.all(
        ports.map(async (port) => {
          const result = await checkPort(hostname, port);
          return { port, ...result };
        })
      );
      return { id: site.id, nombre: site.nombre, hostname, ports: checks };
    })
  );

  res.json(results);
});

module.exports = router;
