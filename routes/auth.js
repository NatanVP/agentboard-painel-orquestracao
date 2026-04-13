// Rotas de autenticação de usuários
const express = require('express');
const bcrypt = require('bcryptjs');
const { executar, buscarUm } = require('../database');
const { autenticar, gerarToken } = require('../middleware/autenticacao');

const router = express.Router();

// POST /api/auth/registrar — Cadastra um novo usuário
router.post('/registrar', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
    }

    if (senha.length < 6) {
      return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres' });
    }

    // Verifica se email já está em uso
    const usuarioExistente = await buscarUm(
      'SELECT id FROM usuarios WHERE email = ?',
      [email.toLowerCase()]
    );

    if (usuarioExistente) {
      return res.status(409).json({ erro: 'Email já cadastrado' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const resultado = await executar(
      'INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)',
      [nome.trim(), email.toLowerCase(), senhaHash]
    );

    const usuario = await buscarUm(
      'SELECT id, nome, email, criado_em FROM usuarios WHERE id = ?',
      [resultado.id]
    );

    const token = gerarToken(usuario);

    return res.status(201).json({
      mensagem: 'Usuário cadastrado com sucesso',
      token,
      usuario
    });
  } catch (err) {
    console.error('Erro ao registrar usuário:', err.message);
    return res.status(500).json({ erro: 'Erro interno ao registrar usuário' });
  }
});

// POST /api/auth/login — Autentica um usuário e retorna JWT
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
    }

    const usuario = await buscarUm(
      'SELECT * FROM usuarios WHERE email = ?',
      [email.toLowerCase()]
    );

    if (!usuario) {
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    const token = gerarToken(usuario);

    return res.json({
      mensagem: 'Login realizado com sucesso',
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        criado_em: usuario.criado_em
      }
    });
  } catch (err) {
    console.error('Erro ao realizar login:', err.message);
    return res.status(500).json({ erro: 'Erro interno ao realizar login' });
  }
});

// GET /api/auth/perfil — Retorna o perfil do usuário autenticado
router.get('/perfil', autenticar, async (req, res) => {
  try {
    const usuario = await buscarUm(
      'SELECT id, nome, email, criado_em FROM usuarios WHERE id = ?',
      [req.usuario.id]
    );

    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    return res.json({ usuario });
  } catch (err) {
    console.error('Erro ao buscar perfil:', err.message);
    return res.status(500).json({ erro: 'Erro interno ao buscar perfil' });
  }
});

module.exports = router;
