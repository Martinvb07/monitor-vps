const express = require('express');
const { getLatest, getHistory } = require('../services/monitor');
const router = express.Router();

router.get('/status', (req, res) => {
  res.json(getLatest());
});

router.get('/history', (req, res) => {
  res.json(getHistory());
});

router.get('/history/:id', (req, res) => {
  const data = getHistory(req.params.id);
  if (!data || !data.length) return res.status(404).json({ error: 'Sitio no encontrado' });
  res.json(data);
});

router.get('/comparar', (req, res) => {
  const history = getHistory();
  const latest = getLatest();
  res.json({ latest, history });
});

router.post('/status/check', async (req, res) => {
  try {
    const { runChecks } = require('../services/monitor');
    const results = await runChecks();
    res.json(results);
  } catch {
    res.status(500).json({ error: 'Error al ejecutar check' });
  }
});

module.exports = router;
