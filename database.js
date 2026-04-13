const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'agentboard.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');

  db.run(`CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'idle',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    output TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    level TEXT DEFAULT 'info',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Dados iniciais
  db.get('SELECT COUNT(*) as n FROM agents', (err, row) => {
    if (!err && row && row.n === 0) {
      db.run(`INSERT INTO agents (name, description, status) VALUES
        ('Agente Alpha', 'Análise de repositórios', 'idle'),
        ('Agente Beta', 'Pipelines de integração', 'running'),
        ('Agente Gamma', 'Qualidade de código', 'idle')`);
      db.run(`INSERT INTO tasks (agent_id, title, status, output) VALUES
        (1, 'Analisar repositório principal', 'completed', 'Análise concluída: 142 arquivos, 87% cobertura'),
        (2, 'Executar pipeline de staging', 'running', 'Deploy em andamento...'),
        (2, 'Validar testes de integração', 'pending', ''),
        (3, 'Revisar padrões de código', 'completed', '3 avisos encontrados')`);
      db.run(`INSERT INTO logs (task_id, message, level) VALUES
        (1, 'Iniciando análise do repositório', 'info'),
        (1, 'Processando 142 arquivos...', 'info'),
        (1, 'Cobertura de testes: 87%', 'info'),
        (1, 'Análise concluída com sucesso', 'success'),
        (2, 'Conectando ao servidor de staging', 'info'),
        (2, 'Build iniciado', 'info'),
        (2, 'Deploy em andamento...', 'warn'),
        (4, 'Verificando padrões de código', 'info'),
        (4, 'Aviso: variável não utilizada em utils.js:42', 'warn'),
        (4, 'Revisão concluída', 'success')`);
    }
  });
});

module.exports = db;
