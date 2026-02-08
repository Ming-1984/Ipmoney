import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { resolvePermissions, resolvePermissionsFromRoleIds, type AdminRoleName } from '../permissions';
import { PrismaService } from '../prisma/prisma.service';
import { RBAC_CONFIG_KEY, ROLE_ID_TO_NAME, SYSTEM_ROLE_IDS, type RbacConfig } from '../rbac';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEMO_USER_ID = '99999999-9999-9999-9999-999999999999';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000001';
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
    if (token === 'demo-admin-token') {
      const adminUser = await this.prisma.user.upsert({
        where: { id: DEMO_ADMIN_ID },
        update: { role: 'admin', nickname: '演示管理员' },
        create: {
          id: DEMO_ADMIN_ID,
          phone: null,
          role: 'admin',
          nickname: '演示管理员',
        },
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

    const userId = token === 'demo-token' ? DEMO_USER_ID : UUID_RE.test(token) ? token : null;
    if (!userId) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: '未登录' });
    }

    let user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user && userId === DEMO_USER_ID) {
      user = await this.prisma.user.upsert({
        where: { id: DEMO_USER_ID },
        update: {},
        create: {
          id: DEMO_USER_ID,
          phone: '13800138000',
          role: 'buyer',
          nickname: '演示用户',
          regionCode: '110000',
        },
      });
    }
    if (!user) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: '未登录' });
    }

    const role = user.role as AdminRoleName | string;
    let roleNames: AdminRoleName[] = ADMIN_ROLE_SET.has(role as AdminRoleName) ? [role as AdminRoleName] : [];

    let rbacConfig: RbacConfig | null = null;
    const configRow = await this.prisma.systemConfig.findUnique({ where: { key: RBAC_CONFIG_KEY } });
    if (configRow?.value) {
      try {
        const parsed = JSON.parse(configRow.value) as RbacConfig;
        if (parsed && Array.isArray(parsed.roles)) {
          rbacConfig = parsed;
        }
      } catch {
        rbacConfig = null;
      }
    }

    let roleIds: string[] = [];
    if (rbacConfig?.userRoles && rbacConfig.userRoles[user.id]?.length) {
      roleIds = rbacConfig.userRoles[user.id];
    }
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
    if (rbacConfig?.roles?.length && roleIds.length) {
      permissions = resolvePermissionsFromRoleIds(roleIds, rbacConfig.roles);
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
