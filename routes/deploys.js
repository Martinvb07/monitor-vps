const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const router = express.Router();

const FILE = path.join(__dirname, '../data/deploys.json');

const SCRIPTS = {
  mesoft: process.env.DEPLOY_SCRIPT_MESOFT || null,
  agro:   process.env.DEPLOY_SCRIPT_AGRO   || null,
  cancha: process.env.DEPLOY_SCRIPT_CANCHA  || null,
};

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; }
}
function save(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }

router.get('/', (req, res) => {
  res.json(load());
});

// Scripts disponibles (sin exponer los comandos)
router.get('/scripts', (req, res) => {
  res.json({
    mesoft: !!SCRIPTS.mesoft,
    agro:   !!SCRIPTS.agro,
    cancha: !!SCRIPTS.cancha,
  });
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
  const script = SCRIPTS[sitio];

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
