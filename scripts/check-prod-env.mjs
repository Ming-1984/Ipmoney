/* eslint-disable no-console */
const truthy = new Set(['1', 'true', 'yes', 'on']);
const falsy = new Set(['0', 'false', 'no', 'off', '']);

const env = process.env;
const prodKeys = ['NODE_ENV', 'APP_MODE', 'DEPLOY_ENV', 'STAGE', 'ENV'];

function isReleaseLike(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return false;
  if (raw === 'prod' || raw === 'production') return true;
  if (raw === 'staging' || raw === 'stage') return true;
  if (/(^|[-_])prod($|[-_])/.test(raw)) return true;
  if (/(^|[-_])staging($|[-_])/.test(raw)) return true;
  return false;
}

// Treat both staging and production as "release-like" environments where demo/mock must be disabled.
const isProd = prodKeys.some((k) => isReleaseLike(env[k]));

if (!isProd) {
  console.log('[check-prod-env] not in staging/prod; skip.');
  process.exit(0);
}

const errors = [];
const warn = [];

function read(key) {
  return String(env[key] || '').trim();
}

function isTruthy(value) {
  return truthy.has(String(value || '').trim().toLowerCase());
}

function assertFalse(key) {
  if (isTruthy(read(key))) {
    errors.push(`${key} must be false in production.`);
  }
}

function assertEmpty(key) {
  if (read(key)) {
    errors.push(`${key} must be empty in production.`);
  }
}

function assertNotLocal(key) {
  const value = read(key);
  if (!value) return;
  if (value.includes('localhost') || value.includes('127.0.0.1')) {
    errors.push(`${key} must not use localhost/127.0.0.1 in production.`);
  }
}

assertFalse('DEMO_AUTH_ENABLED');
assertFalse('DEMO_PAYMENT_ENABLED');
assertFalse('DEMO_AUTH_ALLOW_UUID_TOKENS');
assertFalse('TARO_APP_ENABLE_MOCK_TOOLS');
assertFalse('VITE_ENABLE_MOCK_TOOLS');
assertFalse('SEED_DEMO_DATA');
assertEmpty('DEMO_ADMIN_TOKEN');
assertEmpty('DEMO_USER_TOKEN');
assertEmpty('VITE_DEMO_ADMIN_TOKEN');

assertNotLocal('BASE_URL');
assertNotLocal('PUBLIC_HOST_WHITELIST');
assertNotLocal('TARO_APP_API_BASE_URL');
assertNotLocal('VITE_API_BASE_URL');

const baseUrl = read('BASE_URL');
const publicWhitelist = read('PUBLIC_HOST_WHITELIST');
if (!baseUrl && !publicWhitelist) {
  errors.push('BASE_URL or PUBLIC_HOST_WHITELIST must be set in production.');
}
if (baseUrl && !baseUrl.startsWith('https://')) {
  warn.push('BASE_URL should use https:// in production (or ensure TLS termination is correct).');
}

const corsOrigins = read('CORS_ORIGINS');
if (!corsOrigins || corsOrigins === '*') {
  warn.push('CORS_ORIGINS should be explicitly set (comma-separated) in production (avoid "*").');
}

const fileTempTokenSecret = read('FILE_TEMP_TOKEN_SECRET');
if (!fileTempTokenSecret) {
  errors.push('FILE_TEMP_TOKEN_SECRET is required in production.');
} else if (fileTempTokenSecret.toLowerCase() === 'change-me') {
  errors.push('FILE_TEMP_TOKEN_SECRET must not be the default "change-me" in production.');
}

const jwtSecret = read('JWT_SECRET');
if (!jwtSecret) {
  errors.push('JWT_SECRET is required in production.');
} else if (jwtSecret.toLowerCase() === 'change-me') {
  errors.push('JWT_SECRET must not be the default "change-me" in production.');
}

const smsProvider = read('SMS_PROVIDER').toUpperCase();
if (!smsProvider) {
  errors.push('SMS_PROVIDER is required in production (expected: ALIYUN).');
} else if (smsProvider !== 'ALIYUN') {
  errors.push(`SMS_PROVIDER=${smsProvider} is not supported in production (expected: ALIYUN).`);
}

if (smsProvider === 'ALIYUN') {
  const keyPairs = [
    { key: read('SMS_ACCESS_KEY'), secret: read('SMS_SECRET_KEY'), label: 'SMS_ACCESS_KEY/SMS_SECRET_KEY' },
    { key: read('SMS_ACCESS_KEY_ID'), secret: read('SMS_ACCESS_KEY_SECRET'), label: 'SMS_ACCESS_KEY_ID/SMS_ACCESS_KEY_SECRET' },
    { key: read('SMS_API_KEY'), secret: read('SMS_API_SECRET'), label: 'SMS_API_KEY/SMS_API_SECRET' },
  ];
  const hasCompletePair = keyPairs.some((pair) => pair.key && pair.secret);
  const hasAnyKey = keyPairs.some((pair) => pair.key);
  const hasAnySecret = keyPairs.some((pair) => pair.secret);
  const legacyPair = keyPairs.find((pair) => pair.label === 'SMS_ACCESS_KEY_ID/SMS_ACCESS_KEY_SECRET');
  const shortPair = keyPairs.find((pair) => pair.label === 'SMS_ACCESS_KEY/SMS_SECRET_KEY');
  if (!hasCompletePair) {
    if (!hasAnyKey && !hasAnySecret) {
      errors.push(
        'One SMS key pair is required for ALIYUN in production: SMS_ACCESS_KEY/SMS_SECRET_KEY (recommended), or SMS_ACCESS_KEY_ID/SMS_ACCESS_KEY_SECRET, or SMS_API_KEY/SMS_API_SECRET.',
      );
    } else {
      errors.push('SMS key/secret must be configured as a matched pair. Do not mix values across different variable names.');
    }
  }
  if (shortPair?.key && shortPair?.secret && legacyPair?.key && legacyPair?.secret && (shortPair.key !== legacyPair.key || shortPair.secret !== legacyPair.secret)) {
    warn.push('Both SMS_ACCESS_KEY/SMS_SECRET_KEY and SMS_ACCESS_KEY_ID/SMS_ACCESS_KEY_SECRET are set with different values. Runtime will prefer SMS_ACCESS_KEY/SMS_SECRET_KEY.');
  }
  if (!read('SMS_SIGN_NAME')) {
    errors.push('SMS_SIGN_NAME is required for ALIYUN SMS in production.');
  } else if (/^\?+$/.test(read('SMS_SIGN_NAME'))) {
    errors.push('SMS_SIGN_NAME appears corrupted (all "?"), please fix encoding or env value.');
  }
  if (!read('SMS_TEMPLATE_ID') && !read('SMS_TEMPLATE_ID_LOGIN')) {
    errors.push('SMS_TEMPLATE_ID (or SMS_TEMPLATE_ID_LOGIN) is required for ALIYUN SMS in production.');
  }
}

if (errors.length) {
  console.error('[check-prod-env] failed:');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

if (warn.length) {
  console.warn('[check-prod-env] warnings:');
  for (const w of warn) console.warn(`- ${w}`);
}

console.log('[check-prod-env] ok');
