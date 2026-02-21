import { Controller, Get } from '@nestjs/common';

import { PrismaService } from './common/prisma/prisma.service';
import { RedisProbeService } from './common/redis-probe.service';

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisProbe: RedisProbeService,
  ) {}

  @Get('/health')
  async health() {
    const checks: {
      db: { ok: boolean; message: string };
      redis: { ok: boolean; message: string };
    } = {
      db: { ok: false, message: 'db_unchecked' },
      redis: { ok: true, message: 'redis_not_configured' },
    };

    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      checks.db = { ok: true, message: 'db_ok' };
    } catch {
      checks.db = { ok: false, message: 'db_error' };
    }

    const redis = await this.redisProbe.ping();
    checks.redis = {
      ok: redis.ok,
      message: redis.message || (redis.ok ? 'redis_ok' : 'redis_error'),
    };

    return {
      ok: checks.db.ok && checks.redis.ok,
      checks,
    };
  }
}
