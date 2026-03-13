import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { requirePermission, resolvePermissions, resolvePermissionsFromRoleIds } from '../src/common/permissions';

describe('permissions utility suite', () => {
  it('resolves merged permissions from multiple role names', () => {
    const result = resolvePermissions(['operator', 'finance']);

    expect(result.has('config.manage')).toBe(true);
    expect(result.has('invoice.manage')).toBe(true);
    expect(result.has('verification.review')).toBe(true);
  });

  it('resolves permissions from role ids and ignores invalid permission arrays', () => {
    const result = resolvePermissionsFromRoleIds(
      ['r-1', 'r-2', 'r-missing'],
      [
        { id: 'r-1', permissionIds: ['p.read', 'p.write'] },
        { id: 'r-2', permissionIds: ['*', 123 as any, 'p.write'] as any },
        { id: 'r-3', permissionIds: 'not-array' as any },
      ],
    );

    expect(result.has('p.read')).toBe(true);
    expect(result.has('p.write')).toBe(true);
    expect(result.has('*')).toBe(true);
    expect(result.size).toBe(3);
  });

  it('allows request with wildcard permission', () => {
    const req = { auth: { permissions: new Set(['*']) } };
    expect(() => requirePermission(req, 'anything.permission')).not.toThrow();
  });

  it('throws forbidden when permission is missing', () => {
    const req = { auth: { permissions: new Set(['order.read']) } };
    expect(() => requirePermission(req, 'order.update')).toThrow(ForbiddenException);
  });
});
