import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { Prisma } from '@prisma/client';
import { AuditLogService } from '../../common/audit-log.service';
import { requirePermission } from '../../common/permissions';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  RBAC_CONFIG_KEY,
  SYSTEM_ROLE_IDS,
  buildDefaultRbacConfig,
  buildDefaultRbacRoles,
  type RbacConfig,
} from '../../common/rbac';

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

const PERMISSIONS: Permission[] = [
  { id: 'verification.read', name: 'Verification Read', description: 'View verification details' },
  { id: 'verification.review', name: 'Verification Review', description: 'Approve or reject verification' },
  { id: 'listing.read', name: 'Listing Read', description: 'View listing details' },
  { id: 'listing.audit', name: 'Listing Audit', description: 'Audit listing content' },
  { id: 'announcement.manage', name: 'Announcement Manage', description: 'Manage platform announcements' },
  { id: 'order.read', name: 'Order Read', description: 'View order details' },
  { id: 'case.manage', name: 'Case Manage', description: 'Create, assign, and track cases' },
  { id: 'maintenance.manage', name: 'Maintenance Manage', description: 'Manage patent maintenance schedules and tasks' },
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
  { id: 'refund.complete', name: 'Refund Complete', description: 'Complete refund requests' },
  { id: 'payment.manual.confirm', name: 'Payment Manual Confirm', description: 'Manually confirm payments' },
  { id: 'settlement.read', name: 'Settlement Read', description: 'View settlement statements' },
  { id: 'payout.manual.confirm', name: 'Payout Manual Confirm', description: 'Manually confirm payout' },
  { id: 'invoice.manage', name: 'Invoice Manage', description: 'Upload, replace, or remove invoices' },
  { id: 'config.manage', name: 'Config Manage', description: 'Manage system configuration' },
  { id: 'report.read', name: 'Report Read', description: 'View reports' },
  { id: 'report.export', name: 'Report Export', description: 'Export reports' },
  { id: 'alert.manage', name: 'Alert Manage', description: 'Manage alert events and acknowledgements' },
  { id: 'rbac.manage', name: 'RBAC Manage', description: 'Manage users and roles' },
  { id: 'auditLog.read', name: 'Audit Log Read', description: 'View audit logs' },
];

