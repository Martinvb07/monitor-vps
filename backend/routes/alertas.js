const express = require('express');
const { getAlerts, resolveAlert } = require('../services/monitor');
const router = express.Router();

router.get('/', (req, res) => {
  res.json(getAlerts());
});

router.post('/:id/resolver', (req, res) => {
  const alert = resolveAlert(req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alerta no encontrada' });
  res.json(alert);
});

module.exports = router;
