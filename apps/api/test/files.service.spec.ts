import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FilesService } from '../src/modules/files/files.service';

describe('FilesService temporary token suite', () => {
  let service: FilesService;

  beforeEach(() => {
    service = new FilesService({} as any);
  });

  it('clamps temporary token ttl between 60 and 3600 seconds', () => {
    const nowSec = Math.floor(Date.now() / 1000);

    const minToken = service.createTempToken('11111111-1111-4111-8111-111111111111', 'download', 1);
    expect(minToken.expiresAt - nowSec).toBeGreaterThanOrEqual(60);
    expect(minToken.expiresAt - nowSec).toBeLessThanOrEqual(61);

    const maxToken = service.createTempToken('11111111-1111-4111-8111-111111111111', 'preview', 999999);
    expect(maxToken.expiresAt - nowSec).toBeGreaterThanOrEqual(3600);
    expect(maxToken.expiresAt - nowSec).toBeLessThanOrEqual(3601);
  });

  it('verifies generated token and returns scope/expiresAt', () => {
    const fileId = '11111111-1111-4111-8111-111111111111';
    const { token, expiresAt } = service.createTempToken(fileId, 'preview', 120);

    const result = service.verifyTempToken(token, fileId);

    expect(result).toEqual({ scope: 'preview', expiresAt });
  });

  it('rejects token when fileId does not match', () => {
    const { token } = service.createTempToken('11111111-1111-4111-8111-111111111111', 'download', 120);

    const result = service.verifyTempToken(token, '22222222-2222-4222-8222-222222222222');

    expect(result).toBeNull();
  });

  it('rejects tampered token signature', () => {
    const fileId = '11111111-1111-4111-8111-111111111111';
    const { token } = service.createTempToken(fileId, 'download', 120);
    const tampered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;

    const result = service.verifyTempToken(tampered, fileId);

    expect(result).toBeNull();
  });

  it('rejects expired token', () => {
    vi.useFakeTimers();
    const base = new Date('2026-03-13T00:00:00.000Z');
    vi.setSystemTime(base);

    const fileId = '11111111-1111-4111-8111-111111111111';
    const { token } = service.createTempToken(fileId, 'download', 60);
    vi.setSystemTime(new Date(base.getTime() + 61_000));

    const result = service.verifyTempToken(token, fileId);

    expect(result).toBeNull();
    vi.useRealTimers();
  });
});
