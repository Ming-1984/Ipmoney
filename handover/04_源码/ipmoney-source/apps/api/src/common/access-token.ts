import crypto from 'node:crypto';

type AccessTokenPayload = {
  sub: string;
  iat: number;
  exp: number;
  ver: 1;
};

const TOKEN_PREFIX = 'atk1';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isReleaseLike(value: string | undefined): boolean {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return false;
  if (raw === 'prod' || raw === 'production') return true;
  if (raw === 'staging' || raw === 'stage') return true;
  if (/(^|[-_])prod($|[-_])/.test(raw)) return true;
  if (/(^|[-_])staging($|[-_])/.test(raw)) return true;
  return false;
}

function isNonDevEnv(): boolean {
  const envs = [process.env.NODE_ENV, process.env.DEPLOY_ENV, process.env.APP_MODE, process.env.STAGE, process.env.ENV];
  return envs.some((value) => isReleaseLike(value));
}

function resolveAccessTokenSecret(): string | null {
  const secret = String(process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || '').trim();
  if (secret) return secret;
  if (!isNonDevEnv()) return 'dev-only-access-token-secret-change-me';
  return null;
}

function toBase64Url(input: string) {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function hmacSha256(payloadBase64Url: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payloadBase64Url).digest('base64url');
}

export function createAccessToken(userId: string, expiresInSeconds: number): string {
  const subject = String(userId || '').trim();
  if (!subject || !UUID_RE.test(subject)) {
    throw new Error('access token subject is invalid');
  }
  const secret = resolveAccessTokenSecret();
  if (!secret) {
    throw new Error('ACCESS_TOKEN_SECRET is required');
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  const ttl = Math.max(60, Math.floor(Number(expiresInSeconds) || 7200));
  const payload: AccessTokenPayload = {
    sub: subject,
    iat: nowSeconds,
    exp: nowSeconds + ttl,
    ver: 1,
  };
  const payloadBase64Url = toBase64Url(JSON.stringify(payload));
  const sig = hmacSha256(payloadBase64Url, secret);
  return `${TOKEN_PREFIX}.${payloadBase64Url}.${sig}`;
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  const raw = String(token || '').trim();
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null;
  const payloadBase64Url = parts[1];
  const sig = parts[2];
  if (!payloadBase64Url || !sig) return null;
  const secret = resolveAccessTokenSecret();
  if (!secret) return null;
  const expectedSig = hmacSha256(payloadBase64Url, secret);
  const sigBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expectedSig);
  if (sigBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

  let payload: any;
  try {
    payload = JSON.parse(Buffer.from(payloadBase64Url, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const sub = String(payload?.sub || '').trim();
  const exp = Number(payload?.exp || 0);
  const iat = Number(payload?.iat || 0);
  const ver = Number(payload?.ver || 0);
  if (!sub || !UUID_RE.test(sub)) return null;
  if (!Number.isSafeInteger(iat) || !Number.isSafeInteger(exp) || exp <= iat) return null;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (exp <= nowSeconds) return null;
  if (ver !== 1) return null;
  return { sub, iat, exp, ver: 1 };
}

