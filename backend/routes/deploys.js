const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const router = express.Router();

const FILE = path.join(__dirname, '../data/deploys.json');

const SCRIPTS_DIR = process.env.DEPLOY_SCRIPTS_DIR || (process.platform === 'win32' ? null : '/root');

function getScript(sitioId) {
  // 1. Variable de entorno específica (legacy)
  const envKey = `DEPLOY_SCRIPT_${sitioId.toUpperCase().replace(/-/g, '_')}`;
  if (process.env[envKey]) return process.env[envKey];
  // 2. Archivo en DEPLOY_SCRIPTS_DIR con convención deploy_<id>.sh
  if (SCRIPTS_DIR) {
    const p = require('path').join(SCRIPTS_DIR, `deploy_${sitioId}.sh`);
    if (require('fs').existsSync(p)) return `bash ${p}`;
  }
  return null;
}

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; }
}
function save(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }

router.get('/', (req, res) => {
  res.json(load());
});

// Scripts disponibles por sitio (sin exponer los comandos)
router.get('/scripts', (req, res) => {
  let sites = [];
  try { sites = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/sites.json'), 'utf8')); } catch {}
  const result = {};
  sites.forEach((s) => { result[s.id] = !!getScript(s.id); });
  res.json(result);
});

// Leer script de un sitio
router.get('/scripts/:sitio', (req, res) => {
  if (!SCRIPTS_DIR) return res.json({ content: '' });
  const p = require('path').join(SCRIPTS_DIR, `deploy_${req.params.sitio}.sh`);
  try { res.json({ content: require('fs').readFileSync(p, 'utf8') }); }
  catch { res.json({ content: '' }); }
});

// Guardar/crear script de un sitio localmente
router.put('/scripts/:sitio', (req, res) => {
  if (!SCRIPTS_DIR) return res.status(400).json({ error: 'DEPLOY_SCRIPTS_DIR no configurado' });
  const { content, customPath } = req.body;
  if (!content) return res.status(400).json({ error: 'content requerido' });
  // customPath debe ser ruta absoluta y no contener ..
  let p;
  if (customPath && path.isAbsolute(customPath) && !customPath.includes('..')) {
    p = customPath;
  } else {
    p = path.join(SCRIPTS_DIR, `deploy_${req.params.sitio}.sh`);
  }
  try {
    fs.writeFileSync(p, content, { mode: 0o755 });
    res.json({ ok: true, path: p });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Registrar deploy manual (solo log)
router.post('/', (req, res) => {
  const { sitio, mensaje } = req.body;
  if (!sitio || !mensaje) return res.status(400).json({ error: 'sitio y mensaje requeridos' });
  const deploys = load();
  const deploy = {
    id: Date.now().toString(),
    sitio,
    mensaje,
    timestamp: new Date().toISOString(),
    estado: 'ok',
    tipo: 'manual',
  };
  deploys.unshift(deploy);
  if (deploys.length > 100) deploys.length = 100;
  save(deploys);
  res.status(201).json(deploy);
});

// Ejecutar deploy real
router.post('/:sitio/run', (req, res) => {
  const { sitio } = req.params;
  const script = getScript(sitio);

  if (!script) {
    return res.status(400).json({ error: `No hay script configurado para "${sitio}"` });
  }

  const started = Date.now();

  // Captura latencia antes del deploy
  const { getLatest } = require('../services/monitor');
  const latenciaBefore = getLatest().find((s) => s.id === sitio)?.latencia ?? null;

  exec(script, { timeout: 300000 }, (err, stdout, stderr) => {
    const duracion = Math.floor((Date.now() - started) / 1000);
    const output = [stdout, stderr].filter(Boolean).join('\n').trim();
    const estado = err ? 'error' : 'ok';

    const deploy = {
      id: Date.now().toString(),
      sitio,
      mensaje: req.body.mensaje || 'Deploy ejecutado desde dashboard',
      timestamp: new Date().toISOString(),
      estado,
      tipo: 'automatico',
      duracion,
      output: output || '(sin output)',
      latenciaBefore,
      latenciaAfter: null,
    };

    const deploys = load();
    deploys.unshift(deploy);
    if (deploys.length > 100) deploys.length = 100;
    save(deploys);

    res.json({ ok: estado === 'ok', deploy, output, duracion });

    // Captura latencia 90s después del deploy (async)
    if (estado === 'ok') {
      setTimeout(() => {
        const after = getLatest().find((s) => s.id === sitio)?.latencia ?? null;
        const all = load();
        const idx = all.findIndex((d) => d.id === deploy.id);
        if (idx !== -1) { all[idx].latenciaAfter = after; save(all); }
      }, 90000);
    }
  });
});

module.exports = router;
