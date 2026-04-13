// Módulo de conexão e inicialização do banco de dados SQLite
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const CAMINHO_BANCO = path.join(__dirname, 'agentboard.db');

// Instância única do banco de dados
const db = new sqlite3.Database(CAMINHO_BANCO, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
    process.exit(1);
  }
  console.log('Conectado ao banco de dados SQLite.');
});

// Inicializa o esquema do banco de dados
function inicializarBanco() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Habilita chaves estrangeiras
      db.run('PRAGMA foreign_keys = ON');

      // Tabela de usuários
      db.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nome TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          senha_hash TEXT NOT NULL,
          criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Tabela de agentes
      db.run(`
        CREATE TABLE IF NOT EXISTS agentes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          usuario_id INTEGER NOT NULL,
          nome TEXT NOT NULL,
          tipo TEXT NOT NULL,
          descricao TEXT,
          configuracao TEXT DEFAULT '{}',
          status TEXT DEFAULT 'inativo',
          criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
          atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        )
      `);

      // Tabela de tarefas
      db.run(`
        CREATE TABLE IF NOT EXISTS tarefas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agente_id INTEGER NOT NULL,
          titulo TEXT NOT NULL,
          payload TEXT DEFAULT '{}',
          status TEXT DEFAULT 'pendente',
          prioridade INTEGER DEFAULT 1,
          tentativas INTEGER DEFAULT 0,
          resultado TEXT,
          erro TEXT,
          criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
          iniciado_em DATETIME,
          concluido_em DATETIME,
          FOREIGN KEY (agente_id) REFERENCES agentes(id) ON DELETE CASCADE
        )
      `);

      // Tabela de logs de execução
      db.run(`
        CREATE TABLE IF NOT EXISTS logs_execucao (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tarefa_id INTEGER NOT NULL,
          nivel TEXT NOT NULL DEFAULT 'info',
          mensagem TEXT NOT NULL,
          criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('Erro ao criar tabelas:', err.message);
          reject(err);
        } else {
          console.log('Esquema do banco de dados inicializado com sucesso.');
          resolve();
        }
      });
    });
  });
}

// Utilitários para promisificar operações do sqlite3
function executar(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, alteracoes: this.changes });
    });
  });
}

function buscarUm(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function buscarTodos(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  db,
  inicializarBanco,
  executar,
  buscarUm,
  buscarTodos
};
