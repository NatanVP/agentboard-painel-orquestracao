// Rotas de gerenciamento de agentes
const express = require('express');
const { executar, buscarUm, buscarTodos } = require('../database');
const { autenticar } = require('../middleware/autenticacao');

const router = express.Router();

// Aplica autenticação em todas as rotas de agentes
router.use(autenticar);

// GET /api/agentes — Lista todos os agentes do usuário autenticado
router.get('/', async (req, res) => {
  try {
    const agentes = await buscarTodos(
      `SELECT a.*, 
        (SELECT COUNT(*) FROM tarefas t WHERE t.agente_id = a.id) as total_tarefas,
        (SELECT COUNT(*) FROM tarefas t WHERE t.agente_id = a.id AND t.status = 'pendente') as tarefas_pendentes,
        (SELECT COUNT(*) FROM tarefas t WHERE t.agente_id = a.id AND t.status = 'executando') as tarefas_executando
       FROM agentes a
       WHERE a.usuario_id = ?
       ORDER BY a.criado_em DESC`,
      [req.usuario.id]
    );

    // Parseia o campo configuracao de JSON string para objeto
    const agentesFormatados = agentes.map(a => ({
      ...a,
      configuracao: JSON.parse(a.configuracao || '{}')
    }));

    return res.json({ agentes: agentesFormatados, total: agentesFormatados.length });
  } catch (err) {
    console.error('Erro ao listar agentes:', err.message);
    return res.status(500).json({ erro: 'Erro interno ao listar agentes' });
  }
});

// POST /api/agentes — Cria um novo agente
router.post('/', async (req, res) => {
  try {
    const { nome, tipo, descricao, configuracao, status } = req.body;

    if (!nome || !tipo) {
      return res.status(400).json({ erro: 'Nome e tipo são obrigatórios' });
    }

    const configuracaoJson = typeof configuracao === 'object'
      ? JSON.stringify(configuracao)
      : (configuracao || '{}');

    const resultado = await executar(
      `INSERT INTO agentes (usuario_id, nome, tipo, descricao, configuracao, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.usuario.id,
        nome.trim(),
        tipo.trim(),
        descricao || null,
        configuracaoJson,
        status || 'inativo'
      ]
    );

    const agente = await buscarUm(
      'SELECT * FROM agentes WHERE id = ?',
      [resultado.id]
    );

    return res.status(201).json({
      mensagem: 'Agente criado com sucesso',
      agente: {
        ...agente,
        configuracao: JSON.parse(agente.configuracao || '{}')
      }
    });
  } catch (err) {
    console.error('Erro ao criar agente:', err.message);
    return res.status(500).json({ erro: 'Erro interno ao criar agente' });
  }
});

// GET /api/agentes/:id — Retorna detalhes de um agente específico
router.get('/:id', async (req, res) => {
  try {
    const agente = await buscarUm(
      'SELECT * FROM agentes WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuario.id]
    );

    if (!agente) {
      return res.status(404).json({ erro: 'Agente não encontrado' });
    }

    return res.json({
      agente: {
        ...agente,
        configuracao: JSON.parse(agente.configuracao || '{}')
      }
    });
  } catch (err) {
    console.error('Erro ao buscar agente:', err.message);
    return res.status(500).json({ erro: 'Erro interno ao buscar agente' });
  }
});

// PUT /api/agentes/:id — Atualiza um agente existente
router.put('/:id', async (req, res) => {
  try {
    const agente = await buscarUm(
      'SELECT * FROM agentes WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuario.id]
    );

    if (!agente) {
      return res.status(404).json({ erro: 'Agente não encontrado' });
    }

    const { nome, tipo, descricao, configuracao, status } = req.body;

    const configuracaoJson = configuracao !== undefined
      ? (typeof configuracao === 'object' ? JSON.stringify(configuracao) : configuracao)
      : agente.configuracao;

    await executar(
      `UPDATE agentes SET
        nome = ?,
        tipo = ?,
        descricao = ?,
        configuracao = ?,
        status = ?,
        atualizado_em = CURRENT_TIMESTAMP
       WHERE id = ? AND usuario_id = ?`,
      [
        nome || agente.nome,
        tipo || agente.tipo,
        descricao !== undefined ? descricao : agente.descricao,
        configuracaoJson,
        status || agente.status,
        req.params.id,
        req.usuario.id
      ]
    );

    const agenteAtualizado = await buscarUm(
      'SELECT * FROM agentes WHERE id = ?',
      [req.params.id]
    );

    return res.json({
      mensagem: 'Agente atualizado com sucesso',
      agente: {
        ...agenteAtualizado,
        configuracao: JSON.parse(agenteAtualizado.configuracao || '{}')
      }
    });
  } catch (err) {
    console.error('Erro ao atualizar agente:', err.message);
    return res.status(500).json({ erro: 'Erro interno ao atualizar agente' });
  }
});

// DELETE /api/agentes/:id — Remove um agente
router.delete('/:id', async (req, res) => {
  try {
    const agente = await buscarUm(
      'SELECT * FROM agentes WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuario.id]
    );

    if (!agente) {
      return res.status(404).json({ erro: 'Agente não encontrado' });
    }

    await executar(
      'DELETE FROM agentes WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuario.id]
    );

    return res.json({ mensagem: 'Agente removido com sucesso' });
  } catch (err) {
    console.error('Erro ao remover agente:', err.message);
    return res.status(500).json({ erro: 'Erro interno ao remover agente' });
  }
});

// GET /api/agentes/:id/tarefas — Lista tarefas de um agente específico
router.get('/:id/tarefas', async (req, res) => {
  try {
    const agente = await buscarUm(
      'SELECT * FROM agentes WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuario.id]
    );

    if (!agente) {
      return res.status(404).json({ erro: 'Agente não encontrado' });
    }

    const { status, limit = 50, offset = 0 } = req.query;

    let sql = 'SELECT * FROM tarefas WHERE agente_id = ?';
    const params = [req.params.id];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY criado_em DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const tarefas = await buscarTodos(sql, params);

    const tarefasFormatadas = tarefas.map(t => ({
      ...t,
      payload: JSON.parse(t.payload || '{}')
    }));

    return res.json({ tarefas: tarefasFormatadas, total: tarefasFormatadas.length });
  } catch (err) {
    console.error('Erro ao listar tarefas do agente:', err.message);
    return res.status(500).json({ erro: 'Erro interno ao listar tarefas do agente' });
  }
});

module.exports = router;
