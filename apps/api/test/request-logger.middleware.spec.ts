import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { requestLoggerMiddleware } from '../src/common/request-logger.middleware';

describe('requestLoggerMiddleware strictness suite', () => {
  let previousEnv: string | undefined;

  beforeEach(() => {
    previousEnv = process.env.REQUEST_LOG_ENABLED;
  });

  afterEach(() => {
    if (previousEnv == null) delete process.env.REQUEST_LOG_ENABLED;
    else process.env.REQUEST_LOG_ENABLED = previousEnv;
    vi.restoreAllMocks();
  });

  it('short-circuits when REQUEST_LOG_ENABLED is false', () => {
    process.env.REQUEST_LOG_ENABLED = 'false';
    const on = vi.fn();
    const next = vi.fn();

    requestLoggerMiddleware(
      { method: 'GET', originalUrl: '/api/items', headers: {} } as any,
      { statusCode: 200, on } as any,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(on).not.toHaveBeenCalled();
  });

  it('skips /health endpoint logging', () => {
    process.env.REQUEST_LOG_ENABLED = 'true';
    const on = vi.fn();
    const next = vi.fn();

    requestLoggerMiddleware(
      { method: 'GET', originalUrl: '/health?probe=1', headers: {} } as any,
      { statusCode: 200, on } as any,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(on).not.toHaveBeenCalled();
  });

  it('logs request once even if both finish and close events fire', () => {
    process.env.REQUEST_LOG_ENABLED = 'true';
    const handlers: Record<string, () => void> = {};
    const on = vi.fn((event: 'finish' | 'close', cb: () => void) => {
      handlers[event] = cb;
    });
    const next = vi.fn();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    requestLoggerMiddleware(
      {
        method: 'post',
        originalUrl: '/api/search?keyword=demo',
        headers: { 'user-agent': 'vitest-agent' },
        requestId: 'rid-100',
      } as any,
      { statusCode: 201, on } as any,
      next,
    );

    handlers.finish();
    handlers.close();

    expect(next).toHaveBeenCalledTimes(1);
    expect(on).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(payload).toMatchObject({
      level: 'info',
      msg: 'request',
      requestId: 'rid-100',
      method: 'POST',
      path: '/api/search',
      status: 201,
      event: 'finish',
      userAgent: 'vitest-agent',
    });
    expect(typeof payload.durationMs).toBe('number');
  });

  it('reads request-id from x-requestid header when request property is absent', () => {
    process.env.REQUEST_LOG_ENABLED = 'true';
    const handlers: Record<string, () => void> = {};
    const on = vi.fn((event: 'finish' | 'close', cb: () => void) => {
      handlers[event] = cb;
    });
    const next = vi.fn();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    requestLoggerMiddleware(
      {
        method: 'GET',
        url: '/api/items?page=2',
        headers: { 'x-requestid': 'alt-rid-7' },
      } as any,
      { statusCode: 200, on } as any,
      next,
    );

    handlers.close();

    const payload = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(payload.requestId).toBe('alt-rid-7');
    expect(payload.path).toBe('/api/items');
    expect(payload.event).toBe('close');
  });
});
