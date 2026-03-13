import { UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BearerAuthGuard } from '../src/common/guards/bearer-auth.guard';

type Req = { headers?: Record<string, string>; auth?: any };

function makeContext(req: Req) {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as any;
}

describe('BearerAuthGuard strictness suite', () => {
  const envKeys = [
    'NODE_ENV',
    'DEMO_AUTH_ENABLED',
    'DEMO_AUTH_ALLOW_UUID_TOKENS',
    'DEMO_ADMIN_TOKEN',
    'DEMO_USER_TOKEN',
    'DEMO_ADMIN_ID',
    'DEMO_USER_ID',
    'DEMO_ADMIN_PHONE',
    'DEMO_USER_PHONE',
    'DEMO_ADMIN_NICKNAME',
    'DEMO_USER_NICKNAME',
    'DEMO_ADMIN_REGION_CODE',
    'DEMO_USER_REGION_CODE',
  ] as const;

  let envBackup: Record<string, string | undefined>;
  let prisma: any;
  let guard: BearerAuthGuard;

  beforeEach(() => {
    envBackup = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));
    process.env.NODE_ENV = 'test';
    process.env.DEMO_AUTH_ENABLED = 'true';
    process.env.DEMO_ADMIN_TOKEN = 'demo-admin-token';
    process.env.DEMO_USER_TOKEN = 'demo-user-token';
    process.env.DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000001';
    process.env.DEMO_USER_ID = '00000000-0000-0000-0000-000000000002';
    process.env.DEMO_ADMIN_NICKNAME = 'Demo Admin';
    process.env.DEMO_USER_NICKNAME = 'Demo User';
    process.env.DEMO_AUTH_ALLOW_UUID_TOKENS = 'false';

    prisma = {
      user: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
      },
      rbacUserRole: { findMany: vi.fn().mockResolvedValue([]) },
      rbacRole: { findMany: vi.fn().mockResolvedValue([]) },
      userVerification: { findFirst: vi.fn().mockResolvedValue(null) },
    } as any;
    guard = new BearerAuthGuard(prisma);
  });

  afterEach(() => {
    for (const key of envKeys) {
      const previous = envBackup[key];
      if (previous == null) delete process.env[key];
      else process.env[key] = previous;
    }
  });

  it('rejects when authorization header is missing bearer prefix', async () => {
    const req: Req = { headers: {} };

    await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts demo admin token and injects wildcard admin auth context', async () => {
    prisma.user.upsert.mockResolvedValueOnce({
      id: '00000000-0000-0000-0000-000000000001',
      role: 'admin',
      nickname: 'Demo Admin',
    });
    const req: Req = { headers: { authorization: 'Bearer demo-admin-token' } };

    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);

    expect(prisma.user.upsert).toHaveBeenCalledTimes(1);
    expect(req.auth).toMatchObject({
      userId: '00000000-0000-0000-0000-000000000001',
      isAdmin: true,
      role: 'admin',
      verificationStatus: 'APPROVED',
    });
    expect(req.auth.permissions).toBeInstanceOf(Set);
    expect(req.auth.permissions.has('*')).toBe(true);
  });

  it('accepts demo user token and auto-upserts demo user when absent', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.upsert.mockResolvedValueOnce({
      id: '00000000-0000-0000-0000-000000000002',
      role: 'buyer',
      nickname: 'Demo User',
    });
    const req: Req = { headers: { authorization: 'Bearer demo-user-token' } };

    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: '00000000-0000-0000-0000-000000000002' },
    });
    expect(prisma.user.upsert).toHaveBeenCalledTimes(1);
    expect(req.auth).toMatchObject({
      userId: '00000000-0000-0000-0000-000000000002',
      isAdmin: false,
      role: 'buyer',
      verificationStatus: 'PENDING',
    });
  });

  it('rejects uuid token when demo uuid-token mode is disabled', async () => {
    const req: Req = {
      headers: { authorization: 'Bearer 11111111-1111-4111-8111-111111111111' },
    };

    await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts uuid token when enabled and derives fallback operator permissions', async () => {
    process.env.DEMO_AUTH_ALLOW_UUID_TOKENS = 'true';
    const userId = '11111111-1111-4111-8111-111111111111';
    prisma.user.findUnique.mockResolvedValueOnce({
      id: userId,
      role: 'operator',
      nickname: 'Op User',
    });
    prisma.rbacUserRole.findMany.mockResolvedValueOnce([]);
    prisma.rbacRole.findMany.mockResolvedValueOnce([]);
    prisma.userVerification.findFirst.mockResolvedValueOnce({
      verificationStatus: 'APPROVED',
      verificationType: 'ENTERPRISE',
    });
    const req: Req = { headers: { authorization: `Bearer ${userId}` } };

    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);

    expect(req.auth.userId).toBe(userId);
    expect(req.auth.isAdmin).toBe(true);
    expect(req.auth.roleNames).toEqual(['operator']);
    expect(req.auth.roleIds).toEqual(['role-operator']);
    expect(req.auth.permissions.has('config.manage')).toBe(true);
    expect(req.auth.verificationStatus).toBe('APPROVED');
  });

  it('treats custom wildcard rbac role as admin even without mapped role name', async () => {
    process.env.DEMO_AUTH_ALLOW_UUID_TOKENS = 'true';
    const userId = '22222222-2222-4222-8222-222222222222';
    prisma.user.findUnique.mockResolvedValueOnce({
      id: userId,
      role: 'buyer',
      nickname: 'Buyer User',
    });
    prisma.rbacUserRole.findMany.mockResolvedValueOnce([{ roleId: 'custom-role-id' }]);
    prisma.rbacRole.findMany.mockResolvedValueOnce([{ id: 'custom-role-id', permissionIds: ['*'] }]);
    const req: Req = { headers: { authorization: `Bearer ${userId}` } };

    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);

    expect(req.auth.roleNames).toEqual([]);
    expect(req.auth.roleIds).toEqual(['custom-role-id']);
    expect(req.auth.permissions.has('*')).toBe(true);
    expect(req.auth.isAdmin).toBe(true);
  });

  it('rejects uuid token when user does not exist', async () => {
    process.env.DEMO_AUTH_ALLOW_UUID_TOKENS = 'true';
    const userId = '33333333-3333-4333-8333-333333333333';
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const req: Req = { headers: { authorization: `Bearer ${userId}` } };

    await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
