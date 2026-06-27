import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token || !token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
      continue;
    }
    args[key] = true;
  }
  return args;
}

function ensureFile(filePath, content) {
  if (fs.existsSync(filePath)) return false;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(String(args.root || 'apps/client/dist/weapp'));
  if (!fs.existsSync(root)) {
    console.error(`[ensure-weapp-devtools-compat] dist root not found: ${root}`);
    process.exit(1);
  }

  const jsShim =
    '/* Compatibility shim for WeChat DevTools stale precompile cache. Taro 4 emits runtime.js/app.js. */\n';
  const wxssShim =
    '/* Compatibility shim for WeChat DevTools stale precompile cache. Taro 4 emits app.wxss. */\n';

  const created = [
    ensureFile(path.join(root, 'taro.js'), jsShim) && 'taro.js',
    ensureFile(path.join(root, 'common.js'), jsShim) && 'common.js',
    ensureFile(path.join(root, 'vendors.js'), jsShim) && 'vendors.js',
    ensureFile(path.join(root, 'common.wxss'), wxssShim) && 'common.wxss',
  ].filter(Boolean);

  console.log(
    created.length
      ? `[ensure-weapp-devtools-compat] created: ${created.join(', ')}`
      : '[ensure-weapp-devtools-compat] ok: compatibility files already present',
  );
}

main();
