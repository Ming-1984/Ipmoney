import { describe, expect, it, vi } from 'vitest';

import { FileAccessGuard } from '../src/modules/files/file-access.guard';

function makeContext(req: any) {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as any;
}

describe('FileAccessGuard strictness suite', () => {
  it('allows valid temp token and injects token-based file access metadata', async () => {
    const bearerAuth = { canActivate: vi.fn().mockResolvedValue(true) };
    const files = {
      verifyTempToken: vi.fn().mockReturnValue({ scope: 'preview', expiresAt: 1_728_000_000 }),
    };
    const guard = new FileAccessGuard(bearerAuth as any, files as any);
    const req: any = { query: { token: 'temp-token' }, params: { fileId: 'file-1' } };

    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);

    expect(files.verifyTempToken).toHaveBeenCalledWith('temp-token', 'file-1');
    expect(req.fileAccess).toMatchObject({
      viaToken: true,
      scope: 'preview',
      expiresAt: 1_728_000_000,
    });
    expect(bearerAuth.canActivate).not.toHaveBeenCalled();
  });

  it('falls back to bearer auth when token verification fails', async () => {
    const bearerAuth = { canActivate: vi.fn().mockResolvedValue(true) };
    const files = { verifyTempToken: vi.fn().mockReturnValue(null) };
    const guard = new FileAccessGuard(bearerAuth as any, files as any);
    const ctx = makeContext({ query: { token: 'invalid' }, params: { fileId: 'file-2' } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);

    expect(files.verifyTempToken).toHaveBeenCalledWith('invalid', 'file-2');
    expect(bearerAuth.canActivate).toHaveBeenCalledWith(ctx);
  });

  it('falls back to bearer auth when token is absent', async () => {
    const bearerAuth = { canActivate: vi.fn().mockResolvedValue(false) };
    const files = { verifyTempToken: vi.fn() };
    const guard = new FileAccessGuard(bearerAuth as any, files as any);
    const ctx = makeContext({ query: {}, params: { fileId: 'file-3' } });

    await expect(guard.canActivate(ctx)).resolves.toBe(false);

    expect(files.verifyTempToken).not.toHaveBeenCalled();
    expect(bearerAuth.canActivate).toHaveBeenCalledWith(ctx);
  });
});
