const express = require('express');
const fs      = require('fs');
const path    = require('path');
const router  = express.Router();
const { loadServers, sshExec } = require('../services/servers');
const { exec } = require('child_process');

const FILE = path.join(__dirname, '../data/snippets.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; }
}
function save(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }

router.get('/', (req, res) => res.json(load()));

router.post('/', (req, res) => {
  const { name, command, serverId } = req.body;
  if (!name?.trim() || !command?.trim()) return res.status(400).json({ error: 'name y command requeridos' });
  const snippets = load();
  const snippet = { id: Date.now().toString(), name: name.trim(), command: command.trim(), serverId: serverId || '', createdAt: new Date().toISOString() };
  snippets.push(snippet);
  save(snippets);
  res.status(201).json(snippet);
});

router.put('/:id', (req, res) => {
  const { name, command, serverId } = req.body;
  const snippets = load();
  const idx = snippets.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  snippets[idx] = { ...snippets[idx], name: name?.trim() || snippets[idx].name, command: command?.trim() || snippets[idx].command, serverId: serverId ?? snippets[idx].serverId };
  save(snippets);
  res.json(snippets[idx]);
});

router.delete('/:id', (req, res) => {
  const snippets = load().filter(s => s.id !== req.params.id);
  save(snippets);
  res.json({ ok: true });
});

router.post('/:id/run', async (req, res) => {
  const snippet = load().find(s => s.id === req.params.id);
  if (!snippet) return res.status(404).json({ error: 'No encontrado' });

  const started = Date.now();

  try {
    let output;
    if (snippet.serverId) {
      const srv = loadServers().find(s => s.id === snippet.serverId);
      if (!srv) return res.status(400).json({ error: 'Servidor no configurado' });
      output = await sshExec(srv, snippet.command, 60000);
    } else {
      output = await new Promise((resolve, reject) => {
        exec(snippet.command, { timeout: 60000 }, (err, stdout, stderr) => {
          resolve([stdout, stderr].filter(Boolean).join('\n').trim() || (err ? err.message : '(sin output)'));
        });
      });
    }
    res.json({ ok: true, output, duration: Math.floor((Date.now() - started) / 1000) });
  } catch (err) {
    res.json({ ok: false, output: err.message, duration: Math.floor((Date.now() - started) / 1000) });
  }
});

module.exports = router;
