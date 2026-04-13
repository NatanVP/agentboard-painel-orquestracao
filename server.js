const express = require('express');
const cors = require('cors');
const path = require('path');

const { inicializarBanco } = require('./database');
const sse = require('./services/sse');
const fila = require('./services/fila');
const { tratadorDeErros, rotaNaoEncontrada } = require('./middleware/erros');

const app = express();
const PORT = 3000;

// Middlewares globais
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rotas da API
const rotaAuth = require('./routes/auth');
const rotaAgentes = require('./routes/agentes');
const rotaTarefas = require('./routes/tarefas');
const rotaEventos = require('./routes/eventos');
const rotaDashboard = require('./routes/dashboard');

app.use('/api/auth', rotaAuth);
app.use('/api/agentes', rotaAgentes);
app.use('/api/tarefas', rotaTarefas);
app.use('/api/eventos', rotaEventos);
app.use('/api/dashboard', rotaDashboard);

// Middlewares de erro (devem ser os últimos)
app.use(tratadorDeErros);

// Inicializa banco e sobe o servidor
inicializarBanco().then(() => {
  sse.iniciarHeartbeat();
  fila.retomardTarefasPendentes();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AgentBoard rodando em http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Falha ao inicializar o banco de dados:', err.message);
  process.exit(1);
});

module.exports = app;
