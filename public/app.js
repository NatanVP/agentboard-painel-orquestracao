let token = localStorage.getItem('ab_token');
let sse = null;

// ===== LOGIN =====
async function fazerLogin(e) {
  e.preventDefault();
  const usuario = document.getElementById('campo-usuario').value;
  const senha = document.getElementById('campo-senha').value;
  const erroDiv = document.getElementById('erro-login');
  const btn = document.getElementById('btn-login');
  btn.disabled = true; btn.textContent = 'Entrando...';
  erroDiv.style.display = 'none';
  try {
    const r = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({usuario,senha}) });
    const d = await r.json();
    if (!d.success) throw new Error(d.error || 'Falha no login');
    token = d.data.token;
    localStorage.setItem('ab_token', token);
    mostrarPainel();
  } catch(err) {
    erroDiv.textContent = err.message; erroDiv.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Entrar';
  }
}

function sair() {
  localStorage.removeItem('ab_token'); token = null;
  if (sse) sse.close();
  document.getElementById('painel-principal').style.display = 'none';
  document.getElementById('tela-login').style.display = 'flex';
}

function mostrarPainel() {
  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('painel-principal').style.display = 'grid';
  setInterval(() => { const el = document.getElementById('hora-atual'); if(el) el.textContent = new Date().toLocaleString('pt-BR'); }, 1000);
  carregarDashboard();
  conectarSSE();
}

