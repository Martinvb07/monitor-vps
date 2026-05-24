const express = require('express');
const fs      = require('fs');
const path    = require('path');
const router  = express.Router();
const { loadServers, readFile, writeFile, listEnvFiles } = require('../services/servers');

const SEARCH_DIRS = (process.env.ENV_SEARCH_DIRS || '/var/www').split(',').map(s => s.trim());

// ── helpers locales ──────────────────────────────────────────────────────────
function findEnvLocal() {
  const found = [];
  for (const dir of SEARCH_DIRS) {
    try {
      for (const p of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!p.isDirectory()) continue;
        for (const name of ['.env', '.env.local', '.env.production', '.env.development']) {
          const full = path.join(dir, p.name, name);
          try {
            const stat = fs.statSync(full);
            found.push({ id: Buffer.from(full).toString('base64'), project: p.name, file: name, path: full, size: stat.size, mtime: stat.mtime.toISOString() });
          } catch {}
        }
      }
    } catch {}
  }
  return found;
}

function safeLocal(id) {
  const p = Buffer.from(id, 'base64').toString('utf8');
  if (p.includes('..')) return null;
  if (!SEARCH_DIRS.some(d => p.startsWith(d))) return null;
  return p;
}

// ── listar ───────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { server } = req.query;
  if (server) {
    const srv = loadServers().find(s => s.id === server);
    if (!srv) return res.status(404).json({ error: 'Servidor no encontrado' });
    try {
      const files = await listEnvFiles(srv, SEARCH_DIRS);
      return res.json(files);
    } catch (e) { return res.status(502).json({ error: e.message }); }
  }
  res.json(findEnvLocal());
});

// ── leer ─────────────────────────────────────────────────────────────────────
router.get('/content', async (req, res) => {
  const { id, server } = req.query;
  if (server) {
    const srv = loadServers().find(s => s.id === server);
    if (!srv) return res.status(404).json({ error: 'Servidor no encontrado' });
    try {
      const filePath = Buffer.from(id, 'base64').toString('utf8');
      const content  = await readFile(srv, filePath);
      if (content === '__NOT_FOUND__') return res.status(404).json({ error: 'Archivo no encontrado' });
      return res.json({ content, path: filePath });
    } catch (e) { return res.status(502).json({ error: e.message }); }
  }
  const p = safeLocal(id);
  if (!p) return res.status(403).json({ error: 'Ruta no permitida' });
  try { res.json({ content: fs.readFileSync(p, 'utf8'), path: p }); }
  catch { res.status(404).json({ error: 'No encontrado' }); }
});

// ── guardar ───────────────────────────────────────────────────────────────────
router.put('/content', async (req, res) => {
  const { id, content, server } = req.body;
  if (server) {
    const srv = loadServers().find(s => s.id === server);
    if (!srv) return res.status(404).json({ error: 'Servidor no encontrado' });
    try {
      const filePath = Buffer.from(id, 'base64').toString('utf8');
      const result   = await writeFile(srv, filePath, content);
      return res.json(result);
    } catch (e) { return res.status(502).json({ error: e.message }); }
  }
  const p = safeLocal(id);
  if (!p) return res.status(403).json({ error: 'Ruta no permitida' });
  try {
    const bak = p + '.bak';
    if (fs.existsSync(p)) fs.copyFileSync(p, bak);
    fs.writeFileSync(p, content, 'utf8');
    res.json({ ok: true, backup: bak });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
