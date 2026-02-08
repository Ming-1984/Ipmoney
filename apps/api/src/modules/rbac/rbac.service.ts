import { ForbiddenException, NotFoundException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { AuditLogService } from '../../common/audit-log.service';
import { requirePermission } from '../../common/permissions';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBAC_CONFIG_KEY, SYSTEM_ROLE_IDS, buildDefaultRbacConfig, type RbacConfig } from '../../common/rbac';

type Permission = {
  id: string;
  name: string;
  description?: string;
};

type Role = {
  id: string;
  name: string;
  description?: string;
  permissionIds: string[];
  updatedAt?: string;
};

type UserRole = {
  id: string;
  name: string;
  email?: string;
  roleIds: string[];
};

const SYSTEM_CONFIG_SCOPE = {
  GLOBAL: 'GLOBAL',
} as const;

const SYSTEM_CONFIG_VALUE_TYPE = {
  JSON: 'JSON',
} as const;

const PERMISSIONS: Permission[] = [
  { id: 'verification.read', name: 'Verification Read', description: 'View verification details' },
  { id: 'verification.review', name: 'Verification Review', description: 'Approve or reject verification' },
  { id: 'listing.read', name: 'Listing Read', description: 'View listing details' },
  { id: 'listing.audit', name: 'Listing Audit', description: 'Audit listing content' },
  { id: 'order.read', name: 'Order Read', description: 'View order details' },
  { id: 'case.manage', name: 'Case Manage', description: 'Create, assign, and track cases' },
  {
    id: 'milestone.contractSigned.confirm',
    name: 'Contract Signed Confirm',
    description: 'Confirm contract signing',
  },
  {
    id: 'milestone.transferCompleted.confirm',
    name: 'Transfer Completed Confirm',
    description: 'Confirm ownership transfer completion',
  },
  { id: 'refund.read', name: 'Refund Read', description: 'View refund requests' },
  { id: 'refund.approve', name: 'Refund Approve', description: 'Approve refund requests' },
  { id: 'refund.reject', name: 'Refund Reject', description: 'Reject refund requests' },
  { id: 'settlement.read', name: 'Settlement Read', description: 'View settlement statements' },
  { id: 'payout.manual.confirm', name: 'Payout Manual Confirm', description: 'Manually confirm payout' },
  { id: 'invoice.manage', name: 'Invoice Manage', description: 'Upload, replace, or remove invoices' },
  { id: 'config.manage', name: 'Config Manage', description: 'Manage system configuration' },
  { id: 'report.read', name: 'Report Read', description: 'View reports' },
  { id: 'report.export', name: 'Report Export', description: 'Export reports' },
  { id: 'rbac.manage', name: 'RBAC Manage', description: 'Manage users and roles' },
  { id: 'auditLog.read', name: 'Audit Log Read', description: 'View audit logs' },
];