// ===== NAVEGAÇÃO =====
function navegarPara(pg, link) {
  document.querySelectorAll('.pagina').forEach(p => p.classList.remove('ativa'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('ativo'));
  document.getElementById('pagina-' + pg).classList.add('ativa');
  if (link) link.classList.add('ativo');
  if (pg === 'dashboard') carregarDashboard();
  else if (pg === 'agentes') carregarAgentes();
  else if (pg === 'tarefas') carregarTarefas();
  else if (pg === 'logs') carregarLogs();
}

// ===== FETCH =====
async function api(endpoint, opts = {}) {
  const r = await fetch(endpoint, { ...opts, headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}`, ...(opts.headers||{}) } });
  const d = await r.json();
  if (!d.success) throw new Error(d.error || 'Erro');
  return d.data;
}

// ===== DASHBOARD =====
async function carregarDashboard() {
  try {
    const [agentes, tarefas, logs] = await Promise.all([ api('/api/agents'), api('/api/tasks'), api('/api/logs') ]);
    document.getElementById('total-agentes').textContent = agentes.length;
    document.getElementById('agentes-ativos').textContent = agentes.filter(a => a.status === 'running').length;
    document.getElementById('total-tarefas').textContent = tarefas.length;
    document.getElementById('total-logs').textContent = logs.length;

    document.getElementById('lista-agentes-dash').innerHTML = agentes.slice(0,5).map(a => `
      <div class="agente-item">
        <div><div style="font-weight:500">${esc(a.name)}</div><div style="font-size:12px;color:var(--cor-texto-dim)">${esc(a.description||'Sem descrição')}</div></div>
        <span class="badge badge-${a.status}">${tradStatus(a.status)}</span>
      </div>`).join('');

    const feed = document.getElementById('feed-logs');
    feed.innerHTML = logs.slice(0,10).map(renderLog).join('');
  } catch(e) { console.error(e); }
}

// ===== AGENTES =====
async function carregarAgentes() {
  try {
    const ag = await api('/api/agents');
    document.getElementById('tabela-agentes').innerHTML = `<table><thead><tr><th>Nome</th><th>Descrição</th><th>Status</th><th>Criado em</th><th>Ação</th></tr></thead><tbody>${
      ag.map(a => `<tr>
        <td><strong>${esc(a.name)}</strong></td>
        <td>${esc(a.description||'—')}</td>
        <td><span class="badge badge-${a.status}">${tradStatus(a.status)}</span></td>
        <td style="font-size:12px">${fmtData(a.created_at)}</td>
        <td><select onchange="alterarStatus(${a.id},this.value)" style="background:var(--cor-painel);border:1px solid var(--cor-borda);color:var(--cor-texto);padding:4px 8px;border-radius:6px;font-size:12px">
          ${['idle','running','error','completed'].map(s=>`<option value="${s}" ${a.status===s?'selected':''}>${tradStatus(s)}</option>`).join('')}
        </select></td>
      </tr>`).join('')
    }</tbody></table>`;
  } catch(e) { console.error(e); }
}

async function alterarStatus(id, status) {
  try { await api(`/api/agents/${id}/status`, {method:'PUT', body:JSON.stringify({status})}); carregarAgentes(); }
  catch(e) { alert('Erro: ' + e.message); }
}

function abrirModalAgente() {
  document.getElementById('inp-nome-agente').value = '';
  document.getElementById('inp-desc-agente').value = '';
  document.getElementById('modal-agente').style.display = 'flex';
}

async function criarAgente(e) {
  e.preventDefault();
  const name = document.getElementById('inp-nome-agente').value;
  const description = document.getElementById('inp-desc-agente').value;
  try { await api('/api/agents', {method:'POST', body:JSON.stringify({name,description})}); fecharModal('modal-agente'); carregarAgentes(); }
  catch(e) { alert('Erro: ' + e.message); }
}

// ===== TAREFAS =====
async function carregarTarefas() {
  try {
    const t = await api('/api/tasks');
    document.getElementById('tabela-tarefas').innerHTML = `<table><thead><tr><th>Título</th><th>Agente</th><th>Status</th><th>Output</th><th>Criada em</th></tr></thead><tbody>${
      t.map(r => `<tr>
        <td><strong>${esc(r.title)}</strong></td>
        <td>${esc(r.agent_name||'—')}</td>
        <td><span class="badge badge-${r.status}">${tradStatus(r.status)}</span></td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--cor-texto-dim)">${esc(r.output||'—')}</td>
        <td style="font-size:12px">${fmtData(r.created_at)}</td>
      </tr>`).join('')
    }</tbody></table>`;
  } catch(e) { console.error(e); }
}

async function abrirModalTarefa() {
  try {
    const ag = await api('/api/agents');
    document.getElementById('sel-agente-tarefa').innerHTML = ag.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
    document.getElementById('inp-titulo-tarefa').value = '';
    document.getElementById('modal-tarefa').style.display = 'flex';
  } catch(e) { alert('Erro: ' + e.message); }
}

async function criarTarefa(e) {
  e.preventDefault();
  const agent_id = parseInt(document.getElementById('sel-agente-tarefa').value);
  const title = document.getElementById('inp-titulo-tarefa').value;
  try { await api('/api/tasks', {method:'POST', body:JSON.stringify({agent_id,title})}); fecharModal('modal-tarefa'); carregarTarefas(); }
  catch(e) { alert('Erro: ' + e.message); }
}

// ===== LOGS =====
async function carregarLogs() {
  try {
    const lg = await api('/api/logs');
    document.getElementById('tabela-logs').innerHTML = `<table><thead><tr><th>Nível</th><th>Mensagem</th><th>Tarefa</th><th>Agente</th><th>Data/Hora</th></tr></thead><tbody>${
      lg.map(l => `<tr>
        <td><span class="log-nivel ${l.level}">${l.level.toUpperCase()}</span></td>
        <td>${esc(l.message)}</td>
        <td>${esc(l.task_title||'—')}</td>
        <td>${esc(l.agent_name||'—')}</td>
        <td style="font-size:12px;color:var(--cor-texto-dim)">${fmtData(l.created_at)}</td>
      </tr>`).join('')
    }</tbody></table>`;
  } catch(e) { console.error(e); }
}

// ===== SSE =====
function conectarSSE() {
  if (!token) return;
  sse = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
  const dot = document.getElementById('sse-dot');
  const txt = document.getElementById('sse-texto');
  sse.onopen = () => { dot.className='sse-dot conectado'; txt.textContent='Stream ativo'; };
  sse.onmessage = (e) => {
    try {
      const ev = JSON.parse(e.data);
      if (ev.tipo === 'log_novo') {
        const feed = document.getElementById('feed-logs');
        if (feed) {
          feed.insertAdjacentHTML('afterbegin', renderLog(ev.dados));
          while(feed.children.length > 20) feed.removeChild(feed.lastChild);
          const tl = document.getElementById('total-logs');
          if (tl) tl.textContent = parseInt(tl.textContent||'0') + 1;
        }
      }
    } catch(e) {}
  };
  sse.onerror = () => { dot.className='sse-dot erro'; txt.textContent='Reconectando...'; setTimeout(conectarSSE, 5000); };
}

// ===== UTILS =====
function renderLog(l) {
  return `<div class="log-item"><span class="log-nivel ${l.level||'info'}">${(l.level||'info').toUpperCase()}</span><span style="flex:1">${esc(l.message)}</span>${l.agent_name?`<span style="font-size:11px;color:var(--cor-texto-dim)">${esc(l.agent_name)}</span>`:''}</div>`;
}

function tradStatus(s) {
  return {idle:'Ocioso',running:'Executando',error:'Erro',completed:'Concluído',pending:'Pendente'}[s]||s;
}
function fmtData(d) { return d ? new Date(d).toLocaleString('pt-BR') : '—'; }
function esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }
function fecharModal(id) { document.getElementById(id).style.display = 'none'; }

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  if (token) mostrarPainel();
});
