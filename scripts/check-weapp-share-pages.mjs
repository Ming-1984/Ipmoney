import fs from 'node:fs';
import path from 'node:path';

const PUBLIC_DETAIL_ROUTES = [
  'subpackages/patent/detail/index',
  'subpackages/listing/detail/index',
  'subpackages/achievement/detail/index',
  'subpackages/organizations/detail/index',
];

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    args[key] = next && !next.startsWith('--') ? next : true;
    if (args[key] !== true) index += 1;
  }
  return args;
}

function normalizeRoute(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function collectRoutes(appJson) {
  const routes = new Set((appJson.pages || []).map(normalizeRoute).filter(Boolean));
  for (const subPackage of appJson.subPackages || appJson.subpackages || []) {
    const root = normalizeRoute(subPackage.root);
    for (const page of subPackage.pages || []) {
      const route = normalizeRoute(`${root}/${page}`);
      if (route) routes.add(route);
    }
  }
  return [...routes];
}

function collectFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else files.push(file);
    }
  };
  visit(root);
  return files;
}

function checkShareSource(sourceRoot) {
  if (!fs.existsSync(sourceRoot)) return [];
  const violations = [];
  const sensitivePathParams = /(?:accessToken|token|orderId|sessionId|conversationId|(?:^|[^A-Za-z0-9])userId\b)/i;
  for (const file of collectFiles(sourceRoot)) {
    if (!file.endsWith('.tsx')) continue;
    const content = fs.readFileSync(file, 'utf8');
    const calls = content.match(/useGlobalShareAppMessage\(\{[\s\S]*?\}\);/g) || [];
    for (const call of calls) {
      if (sensitivePathParams.test(call)) {
        violations.push(`${path.relative(sourceRoot, file).replace(/\\/g, '/')} (sensitive share option)`);
        break;
      }
    }
  }
  return violations;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(String(args.root || 'apps/client/dist/weapp'));
  const sourceRoot = path.resolve(String(args['source-root'] || path.join(root, '../../src')));
  const appJsonPath = path.join(root, 'app.json');
  if (!fs.existsSync(appJsonPath)) throw new Error(`app.json not found: ${appJsonPath}`);

  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const routes = collectRoutes(appJson);
  const missingShareConfig = [];
  for (const route of routes) {
    const configPath = path.join(root, `${route}.json`);
    if (!fs.existsSync(configPath)) {
      missingShareConfig.push(`${route}.json (missing)`);
      continue;
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const jsPath = path.join(root, `${route}.js`);
    const compiledMarker = fs.existsSync(jsPath) && /enableShareAppMessage/.test(fs.readFileSync(jsPath, 'utf8'));
    if (config.enableShareAppMessage !== true && !compiledMarker) missingShareConfig.push(`${route}.json (enableShareAppMessage)`);
  }

  const missingPublicRoutes = PUBLIC_DETAIL_ROUTES.filter((route) => !routes.includes(route));
  const sourceViolations = checkShareSource(sourceRoot);
  const forbidden = [];
  const forbiddenPatterns = [
    /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?/i,
  ];
  for (const file of collectFiles(root)) {
    if (!/\.(?:js|json|wxml|wxss)$/.test(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    if (forbiddenPatterns.some((pattern) => pattern.test(content))) forbidden.push(path.relative(root, file).replace(/\\/g, '/'));
  }

  if (missingShareConfig.length || missingPublicRoutes.length || sourceViolations.length || forbidden.length) {
    if (missingShareConfig.length) console.error(`Missing share page config (${missingShareConfig.length}):\n${missingShareConfig.join('\n')}`);
    if (missingPublicRoutes.length) console.error(`Missing public detail routes: ${missingPublicRoutes.join(', ')}`);
    if (sourceViolations.length) console.error(`Sensitive share options found in source:\n${sourceViolations.join('\n')}`);
    if (forbidden.length) console.error(`Forbidden share data found in build artifacts:\n${forbidden.join('\n')}`);
    process.exit(1);
  }
  console.log(`[check-weapp-share-pages] ok: ${routes.length} route(s), share config and privacy checks passed`);
}

try {
  main();
} catch (error) {
  console.error(`[check-weapp-share-pages] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
