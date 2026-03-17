import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RbacService } from '../src/modules/rbac/rbac.service';

describe('RbacService read/update strictness suite', () => {
  let prisma: any;
  let audit: any;
  let service: RbacService;
  const req = { auth: { userId: 'admin-1', permissions: new Set(['rbac.manage']) } };

  beforeEach(() => {
    prisma = {
      rbacRole: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      rbacUserRole: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      systemConfig: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn().mockResolvedValue(undefined),
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    service = new RbacService(audit, prisma);
    prisma.rbacRole.count.mockResolvedValue(1);
  });

  it('requires auth/permission for listRoles', async () => {
    await expect(service.listRoles({})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.listRoles({ auth: { userId: 'u-1', permissions: new Set() } })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lists roles after seed check with mapped dto', async () => {
    prisma.rbacRole.count.mockResolvedValueOnce(1);
    prisma.rbacRole.findMany.mockResolvedValueOnce([
      {
        id: 'role-custom',
        name: 'Custom',
        description: 'desc',
        permissionIds: ['report.read'],
        updatedAt: new Date('2026-03-13T00:00:00.000Z'),
      },
    ]);

    const result = await service.listRoles(req);

    expect(prisma.rbacRole.findMany).toHaveBeenCalledWith({ orderBy: { updatedAt: 'desc' } });
    expect(result.items[0]).toMatchObject({
      id: 'role-custom',
      name: 'Custom',
      permissionIds: ['report.read'],
    });
  });

  it('lists users and falls back to system role when no explicit rbac role assigned', async () => {
    prisma.rbacRole.count.mockResolvedValueOnce(1);
    prisma.user.findMany.mockResolvedValueOnce([
      {
        id: 'u-1',
        nickname: 'Alice',
        phone: '13800000000',
        role: 'operator',
        createdAt: new Date('2026-03-13T00:00:00.000Z'),
        rbacRoles: [],
      },
    ]);

    const result = await service.listUsers(req);

    expect(result.items[0]).toEqual({
      id: 'u-1',
      name: 'Alice',
      email: '13800000000',
      roleIds: ['role-operator'],
    });
  });

  it('validates updateUserRoles userId/roleIds strictly', async () => {
    await expect(service.updateUserRoles(req, 'bad-id', { roleIds: [] })).rejects.toBeInstanceOf(BadRequestException);

    prisma.rbacRole.count.mockResolvedValueOnce(1);
    prisma.user.findUnique.mockResolvedValueOnce({ id: '11111111-1111-4111-8111-111111111111' });
    await expect(service.updateUserRoles(req, '11111111-1111-4111-8111-111111111111', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects unknown roleIds and updates on valid payload', async () => {
    prisma.rbacRole.count.mockResolvedValueOnce(1);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: '11111111-1111-4111-8111-111111111111',
      nickname: 'Alice',
      phone: '13800000000',
    });
    prisma.rbacRole.findMany.mockResolvedValueOnce([{ id: 'role-operator' }]);
    prisma.rbacUserRole.deleteMany.mockReturnValueOnce({});
    prisma.rbacUserRole.createMany.mockReturnValueOnce({});

    await expect(
      service.updateUserRoles(req, '11111111-1111-4111-8111-111111111111', { roleIds: ['role-missing'] }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.rbacRole.count.mockResolvedValueOnce(1);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: '11111111-1111-4111-8111-111111111111',
      nickname: 'Alice',
      phone: '13800000000',
    });
    prisma.rbacRole.findMany.mockResolvedValueOnce([{ id: 'role-operator' }]);
    prisma.rbacUserRole.deleteMany.mockReturnValueOnce({});
    prisma.rbacUserRole.createMany.mockReturnValueOnce({});

    const result = await service.updateUserRoles(req, '11111111-1111-4111-8111-111111111111', {
      roleIds: [' role-operator ', 'role-operator'],
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Alice',
      email: '13800000000',
      roleIds: ['role-operator'],
    });
  });
});
