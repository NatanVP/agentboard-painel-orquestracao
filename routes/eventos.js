// Rota de Server-Sent Events (SSE) para eventos em tempo real
const express = require('express');
const { autenticar } = require('../middleware/autenticacao');
const sse = require('../services/sse');

const router = express.Router();

// GET /api/eventos — Estabelece conexão SSE
// Suporta autenticação via query param ?token= (necessário para EventSource no navegador)
router.get('/', (req, res, next) => {
  if (req.query.token) {
    req.headers['authorization'] = `Bearer ${req.query.token}`;
  }
  next();
}, autenticar, (req, res) => {
  const clienteId = `${req.usuario.id}_${Date.now()}`;

  // Headers obrigatórios para SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Evento inicial confirmando conexão
  res.write(`event: conectado\ndata: ${JSON.stringify({
    mensagem: 'Conexão SSE estabelecida',
    clienteId,
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Registra o cliente no serviço SSE
  sse.registrarCliente(clienteId, res);

  // Limpa ao fechar
  req.on('close', () => sse.removerCliente(clienteId));
  req.on('error', () => sse.removerCliente(clienteId));
});

module.exports = router;
