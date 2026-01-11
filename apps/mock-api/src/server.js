const http = require('node:http');
const { spawn } = require('node:child_process');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4010);
const PRISM_PORT = Number(process.env.PRISM_PORT || 4011);

const OPENAPI_PATH = path.resolve(__dirname, '../../../docs/api/openapi.yaml');
const FIXTURES_DIR = path.resolve(__dirname, '../../../packages/fixtures/scenarios');

const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function listRoutesFromScenario(scenario) {
  const scenarioDir = path.join(FIXTURES_DIR, scenario);
  const indexPath = path.join(scenarioDir, 'index.json');
  const json = readJsonIfExists(indexPath);
  if (!json) return [];
  return Object.entries(json).map(([key, value]) => ({ key, value }));
}

function matchRoute(method, pathname, routeKey) {
  const [routeMethod, routePathPattern] = routeKey.split(' ', 2);
  if (!routeMethod || !routePathPattern) return false;
  if (routeMethod.toUpperCase() !== method.toUpperCase()) return false;

  const actual = pathname.split('/').filter(Boolean);
  const pattern = routePathPattern.split('/').filter(Boolean);
  if (actual.length !== pattern.length) return false;

  for (let i = 0; i < pattern.length; i += 1) {
    const p = pattern[i];
    const a = actual[i];
    if (p.startsWith(':')) continue;
    if (p !== a) return false;
  }
  return true;
}

function pickFixtureResponse({ method, pathname, scenario }) {
  const candidates = [];

  const primary = listRoutesFromScenario(scenario);
  const fallback = scenario === 'happy' ? [] : listRoutesFromScenario('happy');

  for (const r of [...primary, ...fallback]) {
    if (!matchRoute(method, pathname, r.key)) continue;
    candidates.push(r);
  }

  return candidates.length ? candidates[0].value : null;
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Mock-Scenario, Idempotency-Key, Wechatpay-Timestamp, Wechatpay-Nonce, Wechatpay-Signature, Wechatpay-Serial, Wechatpay-Signature-Type',
  );
}

function startPrism() {
  const args = [
    'exec',
    'prism',
    'mock',
    OPENAPI_PATH,
    '--port',
    String(PRISM_PORT),
    '--host',
    HOST,
    '--cors',
  ];

  const child = spawn(PNPM_CMD, args, {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    windowsHide: true,
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[mock-api] prism exited with code ${code}`);
    }
  });

  return child;
}

async function proxyToPrism(req, res, bodyBuffer) {
  const targetUrl = `http://${HOST}:${PRISM_PORT}${req.url}`;

  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (k.toLowerCase() === 'host') continue;
    headers[k] = v;
  }

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: bodyBuffer && bodyBuffer.length > 0 ? bodyBuffer : undefined,
    });
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        code: 'BAD_GATEWAY',
        message: 'Mock upstream not ready',
        details: { targetUrl },
      }),
    );
    return;
  }

  res.statusCode = upstream.status;
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') return;
    res.setHeader(key, value);
  });

  const ab = await upstream.arrayBuffer();
  res.end(Buffer.from(ab));
}

function sendFixture(res, fixture) {
  const status = fixture.status ?? 200;
  const headers = fixture.headers ?? {};
  const body = fixture.body ?? null;

  res.statusCode = status;
  for (const [k, v] of Object.entries(headers)) {
    res.setHeader(k, v);
  }

  if (body === null || body === undefined) {
    res.end();
    return;
  }

  if (Buffer.isBuffer(body)) {
    res.end(body);
    return;
  }

  if (typeof body === 'string') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(body);
    return;
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

const prismProcess = startPrism();

const server = http.createServer((req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const scenario =
    (req.headers['x-mock-scenario'] ? String(req.headers['x-mock-scenario']) : null) ||
    url.searchParams.get('__scenario') ||
    'happy';

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', async () => {
    const bodyBuffer = chunks.length ? Buffer.concat(chunks) : null;

    const fixture = pickFixtureResponse({ method: req.method || 'GET', pathname: url.pathname, scenario });
    if (fixture) {
      sendFixture(res, fixture);
      return;
    }

    await proxyToPrism(req, res, bodyBuffer);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[mock-api] listening on http://${HOST}:${PORT} (scenario fixtures + prism fallback)`);
  console.log(`[mock-api] prism upstream on http://${HOST}:${PRISM_PORT}`);
});

function shutdown() {
  try {
    server.close();
  } catch (_) {}
  try {
    prismProcess.kill();
  } catch (_) {}
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
