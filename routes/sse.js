const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../database');
const { JWT_SECRET } = require('../middleware/auth');

const clientes = new Set();

router.get('/', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).json({ success: false, error: 'Token necessário' });
  try { jwt.verify(token, JWT_SECRET); } catch(e) { return res.status(403).json({ success: false, error: 'Token inválido' }); }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.write(`data: ${JSON.stringify({ tipo: 'conectado', mensagem: 'Stream ativo' })}\n\n`);
  clientes.add(res);

  const hb = setInterval(() => res.write(': hb\n\n'), 20000);

  const sim = setInterval(() => {
    db.get('SELECT t.*, a.name as agent_name FROM tasks t LEFT JOIN agents a ON t.agent_id = a.id WHERE t.status = ? ORDER BY RANDOM() LIMIT 1', ['running'], (err, task) => {
      if (!err && task) {
        const msgs = ['Processando item...', 'Verificando dependências...', 'Executando validação...', 'Sincronizando dados...'];
        const msg = msgs[Math.floor(Math.random() * msgs.length)];
        const lvl = Math.random() > 0.8 ? 'warn' : 'info';
        db.run('INSERT INTO logs (task_id, message, level) VALUES (?, ?, ?)', [task.id, msg, lvl]);
        emitirParaTodos({ tipo: 'log_novo', dados: { task_id: task.id, task_title: task.title, agent_name: task.agent_name, message: msg, level: lvl, created_at: new Date().toISOString() } });
      }
    });
  }, 8000);

  req.on('close', () => { clientes.delete(res); clearInterval(hb); clearInterval(sim); });
});

function emitirParaTodos(evento) {
  const payload = `data: ${JSON.stringify(evento)}\n\n`;
  for (const c of clientes) { try { c.write(payload); } catch(e) { clientes.delete(c); } }
}

module.exports = router;
module.exports.emitirParaTodos = emitirParaTodos;
