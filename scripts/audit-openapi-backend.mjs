import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const OPENAPI_PATH = path.join(repoRoot, 'docs', 'api', 'openapi.yaml');
const REPORT_PATH = path.join(repoRoot, 'docs', 'engineering', 'openapi-backend-diff.md');
const TMP_DIR = path.join(repoRoot, '.tmp');
const TMP_OPENAPI_JSON = path.join(TMP_DIR, 'openapi.bundle.json');
const API_SRC_DIR = path.join(repoRoot, 'apps', 'api', 'src');

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

function normalizePath(p) {
  const raw = String(p || '').trim();
  if (!raw) return '/';
  const collapsed = raw.replace(/\\/g, '/').replace(/\/+/g, '/');
  const trimmed = collapsed.replace(/^\/+|\/+$/g, '');
  if (!trimmed) return '/';

  // Convert both OpenAPI and Nest params to a common placeholder.
  const withParams = trimmed.replace(/\{[^}]+\}/g, ':param').replace(/:[^/]+/g, ':param');
  return '/' + withParams.replace(/\/+/g, '/');
}

function joinPath(base, sub) {
  const b = String(base || '').trim();
  const s = String(sub || '').trim();
  if (!b && !s) return '/';
  if (!b) return normalizePath(s);
  if (!s) return normalizePath(b);
  return normalizePath(`${b}/${s}`);
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
        pathNorm: normalizePath(String(p)),
      });
    }
  }
  operations.sort((a, b) => `${a.method} ${a.pathNorm}`.localeCompare(`${b.method} ${b.pathNorm}`));
  return operations;
}

function keyOf(method, p) {
  return `${method.toUpperCase()} ${p}`;
}

function collectControllerRoutes() {
  const controllerFiles = listFilesRecursive(API_SRC_DIR, {
    exts: ['.controller.ts'],
    ignoreDirs: ['node_modules', 'dist'],
  });

  const routes = new Set();

  // Heuristic parser (regex-based): good enough for our current codebase.
  const methodRe = /@(Get|Post|Put|Patch|Delete)\s*\(([^)]*)\)/g;
  const controllerStrRe = /@Controller\s*\(\s*([\"'`])([^\"'`]*)\1\s*\)/;
  const controllerObjRe = /@Controller\s*\(\s*\{[^}]*\bpath\s*:\s*([\"'`])([^\"'`]*)\1[^}]*\}\s*\)/s;
  const strArgRe = /^\s*([\"'`])([^\"'`]*)\1/;

  for (const filePath of controllerFiles) {
    const text = readUtf8(filePath);

    let base = '';
    const m1 = text.match(controllerStrRe);
    if (m1) {
      base = m1[2];
    } else {
      const m2 = text.match(controllerObjRe);
      if (m2) base = m2[2];
    }

    methodRe.lastIndex = 0;
    let m;
    while ((m = methodRe.exec(text))) {
      const method = m[1].toUpperCase();
      const args = m[2] || '';
      let sub = '';
      const sm = args.match(strArgRe);
      if (sm) sub = sm[2];
      routes.add(keyOf(method, joinPath(base, sub)));
    }
  }

  return { controllerFiles: controllerFiles.length, routes };
}

function writeReport({ openapi, operations, controllerInfo, openapiOnly, controllerOnly }) {
  const lines = [];
  lines.push('# OpenAPI ↔ Backend Routes Diff（自动生成）');
  lines.push('');
  lines.push('> 由 `scripts/audit-openapi-backend.mjs` 生成；用于后端路由与 OpenAPI 契约对齐审计。');
  lines.push('');
  lines.push('## 1. 汇总');
  lines.push('');
  lines.push(`- OpenAPI operations：${operations.length}`);
  lines.push(`- OpenAPI paths：${Object.keys(openapi?.paths || {}).length}`);
  lines.push(`- Controller 文件数：${controllerInfo.controllerFiles}`);
  lines.push(`- Controller 路由（method + path）：${controllerInfo.routes.size}`);
  lines.push(`- OpenAPI-only：${openapiOnly.length}`);
  lines.push(`- Controller-only：${controllerOnly.length}`);
  lines.push('');

  lines.push('## 2. OpenAPI-only（契约存在、后端未实现）');
  lines.push('');
  if (!openapiOnly.length) {
    lines.push('- 无');
  } else {
    for (const k of openapiOnly) lines.push(`- ${k}`);
  }
  lines.push('');

  lines.push('## 3. Controller-only（后端实现、契约缺失）');
  lines.push('');
  if (!controllerOnly.length) {
    lines.push('- 无');
  } else {
    for (const k of controllerOnly) lines.push(`- ${k}`);
  }
  lines.push('');

  ensureDir(path.dirname(REPORT_PATH));
  fs.writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
}

function main() {
  const openapi = bundleOpenapiToJson();
  const operations = collectOpenapiOperations(openapi);
  const openapiSet = new Set(operations.map((op) => keyOf(op.method, op.pathNorm)));

  const controllerInfo = collectControllerRoutes();
  const controllerSet = controllerInfo.routes;

  const openapiOnly = [...openapiSet].filter((k) => !controllerSet.has(k)).sort();
  const controllerOnly = [...controllerSet].filter((k) => !openapiSet.has(k)).sort();

  writeReport({ openapi, operations, controllerInfo, openapiOnly, controllerOnly });

  console.log(`[audit-backend-openapi] wrote ${path.relative(repoRoot, REPORT_PATH)}`);
  console.log(
    `[audit-backend-openapi] OpenAPI-only=${openapiOnly.length}, Controller-only=${controllerOnly.length}, Controllers=${controllerSet.size}, OpenAPI=${openapiSet.size}`,
  );

  if (controllerOnly.length) process.exitCode = 2;
}

main();

