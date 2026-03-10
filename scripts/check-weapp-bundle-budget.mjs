#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..');
const weappRoot = path.join(repoRoot, 'apps', 'client', 'dist', 'weapp');
const homePageSourcePath = path.join(repoRoot, 'apps', 'client', 'src', 'pages', 'home', 'index.tsx');

const budgets = [
  { file: 'app-origin.wxss', maxBytes: 500 * 1024 },
  { file: 'pages/home/index.wxss', maxBytes: 200 * 1024 },
  { file: 'pages/me/index.wxss', maxBytes: 200 * 1024 },
  { file: 'subpackages/login/index.wxss', maxBytes: 200 * 1024 },
];

const inlineGifPattern = /data:image\/gif;base64,/i;
const disallowedHomeGifImports = [
  '../../assets/brand/logo.gif',
  '../../assets/home/promo-certificate.gif',
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

if (!existsSync(homePageSourcePath)) {
  console.error('[check-weapp-bundle-budget] missing home page source:', homePageSourcePath);
  process.exit(1);
}

const homePageSource = readFileSync(homePageSourcePath, 'utf8');
const disallowedHomeImportsFound = disallowedHomeGifImports.filter((item) => {
  const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const importPattern = new RegExp(`from\\s+['"]${escaped}['"]`);
  return importPattern.test(homePageSource);
});

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

const inlineGifChecks = budgets.map((item) => {
  const absPath = path.join(weappRoot, item.file);
  if (!existsSync(absPath)) {
    return {
      file: item.file,
      missing: true,
      hasInlineGif: false,
      ok: false,
    };
  }
  const content = readFileSync(absPath, 'utf8');
  const hasInlineGif = inlineGifPattern.test(content);
  return {
    file: item.file,
    missing: false,
    hasInlineGif,
    ok: !hasInlineGif,
  };
});

const failedSize = checks.filter((c) => !c.ok);
const failedInlineGif = inlineGifChecks.filter((c) => !c.ok);

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

for (const check of inlineGifChecks) {
  if (check.missing) {
    console.log(`[weapp-budget] missing ${check.file} (inline-gif check skipped)`);
    continue;
  }
  const status = check.ok ? 'ok' : 'fail';
  const detail = check.hasInlineGif ? 'inline GIF data URI found' : 'no inline GIF data URI';
  console.log(`[weapp-budget] ${status} ${check.file}: ${detail}`);
}

if (disallowedHomeImportsFound.length > 0) {
  console.log(
    `[weapp-budget] fail home animated asset import: disallowed variant(s): ${disallowedHomeImportsFound.join(', ')}`,
  );
} else {
  console.log('[weapp-budget] ok home animated asset import: no disallowed 2-frame gif variants');
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
      failedSize: failedSize.length,
      failedInlineGif: failedInlineGif.length,
      failedDisallowedHomeGifImport: disallowedHomeImportsFound.length,
      failed:
        failedSize.length + failedInlineGif.length + (disallowedHomeImportsFound.length > 0 ? 1 : 0),
      ok: failedSize.length === 0 && failedInlineGif.length === 0 && disallowedHomeImportsFound.length === 0,
      checks,
      inlineGifChecks,
      disallowedHomeImportsFound,
    },
    null,
    2,
  ),
  'utf8',
);

if (failedSize.length > 0 || failedInlineGif.length > 0 || disallowedHomeImportsFound.length > 0) {
  if (failedSize.length > 0) {
    console.error(`[check-weapp-bundle-budget] failed: ${failedSize.length} item(s) exceed budget`);
  }
  if (failedInlineGif.length > 0) {
    console.error(
      `[check-weapp-bundle-budget] failed: ${failedInlineGif.length} item(s) include inline GIF data URIs`,
    );
  }
  if (disallowedHomeImportsFound.length > 0) {
    console.error(
      `[check-weapp-bundle-budget] failed: home page imports disallowed 2-frame GIF variant(s): ${disallowedHomeImportsFound.join(', ')}`,
    );
  }
  process.exit(1);
}

console.log('[check-weapp-bundle-budget] OK');
