const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const FILE = path.join(__dirname, '../data/sites.json');

const DEFAULT_SITES = [
  { id: 'mesoft', url: 'https://mesoft.store',        nombre: 'MeSoft' },
  { id: 'agro',   url: 'https://agromanager.pro',     nombre: 'AgroManager' },
  { id: 'cancha', url: 'https://reservatucancha.site', nombre: 'ReservaTuCancha' },
];

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return DEFAULT_SITES; }
}

function save(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }

router.get('/', (req, res) => res.json(load()));

router.post('/', (req, res) => {
  const { url, nombre } = req.body;
  if (!url || !nombre) return res.status(400).json({ error: 'url y nombre requeridos' });
  const sites = load();
  const id = nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  if (sites.find((s) => s.id === id)) return res.status(409).json({ error: 'Ya existe un sitio con ese nombre' });
  const site = { id, url: url.startsWith('http') ? url : `https://${url}`, nombre };
  sites.push(site);
  save(sites);

  // Reiniciar monitor con nuevos sitios
  const monitor = require('../services/monitor');
  monitor.reloadSites(sites);

  res.status(201).json(site);
});

router.delete('/:id', (req, res) => {
  let sites = load();
  const exists = sites.find((s) => s.id === req.params.id);
  if (!exists) return res.status(404).json({ error: 'Sitio no encontrado' });
  sites = sites.filter((s) => s.id !== req.params.id);
  save(sites);

  const monitor = require('../services/monitor');
  monitor.reloadSites(sites);

  res.json({ ok: true });
});

module.exports = router;
