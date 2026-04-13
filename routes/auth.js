const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { JWT_SECRET } = require('../middleware/auth');

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

router.post('/login', (req, res) => {
  const { usuario, senha } = req.body;
  if (!usuario || !senha) return res.status(400).json({ success: false, error: 'Usuário e senha obrigatórios' });
  if (usuario !== ADMIN_USER || senha !== ADMIN_PASS) return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
  const token = jwt.sign({ usuario, papel: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ success: true, data: { token, usuario, expira: '8h' } });
});

module.exports = router;
