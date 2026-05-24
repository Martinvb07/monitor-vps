const express = require('express');
const webpush = require('web-push');
const fs      = require('fs');
const path    = require('path');
const router  = express.Router();

const SUBS_FILE = path.join(__dirname, '../data/push-subs.json');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.ADMIN_USER || 'admin'}@localhost`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

function loadSubs() {
  try { return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')); } catch { return []; }
}
function saveSubs(subs) { fs.writeFileSync(SUBS_FILE, JSON.stringify(subs)); }

// Devuelve la clave pública VAPID (necesaria para suscribirse desde el frontend)
router.get('/vapid-key', (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ error: 'Push no configurado. Agrega VAPID_PUBLIC_KEY al .env' });
  res.json({ publicKey: key });
});

// Suscribir dispositivo
router.post('/subscribe', (req, res) => {
  const sub = req.body;
  if (!sub?.endpoint) return res.status(400).json({ error: 'Suscripción inválida' });
  const subs = loadSubs();
  if (!subs.find((s) => s.endpoint === sub.endpoint)) {
    subs.push(sub);
    saveSubs(subs);
  }
  res.json({ ok: true });
});

// Desuscribir dispositivo
router.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  const subs = loadSubs().filter((s) => s.endpoint !== endpoint);
  saveSubs(subs);
  res.json({ ok: true });
});

// Enviar notificación a todos los dispositivos suscritos
async function sendPush(title, body, data = {}) {
  if (!process.env.VAPID_PUBLIC_KEY) return;
  const subs = loadSubs();
  const failed = [];
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(sub, JSON.stringify({ title, body, ...data }));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) failed.push(sub.endpoint);
    }
  }));
  if (failed.length) saveSubs(loadSubs().filter((s) => !failed.includes(s.endpoint)));
}

// Test manual
router.post('/test', async (req, res) => {
  try {
    await sendPush('MARTIN.HQ — Test', 'Las notificaciones push funcionan correctamente ✓');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.sendPush = sendPush;
