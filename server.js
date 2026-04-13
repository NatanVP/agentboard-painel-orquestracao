const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const rotaAuth = require('./routes/auth');
const rotaAgentes = require('./routes/agents');
const rotaTarefas = require('./routes/tasks');
const rotaLogs = require('./routes/logs');
const rotaSSE = require('./routes/sse');

app.locals.emitirEvento = rotaSSE.emitirParaTodos;

app.use('/api/auth', rotaAuth);
app.use('/api/agents', rotaAgentes);
app.use('/api/tasks', rotaTarefas);
app.use('/api/logs', rotaLogs);
app.use('/api/events', rotaSSE);

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

const { tratarErros, rotaNaoEncontrada } = require('./middleware/errors');
app.use(rotaNaoEncontrada);
app.use(tratarErros);

const servidor = app.listen(parseInt(PORT), '127.0.0.1', () => {
  console.log(`AgentBoard rodando em http://localhost:${PORT}`);
});

module.exports = { app, servidor };
