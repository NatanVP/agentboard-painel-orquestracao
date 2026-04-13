// Serviço de fila de tarefas com execução simulada via setTimeout
const { executar, buscarUm, buscarTodos } = require('../database');
const sse = require('./sse');

// Conjunto de tarefas em processamento (evita duplicatas)
const tarefasEmProcessamento = new Set();

// Registra um log de execução para uma tarefa
async function registrarLog(tarefaId, nivel, mensagem) {
  try {
    await executar(
      'INSERT INTO logs_execucao (tarefa_id, nivel, mensagem) VALUES (?, ?, ?)',
      [tarefaId, nivel, mensagem]
    );

    sse.emitirNovoLog({
      tarefa_id: tarefaId,
      nivel,
      mensagem
    });
  } catch (err) {
    console.error('Erro ao registrar log:', err.message);
  }
}

// Atualiza o status de uma tarefa e emite evento SSE
async function atualizarStatusTarefa(tarefaId, status, extras = {}) {
  try {
    const campos = ['status = ?'];
    const valores = [status];

    if (status === 'executando') {
      campos.push('iniciado_em = CURRENT_TIMESTAMP');
    }

    if (status === 'concluido' || status === 'erro') {
      campos.push('concluido_em = CURRENT_TIMESTAMP');
    }

    if (extras.resultado !== undefined) {
      campos.push('resultado = ?');
      valores.push(typeof extras.resultado === 'object'
        ? JSON.stringify(extras.resultado)
        : extras.resultado);
    }

    if (extras.erro !== undefined) {
      campos.push('erro = ?');
      valores.push(extras.erro);
    }

    if (extras.tentativas !== undefined) {
      campos.push('tentativas = ?');
      valores.push(extras.tentativas);
    }

    valores.push(tarefaId);

    await executar(
      `UPDATE tarefas SET ${campos.join(', ')} WHERE id = ?`,
      valores
    );

    const tarefa = await buscarUm('SELECT * FROM tarefas WHERE id = ?', [tarefaId]);
    if (tarefa) {
      sse.emitirMudancaStatus(tarefa);
    }
  } catch (err) {
    console.error('Erro ao atualizar status da tarefa:', err.message);
  }
}

// Simula a execução de uma tarefa com etapas progressivas
async function simularExecucao(tarefa) {
  const tarefaId = tarefa.id;

  await registrarLog(tarefaId, 'info', `Iniciando execução da tarefa: ${tarefa.titulo}`);

  // Etapa 1 — preparação
  await new Promise(resolve => setTimeout(resolve, 1000));
  await registrarLog(tarefaId, 'info', 'Preparando ambiente de execução...');

  // Etapa 2 — processamento
  await new Promise(resolve => setTimeout(resolve, 2000));
  await registrarLog(tarefaId, 'info', 'Processando dados da tarefa...');

  // Etapa 3 — finalização (simula sucesso com 85% de chance, erro com 15%)
  await new Promise(resolve => setTimeout(resolve, 1500));

  const sucesso = Math.random() > 0.15;

  if (sucesso) {
    const resultado = {
      status: 'concluido',
      mensagem: 'Tarefa executada com sucesso',
      timestamp: new Date().toISOString(),
      dados: {
        itensProcessados: Math.floor(Math.random() * 100) + 1,
        duracao_ms: 4500
      }
    };

    await atualizarStatusTarefa(tarefaId, 'concluido', { resultado });
    await registrarLog(tarefaId, 'info', `Tarefa concluída com sucesso. Itens processados: ${resultado.dados.itensProcessados}`);
  } else {
    const mensagemErro = 'Falha durante o processamento: recurso temporariamente indisponível';
    await atualizarStatusTarefa(tarefaId, 'erro', { erro: mensagemErro });
    await registrarLog(tarefaId, 'erro', mensagemErro);
  }
}

// Processa uma tarefa da fila
async function processarTarefa(tarefa) {
  if (tarefasEmProcessamento.has(tarefa.id)) {
    return;
  }

  tarefasEmProcessamento.add(tarefa.id);

  try {
    const tentativas = (tarefa.tentativas || 0) + 1;
    await atualizarStatusTarefa(tarefa.id, 'executando', { tentativas });
    await registrarLog(tarefa.id, 'info', `Tentativa ${tentativas} de execução iniciada`);

    await simularExecucao(tarefa);
  } catch (err) {
    console.error(`Erro ao processar tarefa ${tarefa.id}:`, err.message);
    await atualizarStatusTarefa(tarefa.id, 'erro', { erro: err.message });
    await registrarLog(tarefa.id, 'erro', `Erro inesperado: ${err.message}`);
  } finally {
    tarefasEmProcessamento.delete(tarefa.id);
  }
}

// Inicia o processamento de tarefas pendentes
function enfileirarTarefa(tarefaId) {
  setTimeout(async () => {
    try {
      const tarefa = await buscarUm(
        'SELECT * FROM tarefas WHERE id = ? AND status = ?',
        [tarefaId, 'pendente']
      );

      if (tarefa) {
        await processarTarefa(tarefa);
      }
    } catch (err) {
      console.error(`Erro ao enfileirar tarefa ${tarefaId}:`, err.message);
    }
  }, 500);
}

// Verifica e retoma tarefas pendentes ao iniciar o servidor
async function retomardTarefasPendentes() {
  try {
    const pendentes = await buscarTodos(
      'SELECT * FROM tarefas WHERE status = ? ORDER BY prioridade DESC, criado_em ASC LIMIT 5',
      ['pendente']
    );

    if (pendentes.length > 0) {
      console.log(`Retomando ${pendentes.length} tarefa(s) pendente(s)...`);
      for (const tarefa of pendentes) {
        enfileirarTarefa(tarefa.id);
      }
    }
  } catch (err) {
    console.error('Erro ao retomar tarefas pendentes:', err.message);
  }
}

module.exports = {
  enfileirarTarefa,
  retomardTarefasPendentes,
  registrarLog
};
