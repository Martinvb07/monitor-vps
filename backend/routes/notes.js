const express = require('express');
const fs      = require('fs');
const path    = require('path');
const router  = express.Router();

const FILE = path.join(__dirname, '../data/notes.json');

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    // Migrar formato viejo (single note) a nuevo (array)
    if (raw.content !== undefined && !Array.isArray(raw)) {
      return [{ id: '1', title: 'General', content: raw.content, updatedAt: raw.updatedAt || new Date().toISOString() }];
    }
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [{ id: '1', title: 'General', content: '', updatedAt: new Date().toISOString() }];
  }
}

function save(notes) { fs.writeFileSync(FILE, JSON.stringify(notes, null, 2)); }

// Listar notas
router.get('/', (req, res) => res.json(load()));

// Obtener nota específica
router.get('/:id', (req, res) => {
  const note = load().find(n => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: 'No encontrada' });
  res.json(note);
});

// Crear nota
router.post('/', (req, res) => {
  const { title } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title requerido' });
  const notes = load();
  const note = { id: Date.now().toString(), title: title.trim(), content: '', updatedAt: new Date().toISOString() };
  notes.push(note);
  save(notes);
  res.status(201).json(note);
});

// Guardar contenido de una nota
router.put('/:id', (req, res) => {
  const { content } = req.body;
  if (typeof content !== 'string') return res.status(400).json({ error: 'content requerido' });
  const notes = load();
  const idx = notes.findIndex(n => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'No encontrada' });
  notes[idx] = { ...notes[idx], content, updatedAt: new Date().toISOString() };
  save(notes);
  res.json(notes[idx]);
});

// Renombrar nota
router.patch('/:id', (req, res) => {
  const { title } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title requerido' });
  const notes = load();
  const idx = notes.findIndex(n => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'No encontrada' });
  notes[idx].title = title.trim();
  save(notes);
  res.json(notes[idx]);
});

// Eliminar nota
router.delete('/:id', (req, res) => {
  const notes = load();
  if (notes.length <= 1) return res.status(400).json({ error: 'Debe quedar al menos una nota' });
  const filtered = notes.filter(n => n.id !== req.params.id);
  if (filtered.length === notes.length) return res.status(404).json({ error: 'No encontrada' });
  save(filtered);
  res.json({ ok: true });
});

module.exports = router;