@Injectable()
export class RbacService {
  constructor(private readonly audit: AuditLogService, private readonly prisma: PrismaService) {}
  private ensureAuth(request: any) {
    if (!request?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }

  private async loadConfig(): Promise<RbacConfig> {
    const configRow = await this.prisma.systemConfig.findUnique({ where: { key: RBAC_CONFIG_KEY } });
    if (!configRow) {
      const defaultConfig = buildDefaultRbacConfig();
      await this.prisma.systemConfig.create({
        data: {
          key: RBAC_CONFIG_KEY,
          valueType: SYSTEM_CONFIG_VALUE_TYPE.JSON,
          scope: SYSTEM_CONFIG_SCOPE.GLOBAL,
          value: JSON.stringify(defaultConfig),
          version: 1,
        },
      });
      return defaultConfig;
    }

    try {
      const parsedConfig = JSON.parse(configRow.value) as RbacConfig;
      const roleList =
        Array.isArray(parsedConfig?.roles) && parsedConfig.roles.length
          ? parsedConfig.roles
          : buildDefaultRbacConfig().roles;
      const userRoleMap =
        parsedConfig?.userRoles && typeof parsedConfig.userRoles === 'object' ? parsedConfig.userRoles : {};
      return { roles: roleList, userRoles: userRoleMap };
    } catch {
      return buildDefaultRbacConfig();
    }
  }

  private async saveConfig(nextConfig: RbacConfig) {
    const configRow = await this.prisma.systemConfig.findUnique({ where: { key: RBAC_CONFIG_KEY } });
    if (!configRow) {
      await this.prisma.systemConfig.create({
        data: {
          key: RBAC_CONFIG_KEY,
          valueType: SYSTEM_CONFIG_VALUE_TYPE.JSON,
          scope: SYSTEM_CONFIG_SCOPE.GLOBAL,
          value: JSON.stringify(nextConfig),
          version: 1,
        },
      });
      return;
    }
    await this.prisma.systemConfig.update({
      where: { key: RBAC_CONFIG_KEY },
      data: {
        valueType: SYSTEM_CONFIG_VALUE_TYPE.JSON,
        scope: SYSTEM_CONFIG_SCOPE.GLOBAL,
        value: JSON.stringify(nextConfig),
        version: configRow.version + 1,
      },
    });
  }

  async listRoles(request: any) {
    this.ensureAuth(request);
    requirePermission(request, 'rbac.manage');
    const config = await this.loadConfig();
    return { items: config.roles };
  }

  async createRole(request: any, payload: any) {
    this.ensureAuth(request);
    requirePermission(request, 'rbac.manage');
    const config = await this.loadConfig();
    const newRole: Role = {
      id: randomUUID(),
      name: String(payload?.name || '未命名角色'),
      description: payload?.description,
      permissionIds: Array.isArray(payload?.permissionIds) ? payload.permissionIds : [],
      updatedAt: new Date().toISOString(),
    };
    config.roles.unshift(newRole);
    await this.saveConfig(config);
    void this.audit.log({
      actorUserId: request.auth.userId,
      action: 'RBAC_ROLE_CREATE',
      targetType: 'RBAC_ROLE',
      targetId: newRole.id,
      afterJson: newRole,
    });
    return newRole;
  }

  async updateRole(request: any, roleId: string, payload: any) {
    this.ensureAuth(request);
    requirePermission(request, 'rbac.manage');
    const config = await this.loadConfig();
    const targetRole = config.roles.find((roleItem: Role) => roleItem.id === roleId);
    if (!targetRole) throw new NotFoundException({ code: 'NOT_FOUND', message: '角色不存在' });
    const beforeSnapshot = { ...targetRole };
    if (payload?.name) targetRole.name = payload.name;
    if (payload?.description !== undefined) targetRole.description = payload.description;
    if (Array.isArray(payload?.permissionIds)) targetRole.permissionIds = payload.permissionIds;
    targetRole.updatedAt = new Date().toISOString();
    await this.saveConfig(config);
    void this.audit.log({
      actorUserId: request.auth.userId,
      action: 'RBAC_ROLE_UPDATE',
      targetType: 'RBAC_ROLE',
      targetId: targetRole.id,
      beforeJson: beforeSnapshot,
      afterJson: targetRole,
    });
    return targetRole;
  }

  async deleteRole(request: any, roleId: string) {
    this.ensureAuth(request);
    requirePermission(request, 'rbac.manage');
    const config = await this.loadConfig();
    const roleIndex = config.roles.findIndex((roleItem: Role) => roleItem.id === roleId);
    if (roleIndex < 0) throw new NotFoundException({ code: 'NOT_FOUND', message: '角色不存在' });
    const [removedRole] = config.roles.splice(roleIndex, 1);
    if (config.userRoles) {
      Object.keys(config.userRoles).forEach((userId) => {
        config.userRoles![userId] = config.userRoles![userId].filter(
          (assignedRoleId) => assignedRoleId !== roleId,
        );
      });
    }
    await this.saveConfig(config);
    void this.audit.log({
      actorUserId: request.auth.userId,
      action: 'RBAC_ROLE_DELETE',
      targetType: 'RBAC_ROLE',
      targetId: roleId,
      beforeJson: removedRole,
    });
    return { ok: true };
  }

  async listPermissions(request: any) {
    this.ensureAuth(request);
    requirePermission(request, 'rbac.manage');
    return { items: PERMISSIONS };
  }

  async listUsers(request: any) {
    this.ensureAuth(request);
    requirePermission(request, 'rbac.manage');
    const config = await this.loadConfig();
    const userRecords = await this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    const items: UserRole[] = userRecords.map((userRecord: any) => {
      const assignedRoleIds = config.userRoles?.[userRecord.id] ?? [];
      let effectiveRoleIds = assignedRoleIds;
      if (!effectiveRoleIds.length) {
        const fallbackRoleId = SYSTEM_ROLE_IDS[userRecord.role as keyof typeof SYSTEM_ROLE_IDS];
        effectiveRoleIds = fallbackRoleId ? [fallbackRoleId] : [];
      }
      return {
        id: userRecord.id,
        name: userRecord.nickname || userRecord.phone || userRecord.id,
        email: userRecord.phone || undefined,
        roleIds: effectiveRoleIds,
      };
    });
    return { items };
  }

  async updateUserRoles(request: any, userId: string, payload: any) {
    this.ensureAuth(request);
    requirePermission(request, 'rbac.manage');
    const userRecord = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!userRecord) throw new NotFoundException({ code: 'NOT_FOUND', message: '账号不存在' });
    const config = await this.loadConfig();
    const beforeSnapshot = { id: userRecord.id, roleIds: config.userRoles?.[userId] ?? [] };
    if (Array.isArray(payload?.roleIds)) {
      config.userRoles = config.userRoles || {};
      config.userRoles[userId] = payload.roleIds;
      await this.saveConfig(config);
    }
    void this.audit.log({
      actorUserId: request.auth.userId,
      action: 'RBAC_USER_UPDATE',
      targetType: 'RBAC_USER',
      targetId: userId,
      beforeJson: beforeSnapshot,
      afterJson: { id: userId, roleIds: config.userRoles?.[userId] ?? [] },
    });
    return {
      id: userRecord.id,
      name: userRecord.nickname || userRecord.phone || userRecord.id,
      email: userRecord.phone || undefined,
      roleIds: config.userRoles?.[userId] ?? [],
    };
  }
}
