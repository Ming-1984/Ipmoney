import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { resolvePermissions, type AdminRoleName } from '../permissions';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEMO_USER_ID = '99999999-9999-9999-9999-999999999999';

@Injectable()
export class BearerAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<any>();
    const auth = String(req?.headers?.authorization || '');
    if (!auth.startsWith('Bearer ')) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: '未登录' });
    }

    const token = auth.slice('Bearer '.length).trim();
    const userId = token === 'demo-token' ? DEMO_USER_ID : UUID_RE.test(token) ? token : null;
    const isAdmin = token === 'demo-admin-token';
    const roleNames: AdminRoleName[] = isAdmin ? ['admin'] : [];
    const permissions = resolvePermissions(roleNames);

    req.auth = { token, userId, isAdmin, roleNames, permissions };
    return true;
  }
}
