const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

const router = express.Router();
const TFA_FILE = path.join(__dirname, '../data/2fa.json');

function load2fa() {
  try { return JSON.parse(fs.readFileSync(TFA_FILE, 'utf8')); } catch { return { enabled: false, secret: null }; }
}
function save2fa(data) { fs.writeFileSync(TFA_FILE, JSON.stringify(data, null, 2)); }

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true, legacyHeaders: false,
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { usuario, password, token: totpToken } = req.body;
    if (!usuario || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

    if (usuario !== process.env.ADMIN_USER) return res.status(401).json({ error: 'Credenciales incorrectas' });
    if (!process.env.ADMIN_PASSWORD_HASH) return res.status(500).json({ error: 'Servidor no configurado' });

    const valid = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const tfa = load2fa();
    if (tfa.enabled) {
      if (!totpToken) return res.status(401).json({ error: 'Código 2FA requerido', requires2fa: true });
      const ok = speakeasy.totp.verify({ secret: tfa.secret, encoding: 'base32', token: totpToken, window: 1 });
      if (!ok) return res.status(401).json({ error: 'Código 2FA incorrecto', requires2fa: true });
    }

    const jwtToken = jwt.sign({ usuario }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token: jwtToken, usuario, twoFaEnabled: tfa.enabled });
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/logout', (req, res) => res.json({ ok: true }));

// 2FA setup — genera secret y devuelve otpauth URL
router.get('/2fa/setup', (req, res) => {
  const tfa = load2fa();
  if (tfa.enabled) return res.status(400).json({ error: '2FA ya está activado' });

  const secret = speakeasy.generateSecret({ name: 'MartinHQ Monitor', length: 20 });
  save2fa({ enabled: false, secret: secret.base32, pendingSecret: secret.base32 });

  res.json({
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url,
    qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(secret.otpauth_url)}`,
  });
});

// Activa 2FA verificando el primer código
router.post('/2fa/enable', (req, res) => {
  const { token } = req.body;
  const tfa = load2fa();
  if (!tfa.pendingSecret) return res.status(400).json({ error: 'Primero genera un secret en /setup' });

  const ok = speakeasy.totp.verify({ secret: tfa.pendingSecret, encoding: 'base32', token, window: 1 });
  if (!ok) return res.status(400).json({ error: 'Código incorrecto. Verifica que tu app está sincronizada.' });

  save2fa({ enabled: true, secret: tfa.pendingSecret });
  res.json({ ok: true, message: '2FA activado correctamente' });
});

// Desactiva 2FA
router.post('/2fa/disable', (req, res) => {
  const { token } = req.body;
  const tfa = load2fa();
  if (!tfa.enabled) return res.status(400).json({ error: '2FA no está activado' });

  const ok = speakeasy.totp.verify({ secret: tfa.secret, encoding: 'base32', token, window: 1 });
  if (!ok) return res.status(400).json({ error: 'Código 2FA incorrecto' });

  save2fa({ enabled: false, secret: null });
  res.json({ ok: true, message: '2FA desactivado' });
});

// Estado del 2FA
router.get('/2fa/status', (req, res) => {
  const tfa = load2fa();
  res.json({ enabled: tfa.enabled });
});

module.exports = router;
