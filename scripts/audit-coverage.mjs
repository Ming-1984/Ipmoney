import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const OPENAPI_PATH = path.join(repoRoot, 'docs', 'api', 'openapi.yaml');
const FIXTURES_DIR = path.join(repoRoot, 'packages', 'fixtures', 'scenarios');
const REPORT_PATH = path.join(repoRoot, 'docs', 'engineering', 'openapi-coverage.md');
const TMP_DIR = path.join(repoRoot, '.tmp');
const TMP_OPENAPI_JSON = path.join(TMP_DIR, 'openapi.bundle.json');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readUtf8(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw.replace(/^\uFEFF/, '');
}

function listFilesRecursive(dirPath, { exts, ignoreDirs }) {
  const out = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dirPath, ent.name);
    if (ent.isDirectory()) {
      if (ignoreDirs.some((p) => ent.name === p)) continue;
      out.push(...listFilesRecursive(full, { exts, ignoreDirs }));
      continue;
    }
    if (!ent.isFile()) continue;
    if (!exts.some((ext) => ent.name.endsWith(ext))) continue;
    out.push(full);
  }
  return out;
}

function normalizeOpenapiPath(routePath) {
  const trimmed = String(routePath || '').replace(/\/+$/, '') || '/';
  return trimmed.replace(/\{[^}]+\}/g, ':param');
}

function normalizeFixturePath(routePath) {
  const trimmed = String(routePath || '').replace(/\/+$/, '') || '/';
  const segments = trimmed.split('/').filter(Boolean);
  if (!segments.length) return '/';

  const uuidRe =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const digitsRe = /^\d{4,}$/;

  return (
    '/' +
    segments
      .map((segment) => {
        if (segment.startsWith(':')) return ':param';
        if (uuidRe.test(segment)) return ':param';
        if (digitsRe.test(segment)) return ':param';
        return segment;
      })
      .join('/')
  );
}

function normalizeUsedPath(routePath) {
  const trimmed = String(routePath || '').replace(/\/+$/, '') || '/';
  return trimmed.replace(/\$\{[^}]+\}/g, ':param');
}

function keyOf(method, routePath) {
  return `${method.toUpperCase()} ${routePath}`;
}

function collectFixtureKeys() {
  const scenarios = fs
    .readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const byScenario = new Map();

  for (const scenario of scenarios) {
    const indexPath = path.join(FIXTURES_DIR, scenario, 'index.json');
    if (!fs.existsSync(indexPath)) continue;

    const json = JSON.parse(readUtf8(indexPath));
    const set = new Set();

    for (const routeKey of Object.keys(json)) {
      const [method, rawPath] = routeKey.split(' ', 2);
      if (!method || !rawPath) continue;
      set.add(keyOf(method, normalizeFixturePath(rawPath)));
    }

    byScenario.set(scenario, set);
  }

  return { byScenario };
}

function collectUsedApiKeys({ rootDir, mode }) {
  const files = listFilesRecursive(rootDir, {
    exts: ['.ts', '.tsx'],
    ignoreDirs: ['node_modules', 'dist', '.taro', '.temp', '.cache'],
  });

  const used = new Set();

  const apiNames =
    mode === 'client'
      ? ['apiGet', 'apiPost', 'apiPatch', 'apiDelete']
      : ['apiGet', 'apiPost', 'apiPostForm', 'apiPatch', 'apiPut', 'apiDelete'];

  const apiCallRe = new RegExp(
    '\\b(' +
      apiNames.join('|') +
      ')\\s*(?:<[^>]*>(?:\\s*>)*\\s*)?\\(\\s*(["\'`])([^"\'`]+?)\\2',
    'g',
  );

  for (const filePath of files) {
    const text = readUtf8(filePath);

    apiCallRe.lastIndex = 0;
    let match;
    while ((match = apiCallRe.exec(text))) {
      const fn = match[1];
      const rawPath = match[3];
      const method =
        fn === 'apiGet'
          ? 'GET'
          : fn === 'apiPost' || fn === 'apiPostForm'
            ? 'POST'
            : fn === 'apiPatch'
              ? 'PATCH'
              : fn === 'apiPut'
                ? 'PUT'
                : 'DELETE';

      if (!rawPath.startsWith('/')) continue;
      used.add(keyOf(method, normalizeUsedPath(rawPath)));
    }

    // Detect file upload helper usage.
    if (text.includes('/files')) {
      if (mode === 'client' && text.includes('Taro.uploadFile')) {
        used.add('POST /files');
      }
      if (mode === 'admin' && text.includes('apiUploadFile')) {
        used.add('POST /files');
      }
    }
  }

  return used;
}

function bundleOpenapiToJson() {
  ensureDir(TMP_DIR);
  const cmd = `pnpm exec redocly bundle "${OPENAPI_PATH}" --ext json -o "${TMP_OPENAPI_JSON}"`;
  execSync(cmd, { cwd: repoRoot, stdio: 'inherit' });
  return JSON.parse(readUtf8(TMP_OPENAPI_JSON));
}

function collectOpenapiOperations(openapi) {
  const operations = [];
  const paths = openapi?.paths || {};
  const methods = ['get', 'post', 'put', 'patch', 'delete'];

  for (const [routePath, item] of Object.entries(paths)) {
    if (!item || typeof item !== 'object') continue;
    for (const method of methods) {
      const operation = item[method];
      if (!operation) continue;
      operations.push({
        method: method.toUpperCase(),
        pathNorm: normalizeOpenapiPath(routePath),
        operationId: operation.operationId ? String(operation.operationId) : '',
      });
    }
  }

  operations.sort((a, b) => `${a.method} ${a.pathNorm}`.localeCompare(`${b.method} ${b.pathNorm}`));
  return operations;
}

