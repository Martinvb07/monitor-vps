const express = require('express');
const { loadServers, getMetrics, getPm2, restartPm2, writeScript, readScript, runScript } = require('../services/servers');
const router = express.Router();

function getServer(id) {
  const servers = loadServers();
  return servers.find((s) => s.id === id) || null;
}

// Lista de servidores configurados (sin credenciales)
router.get('/', (req, res) => {
  const servers = loadServers().map(({ id, name, host, user, port }) => ({ id, name, host, user, port }));
  res.json(servers);
});

// Métricas de un servidor remoto
router.get('/:id/metrics', async (req, res) => {
  const srv = getServer(req.params.id);
  if (!srv) return res.status(404).json({ error: 'Servidor no encontrado' });
  try {
    const metrics = await getMetrics(srv);
    res.json(metrics);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// PM2 de un servidor remoto
router.get('/:id/pm2', async (req, res) => {
  const srv = getServer(req.params.id);
  if (!srv) return res.status(404).json({ error: 'Servidor no encontrado' });
  try {
    const list = await getPm2(srv);
    res.json(list);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Restart PM2 en servidor remoto
router.post('/:id/pm2/:name/restart', async (req, res) => {
  const srv = getServer(req.params.id);
  if (!srv) return res.status(404).json({ error: 'Servidor no encontrado' });
  try {
    const output = await restartPm2(srv, req.params.name);
    res.json({ ok: true, output });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Leer script de deploy de un servidor
router.get('/:id/scripts/:sitio', async (req, res) => {
  const srv = getServer(req.params.id);
  if (!srv) return res.status(404).json({ error: 'Servidor no encontrado' });
  try {
    const content = await readScript(srv, req.params.sitio);
    res.json({ content });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Guardar/crear script de deploy en un servidor
router.put('/:id/scripts/:sitio', async (req, res) => {
  const srv = getServer(req.params.id);
  if (!srv) return res.status(404).json({ error: 'Servidor no encontrado' });
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content requerido' });
  try {
    const path = await writeScript(srv, req.params.sitio, content);
    res.json({ ok: true, path });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Ejecutar deploy en servidor remoto
router.post('/:id/deploy/:sitio', async (req, res) => {
  const srv = getServer(req.params.id);
  if (!srv) return res.status(404).json({ error: 'Servidor no encontrado' });
  try {
    const output = await runScript(srv, req.params.sitio);
    res.json({ ok: true, output });
  } catch (err) {
    res.status(502).json({ error: err.message, ok: false });
  }
});

module.exports = router;
