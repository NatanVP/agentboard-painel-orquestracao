const express = require('express');
const router = express.Router();
const db = require('../database');
const { autenticar } = require('../middleware/auth');

router.get('/', autenticar, (req, res) => {
  const { agent_id } = req.query;
  let q = 'SELECT t.*, a.name as agent_name FROM tasks t LEFT JOIN agents a ON t.agent_id = a.id';
  const p = [];
  if (agent_id) { q += ' WHERE t.agent_id = ?'; p.push(agent_id); }
  q += ' ORDER BY t.created_at DESC';
  db.all(q, p, (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, data: rows });
  });
});

router.post('/', autenticar, (req, res) => {
  const { agent_id, title } = req.body;
  if (!agent_id || !title) return res.status(400).json({ success: false, error: 'agent_id e title obrigatórios' });
  db.get('SELECT id FROM agents WHERE id = ?', [agent_id], (err, ag) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!ag) return res.status(404).json({ success: false, error: 'Agente não encontrado' });
    db.run('INSERT INTO tasks (agent_id, title) VALUES (?, ?)', [agent_id, title.trim()], function(err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      const tid = this.lastID;
      db.run('INSERT INTO logs (task_id, message, level) VALUES (?, ?, ?)', [tid, `Tarefa "${title}" criada`, 'info']);
      db.get('SELECT t.*, a.name as agent_name FROM tasks t LEFT JOIN agents a ON t.agent_id = a.id WHERE t.id = ?', [tid], (err, row) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (req.app.locals.emitirEvento) req.app.locals.emitirEvento({ tipo: 'task_created', dados: row });
        res.status(201).json({ success: true, data: row });
      });
    });
  });
});

module.exports = router;
