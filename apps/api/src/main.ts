import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestIdMiddleware } from './common/request-id.middleware';
import { requestLoggerMiddleware } from './common/request-logger.middleware';

function parseBool(value: string | undefined): boolean {
  const v = String(value || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function isReleaseLike(value: string | undefined): boolean {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return false;
  if (raw === 'prod' || raw === 'production') return true;
  if (raw === 'staging' || raw === 'stage') return true;
  if (/(^|[-_])prod($|[-_])/.test(raw)) return true;
  if (/(^|[-_])staging($|[-_])/.test(raw)) return true;
  return false;
}

function isReleaseLikeEnv(): boolean {
  const values = [process.env.NODE_ENV, process.env.DEPLOY_ENV, process.env.APP_MODE, process.env.STAGE, process.env.ENV];
  return values.some((value) => isReleaseLike(value));
}

function normalizeOrigin(raw: string): string | null {
  try {
    const parsed = new URL(String(raw || '').trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function parseCorsOrigins(raw: string): string[] {
  const out: string[] = [];
  for (const item of String(raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)) {
    if (item === '*') continue;
    const normalized = normalizeOrigin(item);
    if (normalized && !out.includes(normalized)) out.push(normalized);
  }
  return out;
}

function deriveReleaseCorsOrigins(): string[] {
  const out: string[] = [];
  const add = (value: string | undefined) => {
    const normalized = normalizeOrigin(String(value || '').trim());
    if (normalized && !out.includes(normalized)) out.push(normalized);
  };

  add(process.env.BASE_URL);
  add(process.env.ADMIN_BASE_URL);
  add(process.env.H5_BASE_URL);
  add(process.env.WEB_BASE_URL);

  const apiBase = normalizeOrigin(String(process.env.BASE_URL || '').trim());
  if (apiBase) {
    try {
      const parsed = new URL(apiBase);
      const host = parsed.host;
      if (host.startsWith('api.')) {
        const apex = host.slice('api.'.length);
        add(`${parsed.protocol}//admin.${apex}`);
        add(`${parsed.protocol}//${apex}`);
        add(`${parsed.protocol}//www.${apex}`);
      }
    } catch {
      // ignore invalid base url
    }
  }

  return out;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: false, rawBody: true });

  // Behind a reverse proxy (ingress / load balancer), Express needs trust proxy
  // to correctly resolve req.ip and protocol.
  if (parseBool(process.env.TRUST_PROXY)) {
    app.set('trust proxy', 1);
  }

  // Basic hardening (no extra deps).
  app.disable('x-powered-by');
  app.use((_: unknown, res: { setHeader: (name: string, value: string) => void }, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  const corsOriginsRaw = String(process.env.CORS_ORIGINS || '').trim();
  const configuredOrigins = parseCorsOrigins(corsOriginsRaw);
  const wildcardConfigured =
    corsOriginsRaw === '*' ||
    corsOriginsRaw
      .split(',')
      .map((item) => item.trim())
      .some((item) => item === '*');
  const releaseLike = isReleaseLikeEnv();
  if (releaseLike) {
    const allowlist = configuredOrigins.length ? configuredOrigins : deriveReleaseCorsOrigins();
    if (wildcardConfigured) {
      console.warn('[security] CORS wildcard ignored in release-like environment; using explicit allowlist only.');
    }
    if (!allowlist.length) {
      console.warn('[security] No CORS allowlist resolved in release-like environment; browser origins will be denied.');
    }
    app.enableCors({
      credentials: true,
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        const normalized = normalizeOrigin(origin);
        if (normalized && allowlist.includes(normalized)) return cb(null, true);
        // Return `false` instead of throwing to avoid surfacing as 500.
        // Browser will block due to missing ACAO header.
        return cb(null, false);
      },
    });
  } else {
    if (!corsOriginsRaw || wildcardConfigured) {
      app.enableCors({ origin: true, credentials: true });
    } else {
      app.enableCors({
        credentials: true,
        origin(origin, cb) {
          // Allow non-browser requests (no Origin header).
          if (!origin) return cb(null, true);
          const normalized = normalizeOrigin(origin);
          if (normalized && configuredOrigins.includes(normalized)) return cb(null, true);
          // Return `false` instead of throwing to avoid surfacing as 500.
          // Browser will block due to missing ACAO header.
          return cb(null, false);
        },
      });
    }
  }

  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.useGlobalFilters(new AllExceptionsFilter());

  const uploadDir = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
  mkdirSync(uploadDir, { recursive: true });
  app.useStaticAssets(uploadDir, { prefix: '/uploads' });

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
}

bootstrap();
