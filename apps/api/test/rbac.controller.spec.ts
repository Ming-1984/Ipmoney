import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RbacController } from '../src/modules/rbac/rbac.controller';

const VALID_UUID = '88888888-8888-4888-8888-888888888888';

describe('RbacController delegation suite', () => {
  let rbac: any;
  let controller: RbacController;

  beforeEach(() => {
    rbac = {
      listRoles: vi.fn(),
      createRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
      listPermissions: vi.fn(),
      listUsers: vi.fn(),
      updateUserRoles: vi.fn(),
    };
    controller = new RbacController(rbac);
  });

  it('delegates listRoles with request context', async () => {
    const req: any = { auth: { userId: 'admin-1' } };
    rbac.listRoles.mockResolvedValueOnce({ items: [{ id: 'role-1' }] });

    await expect(controller.listRoles(req)).resolves.toEqual({ items: [{ id: 'role-1' }] });

    expect(rbac.listRoles).toHaveBeenCalledWith(req);
  });

  it('delegates createRole with fallback empty body', async () => {
    const req: any = { auth: { userId: 'admin-1' } };
    rbac.createRole.mockResolvedValueOnce({ id: 'role-1' });

    await expect(controller.createRole(req, undefined as any)).resolves.toEqual({ id: 'role-1' });

    expect(rbac.createRole).toHaveBeenCalledWith(req, {});
  });

  it('delegates updateRole with fallback empty body', async () => {
    const req: any = { auth: { userId: 'admin-1' } };
    rbac.updateRole.mockResolvedValueOnce({ id: 'role-1', ok: true });

    await expect(controller.updateRole(req, 'role-1', null as any)).resolves.toEqual({ id: 'role-1', ok: true });

    expect(rbac.updateRole).toHaveBeenCalledWith(req, 'role-1', {});
  });

  it('delegates deleteRole with path roleId', async () => {
    const req: any = { auth: { userId: 'admin-1' } };
    rbac.deleteRole.mockResolvedValueOnce({ ok: true });

    await expect(controller.deleteRole(req, 'role-1')).resolves.toEqual({ ok: true });

    expect(rbac.deleteRole).toHaveBeenCalledWith(req, 'role-1');
  });

  it('delegates listPermissions and listUsers with request context', async () => {
    const req: any = { auth: { userId: 'admin-1' } };
    rbac.listPermissions.mockResolvedValueOnce({ items: [{ id: 'perm-1' }] });
    rbac.listUsers.mockResolvedValueOnce({ items: [{ id: VALID_UUID }] });

    await expect(controller.listPermissions(req)).resolves.toEqual({ items: [{ id: 'perm-1' }] });
    await expect(controller.listUsers(req)).resolves.toEqual({ items: [{ id: VALID_UUID }] });

    expect(rbac.listPermissions).toHaveBeenCalledWith(req);
    expect(rbac.listUsers).toHaveBeenCalledWith(req);
  });

  it('delegates updateUserRoles with fallback empty body', async () => {
    const req: any = { auth: { userId: 'admin-1' } };
    rbac.updateUserRoles.mockResolvedValueOnce({ id: VALID_UUID, roleIds: [] });

    await expect(controller.updateUserRoles(req, VALID_UUID, undefined as any)).resolves.toEqual({
      id: VALID_UUID,
      roleIds: [],
    });

    expect(rbac.updateUserRoles).toHaveBeenCalledWith(req, VALID_UUID, {});
  });
});
