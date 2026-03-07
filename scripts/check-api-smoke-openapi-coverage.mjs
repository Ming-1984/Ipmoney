#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const tmpDir = path.join(repoRoot, '.tmp');
const openapiYamlPath = path.join(repoRoot, 'docs', 'api', 'openapi.yaml');
const openapiBundlePath = path.join(tmpDir, 'openapi.bundle.json');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--report-date') {
      args.reportDate = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function ensureOpenapiBundle() {
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  execSync(`pnpm exec redocly bundle "${openapiYamlPath}" -o "${openapiBundlePath}" --ext json`, {
    cwd: repoRoot,
    stdio: 'ignore',
  });
}

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildOperationMatchers(openapi) {
  const methods = ['get', 'post', 'put', 'patch', 'delete'];
  const operations = [];
  for (const [apiPath, item] of Object.entries(openapi.paths || {})) {
    for (const method of methods) {
      if (!item?.[method]) continue;
      const segments = apiPath.split('/').filter(Boolean);
      const regexParts = [];
      let specificity = 0;
      for (const segment of segments) {
        if (segment.startsWith('{') && segment.endsWith('}')) {
          regexParts.push('[^/]+');
          continue;
        }
        regexParts.push(escapeRegex(segment));
        specificity += 1;
      }
      operations.push({
        method: method.toUpperCase(),
        path: apiPath,
        regex: new RegExp(`^/${regexParts.join('/')}$`),
        specificity,
      });
    }
  }
  return operations;
}

function shouldExclude(operationKey, operationPath) {
  if (operationPath.startsWith('/auth/')) return true;
  if (operationPath.startsWith('/webhooks/wechatpay/')) return true;
  if (operationKey === 'POST /webhooks/wechatpay/notify') return true;
  return false;
}

function mapCoveredOperationKeys(operations, smokeResults) {
  const covered = new Set();
  for (const result of smokeResults) {
    const method = String(result?.method || '').toUpperCase();
    if (!method) continue;
    let pathname = '';
    try {
      pathname = new URL(String(result.url || '')).pathname;
    } catch {
      continue;
    }

    const matches = operations
      .filter((op) => op.method === method && op.regex.test(pathname))
      .sort((left, right) => {
        if (left.specificity !== right.specificity) return right.specificity - left.specificity;
        return right.path.length - left.path.length;
      });
    if (matches.length === 0) continue;
    const best = matches[0];
    covered.add(`${best.method} ${best.path}`);
  }
  return covered;
}

function main() {
  const { reportDate } = parseArgs(process.argv.slice(2));
  if (!reportDate) {
    throw new Error('missing required --report-date <YYYY-MM-DD>');
  }

  const smokePath = path.join(tmpDir, `api-real-smoke-${reportDate}.json`);
  if (!fs.existsSync(smokePath)) {
    throw new Error(`smoke result not found: ${smokePath}`);
  }

  ensureOpenapiBundle();
  const openapi = readJsonFile(openapiBundlePath);
  const smokeResults = readJsonFile(smokePath);

  const operations = buildOperationMatchers(openapi);
  const allOperationKeys = operations
    .map((op) => `${op.method} ${op.path}`)
    .filter((key) => !shouldExclude(key, key.slice(key.indexOf(' ') + 1)));
  const coveredKeys = mapCoveredOperationKeys(operations, smokeResults);
  const uncoveredKeys = allOperationKeys.filter((key) => !coveredKeys.has(key));

  const summary = {
    reportDate,
    totalOperations: allOperationKeys.length,
    coveredOperations: allOperationKeys.length - uncoveredKeys.length,
    uncoveredOperations: uncoveredKeys.length,
    uncoveredKeys,
  };

  const summaryPath = path.join(tmpDir, `api-smoke-openapi-coverage-${reportDate}.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  process.stdout.write(`${JSON.stringify(summary)}\n`);
  if (uncoveredKeys.length > 0) {
    const preview = uncoveredKeys.slice(0, 20).join(', ');
    throw new Error(`api smoke coverage gap (${uncoveredKeys.length}): ${preview}`);
  }
}

main();
