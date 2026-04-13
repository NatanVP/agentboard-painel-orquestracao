const express = require('express');
const router = express.Router();
const db = require('../database');
const { autenticar } = require('../middleware/auth');

router.get('/', autenticar, (req, res) => {
  const { task_id } = req.query;
  let q = 'SELECT l.*, t.title as task_title, a.name as agent_name FROM logs l LEFT JOIN tasks t ON l.task_id = t.id LEFT JOIN agents a ON t.agent_id = a.id';
  const p = [];
  if (task_id) { q += ' WHERE l.task_id = ?'; p.push(task_id); }
  q += ' ORDER BY l.created_at DESC LIMIT 100';
  db.all(q, p, (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, data: rows });
  });
});

module.exports = router;
