const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'agentboard-secret-2026';

function autenticar(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: 'Token necessário' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, error: 'Token inválido' });
    req.usuario = user;
    next();
  });
}

module.exports = { autenticar, JWT_SECRET };
