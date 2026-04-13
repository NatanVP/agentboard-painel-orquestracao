const express = require('express');
const router = express.Router();
const db = require('../database');
const { autenticar } = require('../middleware/auth');

router.get('/', autenticar, (req, res) => {
  db.all('SELECT * FROM agents ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, data: rows });
  });
});

router.post('/', autenticar, (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'Nome obrigatório' });
  db.run('INSERT INTO agents (name, description) VALUES (?, ?)', [name.trim(), description || ''], function(err) {
    if (err) return res.status(500).json({ success: false, error: err.message });
    db.get('SELECT * FROM agents WHERE id = ?', [this.lastID], (err, row) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (req.app.locals.emitirEvento) req.app.locals.emitirEvento({ tipo: 'agent_created', dados: row });
      res.status(201).json({ success: true, data: row });
    });
  });
});

router.put('/:id/status', autenticar, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const valid = ['idle', 'running', 'error', 'completed'];
  if (!status || !valid.includes(status)) return res.status(400).json({ success: false, error: 'Status inválido' });
  db.run('UPDATE agents SET status = ? WHERE id = ?', [status, id], function(err) {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (this.changes === 0) return res.status(404).json({ success: false, error: 'Agente não encontrado' });
    db.get('SELECT * FROM agents WHERE id = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (req.app.locals.emitirEvento) req.app.locals.emitirEvento({ tipo: 'agent_status', dados: row });
      res.json({ success: true, data: row });
    });
  });
});

module.exports = router;
