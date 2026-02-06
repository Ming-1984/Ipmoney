import { ForbiddenException, NotFoundException, Injectable } from '@nestjs/common';
import { AuditLogService } from '../../common/audit-log.service';
import { requirePermission } from '../../common/permissions';
import { randomUUID } from 'crypto';

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
  { id: 'verification.read', name: '认证查看', description: '查看认证信息' },
  { id: 'verification.review', name: '认证审核', description: '通过/驳回认证' },
  { id: 'listing.read', name: '上架查看', description: '查看上架信息' },
  { id: 'listing.audit', name: '上架审核', description: '审核上架内容' },
  { id: 'order.read', name: '订单查看', description: '查看订单信息' },
  { id: 'case.manage', name: '工单管理', description: '创建/分配/跟进工单' },
  { id: 'milestone.contractSigned.confirm', name: '合同确认', description: '确认合同签署' },
  { id: 'milestone.transferCompleted.confirm', name: '变更完成确认', description: '确认权属变更完成' },
  { id: 'refund.read', name: '退款查看', description: '查看退款请求' },
  { id: 'refund.approve', name: '退款审批', description: '审批退款请求' },
  { id: 'refund.reject', name: '退款驳回', description: '驳回退款请求' },
  { id: 'settlement.read', name: '结算查看', description: '查看结算台账' },
  { id: 'payout.manual.confirm', name: '放款确认', description: '人工确认放款' },
  { id: 'invoice.manage', name: '发票管理', description: '上传/替换/删除发票' },
  { id: 'config.manage', name: '系统配置', description: '修改系统配置' },
  { id: 'report.read', name: '报表查看', description: '查看报表' },
  { id: 'report.export', name: '报表导出', description: '导出报表' },
  { id: 'rbac.manage', name: '账号权限', description: '管理账号与角色权限' },
  { id: 'auditLog.read', name: '审计日志', description: '查看审计日志' },
];

const ROLES: Role[] = [
  {
    id: 'role-operator',
    name: '运营',
    description: '内容审核与配置',
    permissionIds: ['verification.read', 'verification.review', 'listing.read', 'listing.audit', 'order.read', 'report.read'],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'role-cs',
    name: '客服',
    description: '跟单与工单处理',
    permissionIds: ['order.read', 'case.manage', 'milestone.contractSigned.confirm', 'milestone.transferCompleted.confirm'],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'role-finance',
    name: '财务',
    description: '结算与发票',
    permissionIds: ['settlement.read', 'payout.manual.confirm', 'invoice.manage', 'report.read', 'report.export'],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'role-admin',
    name: '管理员',
    description: '全权限',
    permissionIds: PERMISSIONS.map((p) => p.id),
    updatedAt: new Date().toISOString(),
  },
];

const USERS: UserRole[] = [
  { id: 'admin-001', name: '管理员-张', email: 'admin@ipmoney.test', roleIds: ['role-admin'] },
  { id: 'op-001', name: '运营-周', email: 'op@ipmoney.test', roleIds: ['role-operator'] },
  { id: 'cs-001', name: '客服-王', email: 'cs@ipmoney.test', roleIds: ['role-cs'] },
  { id: 'finance-001', name: '财务-李', email: 'finance@ipmoney.test', roleIds: ['role-finance'] },
];

@Injectable()
export class RbacService {
  constructor(private readonly audit: AuditLogService) {}
  private ensureAuth(req: any) {
    if (!req?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }

  listRoles(req: any) {
    this.ensureAuth(req);
    requirePermission(req, 'rbac.manage');
    return { items: ROLES };
  }

  createRole(req: any, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'rbac.manage');
    const role: Role = {
      id: randomUUID(),
      name: String(body?.name || '未命名角色'),
      description: body?.description,
      permissionIds: Array.isArray(body?.permissionIds) ? body.permissionIds : [],
      updatedAt: new Date().toISOString(),
    };
    ROLES.unshift(role);
    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'RBAC_ROLE_CREATE',
      targetType: 'RBAC_ROLE',
      targetId: role.id,
      afterJson: role,
    });
    return role;
  }

  updateRole(req: any, roleId: string, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'rbac.manage');
    const role = ROLES.find((r) => r.id === roleId);
    if (!role) throw new NotFoundException({ code: 'NOT_FOUND', message: '角色不存在' });
    const before = { ...role };
    if (body?.name) role.name = body.name;
    if (body?.description !== undefined) role.description = body.description;
    if (Array.isArray(body?.permissionIds)) role.permissionIds = body.permissionIds;
    role.updatedAt = new Date().toISOString();
    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'RBAC_ROLE_UPDATE',
      targetType: 'RBAC_ROLE',
      targetId: role.id,
      beforeJson: before,
      afterJson: role,
    });
    return role;
  }

  deleteRole(req: any, roleId: string) {
    this.ensureAuth(req);
    requirePermission(req, 'rbac.manage');
    const idx = ROLES.findIndex((r) => r.id === roleId);
    if (idx < 0) throw new NotFoundException({ code: 'NOT_FOUND', message: '角色不存在' });
    const [removed] = ROLES.splice(idx, 1);
    USERS.forEach((u) => {
      u.roleIds = u.roleIds.filter((id) => id !== roleId);
    });
    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'RBAC_ROLE_DELETE',
      targetType: 'RBAC_ROLE',
      targetId: roleId,
      beforeJson: removed,
    });
    return { ok: true };
  }

  listPermissions(req: any) {
    this.ensureAuth(req);
    requirePermission(req, 'rbac.manage');
    return { items: PERMISSIONS };
  }

  listUsers(req: any) {
    this.ensureAuth(req);
    requirePermission(req, 'rbac.manage');
    const items = USERS.map((u) => ({
      ...u,
      roleNames: u.roleIds.map((id) => ROLES.find((r) => r.id === id)?.name).filter(Boolean),
    }));
    return { items };
  }

  updateUserRoles(req: any, userId: string, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'rbac.manage');
    const user = USERS.find((u) => u.id === userId);
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: '账号不存在' });
    const before = { ...user };
    if (Array.isArray(body?.roleIds)) user.roleIds = body.roleIds;
    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'RBAC_USER_UPDATE',
      targetType: 'RBAC_USER',
      targetId: user.id,
      beforeJson: before,
      afterJson: user,
    });
    return user;
  }
}
