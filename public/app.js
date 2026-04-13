'use strict';

/* ============================================================
   Configuração Global
   ============================================================ */

const API = '';
let sseConexao = null;
let agenteEditandoId = null;

/* ============================================================
   Utilitários
   ============================================================ */

function obterToken() {
  return localStorage.getItem('agentboard_token');
}

function salvarToken(token) {
  localStorage.setItem('agentboard_token', token);
}

function removerToken() {
  localStorage.removeItem('agentboard_token');
}

function headersAutorizados(extras) {
  return Object.assign({
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + obterToken()
  }, extras || {});
}

async function requisicao(metodo, caminho, corpo) {
  const opcoes = {
    method: metodo,
    headers: headersAutorizados()
  };
  if (corpo !== undefined) {
    opcoes.body = JSON.stringify(corpo);
  }
  const resposta = await fetch(API + caminho, opcoes);
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados.mensagem || dados.erro || dados.error || 'Erro ' + resposta.status);
  }
  return dados;
}

function formatarData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatarHora(iso) {
  if (!iso) return new Date().toLocaleTimeString('pt-BR');
  return new Date(iso).toLocaleTimeString('pt-BR');
}

/* ============================================================
   Toast (Notificações)
   ============================================================ */

function mostrarToast(mensagem, tipo) {
  tipo = tipo || 'info';
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + tipo;

  const icones = { sucesso: '✓', erro: '✕', info: 'ℹ' };
  const icone = icones[tipo] || 'ℹ';

  toast.innerHTML = '<span class="toast-icone">' + icone + '</span>'
    + '<span class="toast-mensagem">' + mensagem + '</span>';

  container.appendChild(toast);

  setTimeout(function () {
    toast.classList.add('sair');
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 3500);
}

/* ============================================================
   Navegação
   ============================================================ */

function mostrarSecao(nome, linkEl) {
  const secoes = document.querySelectorAll('.secao');
  secoes.forEach(function (s) { s.classList.add('oculto'); });

  const alvo = document.getElementById('secao-' + nome);
  if (alvo) alvo.classList.remove('oculto');

  document.querySelectorAll('.menu-item').forEach(function (el) {
    el.classList.remove('ativo');
  });
  if (linkEl) linkEl.classList.add('ativo');

  if (nome === 'dashboard') carregarDashboard();
  if (nome === 'agentes') listarAgentes();
  if (nome === 'tarefas') listarTarefas();
}

function alternarFormAuth(forma) {
  if (forma === 'login') {
    document.getElementById('form-login').classList.remove('oculto');
    document.getElementById('form-registro').classList.add('oculto');
  } else {
    document.getElementById('form-login').classList.add('oculto');
    document.getElementById('form-registro').classList.remove('oculto');
  }
}

/* ============================================================
   Autenticação
   ============================================================ */

async function login(evento) {
  evento.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const btn = evento.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Entrando...';

  try {
    const resposta = await requisicao('POST', '/api/auth/login', { email, senha });
    salvarToken(resposta.token);
    entrarNoApp();
    mostrarToast('Bem-vindo, ' + (resposta.usuario && resposta.usuario.nome ? resposta.usuario.nome : 'usuário') + '!', 'sucesso');
  } catch (err) {
    mostrarToast(err.message || 'Erro ao fazer login.', 'erro');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
}

async function registrar(evento) {
  evento.preventDefault();
  const nome = document.getElementById('reg-nome').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const senha = document.getElementById('reg-senha').value;
  const btn = evento.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Criando conta...';

  try {
    await requisicao('POST', '/api/auth/registrar', { nome, email, senha });
    mostrarToast('Conta criada! Faça login para continuar.', 'sucesso');
    alternarFormAuth('login');
    document.getElementById('login-email').value = email;
  } catch (err) {
    mostrarToast(err.message || 'Erro ao registrar.', 'erro');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Criar Conta';
  }
}

function logout() {
  removerToken();
  desconectarSSE();
  document.getElementById('tela-app').classList.add('oculto');
  document.getElementById('tela-auth').classList.remove('oculto');
  alternarFormAuth('login');
  mostrarToast('Sessão encerrada.', 'info');
}

function entrarNoApp() {
  document.getElementById('tela-auth').classList.add('oculto');
  document.getElementById('tela-app').classList.remove('oculto');
  conectarSSE();
  carregarDashboard();
  listarAgentes();
}

/* ============================================================
   Dashboard
   ============================================================ */

async function carregarDashboard() {
  try {
    const dados = await requisicao('GET', '/api/dashboard');

    document.getElementById('dash-total-agentes').textContent =
      dados.total_agentes !== undefined ? dados.total_agentes : (dados.agentes || 0);

    document.getElementById('dash-tarefas-pendentes').textContent =
      dados.tarefas_pendentes !== undefined ? dados.tarefas_pendentes : (dados.pendentes || 0);

    document.getElementById('dash-tarefas-concluidas').textContent =
      dados.tarefas_concluidas !== undefined ? dados.tarefas_concluidas : (dados.concluidas || 0);

    const total = (dados.tarefas_concluidas || dados.concluidas || 0) + (dados.tarefas_erro || dados.erros || 0);
    const concluidas = dados.tarefas_concluidas !== undefined ? dados.tarefas_concluidas : (dados.concluidas || 0);
    const taxa = total > 0 ? Math.round((concluidas / total) * 100) : 0;
    document.getElementById('dash-taxa-sucesso').textContent = taxa + '%';

    const atividade = document.getElementById('dash-atividade');
    if (dados.atividade_recente && dados.atividade_recente.length > 0) {
      atividade.innerHTML = dados.atividade_recente.map(function (item) {
        return '<div style="padding:6px 0;border-bottom:1px solid var(--cor-borda);font-size:13px;">'
          + '<span style="color:var(--cor-texto-suave);">' + formatarData(item.criado_em || item.created_at) + '</span>'
          + ' — ' + (item.titulo || item.descricao || 'Tarefa') + '</div>';
      }).join('');
    } else {
      atividade.innerHTML = '<p class="texto-vazio">Nenhuma atividade recente.</p>';
    }
  } catch (err) {
    mostrarToast('Erro ao carregar dashboard: ' + err.message, 'erro');
  }
}

/* ============================================================
   Agentes
   ============================================================ */

async function listarAgentes() {
  const corpo = document.getElementById('corpo-tabela-agentes');
  corpo.innerHTML = '<tr><td colspan="5" class="texto-vazio">Carregando...</td></tr>';

  try {
    const dados = await requisicao('GET', '/api/agentes');
    const agentes = Array.isArray(dados) ? dados : (dados.agentes || dados.data || []);

    if (agentes.length === 0) {
      corpo.innerHTML = '<tr><td colspan="5" class="texto-vazio">Nenhum agente cadastrado.</td></tr>';
      return;
    }

    corpo.innerHTML = agentes.map(function (ag) {
      return '<tr>'
        + '<td><strong>' + escaparHtml(ag.nome) + '</strong></td>'
        + '<td>' + escaparHtml(capitalizarPrimeira(ag.tipo || '')) + '</td>'
        + '<td><span class="badge badge-' + (ag.status || 'inativo') + '">' + escaparHtml(ag.status || 'inativo') + '</span></td>'
        + '<td>' + (ag.total_tarefas !== undefined ? ag.total_tarefas : '—') + '</td>'
        + '<td>'
        + '<div class="tabela-acoes">'
        + '<button class="btn btn-outline btn-sm" onclick="abrirModalEditarAgente(' + ag.id + ')">Editar</button>'
        + '<button class="btn btn-perigo btn-sm" onclick="excluirAgente(' + ag.id + ', \'' + escaparHtml(ag.nome) + '\')">Excluir</button>'
        + '</div>'
        + '</td>'
        + '</tr>';
    }).join('');

    popularSelectAgentes(agentes);
  } catch (err) {
    corpo.innerHTML = '<tr><td colspan="5" class="texto-vazio">Erro ao carregar agentes.</td></tr>';
    mostrarToast('Erro ao listar agentes: ' + err.message, 'erro');
  }
}

async function criarAgente(dados) {
  return await requisicao('POST', '/api/agentes', dados);
}

async function atualizarAgente(id, dados) {
  return await requisicao('PUT', '/api/agentes/' + id, dados);
}

async function excluirAgente(id, nome) {
  if (!confirm('Confirmar exclusão do agente "' + nome + '"?')) return;
  try {
    await requisicao('DELETE', '/api/agentes/' + id);
    mostrarToast('Agente "' + nome + '" excluído.', 'sucesso');
    listarAgentes();
  } catch (err) {
    mostrarToast('Erro ao excluir agente: ' + err.message, 'erro');
  }
}

function abrirModalAgente() {
  agenteEditandoId = null;
  document.getElementById('modal-agente-titulo').textContent = 'Novo Agente';
  document.getElementById('form-agente').reset();
  document.getElementById('agente-id').value = '';
  abrirModal('modal-agente');
}

async function abrirModalEditarAgente(id) {
  try {
    const dados = await requisicao('GET', '/api/agentes');
    const agentes = Array.isArray(dados) ? dados : (dados.agentes || dados.data || []);
    const ag = agentes.find(function (a) { return a.id === id; });
    if (!ag) { mostrarToast('Agente não encontrado.', 'erro'); return; }

    agenteEditandoId = id;
    document.getElementById('modal-agente-titulo').textContent = 'Editar Agente';
    document.getElementById('agente-id').value = id;
    document.getElementById('agente-nome').value = ag.nome || '';
    document.getElementById('agente-tipo').value = ag.tipo || '';
    document.getElementById('agente-descricao').value = ag.descricao || '';
    document.getElementById('agente-status').value = ag.status || 'ativo';
    abrirModal('modal-agente');
  } catch (err) {
    mostrarToast('Erro ao carregar agente: ' + err.message, 'erro');
  }
}

async function submeterFormAgente(evento) {
  evento.preventDefault();
  const dados = {
    nome: document.getElementById('agente-nome').value.trim(),
    tipo: document.getElementById('agente-tipo').value,
    descricao: document.getElementById('agente-descricao').value.trim(),
    status: document.getElementById('agente-status').value,
    configuracao: {}
  };

  const btn = evento.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    if (agenteEditandoId) {
      await atualizarAgente(agenteEditandoId, dados);
      mostrarToast('Agente atualizado com sucesso!', 'sucesso');
    } else {
      await criarAgente(dados);
      mostrarToast('Agente criado com sucesso!', 'sucesso');
    }
    fecharModal('modal-agente');
    listarAgentes();
  } catch (err) {
    mostrarToast('Erro ao salvar agente: ' + err.message, 'erro');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar';
  }
}

/* ============================================================
   Tarefas
   ============================================================ */

async function listarTarefas() {
  const corpo = document.getElementById('corpo-tabela-tarefas');
  corpo.innerHTML = '<tr><td colspan="6" class="texto-vazio">Carregando...</td></tr>';

  try {
    const dados = await requisicao('GET', '/api/tarefas');
    const tarefas = Array.isArray(dados) ? dados : (dados.tarefas || dados.data || []);

    if (tarefas.length === 0) {
      corpo.innerHTML = '<tr><td colspan="6" class="texto-vazio">Nenhuma tarefa encontrada.</td></tr>';
      return;
    }

    corpo.innerHTML = tarefas.map(function (t) {
      return '<tr>'
        + '<td><strong>' + escaparHtml(t.titulo) + '</strong></td>'
        + '<td>' + escaparHtml(t.agente_nome || t.agente || String(t.agente_id || '—')) + '</td>'
        + '<td><span class="badge badge-' + (t.prioridade || 'media') + '">' + capitalizarPrimeira(t.prioridade || 'media') + '</span></td>'
        + '<td><span class="badge badge-' + (t.status || 'pendente') + '">' + escaparHtml(t.status || 'pendente') + '</span></td>'
        + '<td>' + formatarData(t.criado_em || t.created_at) + '</td>'
        + '<td>'
        + '<div class="tabela-acoes">'
        + '<button class="btn btn-outline btn-sm" onclick="verLogsTarefa(' + t.id + ')">Logs</button>'
        + '<button class="btn btn-perigo btn-sm" onclick="excluirTarefa(' + t.id + ', \'' + escaparHtml(t.titulo) + '\')">Excluir</button>'
        + '</div>'
        + '</td>'
        + '</tr>';
    }).join('');
  } catch (err) {
    corpo.innerHTML = '<tr><td colspan="6" class="texto-vazio">Erro ao carregar tarefas.</td></tr>';
    mostrarToast('Erro ao listar tarefas: ' + err.message, 'erro');
  }
}

async function criarTarefa(dados) {
  return await requisicao('POST', '/api/tarefas', dados);
}

async function excluirTarefa(id, titulo) {
  if (!confirm('Confirmar exclusão da tarefa "' + titulo + '"?')) return;
  try {
    await requisicao('DELETE', '/api/tarefas/' + id);
    mostrarToast('Tarefa excluída.', 'sucesso');
    listarTarefas();
  } catch (err) {
    mostrarToast('Erro ao excluir tarefa: ' + err.message, 'erro');
  }
}

async function verLogsTarefa(id) {
  const painel = document.getElementById('modal-painel-logs');
  painel.innerHTML = '<div class="log-vazio">Carregando logs...</div>';
  abrirModal('modal-logs-tarefa');

  try {
    const dados = await requisicao('GET', '/api/tarefas/' + id + '/logs');
    const logs = Array.isArray(dados) ? dados : (dados.logs || dados.data || []);

    if (logs.length === 0) {
      painel.innerHTML = '<div class="log-vazio">Nenhum log disponível para esta tarefa.</div>';
      return;
    }

    painel.innerHTML = logs.map(function (log) {
      const nivel = (log.nivel || log.level || 'info').toLowerCase();
      const nivelClass = 'log-nivel-' + (nivel === 'error' ? 'erro' : nivel === 'warn' ? 'aviso' : nivel === 'success' ? 'sucesso' : 'info');
      const nivelTexto = nivel === 'error' ? 'ERRO' : nivel === 'warn' ? 'AVISO' : nivel === 'success' ? 'OK' : 'INFO';
      return '<div class="log-linha">'
        + '<span class="log-timestamp">' + formatarHora(log.criado_em || log.created_at || log.timestamp) + '</span>'
        + '<span class="log-nivel ' + nivelClass + '">[' + nivelTexto + ']</span>'
        + '<span class="log-mensagem">' + escaparHtml(log.mensagem || log.message || '') + '</span>'
        + '</div>';
    }).join('');

    painel.scrollTop = painel.scrollHeight;
  } catch (err) {
    painel.innerHTML = '<div class="log-vazio">Erro ao carregar logs: ' + err.message + '</div>';
  }
}

function abrirModalTarefa() {
  document.getElementById('form-tarefa').reset();
  abrirModal('modal-tarefa');
}

async function submeterFormTarefa(evento) {
  evento.preventDefault();
  const payloadTexto = document.getElementById('tarefa-payload').value.trim();
  let payload = {};
  if (payloadTexto) {
    try {
      payload = JSON.parse(payloadTexto);
    } catch (e) {
      mostrarToast('Payload inválido: JSON malformado.', 'erro');
      return;
    }
  }

  const dados = {
    agente_id: parseInt(document.getElementById('tarefa-agente').value, 10),
    titulo: document.getElementById('tarefa-titulo').value.trim(),
    prioridade: document.getElementById('tarefa-prioridade').value,
    payload: payload
  };

  const btn = evento.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Criando...';

  try {
    await criarTarefa(dados);
    mostrarToast('Tarefa criada com sucesso!', 'sucesso');
    fecharModal('modal-tarefa');
    listarTarefas();
    carregarDashboard();
  } catch (err) {
    mostrarToast('Erro ao criar tarefa: ' + err.message, 'erro');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Criar Tarefa';
  }
}

async function popularSelectAgentes(agentesExistentes) {
  const select = document.getElementById('tarefa-agente');
  let agentes = agentesExistentes;

  if (!agentes) {
    try {
      const dados = await requisicao('GET', '/api/agentes');
      agentes = Array.isArray(dados) ? dados : (dados.agentes || dados.data || []);
    } catch (err) {
      return;
    }
  }

  const ativosOuTodos = agentes.filter(function (a) { return a.status === 'ativo'; });
  const lista = ativosOuTodos.length > 0 ? ativosOuTodos : agentes;

  select.innerHTML = '<option value="">Selecione o agente...</option>'
    + lista.map(function (ag) {
      return '<option value="' + ag.id + '">' + escaparHtml(ag.nome) + ' (' + escaparHtml(ag.tipo || '') + ')</option>';
    }).join('');
}

/* ============================================================
   SSE — Eventos em Tempo Real
   ============================================================ */

function conectarSSE() {
  const token = obterToken();
  if (!token) return;

  desconectarSSE();

  try {
    sseConexao = new EventSource(API + '/api/eventos?token=' + encodeURIComponent(token));

    sseConexao.onopen = function () {
      atualizarStatusSSE(true);
    };

    sseConexao.onerror = function () {
      atualizarStatusSSE(false);
    };

    sseConexao.addEventListener('status_tarefa', function (e) {
      try {
        const dados = JSON.parse(e.data);
        adicionarLogSSE('INFO', 'Tarefa #' + (dados.tarefa_id || dados.id || '?') + ' → ' + (dados.status || 'atualizada'));
        const secaoTarefas = document.getElementById('secao-tarefas');
        if (!secaoTarefas.classList.contains('oculto')) {
          listarTarefas();
        }
        carregarDashboard();
      } catch (err) {
        adicionarLogSSE('ERRO', 'Evento status_tarefa inválido: ' + e.data);
      }
    });

    sseConexao.addEventListener('novo_log', function (e) {
      try {
        const dados = JSON.parse(e.data);
        const nivel = (dados.nivel || dados.level || 'INFO').toUpperCase();
        const mensagem = dados.mensagem || dados.message || JSON.stringify(dados);
        adicionarLogSSE(nivel, mensagem);
      } catch (err) {
        adicionarLogSSE('INFO', e.data);
      }
    });

    sseConexao.addEventListener('message', function (e) {
      try {
        const dados = JSON.parse(e.data);
        if (dados.tipo || dados.type) {
          adicionarLogSSE('INFO', JSON.stringify(dados));
        }
      } catch (err) {
        // evento genérico sem JSON
      }
    });

  } catch (err) {
    atualizarStatusSSE(false);
  }
}

function desconectarSSE() {
  if (sseConexao) {
    sseConexao.close();
    sseConexao = null;
  }
  atualizarStatusSSE(false);
}

function atualizarStatusSSE(conectado) {
  const ponto = document.getElementById('sse-status').querySelector('.sse-ponto');
  const texto = document.getElementById('sse-texto');
  if (ponto) {
    ponto.className = 'sse-ponto ' + (conectado ? 'conectado' : 'desconectado');
  }
  if (texto) {
    texto.textContent = conectado ? 'Conectado' : 'Desconectado';
  }
}

function adicionarLogSSE(nivel, mensagem) {
  const painel = document.getElementById('painel-logs');
  if (!painel) return;

  const logVazio = painel.querySelector('.log-vazio');
  if (logVazio) logVazio.remove();

  const nivelNorm = nivel.toUpperCase();
  let nivelClass = 'log-nivel-info';
  if (nivelNorm === 'ERRO' || nivelNorm === 'ERROR') nivelClass = 'log-nivel-erro';
  else if (nivelNorm === 'AVISO' || nivelNorm === 'WARN' || nivelNorm === 'WARNING') nivelClass = 'log-nivel-aviso';
  else if (nivelNorm === 'OK' || nivelNorm === 'SUCCESS' || nivelNorm === 'SUCESSO') nivelClass = 'log-nivel-sucesso';

  const linha = document.createElement('div');
  linha.className = 'log-linha';
  linha.innerHTML = '<span class="log-timestamp">' + new Date().toLocaleTimeString('pt-BR') + '</span>'
    + '<span class="log-nivel ' + nivelClass + '">[' + nivelNorm + ']</span>'
    + '<span class="log-mensagem">' + escaparHtml(mensagem) + '</span>';

  painel.appendChild(linha);

  const limiteLinhas = 300;
  const linhas = painel.querySelectorAll('.log-linha');
  if (linhas.length > limiteLinhas) {
    linhas[0].remove();
  }

  painel.scrollTop = painel.scrollHeight;
}

function limparLogs() {
  const painel = document.getElementById('painel-logs');
  if (painel) {
    painel.innerHTML = '<div class="log-vazio">Logs limpos. Aguardando eventos SSE...</div>';
  }
}

/* ============================================================
   Modais
   ============================================================ */

function abrirModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('oculto');
}

function fecharModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('oculto');
}

function fecharModalSeOverlay(evento, id) {
  if (evento.target === document.getElementById(id)) {
    fecharModal(id);
  }
}

/* ============================================================
   Auxiliares
   ============================================================ */

function escaparHtml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function capitalizarPrimeira(texto) {
  if (!texto) return '';
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/* ============================================================
   Inicialização
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  const token = obterToken();
  if (token) {
    entrarNoApp();
  }

  const overlays = document.querySelectorAll('.modal-overlay');
  overlays.forEach(function (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        overlay.classList.add('oculto');
      }
    });
  });
});
