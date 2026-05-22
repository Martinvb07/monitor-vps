const express = require('express');
const { getVisitantes, loadLog } = require('../services/nginxParser');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const data = await getVisitantes();
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Error al obtener visitantes' });
  }
});

router.get('/live', async (req, res) => {
  try {
    const entries = await loadLog();
    const live = entries.slice(-30).reverse().map((e) => ({
      ip: e.ip,
      path: e.path,
      status: e.status,
      method: e.method,
      ua: e.ua,
      bot: e.bot,
      timestamp: e.timestamp,
    }));
    res.json(live);
  } catch {
    res.status(500).json({ error: 'Error al obtener feed en vivo' });
  }
});

module.exports = router;
