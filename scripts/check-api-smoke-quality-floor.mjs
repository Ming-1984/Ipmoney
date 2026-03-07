#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const tmpDir = path.join(repoRoot, '.tmp');

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

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function extractTopDomain(rawUrl) {
  try {
    const pathname = new URL(String(rawUrl || '')).pathname;
    const first = pathname.split('/').filter(Boolean)[0];
    return first || '';
  } catch {
    return '';
  }
}

function countBy(values) {
  const map = new Map();
  for (const value of values) {
    map.set(value, (map.get(value) || 0) + 1);
  }
  return map;
}

function main() {
  const { reportDate } = parseArgs(process.argv.slice(2));
  if (!reportDate) {
    throw new Error('missing required --report-date <YYYY-MM-DD>');
  }

  const summaryPath = path.join(tmpDir, `api-real-smoke-${reportDate}-summary.json`);
  const resultsPath = path.join(tmpDir, `api-real-smoke-${reportDate}.json`);
  if (!fs.existsSync(summaryPath)) {
    throw new Error(`api smoke summary not found: ${summaryPath}`);
  }
  if (!fs.existsSync(resultsPath)) {
    throw new Error(`api smoke results not found: ${resultsPath}`);
  }

  const summary = readJson(summaryPath);
  const results = readJson(resultsPath);

  const floors = {
    minTotal: 1100,
    minWritesTotal: 820,
    minReadsTotal: 280,
    minNegativeTotal: 700,
    minAdminNegative: 430,
    minStatusCounts: {
      400: 200,
      401: 120,
      403: 140,
      404: 50,
      409: 70,
    },
  };

  const statusCounts = countBy(results.map((result) => Number(result?.status || 0)));
  const negativeResults = results.filter((result) => Number(result?.status || 0) >= 400);
  const domainNegativeCounts = countBy(negativeResults.map((result) => extractTopDomain(result?.url)));
  const violations = [];

  if (Number(summary.failed || 0) !== 0) {
    violations.push(`summary.failed expected 0 but got ${summary.failed}`);
  }
  if (Number(summary.total || 0) < floors.minTotal) {
    violations.push(`summary.total expected >= ${floors.minTotal} but got ${summary.total}`);
  }
  if (Number(summary.writesTotal || 0) < floors.minWritesTotal) {
    violations.push(`summary.writesTotal expected >= ${floors.minWritesTotal} but got ${summary.writesTotal}`);
  }
  if (Number(summary.readsTotal || 0) < floors.minReadsTotal) {
    violations.push(`summary.readsTotal expected >= ${floors.minReadsTotal} but got ${summary.readsTotal}`);
  }
  if (negativeResults.length < floors.minNegativeTotal) {
    violations.push(`negativeResults expected >= ${floors.minNegativeTotal} but got ${negativeResults.length}`);
  }

  const adminNegative = domainNegativeCounts.get('admin') || 0;
  if (adminNegative < floors.minAdminNegative) {
    violations.push(`adminNegative expected >= ${floors.minAdminNegative} but got ${adminNegative}`);
  }

  for (const [statusKey, minCount] of Object.entries(floors.minStatusCounts)) {
    const status = Number(statusKey);
    const actual = statusCounts.get(status) || 0;
    if (actual < minCount) {
      violations.push(`status ${status} expected >= ${minCount} but got ${actual}`);
    }
  }

  const output = {
    reportDate,
    floors,
    observed: {
      total: Number(summary.total || 0),
      failed: Number(summary.failed || 0),
      writesTotal: Number(summary.writesTotal || 0),
      readsTotal: Number(summary.readsTotal || 0),
      negativeResults: negativeResults.length,
      adminNegative,
      statusCounts: Object.fromEntries([...statusCounts.entries()].sort((a, b) => a[0] - b[0])),
      topNegativeDomains: Object.fromEntries(
        [...domainNegativeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
      ),
    },
    violations,
  };

  const outputPath = path.join(tmpDir, `api-smoke-quality-floor-${reportDate}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(output)}\n`);

  if (violations.length > 0) {
    throw new Error(`api smoke quality floor failed (${violations.length}): ${violations.join(' | ')}`);
  }
}

main();