const PERMISSION_ID_SET = new Set([...PERMISSIONS.map((item) => item.id), '*']);
const SYSTEM_ROLE_ID_SET = new Set(Object.values(SYSTEM_ROLE_IDS));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class RbacService {
  private seeded = false;

  constructor(private readonly audit: AuditLogService, private readonly prisma: PrismaService) {}

  private ensureAuth(request: any) {
    if (!request?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }

  private normalizePermissionIds(input: any): string[] {
    if (!Array.isArray(input)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of input) {
      const id = String(raw || '').trim();
      if (!id) continue;
      if (!PERMISSION_ID_SET.has(id)) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: `Unknown permission: ${id}` });
      }
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    return out;
  }

  private parseUuidParam(value: string, field: string): string {
    const raw = String(value || '').trim();
    if (!raw || !UUID_RE.test(raw)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `${field} must be a valid UUID`,
      });
    }
    return raw;
  }

  private parseRoleIdParam(roleId: string): string {
    const raw = String(roleId || '').trim();
    if (!raw) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'roleId must be a valid UUID',
      });
    }
    if (SYSTEM_ROLE_ID_SET.has(raw)) return raw;
    if (!UUID_RE.test(raw)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'roleId must be a valid UUID',
      });
    }
    return raw;
  }

  private toRoleDto(role: any): Role {
    const permissionIds = Array.isArray(role.permissionIds) ? role.permissionIds : [];
    return {
      id: role.id,
      name: role.name,
      description: role.description ?? undefined,
      permissionIds,
      updatedAt: role.updatedAt ? role.updatedAt.toISOString() : undefined,
    };
  }

  private async ensureSeeded() {
    if (this.seeded) return;
    const existing = await this.prisma.rbacRole.count();
    if (existing > 0) {
      this.seeded = true;
      return;
    }

    let seedConfig: RbacConfig | null = null;
    const configRow = await this.prisma.systemConfig.findUnique({ where: { key: RBAC_CONFIG_KEY } });
    if (configRow?.value) {
      try {
        const parsed = JSON.parse(configRow.value) as RbacConfig;
        if (parsed && Array.isArray(parsed.roles)) seedConfig = parsed;
      } catch {
        seedConfig = null;
      }
    }

    if (!seedConfig) seedConfig = buildDefaultRbacConfig();
    const roles = Array.isArray(seedConfig.roles) && seedConfig.roles.length ? seedConfig.roles : buildDefaultRbacRoles();
    const now = new Date();

    await this.prisma.rbacRole.createMany({
      data: roles.map((role) => {
        const updatedAt = role.updatedAt ? new Date(role.updatedAt) : now;
        const normalizedUpdatedAt = Number.isNaN(updatedAt.getTime()) ? now : updatedAt;
        return {
          id: role.id || randomUUID(),
          name: role.name || 'Role',
          description: role.description ?? null,
          permissionIds: Array.isArray(role.permissionIds) ? role.permissionIds : [],
          createdAt: now,
          updatedAt: normalizedUpdatedAt,
        };
      }),
      skipDuplicates: true,
    });

    const userRoles = seedConfig.userRoles || {};
    const userIds = Object.keys(userRoles);
    if (userIds.length) {
      const existingUsers = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true },
      });
      const existingUserSet = new Set(existingUsers.map((item) => item.id));
      const roleIdSet = new Set(roles.map((item) => item.id));
      const assignments: Array<{ userId: string; roleId: string; createdAt: Date }> = [];

      for (const [userId, roleIds] of Object.entries(userRoles)) {
        if (!existingUserSet.has(userId)) continue;
        if (!Array.isArray(roleIds)) continue;
        for (const roleId of roleIds) {
          const normalized = String(roleId || '').trim();
          if (!normalized || !roleIdSet.has(normalized)) continue;
          assignments.push({ userId, roleId: normalized, createdAt: now });
        }
      }

      if (assignments.length) {
        await this.prisma.rbacUserRole.createMany({ data: assignments, skipDuplicates: true });
      }
    }

    this.seeded = true;
  }

  async listRoles(request: any) {
    this.ensureAuth(request);
    requirePermission(request, 'rbac.manage');
    await this.ensureSeeded();

    const roles = await this.prisma.rbacRole.findMany({ orderBy: { updatedAt: 'desc' } });
    return { items: roles.map((role) => this.toRoleDto(role)) };
  }

  async createRole(request: any, payload: any) {
    this.ensureAuth(request);
    requirePermission(request, 'rbac.manage');
    await this.ensureSeeded();

    const name = String(payload?.name || '').trim();
    if (!name) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'name is required' });

    const permissionIds = this.normalizePermissionIds(payload?.permissionIds);
    const newRole: Role = {
      id: randomUUID(),
      name,
      description: payload?.description ? String(payload.description).trim() : undefined,
      permissionIds,
    };

    const created = await this.prisma.rbacRole.create({
      data: {
        id: newRole.id,
        name: newRole.name,
        description: newRole.description ?? null,
        permissionIds: newRole.permissionIds,
      },
    });

    void this.audit.log({
      actorUserId: request.auth.userId,
      action: 'RBAC_ROLE_CREATE',
      targetType: 'RBAC_ROLE',
      targetId: created.id,
      afterJson: newRole,
    });

    return this.toRoleDto(created);
  }

  async updateRole(request: any, roleId: string, payload: any) {
    this.ensureAuth(request);
    requirePermission(request, 'rbac.manage');
    await this.ensureSeeded();
    const normalizedRoleId = this.parseRoleIdParam(roleId);

    const existing = await this.prisma.rbacRole.findUnique({ where: { id: normalizedRoleId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found' });

    const next: any = {};
    if (payload?.name !== undefined) {
      const name = String(payload.name || '').trim();
      if (!name) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'name is required' });
      next.name = name;
    }
    if (payload?.description !== undefined) {
      next.description = payload.description ? String(payload.description).trim() : null;
    }
    if (payload?.permissionIds !== undefined) {
      next.permissionIds = this.normalizePermissionIds(payload.permissionIds);
    }

    const updated = await this.prisma.rbacRole.update({ where: { id: normalizedRoleId }, data: next });

    void this.audit.log({
      actorUserId: request.auth.userId,
      action: 'RBAC_ROLE_UPDATE',
      targetType: 'RBAC_ROLE',
      targetId: normalizedRoleId,
      beforeJson: this.toRoleDto(existing),
      afterJson: this.toRoleDto(updated),
    });

    return this.toRoleDto(updated);
  }

  async deleteRole(request: any, roleId: string) {
    this.ensureAuth(request);
    requirePermission(request, 'rbac.manage');
    await this.ensureSeeded();
    const normalizedRoleId = this.parseRoleIdParam(roleId);

    if (SYSTEM_ROLE_ID_SET.has(normalizedRoleId)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'System role cannot be deleted' });
    }

    const existing = await this.prisma.rbacRole.findUnique({ where: { id: normalizedRoleId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found' });

    await this.prisma.$transaction([
      this.prisma.rbacUserRole.deleteMany({ where: { roleId: normalizedRoleId } }),
      this.prisma.rbacRole.delete({ where: { id: normalizedRoleId } }),
    ]);

    void this.audit.log({
      actorUserId: request.auth.userId,
      action: 'RBAC_ROLE_DELETE',
      targetType: 'RBAC_ROLE',
      targetId: normalizedRoleId,
      beforeJson: this.toRoleDto(existing),
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
    await this.ensureSeeded();

    const userRecords = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: { rbacRoles: true },
    });

    const items: UserRole[] = userRecords.map((userRecord: any) => {
      const assignedRoleIds = (userRecord.rbacRoles || []).map((item: any) => item.roleId);
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
    await this.ensureSeeded();
    const normalizedUserId = this.parseUuidParam(userId, 'userId');

    const userRecord = await this.prisma.user.findUnique({ where: { id: normalizedUserId } });
    if (!userRecord) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Account not found' });

    if (!Array.isArray(payload?.roleIds)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'roleIds is required' });
    }

    const normalizedRoleIds = Array.from(
      new Set<string>(
        (payload.roleIds as Array<unknown>)
          .map((id) => String(id || '').trim())
          .filter((id): id is string => id.length > 0),
      ),
    );

    if (normalizedRoleIds.length) {
      const existingRoles = await this.prisma.rbacRole.findMany({
        where: { id: { in: normalizedRoleIds } },
        select: { id: true },
      });
      const existingSet = new Set(existingRoles.map((item) => item.id));
      const missing = normalizedRoleIds.filter((id) => !existingSet.has(id));
      if (missing.length) {
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message: `Unknown roleIds: ${missing.join(', ')}`,
        });
      }
    }

    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.rbacUserRole.deleteMany({ where: { userId: normalizedUserId } }),
    ];
    if (normalizedRoleIds.length) {
      operations.push(
        this.prisma.rbacUserRole.createMany({
          data: normalizedRoleIds.map((roleId) => ({ userId: normalizedUserId, roleId })),
        }),
      );
    }
    await this.prisma.$transaction(operations);

    void this.audit.log({
      actorUserId: request.auth.userId,
      action: 'RBAC_USER_UPDATE',
      targetType: 'RBAC_USER',
      targetId: normalizedUserId,
      beforeJson: { id: userRecord.id },
      afterJson: { id: normalizedUserId, roleIds: normalizedRoleIds },
    });

    return {
      id: userRecord.id,
      name: userRecord.nickname || userRecord.phone || userRecord.id,
      email: userRecord.phone || undefined,
      roleIds: normalizedRoleIds,
    };
  }
}
