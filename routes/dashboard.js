// Rota de dashboard com estatísticas consolidadas
const express = require('express');
const { buscarUm, buscarTodos } = require('../database');
const { autenticar } = require('../middleware/autenticacao');

const router = express.Router();

// GET /api/dashboard — Retorna métricas gerais do usuário autenticado
router.get('/', autenticar, async (req, res) => {
  try {
    const [
      totalAgentes,
      agentesAtivos,
      totalTarefas,
      tarefasPendentes,
      tarefasExecutando,
      tarefasConcluidas,
      tarefasComErro,
      ultimasTarefas
    ] = await Promise.all([
      buscarUm('SELECT COUNT(*) as total FROM agentes WHERE usuario_id = ?', [req.usuario.id]),
      buscarUm("SELECT COUNT(*) as total FROM agentes WHERE usuario_id = ? AND status = 'ativo'", [req.usuario.id]),
      buscarUm(
        `SELECT COUNT(*) as total FROM tarefas t
         INNER JOIN agentes a ON t.agente_id = a.id
         WHERE a.usuario_id = ?`,
        [req.usuario.id]
      ),
      buscarUm(
        `SELECT COUNT(*) as total FROM tarefas t
         INNER JOIN agentes a ON t.agente_id = a.id
         WHERE a.usuario_id = ? AND t.status = 'pendente'`,
        [req.usuario.id]
      ),
      buscarUm(
        `SELECT COUNT(*) as total FROM tarefas t
         INNER JOIN agentes a ON t.agente_id = a.id
         WHERE a.usuario_id = ? AND t.status = 'executando'`,
        [req.usuario.id]
      ),
      buscarUm(
        `SELECT COUNT(*) as total FROM tarefas t
         INNER JOIN agentes a ON t.agente_id = a.id
         WHERE a.usuario_id = ? AND t.status = 'concluido'`,
        [req.usuario.id]
      ),
      buscarUm(
        `SELECT COUNT(*) as total FROM tarefas t
         INNER JOIN agentes a ON t.agente_id = a.id
         WHERE a.usuario_id = ? AND t.status = 'erro'`,
        [req.usuario.id]
      ),
      buscarTodos(
        `SELECT t.id, t.titulo, t.status, t.criado_em, t.concluido_em,
                a.nome as agente_nome
         FROM tarefas t
         INNER JOIN agentes a ON t.agente_id = a.id
         WHERE a.usuario_id = ?
         ORDER BY t.criado_em DESC
         LIMIT 10`,
        [req.usuario.id]
      )
    ]);

    return res.json({
      resumo: {
        agentes: {
          total: totalAgentes ? totalAgentes.total : 0,
          ativos: agentesAtivos ? agentesAtivos.total : 0
        },
        tarefas: {
          total: totalTarefas ? totalTarefas.total : 0,
          pendentes: tarefasPendentes ? tarefasPendentes.total : 0,
          executando: tarefasExecutando ? tarefasExecutando.total : 0,
          concluidas: tarefasConcluidas ? tarefasConcluidas.total : 0,
          com_erro: tarefasComErro ? tarefasComErro.total : 0
        }
      },
      ultimas_tarefas: ultimasTarefas || [],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Erro ao carregar dashboard:', err.message);
    return res.status(500).json({ erro: 'Erro interno ao carregar dashboard' });
  }
});

module.exports = router;