function mdEscape(text) {
  return String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function mdBool(value) {
  return value ? 'Y' : '';
}

function applyDerivedFileUsage(used) {
  if (used.has('POST /files/:param/temporary-access')) {
    used.add('GET /files/:param');
    used.add('GET /files/:param/preview');
  }
}

function writeReport({ operations, clientUsed, adminUsed, fixtures }) {
  const openapiKeySet = new Set(operations.map((op) => keyOf(op.method, op.pathNorm)));

  const usedNotInOpenapi = [...new Set([...clientUsed, ...adminUsed])]
    .filter((k) => !openapiKeySet.has(k))
    .sort();

  const unusedOpenapiOps = operations
    .filter((op) => !op.pathNorm.startsWith('/webhooks/'))
    .filter((op) => {
      const key = keyOf(op.method, op.pathNorm);
      return !clientUsed.has(key) && !adminUsed.has(key);
    })
    .map((op) => keyOf(op.method, op.pathNorm))
    .sort();

  const fixtureMissingForUsed = operations
    .filter((op) => {
      const key = keyOf(op.method, op.pathNorm);
      if (!clientUsed.has(key) && !adminUsed.has(key)) return false;
      const happy = fixtures.byScenario.get('happy');
      return !(happy && happy.has(key));
    })
    .map((op) => keyOf(op.method, op.pathNorm))
    .sort();

  const scenarioCols = [
    'happy',
    'empty',
    'error',
    'edge',
    'order_conflict',
    'payment_callback_replay',
    'refund_failed',
  ].filter((scenarioName) => fixtures.byScenario.has(scenarioName));

  const lines = [];
  lines.push('# OpenAPI Frontend/Mock Coverage Audit (Auto-generated)');
  lines.push('');
  lines.push('> Generated by `scripts/audit-coverage.mjs`.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- OpenAPI operations: ${operations.length}`);
  lines.push(`- Frontend-used operations (client): ${clientUsed.size}`);
  lines.push(`- Frontend-used operations (admin): ${adminUsed.size}`);
  lines.push(`- Fixture scenarios: ${fixtures.byScenario.size}`);
  lines.push('');

  lines.push('## Key Gaps');
  lines.push('');
  lines.push(`- Frontend-used but missing from OpenAPI: ${usedNotInOpenapi.length}`);
  if (usedNotInOpenapi.length) {
    for (const routeKey of usedNotInOpenapi.slice(0, 50)) lines.push(`  - ${routeKey}`);
    if (usedNotInOpenapi.length > 50) {
      lines.push(`  - ... (${usedNotInOpenapi.length - 50} more)`);
    }
  }

  lines.push(`- OpenAPI-defined but unused by frontend: ${unusedOpenapiOps.length}`);
  if (unusedOpenapiOps.length) {
    for (const routeKey of unusedOpenapiOps.slice(0, 50)) lines.push(`  - ${routeKey}`);
    if (unusedOpenapiOps.length > 50) {
      lines.push(`  - ... (${unusedOpenapiOps.length - 50} more)`);
    }
  }

  lines.push(`- Frontend-used but missing in happy fixtures: ${fixtureMissingForUsed.length}`);
  if (fixtureMissingForUsed.length) {
    for (const routeKey of fixtureMissingForUsed.slice(0, 50)) lines.push(`  - ${routeKey}`);
    if (fixtureMissingForUsed.length > 50) {
      lines.push(`  - ... (${fixtureMissingForUsed.length - 50} more)`);
    }
  }
  lines.push('');

  lines.push('## Coverage Details (by operation)');
  lines.push('');
  lines.push(`| operationId | method | path | Client | Admin | ${scenarioCols.join(' | ')} |`);
  lines.push(`|---|---|---|---|---|${scenarioCols.map(() => '---').join('|')}|`);

  for (const op of operations) {
    const key = keyOf(op.method, op.pathNorm);
    const row = [
      mdEscape(op.operationId || ''),
      op.method,
      mdEscape(op.pathNorm),
      mdBool(clientUsed.has(key)),
      mdBool(adminUsed.has(key)),
      ...scenarioCols.map((scenarioName) => mdBool(fixtures.byScenario.get(scenarioName)?.has(key))),
    ];
    lines.push(`| ${row.join(' | ')} |`);
  }

  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push('- This audit is API-layer only: OpenAPI -> frontend usage -> fixture keys.');
  lines.push('- Product-level feature mapping belongs to `docs/engineering/traceability-matrix.md`.');
  lines.push('- If a used route is missing from happy fixtures, mock-api may fall back to Prism-generated responses.');

  ensureDir(path.dirname(REPORT_PATH));
  fs.writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');

  return {
    usedNotInOpenapi,
    reportPath: path.relative(repoRoot, REPORT_PATH),
  };
}

function main() {
  const openapi = bundleOpenapiToJson();
  const operations = collectOpenapiOperations(openapi);

  const fixtures = collectFixtureKeys();

  const clientUsedRaw = collectUsedApiKeys({ rootDir: path.join(repoRoot, 'apps', 'client', 'src'), mode: 'client' });
  const adminUsedRaw = collectUsedApiKeys({ rootDir: path.join(repoRoot, 'apps', 'admin-web', 'src'), mode: 'admin' });
  const clientUsed = new Set(clientUsedRaw);
  const adminUsed = new Set(adminUsedRaw);

  applyDerivedFileUsage(clientUsed);
  applyDerivedFileUsage(adminUsed);

  const result = writeReport({ operations, clientUsed, adminUsed, fixtures });
  console.log(`[audit] wrote ${result.reportPath}`);

  if (result.usedNotInOpenapi.length) {
    console.log('[audit] WARNING: used endpoints missing from OpenAPI.');
    process.exitCode = 2;
  }
}

main();
