import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VerifiedUserGuard } from '../src/common/guards/verified-user.guard';

type Req = { auth?: any };

function makeContext(req: Req) {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as any;
}

describe('VerifiedUserGuard strictness suite', () => {
  let prisma: any;
  let guard: VerifiedUserGuard;

  beforeEach(() => {
    prisma = {
      userVerification: {
        findFirst: vi.fn(),
      },
    } as any;
    guard = new VerifiedUserGuard(prisma);
  });

  it('rejects when auth userId is missing', async () => {
    await expect(guard.canActivate(makeContext({}))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('short-circuits when request auth already approved', async () => {
    const req: Req = {
      auth: {
        userId: 'u-1',
        verificationStatus: 'APPROVED',
      },
    };

    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);
    expect(prisma.userVerification.findFirst).not.toHaveBeenCalled();
  });

  it('loads latest verification and enriches auth when approved in database', async () => {
    const req: Req = {
      auth: {
        userId: 'u-2',
        verificationStatus: 'PENDING',
      },
    };
    prisma.userVerification.findFirst.mockResolvedValueOnce({
      verificationStatus: 'APPROVED',
      verificationType: 'ENTERPRISE',
    });

    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);

    expect(prisma.userVerification.findFirst).toHaveBeenCalledWith({
      where: { userId: 'u-2' },
      orderBy: { submittedAt: 'desc' },
    });
    expect(req.auth.verificationStatus).toBe('APPROVED');
    expect(req.auth.verificationType).toBe('ENTERPRISE');
  });

  it('rejects when latest verification is absent or not approved', async () => {
    const req: Req = { auth: { userId: 'u-3', verificationStatus: 'PENDING' } };

    prisma.userVerification.findFirst.mockResolvedValueOnce(null);
    await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(ForbiddenException);

    prisma.userVerification.findFirst.mockResolvedValueOnce({
      verificationStatus: 'REJECTED',
      verificationType: 'PERSONAL',
    });
    await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
