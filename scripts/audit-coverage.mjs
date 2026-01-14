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
  return fs.readFileSync(filePath, 'utf8');
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

function normalizeOpenapiPath(p) {
  const trimmed = p.replace(/\/+$/, '') || '/';
  return trimmed.replace(/\{[^}]+\}/g, ':param');
}

function normalizeFixturePath(p) {
  const trimmed = p.replace(/\/+$/, '') || '/';
  const segments = trimmed.split('/').filter(Boolean);
  if (segments.length === 0) return '/';

  const uuidRe =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const digitsRe = /^\d{4,}$/;

  return (
    '/' +
    segments
      .map((seg) => {
        if (seg.startsWith(':')) return ':param';
        if (uuidRe.test(seg)) return ':param';
        if (digitsRe.test(seg)) return ':param';
        return seg;
      })
      .join('/')
  );
}

function normalizeUsedPath(p) {
  const trimmed = p.replace(/\/+$/, '') || '/';
  return trimmed.replace(/\$\{[^}]+\}/g, ':param');
}

function keyOf(method, p) {
  return `${method.toUpperCase()} ${p}`;
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
  return { scenarios, byScenario };
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
      ')\\s*(?:<[^>]*>)?\\s*\\(\\s*([\"\'`])([^\"\'`]+?)\\2',
    'g',
  );

  for (const filePath of files) {
    const text = readUtf8(filePath);

    apiCallRe.lastIndex = 0;
    let m;
    while ((m = apiCallRe.exec(text))) {
      const fn = m[1];
      const raw = m[3];
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

      if (!raw.startsWith('/')) continue;
      used.add(keyOf(method, normalizeUsedPath(raw)));
    }

    // Detect file uploads (client uses Taro.uploadFile, admin uses apiUploadFile).
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
  for (const [p, item] of Object.entries(paths)) {
    if (!item || typeof item !== 'object') continue;
    for (const method of methods) {
      const op = item[method];
      if (!op) continue;
      operations.push({
        method: method.toUpperCase(),
        path: String(p),
        pathNorm: normalizeOpenapiPath(String(p)),
        operationId: op.operationId ? String(op.operationId) : '',
        summary: op.summary ? String(op.summary) : '',
        tags: Array.isArray(op.tags) ? op.tags.map(String) : [],
      });
    }
  }
  operations.sort((a, b) => {
    const ka = `${a.method} ${a.pathNorm}`;
    const kb = `${b.method} ${b.pathNorm}`;
    return ka.localeCompare(kb);
  });
  return operations;
}

