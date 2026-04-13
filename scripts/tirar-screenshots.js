// Captura de screenshots do AgentBoard
const { spawn } = require('child_process');
const puppeteer = require('../node_modules/puppeteer-core');
const path = require('path');
const fs = require('fs');
const http = require('http');

const PROJECT_DIR = path.join(__dirname, '..');
const SCREENSHOTS_DIR = path.join(PROJECT_DIR, 'screenshots');

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

// Remover DB antigo
const dbPath = path.join(PROJECT_DIR, 'agentboard.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

// Iniciar servidor
const servidor = spawn('node', [path.join(PROJECT_DIR, 'server.js')], {
  cwd: PROJECT_DIR,
  env: { ...process.env, PORT: '3000', DB_PATH: dbPath },
  stdio: ['ignore', 'pipe', 'pipe']
});

servidor.stdout.on('data', d => process.stdout.write('[SRV] ' + d));
servidor.stderr.on('data', d => process.stderr.write('[SRV ERR] ' + d));

function aguardar(ms) { return new Promise(r => setTimeout(r, ms)); }

function testarServidor() {
  return new Promise((resolve) => {
    let tentativas = 0;
    function tentar() {
      const req = http.get('http://127.0.0.1:3000', (res) => {
        res.destroy();
        resolve(true);
      });
      req.on('error', () => {
        tentativas++;
        if (tentativas < 30) setTimeout(tentar, 600);
        else resolve(false);
      });
    }
    setTimeout(tentar, 2500);
  });
}

async function main() {
  console.log('Iniciando servidor...');
  const ok = await testarServidor();
  if (!ok) { servidor.kill(); process.exit(1); }
  console.log('Servidor respondendo em 127.0.0.1:3000');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    headless: true
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const capturas = [];
  const erros = [];

  try {
    // === Screenshot 1: Tela de Login ===
    console.log('[1] Navegando para tela de login...');
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle2', timeout: 20000 });
    await aguardar(1500);
    const s1 = path.join(SCREENSHOTS_DIR, 'painel_principal.png');
    await page.screenshot({ path: s1 });
    console.log('[1] painel_principal.png:', fs.statSync(s1).size, 'bytes');
    capturas.push('painel_principal.png');

    // === Login ===
    console.log('[2] Fazendo login...');
    // Aguardar formulário aparecer
    await page.waitForSelector('#form-login', { timeout: 10000 });

    // Preencher campos
    await page.evaluate(() => {
      const u = document.getElementById('usuario');
      const s = document.getElementById('senha');
      if (u) u.value = 'admin';
      if (s) s.value = 'admin123';
    });
    await aguardar(500);
    await page.click('#btn-login');
    await aguardar(4000);

    // Verificar se logou
    const painelVisivel = await page.evaluate(() => {
      const p = document.getElementById('painel-principal');
      return p && p.style.display !== 'none';
    });
    console.log('[2] Painel visível:', painelVisivel);

    // === Screenshot 2: Dashboard ===
    console.log('[2] Capturando dashboard...');
    const s2 = path.join(SCREENSHOTS_DIR, 'agente_em_execucao.png');
    await page.screenshot({ path: s2 });
    console.log('[2] agente_em_execucao.png:', fs.statSync(s2).size, 'bytes');
    capturas.push('agente_em_execucao.png');

    // === Navegar para Logs ===
    console.log('[3] Navegando para logs...');
    await page.evaluate(() => {
      const itens = Array.from(document.querySelectorAll('.nav-item'));
      const logs = itens.find(el => el.textContent.includes('Logs'));
      if (logs) logs.click();
    });
    await aguardar(2500);

    // === Screenshot 3: Logs ===
    console.log('[3] Capturando logs...');
    const s3 = path.join(SCREENSHOTS_DIR, 'historico_logs.png');
    await page.screenshot({ path: s3 });
    console.log('[3] historico_logs.png:', fs.statSync(s3).size, 'bytes');
    capturas.push('historico_logs.png');

  } catch (err) {
    erros.push(err.message);
    console.error('ERRO:', err.message);
    // Screenshot de debug
    try {
      const debugPath = path.join(SCREENSHOTS_DIR, '_debug.png');
      await page.screenshot({ path: debugPath });
      console.log('Debug screenshot salva');
    } catch(e) {}
  }

  await browser.close();
  servidor.kill();

  const resultado = { screenshots: capturas, errors: erros, success: capturas.length >= 3 };
  fs.writeFileSync(path.join(PROJECT_DIR, '_step9_result.json'), JSON.stringify(resultado, null, 2));
  console.log('RESULTADO FINAL:', JSON.stringify(resultado));
  process.exit(0);
}

main().catch(err => {
  console.error('FALHA CRÍTICA:', err.message);
  servidor.kill();
  process.exit(1);
});
