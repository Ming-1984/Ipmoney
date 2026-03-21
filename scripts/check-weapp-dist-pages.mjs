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

function normalizeRoute(route) {
  return String(route || '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

function collectRoutes(appJson) {
  const routes = new Set();

  const pages = Array.isArray(appJson.pages) ? appJson.pages : [];
  for (const route of pages) {
    const normalized = normalizeRoute(route);
    if (normalized) routes.add(normalized);
  }

  const subPackages = Array.isArray(appJson.subPackages)
    ? appJson.subPackages
    : Array.isArray(appJson.subpackages)
      ? appJson.subpackages
      : [];
  for (const sub of subPackages) {
    const root = normalizeRoute(sub?.root);
    const subPages = Array.isArray(sub?.pages) ? sub.pages : [];
    for (const subPage of subPages) {
      const page = normalizeRoute(subPage);
      const route = normalizeRoute(`${root}/${page}`);
      if (route) routes.add(route);
    }
  }

  return [...routes];
}

function check(appJsonPath, requiredExts) {
  const appDir = path.dirname(appJsonPath);
  const raw = fs.readFileSync(appJsonPath, 'utf8');
  const appJson = JSON.parse(raw);
  const routes = collectRoutes(appJson);

  const missing = [];
  for (const route of routes) {
    for (const ext of requiredExts) {
      const candidate = path.join(appDir, `${route}${ext}`);
      if (!fs.existsSync(candidate)) {
        missing.push(path.relative(process.cwd(), candidate).replace(/\\/g, '/'));
      }
    }
  }

  return { routeCount: routes.length, missing };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const appJsonArg = String(args['app-json'] || 'apps/client/dist/weapp/app.json');
  const requiredExtsArg = String(args['required-exts'] || '.js,.json,.wxml,.wxss');
  const requiredExts = requiredExtsArg
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.startsWith('.') ? item : `.${item}`));

  const appJsonPath = path.resolve(appJsonArg);
  if (!fs.existsSync(appJsonPath)) {
    console.error(`[check-weapp-dist-pages] app.json not found: ${appJsonPath}`);
    process.exit(1);
  }

  let result;
  try {
    result = check(appJsonPath, requiredExts);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[check-weapp-dist-pages] failed: ${message}`);
    process.exit(1);
  }

  if (result.missing.length > 0) {
    console.error(
      `[check-weapp-dist-pages] missing build artifacts for ${result.missing.length} file(s) across ${result.routeCount} route(s):`,
    );
    for (const file of result.missing) {
      console.error(`  - ${file}`);
    }
    process.exit(1);
  }

  console.log(
    `[check-weapp-dist-pages] ok: ${result.routeCount} route(s), checked extensions: ${requiredExts.join(', ')}`,
  );
}

main();
