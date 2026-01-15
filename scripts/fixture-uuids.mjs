import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const STRICT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOOSE_UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

function usage(exitCode = 0) {
  // eslint-disable-next-line no-console
  console.log(
    [
      'Audit/fix invalid UUID placeholders in fixtures/demo files.',
      '',
      'Why: client route params validate UUID strictly (version/variant). Placeholders like aaaaaaaa-... break deep links.',
      '',
      'Usage:',
      '  node scripts/fixture-uuids.mjs --check',
      '  node scripts/fixture-uuids.mjs --write',
      '',
      'Flags:',
      '  --check   Only report; exit 1 if any invalid UUID-like values found (default).',
      '  --write   Rewrite files in-place to deterministic UUID v4.',
      '',
      'Scope (hardcoded):',
      '  - packages/fixtures/scenarios/**/*.json',
      '  - scripts/capture-ui.ps1',
      '  - scripts/capture-weapp-ui.js',
      '  - apps/admin-web/src/**/*.ts(x)',
    ].join('\n'),
  );
  process.exit(exitCode);
}

function parseArgs(argv) {
  const out = { mode: 'check' };
  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') usage(0);
    if (raw === '--write') out.mode = 'write';
    if (raw === '--check') out.mode = 'check';
  }
  return out;
}

function listFilesRecursive(dirPath, { exts, ignoreDirs }) {
  const out = [];
  if (!fs.existsSync(dirPath)) return out;
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

function bytesToUuid(bytes) {
  const hex = Buffer.from(bytes).toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

function deterministicUuidV4(seed, saltIndex = 0) {
  const hash = createHash('sha256').update(`ipmoney-fixture-uuid-v4:${saltIndex}:${seed}`).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytesToUuid(bytes);
}

function buildReplacementMap(invalidIds) {
  const map = new Map();
  const assigned = new Set();
  for (const rawId of invalidIds) {
    const seed = String(rawId).toLowerCase();
    let saltIndex = 0;
    // Avoid collisions (extremely unlikely, but cheap to guard).
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const candidate = deterministicUuidV4(seed, saltIndex);
      if (!assigned.has(candidate)) {
        map.set(seed, candidate);
        assigned.add(candidate);
        break;
      }
      saltIndex += 1;
    }
  }
  return map;
}

function collectInvalidIds(files) {
  const invalid = new Set();
  const details = [];
  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const matches = raw.match(LOOSE_UUID_RE) || [];
    for (const m of matches) {
      const id = String(m).toLowerCase();
      if (STRICT_UUID_RE.test(id)) continue;
      invalid.add(id);
      details.push({ filePath, id });
    }
  }
  return { invalid, details };
}

function applyFixes(files, map) {
  let changedFiles = 0;
  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    const next = raw.replace(LOOSE_UUID_RE, (m) => {
      const id = String(m).toLowerCase();
      if (STRICT_UUID_RE.test(id)) return m;
      const repl = map.get(id);
      if (!repl) return m;
      changed = true;
      return repl;
    });
    if (!changed) continue;
    fs.writeFileSync(filePath, next, 'utf8');
    changedFiles += 1;
  }
  return changedFiles;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const targets = [];
  targets.push(
    ...listFilesRecursive(path.join(repoRoot, 'packages', 'fixtures', 'scenarios'), {
      exts: ['.json'],
      ignoreDirs: ['node_modules', 'dist', '.tmp', '.turbo'],
    }),
  );

  for (const rel of ['scripts/capture-ui.ps1', 'scripts/capture-weapp-ui.js']) {
    const abs = path.join(repoRoot, rel);
    if (fs.existsSync(abs)) targets.push(abs);
  }

  targets.push(
    ...listFilesRecursive(path.join(repoRoot, 'apps', 'admin-web', 'src'), {
      exts: ['.ts', '.tsx'],
      ignoreDirs: ['node_modules', 'dist', '.tmp', '.turbo'],
    }),
  );

  const { invalid, details } = collectInvalidIds(targets);
  const invalidList = Array.from(invalid).sort();

  if (args.mode === 'check') {
    if (invalidList.length === 0) {
      // eslint-disable-next-line no-console
      console.log('[fixture-uuids] OK: no invalid UUID-like values found.');
      return;
    }

    // eslint-disable-next-line no-console
    console.log(`[fixture-uuids] Found ${invalidList.length} invalid UUID-like values (sample):`);
    for (const id of invalidList.slice(0, 20)) {
      // eslint-disable-next-line no-console
      console.log(`  - ${id}`);
    }
    const fileCount = new Set(details.map((d) => d.filePath)).size;
    // eslint-disable-next-line no-console
    console.log(`[fixture-uuids] Affected files: ${fileCount}. Run: node scripts/fixture-uuids.mjs --write`);
    process.exit(1);
  }

  if (invalidList.length === 0) {
    // eslint-disable-next-line no-console
    console.log('[fixture-uuids] Nothing to fix.');
    return;
  }

  const map = buildReplacementMap(invalidList);
  const changedFiles = applyFixes(targets, map);

  // eslint-disable-next-line no-console
  console.log(`[fixture-uuids] Replaced ${invalidList.length} IDs across ${changedFiles} files.`);
}

main();

