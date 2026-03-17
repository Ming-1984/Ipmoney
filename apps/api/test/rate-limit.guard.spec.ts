import { HttpException, HttpStatus } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RateLimitGuard } from '../src/common/guards/rate-limit.guard';

function makeContext(req: any) {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as any;
}

describe('RateLimitGuard strictness suite', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bypasses health endpoints regardless of request volume', () => {
    const guard = new RateLimitGuard();
    const ctx = makeContext({ path: '/health', ip: '10.0.0.1' });

    for (let i = 0; i < 200; i += 1) {
      expect(guard.canActivate(ctx)).toBe(true);
    }
  });

  it('uses the first x-forwarded-for IP and throws 429 after max requests', () => {
    const guard = new RateLimitGuard();
    const ctx = makeContext({
      path: '/api/search',
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.4' },
    });
    const max = (guard as any).max as number;

    for (let i = 0; i < max; i += 1) {
      expect(guard.canActivate(ctx)).toBe(true);
    }

    try {
      guard.canActivate(ctx);
      throw new Error('expected rate limit exception');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      const exception = error as HttpException;
      expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(exception.getResponse()).toMatchObject({ code: 'TOO_MANY_REQUESTS' });
    }
  });

  it('resets an IP counter after the window expires', () => {
    const guard = new RateLimitGuard() as any;
    const nowSpy = vi.spyOn(Date, 'now');
    const ctx = makeContext({
      path: '/api/items',
      ip: '198.51.100.20',
    });

    nowSpy.mockReturnValueOnce(5_000);
    guard.store.set('198.51.100.20', { count: guard.max, resetAt: 4_999 });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.store.get('198.51.100.20')).toMatchObject({
      count: 1,
      resetAt: 5_000 + guard.windowMs,
    });
  });
});
