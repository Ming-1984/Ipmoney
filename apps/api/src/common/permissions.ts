import { ForbiddenException } from '@nestjs/common';

export type AdminRoleName = 'admin' | 'cs' | 'operator' | 'finance';

const IMPLIED_PERMISSION_IDS: Record<string, string[]> = {
  'conversation.platform.manage': ['conversation.platform.reply'],
};

function addPermission(out: Set<string>, permission: string) {
  if (out.has(permission)) return;
  out.add(permission);
  (IMPLIED_PERMISSION_IDS[permission] || []).forEach((implied) => addPermission(out, implied));
}

export const ADMIN_ROLE_PERMISSIONS: Record<AdminRoleName, string[]> = {
  admin: ['*'],
  operator: [
    'verification.read',
    'verification.review',
    'listing.read',
    'listing.audit',
    'listing.batchPublish',
    'listing.import',
    'patent.import',
    'patent.claim.review',
    'conversation.platform.manage',
    'order.read',
    'case.manage',
    'maintenance.manage',
    'refund.read',
    'refund.approve',
    'refund.reject',
    'settlement.read',
    'config.manage',
    'report.read',
    'report.export',
    'alert.manage',
    'ops.notification.read',
    'auditLog.read',
  ],
  cs: [
    'verification.read',
    'listing.read',
    'conversation.platform.reply',
    'order.read',
    'case.manage',
    'maintenance.manage',
    'milestone.contractSigned.confirm',
    'milestone.transferCompleted.confirm',
    'refund.read',
    'settlement.read',
    'ops.notification.read',
    'auditLog.read',
  ],
  finance: [
    'verification.read',
    'order.read',
    'refund.read',
    'refund.approve',
    'refund.reject',
    'refund.complete',
    'payment.manual.confirm',
    'settlement.read',
    'payout.manual.confirm',
    'invoice.manage',
    'report.read',
    'report.export',
    'alert.manage',
    'ops.notification.read',
    'auditLog.read',
  ],
};

export function resolvePermissions(roleNames: AdminRoleName[]) {
  const out = new Set<string>();
  roleNames.forEach((r) => {
    (ADMIN_ROLE_PERMISSIONS[r] || []).forEach((p) => addPermission(out, p));
  });
  return out;
}

export function resolvePermissionsFromRoleIds(
  roleIds: string[],
  roles: Array<{ id: string; permissionIds?: unknown }>,
) {
  const out = new Set<string>();
  const roleMap = new Map<string, string[]>();
  roles.forEach((role) => {
    if (role?.id) {
      const raw = role.permissionIds;
      const normalized = Array.isArray(raw)
        ? raw.filter((item): item is string => typeof item === 'string')
        : [];
      roleMap.set(role.id, normalized);
    }
  });

  roleIds.forEach((id) => {
    const perms = roleMap.get(id) || [];
    perms.forEach((p) => addPermission(out, p));
  });

  return out;
}

export function hasPermission(req: any, permission: string) {
  const perms: Set<string> | undefined = req?.auth?.permissions;
  if (!perms) return false;
  if (perms.has('*') || perms.has(permission)) return true;
  for (const sourcePermission of perms) {
    if ((IMPLIED_PERMISSION_IDS[sourcePermission] || []).includes(permission)) return true;
  }
  return false;
}

export function requirePermission(req: any, permission: string) {
  if (!hasPermission(req, permission)) {
    throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }
}
