import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

type UserListScope = 'ALL' | 'STAFF';

const PERMISSIONS: Permission[] = [
  { id: 'verification.read', name: '认证查看', description: '查看认证资料' },
  { id: 'verification.review', name: '认证审核', description: '通过或驳回认证' },
  { id: 'listing.read', name: '挂牌查看', description: '查看挂牌详情' },
  { id: 'listing.audit', name: '挂牌审核', description: '审核挂牌内容' },
  { id: 'listing.batchPublish', name: '挂牌批量发布', description: '执行挂牌批量操作任务' },
  { id: 'listing.import', name: '挂牌导入', description: '执行挂牌导入任务' },
  { id: 'patent.import', name: '专利导入', description: '执行专利导入与挂牌生成任务' },
  { id: 'patent.claim.review', name: '专利认领审核', description: '审核并处理专利权属认领' },
  { id: 'conversation.platform.manage', name: '平台会话调度', description: '查看平台会话池并分配客服' },
  { id: 'order.read', name: '订单查看', description: '查看订单详情' },
  { id: 'case.manage', name: '工单管理', description: '创建、分派和跟踪工单' },
  { id: 'maintenance.manage', name: '年费托管管理', description: '管理专利年费托管排期与任务' },
  {
    id: 'milestone.contractSigned.confirm',
    name: '合同签署确认',
    description: '确认订单合同已签署',
  },
  {
    id: 'milestone.transferCompleted.confirm',
    name: '权属变更完成确认',
    description: '确认权属变更已完成',
  },
  { id: 'refund.read', name: '退款查看', description: '查看退款申请' },
  { id: 'refund.approve', name: '退款通过', description: '通过退款申请' },
  { id: 'refund.reject', name: '退款驳回', description: '驳回退款申请' },
  { id: 'refund.complete', name: '退款完成', description: '确认退款已完成' },
  { id: 'payment.manual.confirm', name: '手工确认付款', description: '手工确认订金或尾款到账' },
  { id: 'settlement.read', name: '结算查看', description: '查看结算台账' },
  { id: 'payout.manual.confirm', name: '手工确认放款', description: '手工确认结算放款' },
  { id: 'invoice.manage', name: '发票管理', description: '上传、替换或删除发票' },
  { id: 'config.manage', name: '系统配置管理', description: '管理系统配置' },
  { id: 'report.read', name: '报表查看', description: '查看报表' },
  { id: 'report.export', name: '报表导出', description: '导出报表' },
  { id: 'alert.manage', name: '告警管理', description: '管理告警事件与确认状态' },
  { id: 'rbac.manage', name: '账号权限管理', description: '管理用户与角色' },
  { id: 'auditLog.read', name: '审计日志查看', description: '查看审计日志' },
];

const PERMISSION_ID_SET = new Set([...PERMISSIONS.map((item) => item.id), '*']);
const SYSTEM_ROLE_ID_SET = new Set(Object.values(SYSTEM_ROLE_IDS));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_RE = /^[0-9]{6,20}$/;
const STAFF_ROLE_NAMES = new Set(['admin', 'operator', 'finance', 'cs']);

@Injectable()
export class RbacService {
  private seeded = false;

  constructor(private readonly audit: AuditLogService, private readonly prisma: PrismaService) {}

