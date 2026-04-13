// Middleware centralizado de tratamento de erros
function tratadorDeErros(err, req, res, next) {
  console.error('Erro na requisição:', err.message);
  console.error(err.stack);

  // Erros de validação (campos obrigatórios ausentes)
  if (err.type === 'validacao') {
    return res.status(400).json({ erro: err.message });
  }

  // Erros de conflito (ex: email duplicado)
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(409).json({ erro: 'Conflito: recurso já existe ou viola restrição do banco' });
  }

  // Erro genérico
  return res.status(500).json({
    erro: 'Erro interno do servidor',
    detalhe: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
}

// Middleware para rotas não encontradas
function rotaNaoEncontrada(req, res) {
  res.status(404).json({ erro: `Rota ${req.method} ${req.path} não encontrada` });
}

module.exports = { tratadorDeErros, rotaNaoEncontrada };
