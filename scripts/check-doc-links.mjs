import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = path.join(repoRoot, 'docs');
const reportPath = path.join(repoRoot, '.tmp', 'docs-link-check.json');

const skippedDocMatchers = [
  /^docs\/engineering\/test-report\.md$/,
];

const localOnlyPathMatchers = [
  /^docs\/demo\/rendered\//,
];

function toRepoPath(absPath) {
  return path.relative(repoRoot, absPath).replaceAll('\\', '/');
}

function shouldSkipDoc(docPath) {
  return skippedDocMatchers.some((matcher) => matcher.test(docPath));
}

function isWebTarget(value) {
  return /^(?:[a-z]+:)?\/\//i.test(value);
}

function normalizeCandidate(raw) {
  if (!raw) return '';
  let value = String(raw).trim();
  if (!value) return '';

  // strip optional title in markdown link target: path "title"
  const firstToken = value.split(/\s+/)[0];
  value = firstToken.trim();
  value = value.replaceAll('`', '');
  value = value.replace(/^<|>$/g, '');
  value = value.replaceAll('\\', '/');
  value = value.replace(/^\.\/+/, '');
  value = value.replace(/[),.;]+$/g, '');

  if (!value || isWebTarget(value)) return '';
  if (value.startsWith('#')) return '';
  if (value.includes('*')) return '';
  if (value.includes('YYYY') || value.includes('<') || value.includes('>')) return '';
  if (localOnlyPathMatchers.some((matcher) => matcher.test(value))) return '';

  // strip hash fragment and common line suffixes (path:12 or path:12:5)
  value = value.replace(/#.*$/, '');
  const lineRefMatch = value.match(/^(.+?):\d+(?:[-,:]\d+)*$/);
  if (lineRefMatch) {
    value = lineRefMatch[1];
  }

  // directory path hint ending with slash is acceptable as long as directory exists.
  value = value.replace(/\/+$/, '');
  return value;
}

function extractCandidates(markdownText) {
  const candidates = new Set();
  const markdownLinkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
  const inlineCodePattern = /`([^`\n]+)`/g;
  const plainPathPattern = /(?:^|\s)((?:docs|scripts|apps|packages)\/[A-Za-z0-9._/-]+)/g;

  for (const pattern of [markdownLinkPattern, inlineCodePattern, plainPathPattern]) {
    let match = pattern.exec(markdownText);
    while (match) {
      const normalized = normalizeCandidate(match[1]);
      if (normalized) candidates.add(normalized);
      match = pattern.exec(markdownText);
    }
  }
  return [...candidates];
}

async function collectMarkdownFiles(dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(full)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

async function pathExists(absPath) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const mdFiles = await collectMarkdownFiles(docsRoot);
  const missing = [];

  for (const mdAbsPath of mdFiles) {
    const docPath = toRepoPath(mdAbsPath);
    if (shouldSkipDoc(docPath)) continue;

    const content = await fs.readFile(mdAbsPath, 'utf8');
    const candidates = extractCandidates(content).filter((candidate) =>
      /^(?:docs|scripts|apps|packages)\//.test(candidate),
    );

    for (const candidate of candidates) {
      const targetAbsPath = path.join(repoRoot, candidate);
      // also accept markdown file links without extension when folder has README.md
      const existsDirect = await pathExists(targetAbsPath);
      const existsReadmeFallback = await pathExists(path.join(targetAbsPath, 'README.md'));
      if (!existsDirect && !existsReadmeFallback) {
        missing.push({
          source: docPath,
          target: candidate,
        });
      }
    }
  }

  const uniqueMissing = [];
  const seen = new Set();
  for (const item of missing) {
    const key = `${item.source} -> ${item.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueMissing.push(item);
  }

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(
    reportPath,
    JSON.stringify(
      {
        checkedDocs: mdFiles.length,
        missingCount: uniqueMissing.length,
        missing: uniqueMissing,
      },
      null,
      2,
    ),
    'utf8',
  );

  if (uniqueMissing.length > 0) {
    for (const item of uniqueMissing.slice(0, 100)) {
      console.error(`[doc-link-missing] ${item.source} -> ${item.target}`);
    }
    if (uniqueMissing.length > 100) {
      console.error(`[doc-link-missing] ... and ${uniqueMissing.length - 100} more`);
    }
    console.error(`[check-doc-links] FAILED missing=${uniqueMissing.length} report=${toRepoPath(reportPath)}`);
    process.exitCode = 1;
    return;
  }

  console.log(`[check-doc-links] OK checked=${mdFiles.length} report=${toRepoPath(reportPath)}`);
}

main().catch((error) => {
  console.error('[check-doc-links] fatal', error);
  process.exitCode = 1;
});
