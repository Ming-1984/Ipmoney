#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..');
const weappRoot = path.join(repoRoot, 'apps', 'client', 'dist', 'weapp');

const budgets = [
  { file: 'app-origin.wxss', maxBytes: 500 * 1024 },
  { file: 'pages/home/index.wxss', maxBytes: 200 * 1024 },
  { file: 'pages/me/index.wxss', maxBytes: 200 * 1024 },
  { file: 'subpackages/login/index.wxss', maxBytes: 200 * 1024 },
];

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function getFileSize(filePath) {
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath).byteLength;
}

if (!existsSync(weappRoot)) {
  console.error('[check-weapp-bundle-budget] missing build output:', weappRoot);
  process.exit(1);
}

const checks = budgets.map((item) => {
  const absPath = path.join(weappRoot, item.file);
  const size = getFileSize(absPath);
  const ok = size !== null && size <= item.maxBytes;
  return {
    file: item.file,
    sizeBytes: size,
    maxBytes: item.maxBytes,
    ok,
  };
});

const failed = checks.filter((c) => !c.ok);

for (const check of checks) {
  if (check.sizeBytes === null) {
    console.log(`[weapp-budget] missing ${check.file}`);
    continue;
  }
  const status = check.ok ? 'ok' : 'fail';
  console.log(
    `[weapp-budget] ${status} ${check.file}: ${formatKiB(check.sizeBytes)} / limit ${formatKiB(check.maxBytes)}`,
  );
}

const reportDir = path.join(repoRoot, '.tmp');
mkdirSync(reportDir, { recursive: true });
const reportDate = new Date().toISOString().slice(0, 10);
const reportPath = path.join(reportDir, `weapp-bundle-budget-${reportDate}.json`);
writeFileSync(
  reportPath,
  JSON.stringify(
    {
      total: checks.length,
      failed: failed.length,
      ok: failed.length === 0,
      checks,
    },
    null,
    2,
  ),
  'utf8',
);

if (failed.length > 0) {
  console.error(`[check-weapp-bundle-budget] failed: ${failed.length} item(s) exceed budget`);
  process.exit(1);
}

console.log('[check-weapp-bundle-budget] OK');
