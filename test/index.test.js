const request = require('supertest');

// Importa o app diretamente
const app = require('../server');

describe('AgentBoard - Testes de API', () => {
  test('GET /api/auth/perfil sem token retorna 401', async () => {
    const res = await request(app).get('/api/auth/perfil');
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/registrar com dados válidos retorna 201', async () => {
    const res = await request(app)
      .post('/api/auth/registrar')
      .send({ nome: 'Teste Usuario', email: `teste${Date.now()}@exemplo.com`, senha: 'senha123' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
  });

  test('POST /api/auth/login com credenciais inválidas retorna 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'invalido@teste.com', senha: 'senhaerrada' });
    expect(res.status).toBe(401);
  });

  test('GET /api/agentes sem token retorna 401', async () => {
    const res = await request(app).get('/api/agentes');
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/registrar sem dados retorna 400', async () => {
    const res = await request(app)
      .post('/api/auth/registrar')
      .send({});
    expect(res.status).toBe(400);
  });
});
