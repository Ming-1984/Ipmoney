import { describe, expect, it, vi } from 'vitest';

import { requestIdMiddleware } from '../src/common/request-id.middleware';

describe('requestIdMiddleware strictness suite', () => {
  it('reuses x-request-id when present and trimmed', () => {
    const req: any = { headers: { 'x-request-id': '  req-123  ' } };
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    requestIdMiddleware(req, res as any, next);

    expect(req.requestId).toBe('req-123');
    expect(req.headers['x-request-id']).toBe('req-123');
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'req-123');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('reuses alternative x-requestid header when canonical one is absent', () => {
    const req: any = { headers: { 'x-requestid': 'alt-888' } };
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    requestIdMiddleware(req, res as any, next);

    expect(req.requestId).toBe('alt-888');
    expect(req.headers['x-request-id']).toBe('alt-888');
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'alt-888');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('uses first item when request-id header arrives as an array', () => {
    const req: any = { headers: { 'x-request-id': ['array-1', 'array-2'] } };
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    requestIdMiddleware(req, res as any, next);

    expect(req.requestId).toBe('array-1');
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'array-1');
  });

  it('generates UUID when request-id headers are missing', () => {
    const req: any = { headers: {} };
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    requestIdMiddleware(req, res as any, next);

    expect(typeof req.requestId).toBe('string');
    expect(req.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', req.requestId);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
