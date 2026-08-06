import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiRoot = path.join(repoRoot, 'apps', 'api', 'src');
const auditPagePath = path.join(repoRoot, 'apps', 'admin-web', 'src', 'views', 'AuditLogsPage.tsx');

function listTypeScriptFiles(dirPath) {
  const files = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTypeScriptFiles(fullPath));
      continue;
    }
    if (entry.isFile() && /\.tsx?$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

function readObjectKeys(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    throw new Error(`unable to locate ${startMarker}`);
  }

  const section = source.slice(start, end);
  return new Set([...section.matchAll(/^\s{2}([A-Z][A-Z0-9_]+):/gm)].map((match) => match[1]));
}

function collectAuditLiterals() {
  const actions = new Set();
  const targetTypes = new Set();
  const actionPattern = /\baction\s*:\s*'([A-Z][A-Z0-9_]+)'/g;
  const targetPattern = /\btargetType\s*:\s*'([A-Z][A-Z0-9_]+)'/g;

  for (const filePath of listTypeScriptFiles(apiRoot)) {
    const source = fs.readFileSync(filePath, 'utf8');
    for (const match of source.matchAll(actionPattern)) actions.add(match[1]);
    for (const match of source.matchAll(targetPattern)) targetTypes.add(match[1]);
  }

  return { actions, targetTypes };
}

function sortedDifference(actual, expected) {
  return [...actual].filter((item) => !expected.has(item)).sort();
}

function main() {
  const auditPage = fs.readFileSync(auditPagePath, 'utf8');
  const actionLabels = readObjectKeys(auditPage, 'const ACTION_LABELS', 'const TARGET_TYPE_LABELS');
  const targetLabels = readObjectKeys(auditPage, 'const TARGET_TYPE_LABELS', 'const FIELD_LABELS');
  const { actions, targetTypes } = collectAuditLiterals();
  const missingActions = sortedDifference(actions, actionLabels);
  const missingTargetTypes = sortedDifference(targetTypes, targetLabels);

  if (missingActions.length === 0 && missingTargetTypes.length === 0) {
    console.log(`[check-audit-log-labels] OK actions=${actions.size} targetTypes=${targetTypes.size}`);
    return;
  }

  if (missingActions.length > 0) {
    console.error(`[check-audit-log-labels] missing action labels: ${missingActions.join(', ')}`);
  }
  if (missingTargetTypes.length > 0) {
    console.error(`[check-audit-log-labels] missing target type labels: ${missingTargetTypes.join(', ')}`);
  }
  process.exitCode = 1;
}

main();
