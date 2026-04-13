// Serviço de Server-Sent Events (SSE) para transmissão de eventos em tempo real
const clientes = new Map();

// Registra um novo cliente SSE
function registrarCliente(id, res) {
  clientes.set(id, res);
  console.log(`Cliente SSE registrado: ${id}. Total: ${clientes.size}`);
}

// Remove um cliente SSE
function removerCliente(id) {
  clientes.delete(id);
  console.log(`Cliente SSE removido: ${id}. Total: ${clientes.size}`);
}

// Emite um evento para todos os clientes conectados
function emitirEvento(tipo, dados) {
  const payload = JSON.stringify(dados);
  const mensagem = `event: ${tipo}\ndata: ${payload}\n\n`;

  clientes.forEach((res, id) => {
    try {
      res.write(mensagem);
    } catch (err) {
      console.error(`Erro ao emitir evento para cliente ${id}:`, err.message);
      removerCliente(id);
    }
  });
}

// Emite evento de mudança de status de tarefa
function emitirMudancaStatus(tarefa) {
  emitirEvento('status_tarefa', {
    tipo: 'status_tarefa',
    tarefaId: tarefa.id,
    status: tarefa.status,
    agenteId: tarefa.agente_id,
    titulo: tarefa.titulo,
    timestamp: new Date().toISOString()
  });
}

// Emite evento de novo log de execução
function emitirNovoLog(log) {
  emitirEvento('novo_log', {
    tipo: 'novo_log',
    tarefaId: log.tarefa_id,
    nivel: log.nivel,
    mensagem: log.mensagem,
    timestamp: new Date().toISOString()
  });
}

// Emite evento de heartbeat para manter conexões ativas
function iniciarHeartbeat() {
  setInterval(() => {
    emitirEvento('heartbeat', { timestamp: new Date().toISOString() });
  }, 30000);
}

module.exports = {
  registrarCliente,
  removerCliente,
  emitirEvento,
  emitirMudancaStatus,
  emitirNovoLog,
  iniciarHeartbeat
};
