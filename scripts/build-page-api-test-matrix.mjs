#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
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

function readJsonMaybeBom(filePath) {
  const buf = readFileSync(filePath);
  let text = '';
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    text = buf.slice(2).toString('utf16le');
  } else {
    text = buf.toString('utf8');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  }
  return JSON.parse(text);
}

function normalizeRoute(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hash && parsed.hash.startsWith('#/')) {
      return parsed.hash.slice(1);
    }
    return parsed.pathname || '/';
  } catch {
    return url;
  }
}

function inferArea(name) {
  if (name.startsWith('client-')) return 'client';
  if (name.startsWith('admin-')) return 'admin';
  return 'unknown';
}

function inferApiDomain(name, area) {
  if (area === 'admin') {
    if (/verifications/.test(name)) return 'admin/verifications';
    if (/listings/.test(name)) return 'admin/listings-audit';
    if (/tech-managers/.test(name)) return 'admin/tech-managers';
    if (/orders|order-detail/.test(name)) return 'admin/orders';
    if (/refunds/.test(name)) return 'admin/refunds';
    if (/settlements/.test(name)) return 'admin/settlements';
    if (/invoices/.test(name)) return 'admin/invoices';
    if (/reports/.test(name)) return 'admin/reports';
    if (/comments/.test(name)) return 'admin/comments';
    if (/alerts/.test(name)) return 'admin/alerts';
    if (/audit-logs/.test(name)) return 'admin/audit-logs';
    if (/rbac/.test(name)) return 'admin/rbac';
    if (/config/.test(name)) return 'admin/config';
    if (/maintenance/.test(name)) return 'admin/patent-maintenance';
    if (/regions/.test(name)) return 'admin/regions';
    if (/patents/.test(name)) return 'admin/patents';
    if (/dashboard/.test(name)) return 'admin/dashboard';
    if (/login/.test(name)) return 'demo-auth-boundary';
    return 'admin/misc';
  }

  if (/home|search|listing|patent-detail|inventors|tech-managers|organizations/.test(name)) {
    return 'public discovery/search';
  }
  if (/login|onboarding|profile-edit|me$|settings-notifications/.test(name)) return 'auth/me/verification';
  if (/messages|chat|notifications/.test(name)) return 'conversations + notifications';
  if (/orders|checkout|contracts|invoices|addresses/.test(name)) return 'orders/payment/address/invoice';
  if (/favorites/.test(name)) return 'favorites';
  if (/my-listings|publish/.test(name)) {
    return 'my-content create/update/submit';
  }
  if (/region-picker|ipc-picker|about|support|legal|trade-rules/.test(name)) {
    return 'static/config (no critical API write)';
  }
  return 'client/misc';
}

const tmpDir = path.join(repoRoot, '.tmp');
const dateArg = getArg('--date', '');
const requestedDate = dateArg || new Date().toISOString().slice(0, 10);