  private ensureAuth(request: any) {
    if (!request?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }

  private hasPermission(request: any, permission: string): boolean {
    const perms: Set<string> | undefined = request?.auth?.permissions;
    return !!perms && (perms.has('*') || perms.has(permission));
  }

  private hasOwn(input: any, key: string) {
    return !!input && Object.prototype.hasOwnProperty.call(input, key);
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

  private parsePhoneStrict(value: unknown, fieldName: string): string {
    const raw = String(value || '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is required` });
    }
    if (!PHONE_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseDisplayNameStrict(value: unknown, fieldName: string): string {
    const raw = String(value || '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is required` });
    }
    if (raw.length > 64) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is too long` });
    }
    return raw;
  }

  private parseRoleIdsStrict(input: unknown, fieldName: string): string[] {
    if (!Array.isArray(input) || input.length === 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is required` });
    }
    const roleIds = Array.from(
      new Set(
        input
          .map((item) => String(item || '').trim())
          .filter((item) => Boolean(item)),
      ),
    );
    if (!roleIds.length) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is required` });
    }
    return roleIds;
  }

  private parseUserListScopeStrict(value: unknown, fieldName: string): UserListScope {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'ALL' || normalized === 'STAFF') {
      return normalized as UserListScope;
    }
    throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
  }

  private deriveUserRole(roleIds: string[]): 'admin' | 'operator' | 'finance' | 'cs' {
    if (roleIds.includes(SYSTEM_ROLE_IDS.admin)) return 'admin';
    if (roleIds.includes(SYSTEM_ROLE_IDS.finance)) return 'finance';
    if (roleIds.includes(SYSTEM_ROLE_IDS.cs)) return 'cs';
    return 'operator';
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
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '系统角色不可删除，请改为编辑权限或名称' });
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

  async listUsers(request: any, query: any = {}) {
    this.ensureAuth(request);
    await this.ensureSeeded();

    const scope = this.hasOwn(query, 'scope') ? this.parseUserListScopeStrict(query?.scope, 'scope') : 'STAFF';
    if (
      !this.hasPermission(request, 'rbac.manage') &&
      !(scope === 'STAFF' && (this.hasPermission(request, 'conversation.platform.manage') || this.hasPermission(request, 'maintenance.manage')))
    ) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
    const q = String(query?.q || '').trim();
    const where: Prisma.UserWhereInput = {};
    const andFilters: Prisma.UserWhereInput[] = [];
    if (scope === 'STAFF') {
      andFilters.push({
        OR: [{ role: { in: Array.from(STAFF_ROLE_NAMES) as any } }, { rbacRoles: { some: {} } }],
      });
    }
    if (q) {
      const qOrFilters: Prisma.UserWhereInput[] = [
        { phone: { contains: q, mode: 'insensitive' } },
        { nickname: { contains: q, mode: 'insensitive' } },
      ];
      if (UUID_RE.test(q)) {
        qOrFilters.push({ id: q });
      }
      andFilters.push({
        OR: qOrFilters,
      });
    }
    if (andFilters.length) {
      where.AND = andFilters;
    }

    const userRecords = await this.prisma.user.findMany({
      where,
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

  async createUser(request: any, payload: any) {
    this.ensureAuth(request);
    requirePermission(request, 'rbac.manage');
    await this.ensureSeeded();

    const phone = this.parsePhoneStrict(payload?.phone, 'phone');
    const name = this.parseDisplayNameStrict(payload?.name, 'name');
    const roleIds = this.parseRoleIdsStrict(payload?.roleIds, 'roleIds');

    const existingRoles = await this.prisma.rbacRole.findMany({
      where: { id: { in: roleIds } },
      select: { id: true },
    });
    const existingRoleSet = new Set(existingRoles.map((item) => item.id));
    const missing = roleIds.filter((roleId) => !existingRoleSet.has(roleId));
    if (missing.length) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `Unknown roleIds: ${missing.join(', ')}` });
    }

    const existingUser = await this.prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      throw new ConflictException({ code: 'CONFLICT', message: 'phone already exists' });
    }

    const userId = randomUUID();
    const role = this.deriveUserRole(roleIds);
    await this.prisma.$transaction([
      this.prisma.user.create({
        data: {
          id: userId,
          phone,
          nickname: name,
          role,
        },
      }),
      this.prisma.rbacUserRole.createMany({
        data: roleIds.map((roleId) => ({ userId, roleId })),
      }),
    ]);

    void this.audit.log({
      actorUserId: request.auth.userId,
      action: 'RBAC_USER_CREATE',
      targetType: 'RBAC_USER',
      targetId: userId,
      afterJson: { id: userId, phone, name, roleIds },
    });

    return {
      id: userId,
      name,
      email: phone,
      roleIds,
    };
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
