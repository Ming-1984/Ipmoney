import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { resolvePermissions, resolvePermissionsFromRoleIds, type AdminRoleName } from '../permissions';
import { PrismaService } from '../prisma/prisma.service';
import { ROLE_ID_TO_NAME, SYSTEM_ROLE_IDS, buildDefaultRbacRoles } from '../rbac';
import { getDemoAuthConfig, isDemoUuidTokenEnabled } from '../demo';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADMIN_ROLE_SET = new Set<AdminRoleName>(['admin', 'operator', 'finance', 'cs']);

@Injectable()
export class BearerAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<any>();
    const auth = String(req?.headers?.authorization || '');
    if (!auth.startsWith('Bearer ')) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: '未登录' });
    }

    const token = auth.slice('Bearer '.length).trim();
    const demoConfig = getDemoAuthConfig();
    const demoAuthEnabled = demoConfig.enabled;
    const allowUuidToken = demoAuthEnabled && isDemoUuidTokenEnabled();
    if (demoAuthEnabled && demoConfig.adminToken && token === demoConfig.adminToken) {
      const adminUpdate: Prisma.UserUncheckedUpdateInput = { role: 'admin' };
      if (demoConfig.adminNickname) adminUpdate.nickname = demoConfig.adminNickname;
      if (demoConfig.adminPhone) adminUpdate.phone = demoConfig.adminPhone;
      if (demoConfig.adminRegionCode) adminUpdate.regionCode = demoConfig.adminRegionCode;

      const adminCreate: Prisma.UserUncheckedCreateInput = {
        id: demoConfig.adminId as string,
        role: 'admin',
      };
      if (demoConfig.adminPhone) adminCreate.phone = demoConfig.adminPhone;
      if (demoConfig.adminNickname) adminCreate.nickname = demoConfig.adminNickname;
      if (demoConfig.adminRegionCode) adminCreate.regionCode = demoConfig.adminRegionCode;

      const adminUser = await this.prisma.user.upsert({
        where: { id: demoConfig.adminId as string },
        update: adminUpdate,
        create: adminCreate,
      });
      const roleNames: AdminRoleName[] = ['admin'];
      req.auth = {
        token,
        userId: adminUser.id,
        isAdmin: true,
        roleNames,
        roleIds: [SYSTEM_ROLE_IDS.admin],
        permissions: resolvePermissions(roleNames),
        role: adminUser.role,
        nickname: adminUser.nickname,
        verificationStatus: 'APPROVED',
        verificationType: null,
      };
      return true;
    }

    const isDemoUserToken = demoAuthEnabled && demoConfig.userToken && token === demoConfig.userToken;
    const userId = isDemoUserToken ? (demoConfig.userId as string) : allowUuidToken && UUID_RE.test(token) ? token : null;
    if (!userId) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: '未登录' });
    }

    let user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user && isDemoUserToken) {
      const demoUpdate: Prisma.UserUncheckedUpdateInput = {};
      if (demoConfig.userNickname) demoUpdate.nickname = demoConfig.userNickname;
      if (demoConfig.userPhone) demoUpdate.phone = demoConfig.userPhone;
      if (demoConfig.userRegionCode) demoUpdate.regionCode = demoConfig.userRegionCode;

      const demoCreate: Prisma.UserUncheckedCreateInput = {
        id: demoConfig.userId as string,
        role: 'buyer',
      };
      if (demoConfig.userPhone) demoCreate.phone = demoConfig.userPhone;
      if (demoConfig.userNickname) demoCreate.nickname = demoConfig.userNickname;
      if (demoConfig.userRegionCode) demoCreate.regionCode = demoConfig.userRegionCode;

      user = await this.prisma.user.upsert({
        where: { id: demoConfig.userId as string },
        update: demoUpdate,
        create: demoCreate,
      });
    }
    if (!user) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: '未登录' });
    }

    const role = user.role as AdminRoleName | string;
    let roleNames: AdminRoleName[] = ADMIN_ROLE_SET.has(role as AdminRoleName) ? [role as AdminRoleName] : [];

    const assignedRoles = await this.prisma.rbacUserRole.findMany({
      where: { userId: user.id },
      select: { roleId: true },
    });

    let roleIds: string[] = assignedRoles.map((item) => item.roleId);
    if (!roleIds.length) {
      const fallbackRoleId = SYSTEM_ROLE_IDS[role as AdminRoleName];
      if (fallbackRoleId) roleIds = [fallbackRoleId];
    }

    const derivedRoleNames = roleIds
      .map((id) => ROLE_ID_TO_NAME[id])
      .filter((name): name is AdminRoleName => Boolean(name));
    if (derivedRoleNames.length) {
      roleNames = derivedRoleNames;
    }

    let permissions = resolvePermissions(roleNames);
    if (roleIds.length) {
      const roleRows = await this.prisma.rbacRole.findMany({
        where: { id: { in: roleIds } },
        select: { id: true, permissionIds: true },
      });
      const roleRefs = roleRows.length ? roleRows : buildDefaultRbacRoles();
      permissions = resolvePermissionsFromRoleIds(roleIds, roleRefs);
    }

    const verification = await this.prisma.userVerification.findFirst({
      where: { userId: user.id },
      orderBy: { submittedAt: 'desc' },
    });

    req.auth = {
      token,
      userId,
      isAdmin: roleNames.length > 0 || roleIds.length > 0,
      roleNames,
      roleIds,
      permissions,
      role: user.role,
      nickname: user.nickname,
      verificationStatus: verification?.verificationStatus ?? 'PENDING',
      verificationType: verification?.verificationType ?? null,
    };
    return true;
  }
}
