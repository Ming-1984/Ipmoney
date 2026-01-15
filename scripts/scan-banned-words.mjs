import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const TARGET_DIRS = [
  path.join(repoRoot, 'apps', 'client', 'src'),
  path.join(repoRoot, 'apps', 'admin-web', 'src'),
];

const IGNORE_DIRS = new Set(['node_modules', 'dist', '.turbo', '.tmp', '.cache', '.taro', '.temp']);
const EXTS = new Set(['.ts', '.tsx']);

const BANNED = [
  { name: '演示', re: /演示/ },
  { name: 'P0', re: /\bP0\b/ },
  { name: 'Mock', re: /\bmock\b/i },
  { name: 'fixtures', re: /\bfixtures\b/i },
  { name: 'HTTP', re: /\bhttps?\b/i },
  { name: 'undefined', re: /\bundefined\b/i },
  { name: 'null', re: /\bnull\b/i },
  { name: 'TODO', re: /\bTODO\b/i },
];

const JSX_ATTR_WHITELIST = new Set([
  'title',
  'subtitle',
  'label',
  'placeholder',
  'message',
  'description',
  'actionText',
  'okText',
  'cancelText',
  'text',
  'tip',
  'help',
]);

const UI_CONFIG_PROP_NAMES = new Set(['title', 'content', 'message', 'description', 'okText', 'cancelText', 'placeholder', 'label']);

const UI_CALLEE_NAMES = new Set([
  'toast',
  'confirm',
  'confirmAction',
  'message.info',
  'message.success',
  'message.warning',
  'message.error',
  'Modal.confirm',
  'Modal.info',
  'Modal.success',
  'Modal.warning',
  'Modal.error',
]);

function listFilesRecursive(dirPath) {
  const out = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dirPath, ent.name);
    if (ent.isDirectory()) {
      if (IGNORE_DIRS.has(ent.name)) continue;
      out.push(...listFilesRecursive(full));
      continue;
    }
    if (!ent.isFile()) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!EXTS.has(ext)) continue;
    out.push(full);
  }
  return out;
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function getCallName(expr) {
  if (!expr) return '';
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) {
    const left = getCallName(expr.expression);
    const right = expr.name?.text || '';
    if (!left) return right;
    return `${left}.${right}`;
  }
  return '';
}

function isUserVisibleString(node) {
  const parent = node.parent;
  if (!parent) return false;

  if (ts.isJsxAttribute(parent)) {
    const name = parent.name?.getText?.() || '';
    return JSX_ATTR_WHITELIST.has(name);
  }

  if (ts.isCallExpression(parent)) {
    const callName = getCallName(parent.expression);
    return UI_CALLEE_NAMES.has(callName);
  }

  if (ts.isPropertyAssignment(parent)) {
    const propName = parent.name?.getText?.() || '';
    if (!UI_CONFIG_PROP_NAMES.has(propName)) return false;

    const obj = parent.parent;
    if (!obj || !ts.isObjectLiteralExpression(obj)) return true;
    const maybeCall = obj.parent;
    if (!maybeCall || !ts.isCallExpression(maybeCall)) return true;
    const callName = getCallName(maybeCall.expression);
    return UI_CALLEE_NAMES.has(callName);
  }

  return false;
}

function shouldScanText(node, text) {
  if (!text) return false;
  if (!text.trim()) return false;
  if (ts.isJsxText(node)) return true;
  if (ts.isJsxTextAllWhiteSpaces?.(node)) return false;
  return isUserVisibleString(node);
}

function scanText(filePath, sourceFile, node, text) {
  const hits = [];
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (!clean) return hits;

  for (const rule of BANNED) {
    if (!rule.re.test(clean)) continue;
    const pos = node.getStart(sourceFile, false);
    const lc = sourceFile.getLineAndCharacterOfPosition(pos);
    hits.push({
      filePath,
      line: lc.line + 1,
      rule: rule.name,
      preview: clean,
    });
  }

  return hits;
}

function scanFile(filePath) {
  const text = readUtf8(filePath);
  const scriptKind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, scriptKind);

  const hits = [];
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      if (shouldScanText(node, node.text)) hits.push(...scanText(filePath, sourceFile, node, node.text));
    }

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (shouldScanText(node, node.text)) hits.push(...scanText(filePath, sourceFile, node, node.text));
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return hits;
}

function main() {
  const allHits = [];
  for (const dir of TARGET_DIRS) {
    if (!fs.existsSync(dir)) continue;
    const files = listFilesRecursive(dir);
    for (const filePath of files) {
      allHits.push(...scanFile(filePath));
    }
  }

  if (!allHits.length) {
    console.log('[scan-banned-words] OK (no banned words found)');
    return;
  }

  console.error(`[scan-banned-words] Found ${allHits.length} issue(s):`);
  for (const hit of allHits) {
    console.error(`- ${hit.filePath}:${hit.line} (${hit.rule}) ${hit.preview}`);
  }
  process.exitCode = 1;
}

main();
