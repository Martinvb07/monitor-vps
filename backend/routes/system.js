const express = require('express');
const { exec }  = require('child_process');
const router    = express.Router();

// Actualizar paquetes del VPS
router.post('/update', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.flushHeaders();

  const cmd = 'DEBIAN_FRONTEND=noninteractive apt-get update -y && apt-get upgrade -y 2>&1';
  const proc = exec(cmd, { timeout: 300000 });

  proc.stdout?.on('data', (d) => res.write(d));
  proc.stderr?.on('data', (d) => res.write(d));

  proc.on('close', (code) => {
    res.write(`\n[Proceso terminado con código ${code}]\n`);
    res.end();
  });

  proc.on('error', (err) => {
    res.write(`\nError: ${err.message}\n`);
    res.end();
  });
});

// Cambiar contraseña del dashboard
router.post('/change-password', async (req, res) => {
  const bcrypt = require('bcrypt');
  const fs     = require('fs');
  const path   = require('path');

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Faltan campos' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) return res.status(500).json({ error: 'Servidor no configurado' });

  const valid = await bcrypt.compare(currentPassword, hash);
  if (!valid) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

  const newHash = await bcrypt.hash(newPassword, 10);

  // Actualizar el .env
  const envPath = path.join(__dirname, '../.env');
  let content   = fs.readFileSync(envPath, 'utf8');
  content       = content.replace(/ADMIN_PASSWORD_HASH=.*/,`ADMIN_PASSWORD_HASH=${newHash}`);
  fs.writeFileSync(envPath, content);

  // Actualizar en memoria para que no requiera reinicio
  process.env.ADMIN_PASSWORD_HASH = newHash;

  res.json({ ok: true });
});

module.exports = router;
