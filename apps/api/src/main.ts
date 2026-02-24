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

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: false });

  // Behind a reverse proxy (ingress / load balancer), Express needs trust proxy
  // to correctly resolve req.ip and protocol.
  if (parseBool(process.env.TRUST_PROXY)) {
    app.set('trust proxy', 1);
  }

  // Basic hardening (no extra deps).
  app.disable('x-powered-by');

  const corsOriginsRaw = String(process.env.CORS_ORIGINS || '').trim();
  if (!corsOriginsRaw || corsOriginsRaw === '*') {
    app.enableCors({ origin: true, credentials: true });
  } else {
    const origins = corsOriginsRaw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    app.enableCors({
      credentials: true,
      origin(origin, cb) {
        // Allow non-browser requests (no Origin header).
        if (!origin) return cb(null, true);
        if (origins.includes(origin)) return cb(null, true);
        return cb(new Error('Not allowed by CORS'), false);
      },
    });
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