function mdEscape(text) {
  return String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function mdBool(v) {
  return v ? '✓' : '';
}

function writeReport({ operations, clientUsed, adminUsed, fixtures }) {
  const openapiKeySet = new Set(operations.map((op) => keyOf(op.method, op.pathNorm)));

  const usedNotInOpenapi = [...new Set([...clientUsed, ...adminUsed])]
    .filter((k) => !openapiKeySet.has(k))
    .sort();

  const unusedOps = operations
    .filter((op) => !op.pathNorm.startsWith('/webhooks/'))
    .filter((op) => !clientUsed.has(keyOf(op.method, op.pathNorm)) && !adminUsed.has(keyOf(op.method, op.pathNorm)))
    .map((op) => keyOf(op.method, op.pathNorm))
    .sort();

  const fixtureMissingForUsed = operations
    .filter((op) => {
      const k = keyOf(op.method, op.pathNorm);
      if (!clientUsed.has(k) && !adminUsed.has(k)) return false;
      const happy = fixtures.byScenario.get('happy');
      return !(happy && happy.has(k));
    })
    .map((op) => keyOf(op.method, op.pathNorm))
    .sort();

  const scenarioCols = ['happy', 'empty', 'error', 'edge', 'order_conflict', 'payment_callback_replay', 'refund_failed']
    .filter((s) => fixtures.byScenario.has(s));

  const lines = [];
  lines.push('# OpenAPI × 前端 × Mock 覆盖报告（自动生成）');
  lines.push('');
  lines.push('> 由 `scripts/audit-coverage.mjs` 生成；用于 #14 覆盖度审计与防遗漏。');
  lines.push('');
  lines.push('## 1. 汇总');
  lines.push('');
  lines.push(`- OpenAPI operations：${operations.length}`);
  lines.push(`- 前端已使用（Client）：${clientUsed.size}`);
  lines.push(`- 前端已使用（Admin）：${adminUsed.size}`);
  lines.push(`- fixtures 场景数：${fixtures.byScenario.size}`);
  lines.push('');

  lines.push('## 2. 关键差异（需要人工确认/回填）');
  lines.push('');
  lines.push(`- 前端使用但 OpenAPI 未定义：${usedNotInOpenapi.length}`);
  if (usedNotInOpenapi.length) {
    for (const k of usedNotInOpenapi.slice(0, 50)) lines.push(`  - ${k}`);
    if (usedNotInOpenapi.length > 50) lines.push(`  - …（其余 ${usedNotInOpenapi.length - 50} 条略）`);
  }
  lines.push(`- OpenAPI 定义但前端未使用：${unusedOps.length}`);
  if (unusedOps.length) {
    for (const k of unusedOps.slice(0, 50)) lines.push(`  - ${k}`);
    if (unusedOps.length > 50) lines.push(`  - …（其余 ${unusedOps.length - 50} 条略）`);
  }
  lines.push(`- 前端已使用但 happy fixtures 未覆盖（会回落到 Prism）：${fixtureMissingForUsed.length}`);
  if (fixtureMissingForUsed.length) {
    for (const k of fixtureMissingForUsed.slice(0, 50)) lines.push(`  - ${k}`);
    if (fixtureMissingForUsed.length > 50) lines.push(`  - …（其余 ${fixtureMissingForUsed.length - 50} 条略）`);
  }
  lines.push('');

  lines.push('## 3. 覆盖明细（按 operation）');
  lines.push('');
  lines.push(
    `| operationId | method | path | Client | Admin | ${scenarioCols.map((s) => s).join(' | ')} |`,
  );
  lines.push(
    `|---|---|---|---|---|${scenarioCols.map(() => '---').join('|')}|`,
  );

  for (const op of operations) {
    const k = keyOf(op.method, op.pathNorm);
    const row = [
      mdEscape(op.operationId || ''),
      op.method,
      mdEscape(op.pathNorm),
      mdBool(clientUsed.has(k)),
      mdBool(adminUsed.has(k)),
      ...scenarioCols.map((s) => mdBool(fixtures.byScenario.get(s)?.has(k))),
    ];
    lines.push(`| ${row.join(' | ')} |`);
  }

  lines.push('');
  lines.push('## 4. 使用说明');
  lines.push('');
  lines.push('- 本报告只做“接口层”覆盖审计：OpenAPI ↔ 前端调用 ↔ fixtures keys。');
  lines.push('- PRD 页面/业务规则覆盖请结合 `docs/engineering/traceability-matrix.md` 的“页面能力矩阵”。');
  lines.push('- 若某接口未在 happy fixtures 覆盖，mock-api 会回落到 Prism 生成响应，但不保证演示数据质量。');

  ensureDir(path.dirname(REPORT_PATH));
  fs.writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');

  return {
    usedNotInOpenapi,
    unusedOps,
    fixtureMissingForUsed,
    reportPath: path.relative(repoRoot, REPORT_PATH),
  };
}

function main() {
  const openapi = bundleOpenapiToJson();
  const operations = collectOpenapiOperations(openapi);

  const fixtures = collectFixtureKeys();

  const clientUsed = collectUsedApiKeys({ rootDir: path.join(repoRoot, 'apps', 'client', 'src'), mode: 'client' });
  const adminUsed = collectUsedApiKeys({ rootDir: path.join(repoRoot, 'apps', 'admin-web', 'src'), mode: 'admin' });

  const result = writeReport({ operations, clientUsed, adminUsed, fixtures });
  console.log(`[audit] wrote ${result.reportPath}`);

  if (result.usedNotInOpenapi.length) {
    console.log('[audit] WARNING: used endpoints missing from OpenAPI.');
    process.exitCode = 2;
  }
}

main();
