import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RbacService } from '../src/modules/rbac/rbac.service';

const ROLE_ID = '11111111-1111-4111-8111-111111111111';
const USER_REQ = { auth: { userId: 'admin-1', permissions: new Set(['rbac.manage']) } };

describe('RbacService write flow suite', () => {
  let prisma: any;
  let audit: any;
  let service: RbacService;

  beforeEach(() => {
    prisma = {
      rbacRole: {
        count: vi.fn().mockResolvedValue(1),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      rbacUserRole: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      systemConfig: {
        findUnique: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn().mockResolvedValue(undefined),
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    service = new RbacService(audit, prisma);
  });

  it('requires auth and rbac.manage permission for role writes', async () => {
    await expect(service.createRole({}, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.updateRole({}, ROLE_ID, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.deleteRole({}, ROLE_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('createRole validates name and permission ids strictly', async () => {
    await expect(service.createRole(USER_REQ, { name: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createRole(USER_REQ, { name: 'Ops', permissionIds: ['unknown.permission'] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.rbacRole.create).not.toHaveBeenCalled();
  });

  it('createRole normalizes payload and writes audit log', async () => {
    prisma.rbacRole.create.mockResolvedValueOnce({
      id: ROLE_ID,
      name: 'Ops',
      description: 'Manage reports',
      permissionIds: ['report.read', 'report.export'],
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });

    const result = await service.createRole(USER_REQ, {
      name: '  Ops  ',
      description: '  Manage reports  ',
      permissionIds: [' report.read ', 'report.read', 'report.export'],
    });

    expect(prisma.rbacRole.create).toHaveBeenCalledWith({
      data: {
        id: expect.any(String),
        name: 'Ops',
        description: 'Manage reports',
        permissionIds: ['report.read', 'report.export'],
      },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'RBAC_ROLE_CREATE',
        targetType: 'RBAC_ROLE',
        targetId: ROLE_ID,
      }),
    );
    expect(result).toMatchObject({
      id: ROLE_ID,
      name: 'Ops',
      description: 'Manage reports',
      permissionIds: ['report.read', 'report.export'],
    });
  });

  it('updateRole validates roleId format and maps missing role', async () => {
    await expect(service.updateRole(USER_REQ, 'bad-role-id', {})).rejects.toBeInstanceOf(BadRequestException);

    prisma.rbacRole.findUnique.mockResolvedValueOnce(null);
    await expect(service.updateRole(USER_REQ, ROLE_ID, {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateRole validates strict patch fields', async () => {
    prisma.rbacRole.findUnique.mockResolvedValue({
      id: ROLE_ID,
      name: 'Old',
      description: null,
      permissionIds: ['report.read'],
      updatedAt: new Date('2026-03-12T00:00:00.000Z'),
    });

    await expect(service.updateRole(USER_REQ, ROLE_ID, { name: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateRole(USER_REQ, ROLE_ID, { permissionIds: ['no.permission'] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('updateRole persists normalized patch and writes audit log', async () => {
    prisma.rbacRole.findUnique.mockResolvedValueOnce({
      id: ROLE_ID,
      name: 'Ops',
      description: 'old',
      permissionIds: ['report.read'],
      updatedAt: new Date('2026-03-12T00:00:00.000Z'),
    });
    prisma.rbacRole.update.mockResolvedValueOnce({
      id: ROLE_ID,
      name: 'Ops Team',
      description: null,
      permissionIds: ['report.read', 'report.export'],
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });

    const result = await service.updateRole(USER_REQ, ROLE_ID, {
      name: '  Ops Team ',
      description: '',
      permissionIds: ['report.read', ' report.export ', 'report.read'],
    });

    expect(prisma.rbacRole.update).toHaveBeenCalledWith({
      where: { id: ROLE_ID },
      data: {
        name: 'Ops Team',
        description: null,
        permissionIds: ['report.read', 'report.export'],
      },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RBAC_ROLE_UPDATE',
        targetType: 'RBAC_ROLE',
        targetId: ROLE_ID,
      }),
    );
    expect(result).toMatchObject({
      id: ROLE_ID,
      name: 'Ops Team',
      permissionIds: ['report.read', 'report.export'],
    });
  });

  it('deleteRole forbids system role, maps missing role, and deletes via transaction', async () => {
    await expect(service.deleteRole(USER_REQ, 'role-admin')).rejects.toBeInstanceOf(ForbiddenException);

    prisma.rbacRole.findUnique.mockResolvedValueOnce(null);
    await expect(service.deleteRole(USER_REQ, ROLE_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.rbacRole.findUnique.mockResolvedValueOnce({
      id: ROLE_ID,
      name: 'Ops',
      description: null,
      permissionIds: ['report.read'],
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    prisma.rbacUserRole.deleteMany.mockReturnValueOnce('delete-user-roles');
    prisma.rbacRole.delete.mockReturnValueOnce('delete-role');

    const result = await service.deleteRole(USER_REQ, ROLE_ID);

    expect(prisma.$transaction).toHaveBeenCalledWith(['delete-user-roles', 'delete-role']);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RBAC_ROLE_DELETE',
        targetType: 'RBAC_ROLE',
        targetId: ROLE_ID,
      }),
    );
    expect(result).toEqual({ ok: true });
  });
});
