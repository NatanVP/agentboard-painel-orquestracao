function tratarErros(err, req, res, next) {
  console.error('Erro:', err.message);
  res.status(err.status || 500).json({ success: false, error: err.message || 'Erro interno' });
}

function rotaNaoEncontrada(req, res) {
  res.status(404).json({ success: false, error: 'Rota não encontrada' });
}

module.exports = { tratarErros, rotaNaoEncontrada };
