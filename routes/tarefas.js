// Rotas de gerenciamento de tarefas
const express = require('express');
const { executar, buscarUm, buscarTodos } = require('../database');
const { autenticar } = require('../middleware/autenticacao');
const fila = require('../services/fila');

const router = express.Router();

// Aplica autenticação em todas as rotas de tarefas
router.use(autenticar);

// GET /api/tarefas — Lista todas as tarefas dos agentes do usuário
router.get('/', async (req, res) => {
  try {
    const { status, agente_id, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT t.*, a.nome as agente_nome, a.tipo as agente_tipo
      FROM tarefas t
      INNER JOIN agentes a ON t.agente_id = a.id
      WHERE a.usuario_id = ?
    `;
    const params = [req.usuario.id];

    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }

    if (agente_id) {
      sql += ' AND t.agente_id = ?';
      params.push(agente_id);
    }

    sql += ' ORDER BY t.prioridade DESC, t.criado_em DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const tarefas = await buscarTodos(sql, params);

    const tarefasFormatadas = tarefas.map(t => ({
      ...t,
      payload: JSON.parse(t.payload || '{}')
    }));

    return res.json({ tarefas: tarefasFormatadas, total: tarefasFormatadas.length });
  } catch (err) {
    console.error('Erro ao listar tarefas:', err.message);
    return res.status(500).json({ erro: 'Erro interno ao listar tarefas' });
  }
});

// POST /api/tarefas — Cria uma nova tarefa e a enfileira para execução
router.post('/', async (req, res) => {
  try {
    const { agente_id, titulo, payload, prioridade } = req.body;

    if (!agente_id || !titulo) {
      return res.status(400).json({ erro: 'ID do agente e título são obrigatórios' });
    }

    // Verifica se o agente pertence ao usuário autenticado
    const agente = await buscarUm(
      'SELECT * FROM agentes WHERE id = ? AND usuario_id = ?',
      [agente_id, req.usuario.id]
    );

    if (!agente) {
      return res.status(404).json({ erro: 'Agente não encontrado ou sem permissão' });
    }

    const payloadJson = typeof payload === 'object'
      ? JSON.stringify(payload)
      : (payload || '{}');

    const resultado = await executar(
      `INSERT INTO tarefas (agente_id, titulo, payload, prioridade)
       VALUES (?, ?, ?, ?)`,
      [agente_id, titulo.trim(), payloadJson, prioridade || 1]
    );

    const tarefa = await buscarUm(
      'SELECT * FROM tarefas WHERE id = ?',
      [resultado.id]
    );

    // Enfileira a tarefa para processamento assíncrono
    fila.enfileirarTarefa(resultado.id);

    return res.status(201).json({
      mensagem: 'Tarefa criada e enfileirada com sucesso',
      tarefa: {
        ...tarefa,
        payload: JSON.parse(tarefa.payload || '{}')
      }
    });
  } catch (err) {
    console.error('Erro ao criar tarefa:', err.message);
    return res.status(500).json({ erro: 'Erro interno ao criar tarefa' });
  }
});

// GET /api/tarefas/:id — Retorna detalhes de uma tarefa específica
router.get('/:id', async (req, res) => {
  try {
    const tarefa = await buscarUm(
      `SELECT t.*, a.nome as agente_nome, a.tipo as agente_tipo
       FROM tarefas t
       INNER JOIN agentes a ON t.agente_id = a.id
       WHERE t.id = ? AND a.usuario_id = ?`,
      [req.params.id, req.usuario.id]
    );

    if (!tarefa) {
      return res.status(404).json({ erro: 'Tarefa não encontrada' });
    }

    return res.json({
      tarefa: {
        ...tarefa,
        payload: JSON.parse(tarefa.payload || '{}')
      }
    });
  } catch (err) {
    console.error('Erro ao buscar tarefa:', err.message);
    return res.status(500).json({ erro: 'Erro interno ao buscar tarefa' });
  }
});

// DELETE /api/tarefas/:id — Remove uma tarefa
router.delete('/:id', async (req, res) => {
  try {
    const tarefa = await buscarUm(
      `SELECT t.* FROM tarefas t
       INNER JOIN agentes a ON t.agente_id = a.id
       WHERE t.id = ? AND a.usuario_id = ?`,
      [req.params.id, req.usuario.id]
    );

    if (!tarefa) {
      return res.status(404).json({ erro: 'Tarefa não encontrada' });
    }

    if (tarefa.status === 'executando') {
      return res.status(409).json({ erro: 'Não é possível remover uma tarefa em execução' });
    }

    await executar('DELETE FROM tarefas WHERE id = ?', [req.params.id]);

    return res.json({ mensagem: 'Tarefa removida com sucesso' });
  } catch (err) {
    console.error('Erro ao remover tarefa:', err.message);
    return res.status(500).json({ erro: 'Erro interno ao remover tarefa' });
  }
});

// GET /api/tarefas/:id/logs — Lista os logs de execução de uma tarefa
router.get('/:id/logs', async (req, res) => {
  try {
    const tarefa = await buscarUm(
      `SELECT t.* FROM tarefas t
       INNER JOIN agentes a ON t.agente_id = a.id
       WHERE t.id = ? AND a.usuario_id = ?`,
      [req.params.id, req.usuario.id]
    );

    if (!tarefa) {
      return res.status(404).json({ erro: 'Tarefa não encontrada' });
    }

    const { limit = 100, offset = 0 } = req.query;

    const logs = await buscarTodos(
      `SELECT * FROM logs_execucao
       WHERE tarefa_id = ?
       ORDER BY criado_em ASC
       LIMIT ? OFFSET ?`,
      [req.params.id, parseInt(limit), parseInt(offset)]
    );

    return res.json({ logs, total: logs.length });
  } catch (err) {
    console.error('Erro ao buscar logs da tarefa:', err.message);
    return res.status(500).json({ erro: 'Erro interno ao buscar logs' });
  }
});

module.exports = router;
