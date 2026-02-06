export type AdminRoleName = 'admin' | 'cs' | 'operator' | 'finance';

export const ADMIN_ROLE_PERMISSIONS: Record<AdminRoleName, string[]> = {
  admin: ['*'],
  operator: ['verification.read', 'verification.review', 'listing.read', 'listing.audit', 'order.read', 'report.read', 'config.manage'],
  cs: ['order.read', 'case.manage', 'milestone.contractSigned.confirm', 'milestone.transferCompleted.confirm'],
  finance: ['settlement.read', 'payout.manual.confirm', 'invoice.manage', 'report.read', 'report.export'],
};

export function resolvePermissions(roleNames: AdminRoleName[]) {
  const out = new Set<string>();
  roleNames.forEach((r) => {
    (ADMIN_ROLE_PERMISSIONS[r] || []).forEach((p) => out.add(p));
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
