const express = require('express');
const { getSeguridad } = require('../services/nginxParser');
const { getLatest } = require('../services/monitor');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [seg, sites] = await Promise.all([getSeguridad(), getLatest()]);

    const headersCheck = sites.map((s) => ({
      sitio: s.id,
      nombre: s.nombre,
      https: s.url.startsWith('https'),
      hsts: !!(s.headers && s.headers.hsts),
      http2: !!(s.headers && s.headers.http2),
      xPoweredBy: !!(s.headers && s.headers.xPoweredBy),
    }));

    res.json({ ...seg, headersCheck });
  } catch {
    res.status(500).json({ error: 'Error al obtener datos de seguridad' });
  }
});

module.exports = router;
