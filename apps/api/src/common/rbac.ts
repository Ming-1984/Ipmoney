import type { AdminRoleName } from './permissions';

export type RbacRole = {
  id: string;
  name: string;
  description?: string;
  permissionIds: string[];
  updatedAt?: string;
};

export type RbacConfig = {
  roles: RbacRole[];
  userRoles?: Record<string, string[]>;
};

export const RBAC_CONFIG_KEY = 'rbac_config';

export const SYSTEM_ROLE_IDS: Record<AdminRoleName, string> = {
  admin: 'role-admin',
  operator: 'role-operator',
  cs: 'role-cs',
  finance: 'role-finance',
};

export const ROLE_ID_TO_NAME = Object.fromEntries(
  Object.entries(SYSTEM_ROLE_IDS).map(([name, id]) => [id, name]),
) as Record<string, AdminRoleName>;

export function buildDefaultRbacRoles(now = new Date()): RbacRole[] {
  const updatedAt = now.toISOString();
  return [
    {
      id: SYSTEM_ROLE_IDS.operator,
      name: '运营',
      description: '内容审核与配置',
      permissionIds: [
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
      updatedAt,
    },
    {
      id: SYSTEM_ROLE_IDS.cs,
      name: '客服',
      description: '跟单与工单处理',
      permissionIds: [
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
      updatedAt,
    },
    {
      id: SYSTEM_ROLE_IDS.finance,
      name: '财务',
      description: '结算与发票',
      permissionIds: [
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
      updatedAt,
    },
    {
      id: SYSTEM_ROLE_IDS.admin,
      name: '管理员',
      description: '全权限',
      permissionIds: ['*'],
      updatedAt,
    },
  ];
}

export function buildDefaultRbacConfig(now = new Date()): RbacConfig {
  return { roles: buildDefaultRbacRoles(now), userRoles: {} };
}
