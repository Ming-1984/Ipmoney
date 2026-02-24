const fs = require('node:fs');
const path = require('node:path');

let automator;
try {
  // Optional dependency: only required for WeChat DevTools automation runs.
  // Install: pnpm add -D miniprogram-automator
  // eslint-disable-next-line global-require
  automator = require('miniprogram-automator');
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('[weapp] Missing dependency: miniprogram-automator');
  // eslint-disable-next-line no-console
  console.error('[weapp] Install: pnpm add -D miniprogram-automator');
  // eslint-disable-next-line no-console
  console.error('[weapp] Then run: node scripts/capture-weapp-ui.js --help');
  // eslint-disable-next-line no-console
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Timeout: ${label} (${timeoutMs}ms)`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw) continue;
    if (raw === '--help' || raw === '-h') {
      args.help = true;
      continue;
    }
    if (!raw.startsWith('--')) continue;
    const key = raw.slice(2);
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

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resolveCliPath(cliPathOrExeOrDir) {
  if (!cliPathOrExeOrDir || typeof cliPathOrExeOrDir !== 'string') return '';

  const trimmed = cliPathOrExeOrDir.trim();
  if (!trimmed) return '';

  const abs = path.resolve(trimmed);
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    const inDir = path.join(abs, 'cli.bat');
    if (fs.existsSync(inDir)) return inDir;
    return abs;
  }

  if (abs.toLowerCase().endsWith('.exe')) {
    const dir = path.dirname(abs);
    const cliBat = path.join(dir, 'cli.bat');
    if (fs.existsSync(cliBat)) return cliBat;
  }

  return abs;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readEnvFile(filePath) {
  const map = new Map();
  if (!filePath) return map;
  if (!fs.existsSync(filePath)) return map;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/g)) {
    const line = String(rawLine || '').trim();
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

function getEnvValue(key, envMap) {
  const fromProc = String(process.env[key] || '').trim();
  if (fromProc) return fromProc;
  const fromFile = envMap && envMap.has(key) ? String(envMap.get(key) || '').trim() : '';
  return fromFile || '';
}

function cleanOldScreenshots(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  if (!fs.statSync(dirPath).isDirectory()) return;
  for (const name of fs.readdirSync(dirPath)) {
    if (!name.endsWith('.png')) continue;
    if (!name.startsWith('client-')) continue;
    try {
      fs.rmSync(path.join(dirPath, name), { force: true });
    } catch {}
  }
}

const SAMPLE = {
  // Keep in sync with apps/api/prisma/seed.js demo IDs (SEED_* constants).
  listingId: 'd562cea2-5502-4553-9cf1-869ee2c760fd',
  patentId: '6e0511e4-5d32-4794-99f6-408d0941a754',
  orgUserId: '982bb394-283b-418d-aec4-9e69568576b3',
  conversationId: 'ae127712-cb2f-4526-8520-0dc45528ab8a',
  orderId: '5e238163-ad1e-4830-a74d-944959427ebe',
  paymentId: '28b74a0d-40c2-4af8-87b5-60d1390e46fd',
  regionCode: '110000',
  year: 2025,
};

const PAGES = [
  { name: 'home', url: '/pages/home/index' },
  { name: 'search', url: '/subpackages/search/index' },
  { name: 'patent-map', url: '/subpackages/patent-map/index' },
  {
    name: 'patent-map-region-detail',
    url: `/subpackages/patent-map/region-detail/index?regionCode=${SAMPLE.regionCode}&year=${SAMPLE.year}`,
  },
  { name: 'inventors', url: '/subpackages/inventors/index' },
  { name: 'listing-detail', url: `/subpackages/listing/detail/index?listingId=${SAMPLE.listingId}` },
  { name: 'patent-detail', url: `/subpackages/patent/detail/index?patentId=${SAMPLE.patentId}` },
  { name: 'organizations', url: '/subpackages/organizations/index' },
  { name: 'organization-detail', url: `/subpackages/organizations/detail/index?orgUserId=${SAMPLE.orgUserId}` },
  { name: 'trade-rules', url: '/subpackages/trade-rules/index' },
  { name: 'login', url: '/subpackages/login/index' },
  { name: 'onboarding-choose-identity', url: '/subpackages/onboarding/choose-identity/index' },
  { name: 'onboarding-verification-form', url: '/subpackages/onboarding/verification-form/index' },
  { name: 'region-picker', url: '/subpackages/region-picker/index' },
  { name: 'profile-edit', url: '/subpackages/profile/edit/index' },
  { name: 'messages', url: '/pages/messages/index' },
  { name: 'chat', url: `/subpackages/messages/chat/index?conversationId=${SAMPLE.conversationId}` },
  { name: 'publish', url: '/pages/publish/index' },
  { name: 'publish-patent', url: '/subpackages/publish/patent/index' },
  { name: 'publish-demand', url: '/subpackages/publish/demand/index' },
  { name: 'publish-achievement', url: '/subpackages/publish/achievement/index' },
  { name: 'my-listings', url: '/subpackages/my-listings/index' },
  { name: 'favorites', url: '/subpackages/favorites/index' },
  { name: 'orders', url: '/subpackages/orders/index' },
  { name: 'order-detail', url: `/subpackages/orders/detail/index?orderId=${SAMPLE.orderId}` },
  { name: 'checkout-deposit-pay', url: `/subpackages/checkout/deposit-pay/index?listingId=${SAMPLE.listingId}` },
  {
    name: 'checkout-deposit-success',
    url: `/subpackages/checkout/deposit-success/index?orderId=${SAMPLE.orderId}&paymentId=${SAMPLE.paymentId}`,
  },
  { name: 'checkout-final-pay', url: `/subpackages/checkout/final-pay/index?orderId=${SAMPLE.orderId}` },
  {
    name: 'checkout-final-success',
    url: `/subpackages/checkout/final-success/index?orderId=${SAMPLE.orderId}&paymentId=${SAMPLE.paymentId}`,
  },
  { name: 'me', url: '/pages/me/index' },
];

function printHelp() {
  // eslint-disable-next-line no-console
  console.log(
    [
      'Capture WeChat DevTools (weapp) screenshots into a folder compatible with scripts/merge-ui-screenshots.py.',
      '',
      'Usage:',
      '  node scripts/capture-weapp-ui.js --cli-path "D:\\\\微信web开发者工具\\\\cli.bat" --project-path apps/client --out-dir docs/demo/rendered/ui --user-token <DEMO_USER_TOKEN>',
      '',
      'Options:',
      '  --cli-path       Path to WeChat DevTools cli (cli/cli.bat). You may also pass the DevTools exe/dir; it will try to resolve cli.bat.',
      '  --project-path   WeChat DevTools project directory (default: apps/client).',
      '  --out-dir        Output root directory; screenshots go to <out-dir>/client/ (default: docs/demo/rendered/ui).',
      '  --wait-ms        Extra wait after each route change before screenshot (default: 2500).',
      '  --timeout-ms     DevTools launch timeout (default: 120000).',
      '  --scenario       Mock scenario storage value (default: happy).',
      '  --user-token     Demo user token stored as ipmoney.token. If omitted, it will try DEMO_USER_TOKEN from process env or repo .env.',
      '  --screenshot-timeout-ms  Timeout for each screenshot call (default: 20000).',
      '  --no-auth        Do not set demo auth storage keys.',
      '  --list-only      Only print planned pages.',
    ].join('\n'),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const repoRoot = path.resolve(__dirname, '..');
  const envMap = readEnvFile(path.join(repoRoot, '.env'));
  const projectPath = path.resolve(repoRoot, String(args['project-path'] || 'apps/client'));
  const outDir = path.resolve(repoRoot, String(args['out-dir'] || 'docs/demo/rendered/ui'));
  const outClientDir = path.join(outDir, 'client');

  const cliPathResolved = resolveCliPath(String(args['cli-path'] || ''));
  if (!cliPathResolved) {
    // eslint-disable-next-line no-console
    console.error('Missing --cli-path (WeChat DevTools cli.bat).');
    process.exit(1);
  }

  const waitMs = Number(args['wait-ms'] || 2500);
  const timeoutMs = Number(args['timeout-ms'] || 120_000);
  const screenshotTimeoutMs = Number(args['screenshot-timeout-ms'] || 20_000);
  const scenario = String(args.scenario || 'happy');
  const noAuth = Boolean(args['no-auth']);
  const listOnly = Boolean(args['list-only']);
  const userToken = String(args['user-token'] || '').trim() || getEnvValue('DEMO_USER_TOKEN', envMap) || '';

  if (listOnly) {
    // eslint-disable-next-line no-console
    console.log('[weapp] Planned pages:');
    for (const p of PAGES) {
      // eslint-disable-next-line no-console
      console.log(`  - ${p.name}: ${p.url}`);
    }
    return;
  }

  ensureDir(outClientDir);
  cleanOldScreenshots(outClientDir);

  const projectConfigPath = path.join(projectPath, 'project.config.json');
  const originalProjectConfigText = fs.existsSync(projectConfigPath)
    ? fs.readFileSync(projectConfigPath, 'utf8')
    : null;
  const restoreProjectConfig = () => {
    if (originalProjectConfigText === null) return;
    try {
      fs.writeFileSync(projectConfigPath, originalProjectConfigText, 'utf8');
    } catch {}
  };

  if (originalProjectConfigText !== null) {
    const json = safeJsonParse(originalProjectConfigText);
    if (json && typeof json === 'object') {
      json.setting = json.setting && typeof json.setting === 'object' ? json.setting : {};
      json.setting.urlCheck = false;
      try {
        fs.writeFileSync(projectConfigPath, JSON.stringify(json, null, 2), 'utf8');
      } catch {
        restoreProjectConfig();
      }
    }
  }

  // miniprogram-automator spawns cliPath directly; on newer Node versions, spawning .bat may fail.
  // Workaround: wrap via cmd.exe when cliPath is a .bat on Windows.
  const isWindows = process.platform === 'win32';
  const launchCliPath = isWindows && cliPathResolved.toLowerCase().endsWith('.bat') ? 'cmd' : cliPathResolved;
  const launchArgs = isWindows && cliPathResolved.toLowerCase().endsWith('.bat') ? ['/c', cliPathResolved] : [];

  const miniProgram = await automator.launch({
    cliPath: launchCliPath,
    args: launchArgs,
    projectPath,
    timeout: timeoutMs,
    trustProject: true,
  });

  try {
    await miniProgram.callWxMethod('setStorageSync', 'ipmoney.mockScenario', scenario);

    if (!noAuth) {
      if (!userToken) {
        // eslint-disable-next-line no-console
        console.error('[weapp] Missing demo user token. Pass --user-token or set DEMO_USER_TOKEN in env / repo .env.');
        process.exit(1);
      }
      await miniProgram.callWxMethod('setStorageSync', 'ipmoney.token', userToken);
      await miniProgram.callWxMethod('setStorageSync', 'ipmoney.onboardingDone', true);
      await miniProgram.callWxMethod('setStorageSync', 'ipmoney.verificationType', 'PERSON');
      await miniProgram.callWxMethod('setStorageSync', 'ipmoney.verificationStatus', 'APPROVED');
    }

    // Make sure the next pages see the updated storage.
    await miniProgram.callWxMethod('reLaunch', { url: '/pages/home/index' });
    await sleep(1500);

    for (const p of PAGES) {
      // eslint-disable-next-line no-console
      console.log(`[weapp] ${p.name} -> ${p.url}`);
      await miniProgram.callWxMethod('reLaunch', { url: p.url });
      await sleep(waitMs);
      const outPath = path.join(outClientDir, `client-${p.name}.png`);
      try {
        await withTimeout(miniProgram.screenshot({ path: outPath }), screenshotTimeoutMs, `screenshot(${p.name})`);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`[weapp] Screenshot failed: ${p.name}.`);
        // eslint-disable-next-line no-console
        console.error(
          '[weapp] Note: on some WeChat DevTools versions, App.captureScreenshot may be unimplemented/hang in automation mode.',
        );
        throw e;
      }
    }
  } finally {
    try {
      await miniProgram.close();
    } catch {}
    restoreProjectConfig();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
