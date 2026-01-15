const fs = require('node:fs');
const path = require('node:path');

const automator = require('miniprogram-automator');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  listingId: '7a490e63-8173-41e7-b4f0-0d0bb5ce7d20',
  patentId: '965f9831-2c44-48e8-8b7a-cd7ab40ff7ec',
  orgUserId: 'c5b6438a-f3a7-4590-a484-0f2a2991c613',
  conversationId: '127a267b-d5f8-4b39-acf8-855dff7258b0',
  orderId: 'e9032d03-9b23-40ba-84a3-ac681f21c41b',
  regionCode: '110000',
  year: 2025,
};

const PAGES = [
  { name: 'home', url: '/pages/home/index' },
  { name: 'search', url: '/pages/search/index' },
  { name: 'patent-map', url: '/pages/patent-map/index' },
  { name: 'patent-map-region-detail', url: `/pages/patent-map/region-detail/index?regionCode=${SAMPLE.regionCode}&year=${SAMPLE.year}` },
  { name: 'inventors', url: '/pages/inventors/index' },
  { name: 'listing-detail', url: `/pages/listing/detail/index?listingId=${SAMPLE.listingId}` },
  { name: 'patent-detail', url: `/pages/patent/detail/index?patentId=${SAMPLE.patentId}` },
  { name: 'organizations', url: '/pages/organizations/index' },
  { name: 'organization-detail', url: `/pages/organizations/detail/index?orgUserId=${SAMPLE.orgUserId}` },
  { name: 'trade-rules', url: '/pages/trade-rules/index' },
  { name: 'login', url: '/pages/login/index' },
  { name: 'onboarding-choose-identity', url: '/pages/onboarding/choose-identity/index' },
  { name: 'onboarding-verification-form', url: '/pages/onboarding/verification-form/index' },
  { name: 'region-picker', url: '/pages/region-picker/index' },
  { name: 'profile-edit', url: '/pages/profile/edit/index' },
  { name: 'messages', url: '/pages/messages/index' },
  { name: 'chat', url: `/pages/messages/chat/index?conversationId=${SAMPLE.conversationId}` },
  { name: 'publish', url: '/pages/publish/index' },
  { name: 'publish-patent', url: '/pages/publish/patent/index' },
  { name: 'publish-demand', url: '/pages/publish/demand/index' },
  { name: 'publish-achievement', url: '/pages/publish/achievement/index' },
  { name: 'my-listings', url: '/pages/my-listings/index' },
  { name: 'favorites', url: '/pages/favorites/index' },
  { name: 'orders', url: '/pages/orders/index' },
  { name: 'order-detail', url: `/pages/orders/detail/index?orderId=${SAMPLE.orderId}` },
  { name: 'checkout-deposit-pay', url: `/pages/checkout/deposit-pay/index?listingId=${SAMPLE.listingId}` },
  { name: 'checkout-deposit-success', url: `/pages/checkout/deposit-success/index?orderId=${SAMPLE.orderId}&paymentId=demo-payment-deposit` },
  { name: 'checkout-final-pay', url: `/pages/checkout/final-pay/index?orderId=${SAMPLE.orderId}` },
  { name: 'checkout-final-success', url: `/pages/checkout/final-success/index?orderId=${SAMPLE.orderId}&paymentId=demo-payment-final` },
  { name: 'me', url: '/pages/me/index' },
];

function printHelp() {
  // eslint-disable-next-line no-console
  console.log(
    [
      'Capture WeChat DevTools (weapp) screenshots into a folder compatible with scripts/merge-ui-screenshots.py.',
      '',
      'Usage:',
      '  node scripts/capture-weapp-ui.js --cli-path "D:\\\\微信web开发者工具\\\\cli.bat" --project-path apps/client --out-dir docs/demo/rendered/ui',
      '',
      'Options:',
      '  --cli-path       Path to WeChat DevTools cli (cli/cli.bat). You may also pass the DevTools exe/dir; it will try to resolve cli.bat.',
      '  --project-path   WeChat DevTools project directory (default: apps/client).',
      '  --out-dir        Output root directory; screenshots go to <out-dir>/client/ (default: docs/demo/rendered/ui).',
      '  --wait-ms        Extra wait after each route change before screenshot (default: 2500).',
      '  --timeout-ms     DevTools launch timeout (default: 120000).',
      '  --scenario       Mock scenario storage value (default: happy).',
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
  const scenario = String(args.scenario || 'happy');
  const noAuth = Boolean(args['no-auth']);
  const listOnly = Boolean(args['list-only']);

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

  const miniProgram = await automator.launch({
    cliPath: cliPathResolved,
    projectPath,
    timeout: timeoutMs,
    trustProject: true,
  });

  try {
    await miniProgram.callWxMethod('setStorageSync', 'ipmoney.mockScenario', scenario);

    if (!noAuth) {
      await miniProgram.callWxMethod('setStorageSync', 'ipmoney.token', 'demo-user-token');
      await miniProgram.callWxMethod('setStorageSync', 'ipmoney.onboardingDone', true);
      await miniProgram.callWxMethod('setStorageSync', 'ipmoney.verificationType', 'PERSON');
      await miniProgram.callWxMethod('setStorageSync', 'ipmoney.verificationStatus', 'APPROVED');
    }

    // Make sure the next pages see the updated storage.
    await miniProgram.reLaunch('/pages/home/index');
    await sleep(1500);

    for (const p of PAGES) {
      // eslint-disable-next-line no-console
      console.log(`[weapp] ${p.name} -> ${p.url}`);
      await miniProgram.reLaunch(p.url);
      await sleep(waitMs);
      const outPath = path.join(outClientDir, `client-${p.name}.png`);
      await miniProgram.screenshot({ path: outPath });
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
