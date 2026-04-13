// Middleware de autenticação via JWT
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'agentboard-secret-2026';

// Verifica o token JWT no cabeçalho Authorization
function autenticar(req, res, next) {
  const cabecalho = req.headers['authorization'];

  if (!cabecalho || !cabecalho.startsWith('Bearer ')) {
    return res.status(401).json({
      erro: 'Token de autenticação não fornecido'
    });
  }

  const token = cabecalho.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.usuario = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ erro: 'Token expirado' });
    }
    return res.status(401).json({ erro: 'Token inválido' });
  }
}

// Gera um novo token JWT para um usuário
function gerarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

module.exports = { autenticar, gerarToken, JWT_SECRET };
