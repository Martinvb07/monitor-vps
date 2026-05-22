const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DEPLOYS_FILE = path.join(__dirname, '../data/deploys.json');

function load() {
  try { return JSON.parse(fs.readFileSync(DEPLOYS_FILE, 'utf8')); } catch { return []; }
}
function save(data) { fs.writeFileSync(DEPLOYS_FILE, JSON.stringify(data, null, 2)); }

router.post('/deploy', (req, res) => {
  const secret = req.headers['x-webhook-secret'];
  if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Webhook secret inválido' });
  }

  const { sitio = 'desconocido', mensaje = 'Deploy desde CI/CD', ref = '', commit = '' } = req.body;
  const deploy = {
    id: Date.now().toString(),
    sitio,
    mensaje: `${mensaje}${ref ? ` · ${ref.replace('refs/heads/', '')}` : ''}${commit ? ` · ${commit.slice(0, 7)}` : ''}`,
    timestamp: new Date().toISOString(),
    estado: 'ok',
    tipo: 'webhook',
  };

  const deploys = load();
  deploys.unshift(deploy);
  if (deploys.length > 100) deploys.length = 100;
  save(deploys);

  res.json({ ok: true, deploy });
});

module.exports = router;
