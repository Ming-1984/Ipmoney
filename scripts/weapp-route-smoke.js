/* eslint-disable no-console */
// WeApp route smoke test via WeChat DevTools automation (miniprogram-automator).
//
// Goal: provide a reliable, screenshot-free smoke run on DevTools versions where
// App.captureScreenshot is unimplemented/hangs in automation mode.
//
// This does NOT replace a full manual smoke (click/scroll/real device); it only
// validates that core routes can be entered without throwing runtime exceptions.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

let automator;
try {
  // Optional dependency; present in repo devDependencies.
  // eslint-disable-next-line global-require
  automator = require('miniprogram-automator');
} catch (e) {
  console.error('[weapp-route-smoke] Missing dependency: miniprogram-automator');
  console.error('[weapp-route-smoke] Install: pnpm add -D miniprogram-automator');
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePositiveInt(input, fallback, min = 1) {
  const num = Number(input);
  if (!Number.isFinite(num)) return fallback;
  const rounded = Math.floor(num);
  if (rounded < min) return fallback;
  return rounded;
}

function safeErrorMessage(error) {
  if (!error) return 'Unknown error';
  return String(error && error.message ? error.message : error);
}

function getWechatDevtoolsProcessCount() {
  if (process.platform !== 'win32') {
    return {
      count: null,
      error: 'process-count check only supports Windows in this script.',
    };
  }

  try {
    const output = execFileSync('tasklist', ['/FI', 'IMAGENAME eq wechatdevtools.exe', '/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const lines = String(output || '')
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean);

    const count = lines.filter((line) => line.toLowerCase().replace(/^"/, '').startsWith('wechatdevtools.exe')).length;
    return { count, error: '' };
  } catch (error) {
    return { count: null, error: safeErrorMessage(error) };
  }
}

function killWechatDevtoolsProcesses() {
  const before = getWechatDevtoolsProcessCount();
  const result = {
    attempted: false,
    beforeCount: before.count,
    afterCount: before.count,
    ok: true,
    error: '',
  };

  if (process.platform !== 'win32') {
    result.ok = false;
    result.error = 'kill only supports Windows in this script.';
    return result;
  }

  if (typeof before.count !== 'number' || before.count <= 0) {
    if (before.error) {
      result.ok = false;
      result.error = before.error;
    }
    return result;
  }

  result.attempted = true;
  try {
    execFileSync('taskkill', ['/F', '/IM', 'wechatdevtools.exe'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    result.ok = false;
    result.error = safeErrorMessage(error);
  }

  const after = getWechatDevtoolsProcessCount();
  result.afterCount = after.count;
  if (after.error && !result.error) {
    result.ok = false;
    result.error = after.error;
  }
  return result;
}

function isLaunchPortError(message) {
  const msg = String(message || '').toLowerCase();
  return msg.includes('failed to launch wechat web devtools') || msg.includes('please make sure http port is open');
}

async function launchMiniProgramWithRetry({
  launchOptions,
  launchRetries,
  launchRetryDelayMs,
  killStaleDevtools,
}) {
  const attempts = [];

  for (let attempt = 1; attempt <= launchRetries; attempt += 1) {
    const processBefore = getWechatDevtoolsProcessCount();
    const devtoolsBefore = processBefore.count === null ? 'unknown' : String(processBefore.count);
    console.log(`[weapp-route-smoke] launch attempt ${attempt}/${launchRetries} (wechatdevtools=${devtoolsBefore})`);

    let killResult = null;
    if (killStaleDevtools) {
      killResult = killWechatDevtoolsProcesses();
      if (killResult.attempted) {
        const after = killResult.afterCount === null ? 'unknown' : String(killResult.afterCount);
        console.log(
          `[weapp-route-smoke] stale devtools cleanup attempted (before=${killResult.beforeCount}, after=${after}, ok=${killResult.ok})`,
        );
        await sleep(800);
      }
    }

    const launchStartedAt = Date.now();
    try {
      const miniProgram = await automator.launch(launchOptions);
      const processAfter = getWechatDevtoolsProcessCount();
      attempts.push({
        attempt,
        ok: true,
        elapsedMs: Date.now() - launchStartedAt,
        devtoolsBefore: processBefore.count,
        devtoolsAfter: processAfter.count,
        killResult,
      });
      return { miniProgram, attempts };
    } catch (error) {
      const message = safeErrorMessage(error);
      const processAfter = getWechatDevtoolsProcessCount();

      attempts.push({
        attempt,
        ok: false,
        elapsedMs: Date.now() - launchStartedAt,
        error: message,
        devtoolsBefore: processBefore.count,
        devtoolsAfter: processAfter.count,
        killResult,
      });

      console.error(`[weapp-route-smoke] launch attempt ${attempt}/${launchRetries} failed: ${message}`);
      if (isLaunchPortError(message)) {
        console.error(
          '[weapp-route-smoke] hint: close stale WeChat DevTools windows or rerun with --kill-stale-devtools to auto-clean lingering processes.',
        );
      }

      if (attempt < launchRetries) {
        await sleep(launchRetryDelayMs);
        continue;
      }

      const launchError = new Error(`DevTools launch failed after ${launchRetries} attempt(s): ${message}`);
      launchError.launchAttempts = attempts;
      throw launchError;
    }
  }

  const launchError = new Error(`DevTools launch failed after ${launchRetries} attempt(s).`);
  launchError.launchAttempts = attempts;
  throw launchError;
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

function detectCliPath() {
  const candidates = [
    process.env.WX_DEVTOOLS_CLI,
    // Common installs (CN)
    'D:\\\\微信web开发者工具\\\\cli.bat',
    'C:\\\\Program Files (x86)\\\\Tencent\\\\微信web开发者工具\\\\cli.bat',
    'C:\\\\Program Files\\\\Tencent\\\\微信web开发者工具\\\\cli.bat',
    // Legacy-ish path (mojibake safe): allow the automator default resolution too.
  ]
    .filter(Boolean)
    .map(String);

  for (const c of candidates) {
    const resolved = resolveCliPath(c);
    if (resolved && fs.existsSync(resolved)) return resolved;
  }
  return '';
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

const SAMPLE = {
  // Keep in sync with apps/api/prisma/seed.js demo IDs (SEED_* constants).
  listingId: 'd562cea2-5502-4553-9cf1-869ee2c760fd',
  patentId: '6e0511e4-5d32-4794-99f6-408d0941a754',
  conversationId: 'ae127712-cb2f-4526-8520-0dc45528ab8a',
  orderId: '5e238163-ad1e-4830-a74d-944959427ebe',
};

const P0_ROUTES = [
  { name: 'home', url: '/pages/home/index' },
  { name: 'search', url: '/subpackages/search/index' },
  { name: 'listing-detail', url: `/subpackages/listing/detail/index?listingId=${SAMPLE.listingId}` },
  { name: 'patent-detail', url: `/subpackages/patent/detail/index?patentId=${SAMPLE.patentId}` },
  { name: 'messages', url: '/pages/messages/index' },
  { name: 'chat', url: `/subpackages/messages/chat/index?conversationId=${SAMPLE.conversationId}` },
  { name: 'favorites', url: '/subpackages/favorites/index' },
  { name: 'publish', url: '/pages/publish/index' },
  { name: 'orders', url: '/subpackages/orders/index' },
  { name: 'order-detail', url: `/subpackages/orders/detail/index?orderId=${SAMPLE.orderId}` },
  { name: 'me', url: '/pages/me/index' },
];

function printHelp() {
  console.log(
    [
      'WeApp route smoke (no screenshots). Navigates core routes and fails on runtime exceptions.',
      '',
      'Usage:',
      '  node scripts/weapp-route-smoke.js --cli-path "D:\\\\微信web开发者工具\\\\cli.bat" --project-path apps/client --out-file .tmp/weapp-route-smoke.json --user-token <DEMO_USER_TOKEN>',
      '',
      'Options:',
      '  --cli-path     Path to WeChat DevTools cli (cli/cli.bat). If omitted, it will try to auto-detect common paths or env WX_DEVTOOLS_CLI.',
      '  --project-path WeChat DevTools project directory (default: apps/client).',
      '  --out-file     Output JSON file (default: .tmp/weapp-route-smoke-<date>.json).',
      '  --wait-ms      Extra wait after each route change (default: 2000).',
      '  --timeout-ms   DevTools launch timeout (default: 120000).',
      '  --launch-retries     DevTools launch retry count (default: 3).',
      '  --launch-retry-delay-ms  Delay between launch retries in ms (default: 4000).',
      '  --kill-stale-devtools    Auto kill lingering wechatdevtools.exe before each launch attempt (Windows only).',
      '  --scenario     Mock scenario storage value (default: happy).',
      '  --user-token   Demo user token stored as ipmoney.token. If omitted, it will try DEMO_USER_TOKEN from process env or repo .env.',
      '  --no-auth      Do not set demo auth storage keys.',
      '  --list-only    Only print planned routes.',
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
  const waitMs = parsePositiveInt(args['wait-ms'], 2000, 200);
  const timeoutMs = parsePositiveInt(args['timeout-ms'], 120_000, 5000);
  const launchRetries = parsePositiveInt(args['launch-retries'], 3, 1);
  const launchRetryDelayMs = parsePositiveInt(args['launch-retry-delay-ms'], 4000, 0);
  const killStaleDevtools = Boolean(args['kill-stale-devtools']);
  const scenario = String(args.scenario || 'happy');
  const noAuth = Boolean(args['no-auth']);
  const listOnly = Boolean(args['list-only']);
  const userToken = String(args['user-token'] || '').trim() || getEnvValue('DEMO_USER_TOKEN', envMap) || '';

  if (listOnly) {
    console.log('[weapp-route-smoke] Planned routes:');
    for (const p of P0_ROUTES) console.log(`  - ${p.name}: ${p.url}`);
    return;
  }

  const cliPathResolved = resolveCliPath(String(args['cli-path'] || '')) || detectCliPath();
  if (!cliPathResolved || !fs.existsSync(cliPathResolved)) {
    console.error('[weapp-route-smoke] Missing --cli-path (WeChat DevTools cli.bat).');
    console.error('[weapp-route-smoke] Tip: set env WX_DEVTOOLS_CLI=.../cli.bat');
    process.exit(1);
  }

  const reportDate = String(args.date || '').trim() || new Date().toISOString().slice(0, 10);
  const outFile =
    String(args['out-file'] || '').trim() || path.resolve(repoRoot, '.tmp', `weapp-route-smoke-${reportDate}.json`);
  ensureDir(path.dirname(outFile));
  const startedAt = Date.now();

  // miniprogram-automator spawns cliPath directly; on newer Node versions, spawning .bat may fail.
  // Workaround: wrap via cmd.exe when cliPath is a .bat on Windows.
  const isWindows = process.platform === 'win32';
  const launchCliPath = isWindows && cliPathResolved.toLowerCase().endsWith('.bat') ? 'cmd' : cliPathResolved;
  const launchArgs = isWindows && cliPathResolved.toLowerCase().endsWith('.bat') ? ['/c', cliPathResolved] : [];
  console.log(
    `[weapp-route-smoke] preflight project=${projectPath} cli=${cliPathResolved} timeoutMs=${timeoutMs} launchRetries=${launchRetries} killStale=${killStaleDevtools}`,
  );

  const exceptions = [];
  const consoleLogs = [];
  let launchAttempts = [];
  let miniProgram = null;
  try {
    const launched = await launchMiniProgramWithRetry({
      launchOptions: {
        cliPath: launchCliPath,
        args: launchArgs,
        projectPath,
        timeout: timeoutMs,
        trustProject: true,
      },
      launchRetries,
      launchRetryDelayMs,
      killStaleDevtools,
    });
    miniProgram = launched.miniProgram;
    launchAttempts = launched.attempts;
  } catch (error) {
    launchAttempts = Array.isArray(error && error.launchAttempts) ? error.launchAttempts : launchAttempts;
    const failureSummary = {
      ok: false,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      routes: [],
      meta: {
        scenario,
        noAuth,
        projectPath,
        launchRetries,
        launchRetryDelayMs,
        killStaleDevtools,
      },
      launch: {
        ok: false,
        attempts: launchAttempts,
        error: safeErrorMessage(error),
      },
    };
    fs.writeFileSync(outFile, JSON.stringify(failureSummary, null, 2), 'utf8');
    console.error(`[weapp-route-smoke] wrote ${outFile}`);
    throw error;
  }

  miniProgram.on('exception', (payload) => {
    exceptions.push({ ts: Date.now(), payload });
  });

  miniProgram.on('console', (payload) => {
    consoleLogs.push({ ts: Date.now(), payload });
  });

  const results = [];

  try {
    await miniProgram.callWxMethod('setStorageSync', 'ipmoney.mockScenario', scenario);

    if (!noAuth) {
      if (!userToken) {
        throw new Error(
          '[weapp-route-smoke] Missing demo user token. Pass --user-token or set DEMO_USER_TOKEN in env / repo .env.',
        );
      }
      await miniProgram.callWxMethod('setStorageSync', 'ipmoney.token', userToken);
      await miniProgram.callWxMethod('setStorageSync', 'ipmoney.onboardingDone', true);
      await miniProgram.callWxMethod('setStorageSync', 'ipmoney.verificationType', 'PERSON');
      await miniProgram.callWxMethod('setStorageSync', 'ipmoney.verificationStatus', 'APPROVED');
    }

    // Make sure the next pages see the updated storage.
    await miniProgram.callWxMethod('reLaunch', { url: '/pages/home/index' });
    await sleep(1200);

    for (const p of P0_ROUTES) {
      const navStart = Date.now();
      console.log(`[weapp-route-smoke] ${p.name} -> ${p.url}`);
      let ok = true;
      let err = '';
      let current = null;
      let currentErr = '';

      try {
        await miniProgram.callWxMethod('reLaunch', { url: p.url });
        await sleep(waitMs);
      } catch (e) {
        ok = false;
        err = String(e && e.message ? e.message : e);
      }

      // Some DevTools versions may have incomplete support for App.getCurrentPage in automation mode.
      // Treat it as best-effort and do not fail the route solely because of it.
      if (ok) {
        try {
          const page = await miniProgram.currentPage();
          current = page ? { path: page.path, query: page.query } : null;
        } catch (e) {
          currentErr = String(e && e.message ? e.message : e);
        }
      }

      const navEnd = Date.now();
      const pageExceptions = exceptions.filter((x) => x.ts >= navStart && x.ts <= navEnd);
      if (pageExceptions.length) {
        ok = false;
        if (!err) err = `runtime_exception(${pageExceptions.length})`;
      }

      results.push({
        name: p.name,
        url: p.url,
        ok,
        err: err || undefined,
        current,
        currentErr: currentErr || undefined,
        exceptions: pageExceptions.map((x) => x.payload),
      });
    }
  } finally {
    try {
      await miniProgram.close();
    } catch {}
  }

  const summary = {
    ok: results.every((r) => r.ok),
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date().toISOString(),
    routes: results,
    meta: {
      scenario,
      noAuth,
      projectPath,
      launchRetries,
      launchRetryDelayMs,
      killStaleDevtools,
    },
    launch: {
      ok: true,
      attempts: launchAttempts,
    },
    consoleLogCount: consoleLogs.length,
  };

  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`[weapp-route-smoke] wrote ${outFile}`);
  if (!summary.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
