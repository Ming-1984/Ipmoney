#!/usr/bin/env node

import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..');
const args = process.argv.slice(2);

function getArg(name, fallback = '') {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) return fallback;
  return value;
}

function kib(v) {
  return (v / 1024).toFixed(1);
}

function toReportPath(p) {
  return p.replace(/\\/g, '/');
}

const reportDate = getArg('--report-date', new Date().toISOString().slice(0, 10));
const h5Root = path.join(repoRoot, 'apps', 'client', 'dist', 'h5');

if (!existsSync(h5Root)) {
  console.error('[check-h5-bundle-budget] missing build output:', h5Root);
  process.exit(1);
}

const checks = [
  { name: 'vendors.js', file: 'js/vendors.js', maxBytes: 760 * 1024 },
  { name: 'app.css', file: 'css/app.css', maxBytes: 180 * 1024 },
  { name: 'logo.optim2.gif', file: 'static/images/assets/brand/logo.optim2.gif', maxBytes: 1000 * 1024 },
  {
    name: 'promo-certificate.optim3.gif',
    file: 'static/images/assets/home/promo-certificate.optim3.gif',
    maxBytes: 1050 * 1024,
  },
];

const results = checks.map((check) => {
  const fullPath = path.join(h5Root, check.file);
  if (!existsSync(fullPath)) {
    return { ...check, exists: false, pass: false, sizeBytes: null };
  }
  const sizeBytes = statSync(fullPath).size;
  return { ...check, exists: true, pass: sizeBytes <= check.maxBytes, sizeBytes };
});

const entrypointFiles = ['js/framework.js', 'js/ui-kit.js', 'js/vendors.js', 'css/app.css', 'js/app.js'];
const entrypointMaxBytes = 1750 * 1024;
const entrypoint = {
  name: 'h5-entrypoint-app',
  files: entrypointFiles,
  maxBytes: entrypointMaxBytes,
  missingFiles: [],
  sizeBytes: 0,
};
for (const rel of entrypointFiles) {
  const fullPath = path.join(h5Root, rel);
  if (!existsSync(fullPath)) {
    entrypoint.missingFiles.push(rel);
    continue;
  }
  entrypoint.sizeBytes += statSync(fullPath).size;
}
entrypoint.pass = entrypoint.missingFiles.length === 0 && entrypoint.sizeBytes <= entrypoint.maxBytes;

const failedChecks = results.filter((item) => !item.pass);
for (const item of results) {
  if (!item.exists) {
    console.log(`[h5-budget] missing ${item.file}`);
    continue;
  }
  const status = item.pass ? 'ok' : 'fail';
  console.log(`[h5-budget] ${status} ${item.file}: ${kib(item.sizeBytes)} KiB / limit ${kib(item.maxBytes)} KiB`);
}
if (entrypoint.missingFiles.length > 0) {
  console.log(`[h5-budget] fail h5-entrypoint-app missing: ${entrypoint.missingFiles.join(', ')}`);
} else {
  const status = entrypoint.pass ? 'ok' : 'fail';
  console.log(
    `[h5-budget] ${status} h5-entrypoint-app: ${kib(entrypoint.sizeBytes)} KiB / limit ${kib(entrypoint.maxBytes)} KiB`,
  );
}

const outputPath = path.join(repoRoot, '.tmp', `h5-bundle-budget-${reportDate}.json`);
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      reportDate,
      h5Root: toReportPath(path.relative(repoRoot, h5Root)),
      checks: results.map((item) => ({
        name: item.name,
        file: item.file,
        exists: item.exists,
        pass: item.pass,
        sizeBytes: item.sizeBytes,
        maxBytes: item.maxBytes,
      })),
      entrypoint,
      pass: failedChecks.length === 0 && entrypoint.pass,
    },
    null,
    2,
  )}\n`,
  'utf8',
);
console.log(`[check-h5-bundle-budget] wrote ${toReportPath(path.relative(repoRoot, outputPath))}`);

if (failedChecks.length > 0 || !entrypoint.pass) {
  const reasons = [];
  if (failedChecks.length > 0) {
    reasons.push(`file budgets failed: ${failedChecks.map((item) => item.file).join(', ')}`);
  }
  if (!entrypoint.pass) {
    reasons.push('entrypoint budget failed');
  }
  console.error(`[check-h5-bundle-budget] failed: ${reasons.join(' | ')}`);
  process.exit(1);
}

console.log('[check-h5-bundle-budget] OK');