function pickLatestMatch(dirPath, matcher) {
  if (!existsSync(dirPath)) return '';
  const names = readdirSync(dirPath);
  const matches = names
    .filter((name) => matcher.test(name))
    .map((name) => {
      const fullPath = path.join(dirPath, name);
      let mtimeMs = 0;
      try {
        mtimeMs = statSync(fullPath).mtimeMs;
      } catch {
        mtimeMs = 0;
      }
      return { name, fullPath, mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return matches[0]?.fullPath || '';
}

function resolveInputPath({ explicitPath, defaultPath, fallbackMatcher, label }) {
  if (explicitPath) return explicitPath;
  if (existsSync(defaultPath)) return defaultPath;
  const fallbackPath = pickLatestMatch(tmpDir, fallbackMatcher);
  if (fallbackPath) {
    console.warn(
      `[build-page-api-test-matrix] fallback ${label}: missing ${path.basename(defaultPath)}, using ${path.basename(
        fallbackPath,
      )}`,
    );
    return fallbackPath;
  }
  return defaultPath;
}

function extractToken(filePath, prefix, suffix) {
  const name = path.basename(filePath);
  if (!name.startsWith(prefix) || !name.endsWith(suffix)) return '';
  return name.slice(prefix.length, name.length - suffix.length);
}

const renderPath = resolveInputPath({
  explicitPath: getArg('--render-json', ''),
  defaultPath: path.join(tmpDir, `ui-render-smoke-${requestedDate}.json`),
  fallbackMatcher: /^ui-render-smoke-(?!.*-summary).*\.json$/,
  label: 'render-json',
});

const inferredDate = extractToken(renderPath, 'ui-render-smoke-', '.json') || requestedDate;
const reportDate = dateArg || inferredDate;

const renderSummaryPath = resolveInputPath({
  explicitPath: getArg('--render-summary-json', ''),
  defaultPath: path.join(tmpDir, `ui-render-smoke-${reportDate}-summary.json`),
  fallbackMatcher: /^ui-render-smoke-.*-summary\.json$/,
  label: 'render-summary-json',
});

const httpPath = resolveInputPath({
  explicitPath: getArg('--http-json', ''),
  defaultPath: path.join(tmpDir, `ui-http-smoke-${reportDate}.json`),
  fallbackMatcher: /^ui-http-smoke-.*\.json$/,
  label: 'http-json',
});

const domPath = resolveInputPath({
  explicitPath: getArg('--dom-json', ''),
  defaultPath: path.join(tmpDir, `ui-dom-smoke-${reportDate}.json`),
  fallbackMatcher: /^ui-dom-smoke-(?!.*-summary).*\.json$/,
  label: 'dom-json',
});

const domSummaryPath = resolveInputPath({
  explicitPath: getArg('--dom-summary-json', ''),
  defaultPath: path.join(tmpDir, `ui-dom-smoke-${reportDate}-summary.json`),
  fallbackMatcher: /^ui-dom-smoke-.*-summary\.json$/,
  label: 'dom-summary-json',
});

const outputPath =
  getArg('--output', '') ||
  path.join(repoRoot, 'docs', 'engineering', `page-api-test-matrix-${reportDate}.md`);

for (const filePath of [renderPath, renderSummaryPath, httpPath]) {
  if (!existsSync(filePath)) {
    console.error('[build-page-api-test-matrix] missing input:', filePath);
    process.exit(1);
  }
}

const hasDomInputs = existsSync(domPath) && existsSync(domSummaryPath);

const renderResults = readJsonMaybeBom(renderPath);
const renderSummary = readJsonMaybeBom(renderSummaryPath);
const httpResults = readJsonMaybeBom(httpPath);
const domResults = hasDomInputs ? readJsonMaybeBom(domPath) : [];
const domSummary = hasDomInputs ? readJsonMaybeBom(domSummaryPath) : { passed: 0, total: 0 };
const domMode = hasDomInputs && domSummary.mode ? String(domSummary.mode) : '';

function toArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

const renderList = toArray(renderResults);
const domList = toArray(domResults);
const httpNameSet = new Set(httpResults.filter((item) => item.pass).map((item) => item.name));
const domNameSet = new Set(domList.filter((item) => item.ok).map((item) => item.name));

const httpByPage = new Map([
  ['client-home', 'client-root'],
  ['admin-dashboard', 'admin-root'],
  ['admin-login', 'admin-login'],
  ['admin-orders', 'admin-orders'],
  ['admin-verifications', 'admin-verifications'],
  ['admin-config', 'admin-config'],
]);

const rows = renderList
  .map((item) => {
    const area = inferArea(item.name);
    const httpAlias = httpByPage.get(item.name);
    return {
      page: item.name,
      area,
      route: normalizeRoute(item.url),
      apiDomain: inferApiDomain(item.name, area),
      http: httpNameSet.has(item.name) || (httpAlias ? httpNameSet.has(httpAlias) : false),
      render: !!item.ok,
      dom: domNameSet.has(item.name),
      e2e: false,
      manual: 'pending',
      owner: area === 'admin' ? 'admin-web' : 'client',
    };
  })
  .sort((a, b) => {
    if (a.area !== b.area) return a.area.localeCompare(b.area);
    return a.page.localeCompare(b.page);
  });

const clientTotal = rows.filter((row) => row.area === 'client').length;
const adminTotal = rows.filter((row) => row.area === 'admin').length;
const httpCovered = rows.filter((row) => row.http).length;
const domCovered = rows.filter((row) => row.dom).length;

const lines = [];
lines.push(`# Page-API-Test Matrix (${reportDate})`);
lines.push('');
lines.push('> Scope: client + admin-web pages; excludes real login/payment integrations.');
lines.push(
  `> Data sources: \`${path.relative(repoRoot, renderPath).replace(/\\/g, '/')}\`, \`${path
    .relative(repoRoot, httpPath)
    .replace(/\\/g, '/')}\`${hasDomInputs ? `, \`${path.relative(repoRoot, domPath).replace(/\\/g, '/')}\`` : ''}, \`docs/engineering/traceability-matrix.md\`.`,
);
lines.push('');
lines.push('## Snapshot');
lines.push(`- UI render smoke (full): ${renderSummary.passed}/${renderSummary.total} pass.`);
lines.push(`- Coverage split: client ${clientTotal}/${clientTotal}, admin ${adminTotal}/${adminTotal}.`);
lines.push(`- UI HTTP smoke: ${httpCovered}/${rows.length} pages have route-level HTTP checks (root-focused).`);
if (hasDomInputs) {
  lines.push(`- DOM assertion automation: ${domCovered}/${rows.length} pages (${domSummary.passed}/${domSummary.total} in current DOM smoke run).`);
} else {
  lines.push(`- DOM assertion automation: ${domCovered}/${rows.length} pages (DOM artifact missing).`);
}
lines.push(`- E2E automation: 0/${rows.length} (planned in B03).`);
lines.push('');
lines.push('## Matrix');
lines.push('| Page | Area | Route | API Domain | HTTP Smoke | Render Smoke | DOM Assert | E2E | Manual | Owner |');
lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const row of rows) {
  lines.push(
    `| ${row.page} | ${row.area} | ${row.route.replace(/\|/g, '\\|')} | ${row.apiDomain} | ${row.http ? 'Y' : 'N'} | ${row.render ? 'Y' : 'N'} | ${row.dom ? 'Y' : 'N'} | ${row.e2e ? 'Y' : 'N'} | ${row.manual} | ${row.owner} |`,
  );
}
lines.push('');
lines.push('## Notes');
lines.push(
  '- API domain mapping is a first-pass taxonomy for risk grouping; endpoint-level mapping remains in `docs/engineering/traceability-matrix.md`.',
);
lines.push(
  '- Pages marked `HTTP Smoke=N` still rely on local UI screenshot evidence generated by `scripts/ui-render-smoke.ps1` (artifacts are local-only, git-ignored under `docs/demo/rendered/`).',
);
if (hasDomInputs) {
  if (domMode.startsWith('full')) {
    if (domCovered >= rows.length) {
      lines.push(
        `- DOM smoke is running in \`${domMode}\` and currently covers ${domCovered}/${rows.length} pages; full page coverage is achieved for this baseline.`,
      );
    } else {
      lines.push(
        `- DOM smoke is running in \`${domMode}\` and currently covers ${domCovered}/${rows.length} pages; continue expanding toward full-page assertions.`,
      );
    }
  } else {
    lines.push('- DOM smoke currently tracks a core subset; next step is extending assertions from core to full-page scope.');
  }
} else {
  lines.push('- Priority next step: add at least 1-2 stable DOM assertions per high-risk page group (orders, publish, audit, config).');
}

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`[build-page-api-test-matrix] wrote ${path.relative(repoRoot, outputPath)}`);
