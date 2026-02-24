/* eslint-disable no-console */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = [];
  const flags = {};
  let after = false;
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (raw === '--') {
      after = true;
      continue;
    }
    if (!after) {
      if (raw === '--env') {
        flags.env = argv[i + 1] || '';
        i += 1;
        continue;
      }
      continue;
    }
    args.push(raw);
  }
  return { flags, cmd: args[0] || '', cmdArgs: args.slice(1) };
}

function findUp(startDir, fileName) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 12; i += 1) {
    const candidate = path.join(dir, fileName);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '';
}

function readEnvFile(filePath) {
  const map = new Map();
  if (!filePath) return map;
  if (!fs.existsSync(filePath)) return map;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
      (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
    ) {
      val = val.slice(1, -1);
    }
    if (!key) continue;
    map.set(key, val);
  }
  return map;
}

function mergeEnv(baseEnv, loaded) {
  const next = { ...baseEnv };
  for (const [k, v] of loaded.entries()) {
    if (next[k] === undefined || String(next[k]).trim() === '') {
      next[k] = v;
    }
  }
  return next;
}

async function main() {
  const { flags, cmd, cmdArgs } = parseArgs(process.argv.slice(2));
  if (!cmd) {
    console.error('Usage: node scripts/run-with-env.mjs [--env path/to/.env] -- <command> [args...]');
    process.exit(2);
  }

  const envPath = flags.env ? path.resolve(process.cwd(), String(flags.env)) : findUp(process.cwd(), '.env');
  const loaded = envPath ? readEnvFile(envPath) : new Map();
  const childEnv = mergeEnv(process.env, loaded);

  if (!envPath) {
    console.warn('[run-with-env] .env not found; running without env injection.');
  } else if (loaded.size > 0) {
    console.log(`[run-with-env] loaded ${loaded.size} vars from ${envPath}`);
  }

  const child = spawn(cmd, cmdArgs, { stdio: 'inherit', env: childEnv, shell: true });
  child.on('exit', (code) => process.exit(code ?? 1));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

