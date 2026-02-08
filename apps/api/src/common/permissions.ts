export type AdminRoleName = 'admin' | 'cs' | 'operator' | 'finance';

export const ADMIN_ROLE_PERMISSIONS: Record<AdminRoleName, string[]> = {
  admin: ['*'],
  operator: [
    'verification.read',
    'verification.review',
    'listing.read',
    'listing.audit',
    'order.read',
    'case.manage',
    'refund.read',
    'refund.approve',
    'refund.reject',
    'settlement.read',
    'config.manage',
    'report.read',
    'report.export',
    'auditLog.read',
  ],
  cs: [
    'verification.read',
    'listing.read',
    'order.read',
    'case.manage',
    'milestone.contractSigned.confirm',
    'milestone.transferCompleted.confirm',
    'refund.read',
    'settlement.read',
    'auditLog.read',
  ],
  finance: [
    'verification.read',
    'order.read',
    'refund.read',
    'refund.approve',
    'refund.reject',
    'settlement.read',
    'payout.manual.confirm',
    'invoice.manage',
    'report.read',
    'report.export',
    'auditLog.read',
  ],
};

export function resolvePermissions(roleNames: AdminRoleName[]) {
  const out = new Set<string>();
  roleNames.forEach((r) => {
    (ADMIN_ROLE_PERMISSIONS[r] || []).forEach((p) => out.add(p));
  });
  return out;
}

export function resolvePermissionsFromRoleIds(
  roleIds: string[],
  roles: Array<{ id: string; permissionIds?: string[] | null }>,
) {
  const out = new Set<string>();
  const roleMap = new Map<string, string[]>();
  roles.forEach((role) => {
    if (role?.id) {
      roleMap.set(role.id, Array.isArray(role.permissionIds) ? role.permissionIds : []);
    }
  });

  roleIds.forEach((id) => {
    const perms = roleMap.get(id) || [];
    perms.forEach((p) => out.add(p));
  });

  return out;
}

export function requirePermission(req: any, permission: string) {
  const perms: Set<string> | undefined = req?.auth?.permissions;
  if (!perms || (!perms.has('*') && !perms.has(permission))) {
    const err: any = new Error('FORBIDDEN_PERMISSION');
    err.status = 403;
    err.code = 'FORBIDDEN';
    err.message = '无权限';
    throw err;
  }
}
