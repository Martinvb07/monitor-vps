const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const FILE = path.join(__dirname, '../data/notes.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { content: '' }; }
}

router.get('/', (req, res) => res.json(load()));

router.put('/', (req, res) => {
  const { content } = req.body;
  if (typeof content !== 'string') return res.status(400).json({ error: 'content requerido' });
  const data = { content, updatedAt: new Date().toISOString() };
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  res.json(data);
});

module.exports = router;
