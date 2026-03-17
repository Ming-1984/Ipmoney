import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../src/common/prisma/prisma.service';
import { RedisProbeService } from '../src/common/redis-probe.service';
import { HealthController } from '../src/health.controller';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  const prismaMock = {
    $queryRawUnsafe: vi.fn(),
  };
  const redisProbeMock = {
    ping: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisProbeService, useValue: redisProbeMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns ok=true when db and redis probes succeed', async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ '?column?': 1 }]);
    redisProbeMock.ping.mockResolvedValueOnce({ ok: true, message: 'redis_ok' });

    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body).toMatchObject({
      ok: true,
      checks: {
        db: { ok: true, message: 'db_ok' },
        redis: { ok: true, message: 'redis_ok' },
      },
    });
  });

  it('returns ok=false when db probe fails', async () => {
    prismaMock.$queryRawUnsafe.mockRejectedValueOnce(new Error('db down'));
    redisProbeMock.ping.mockResolvedValueOnce({ ok: true, message: '' });

    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body).toMatchObject({
      ok: false,
      checks: {
        db: { ok: false, message: 'db_error' },
        redis: { ok: true, message: 'redis_ok' },
      },
    });
  });
});
