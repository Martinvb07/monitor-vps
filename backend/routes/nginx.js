const express = require('express');
const fs      = require('fs');
const path    = require('path');
const { exec } = require('child_process');
const router  = express.Router();
const { loadServers, readFile, writeFile, listNginxConfigs, sshExec } = require('../services/servers');

const NGINX_AVAILABLE = process.env.NGINX_SITES_AVAILABLE || '/etc/nginx/sites-available';
const NGINX_ENABLED   = process.env.NGINX_SITES_ENABLED   || '/etc/nginx/sites-enabled';
const NGINX_CONF      = process.env.NGINX_CONF            || '/etc/nginx/nginx.conf';

function listLocal() {
  const configs = [];
  try {
    const enabled = new Set(fs.readdirSync(NGINX_ENABLED));
    for (const f of fs.readdirSync(NGINX_AVAILABLE)) {
      const p = path.join(NGINX_AVAILABLE, f);
      if (!fs.statSync(p).isFile()) continue;
      configs.push({ name: f, path: p, enabled: enabled.has(f), size: fs.statSync(p).size, mtime: fs.statSync(p).mtime.toISOString() });
    }
  } catch {}
  try {
    const s = fs.statSync(NGINX_CONF);
    configs.unshift({ name: 'nginx.conf', path: NGINX_CONF, enabled: true, size: s.size, mtime: s.mtime.toISOString() });
  } catch {}
  return configs;
}

// ── listar ───────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { server } = req.query;
  if (server) {
    const srv = loadServers().find(s => s.id === server);
    if (!srv) return res.status(404).json({ error: 'Servidor no encontrado' });
    try { return res.json(await listNginxConfigs(srv)); }
    catch (e) { return res.status(502).json({ error: e.message }); }
  }
  res.json(listLocal());
});

// ── leer ─────────────────────────────────────────────────────────────────────
router.get('/content', async (req, res) => {
  const { path: filePath, server } = req.query;
  if (!filePath || filePath.includes('..')) return res.status(400).json({ error: 'Ruta inválida' });
  if (server) {
    const srv = loadServers().find(s => s.id === server);
    if (!srv) return res.status(404).json({ error: 'Servidor no encontrado' });
    try {
      const content = await readFile(srv, filePath);
      return res.json({ content, path: filePath });
    } catch (e) { return res.status(502).json({ error: e.message }); }
  }
  try { res.json({ content: fs.readFileSync(filePath, 'utf8'), path: filePath }); }
  catch { res.status(404).json({ error: 'No encontrado' }); }
});

// ── guardar ───────────────────────────────────────────────────────────────────
router.put('/content', async (req, res) => {
  const { path: filePath, content, server } = req.body;
  if (!filePath || filePath.includes('..')) return res.status(400).json({ error: 'Ruta inválida' });
  if (server) {
    const srv = loadServers().find(s => s.id === server);
    if (!srv) return res.status(404).json({ error: 'Servidor no encontrado' });
    try { return res.json(await writeFile(srv, filePath, content)); }
    catch (e) { return res.status(502).json({ error: e.message }); }
  }
  try {
    const bak = filePath + '.bak';
    if (fs.existsSync(filePath)) fs.copyFileSync(filePath, bak);
    fs.writeFileSync(filePath, content);
    res.json({ ok: true, backup: bak });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── nginx -t ─────────────────────────────────────────────────────────────────
router.post('/test', async (req, res) => {
  const { server } = req.body;
  if (server) {
    const srv = loadServers().find(s => s.id === server);
    if (!srv) return res.status(404).json({ error: 'Servidor no encontrado' });
    try {
      const output = await sshExec(srv, 'nginx -t 2>&1');
      return res.json({ ok: !output.includes('failed'), output });
    } catch (e) { return res.status(502).json({ error: e.message }); }
  }
  exec('nginx -t 2>&1', (err, stdout, stderr) => res.json({ ok: !err, output: (stdout + stderr).trim() }));
});

// ── reload ───────────────────────────────────────────────────────────────────
router.post('/reload', async (req, res) => {
  const { server } = req.body;
  if (server) {
    const srv = loadServers().find(s => s.id === server);
    if (!srv) return res.status(404).json({ error: 'Servidor no encontrado' });
    try {
      const output = await sshExec(srv, 'systemctl reload nginx 2>&1');
      return res.json({ ok: true, output: output || 'Nginx recargado' });
    } catch (e) { return res.status(502).json({ error: e.message }); }
  }
  exec('systemctl reload nginx 2>&1', (err, stdout, stderr) => res.json({ ok: !err, output: (stdout + stderr).trim() || 'Nginx recargado' }));
});

// ── toggle enable/disable ─────────────────────────────────────────────────────
router.post('/toggle', async (req, res) => {
  const { name, enable, server } = req.body;
  if (!name || name.includes('..')) return res.status(400).json({ error: 'nombre inválido' });
  if (server) {
    const srv = loadServers().find(s => s.id === server);
    if (!srv) return res.status(404).json({ error: 'Servidor no encontrado' });
    const cmd = enable
      ? `ln -sf /etc/nginx/sites-available/${name} /etc/nginx/sites-enabled/${name}`
      : `rm -f /etc/nginx/sites-enabled/${name}`;
    try { await sshExec(srv, cmd); return res.json({ ok: true }); }
    catch (e) { return res.status(502).json({ error: e.message }); }
  }
  const src = path.join(NGINX_AVAILABLE, name);
  const link = path.join(NGINX_ENABLED, name);
  try {
    if (enable) { if (!fs.existsSync(link)) fs.symlinkSync(src, link); }
    else { if (fs.existsSync(link)) fs.unlinkSync(link); }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
