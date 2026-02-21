import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

const RATE_LIMIT_ENABLED = String(process.env.RATE_LIMIT_ENABLED || 'true') !== 'false';
const RATE_LIMIT_WINDOW_SECONDS = Math.max(1, Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 60));
const RATE_LIMIT_MAX = Math.max(1, Number(process.env.RATE_LIMIT_MAX || 120));

type Counter = { count: number; resetAt: number };

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly enabled = RATE_LIMIT_ENABLED;
  private readonly windowMs = RATE_LIMIT_WINDOW_SECONDS * 1000;
  private readonly max = RATE_LIMIT_MAX;
  private readonly store = new Map<string, Counter>();

  canActivate(context: ExecutionContext): boolean {
    if (!this.enabled) return true;

    const req = context.switchToHttp().getRequest<any>();
    const path = String(req?.path || req?.url || '');
    if (path.startsWith('/health')) return true;
    const ipRaw = String(req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || 'unknown');
    const ip = ipRaw.split(',')[0].trim() || 'unknown';

    const now = Date.now();
    const current = this.store.get(ip);
    if (!current || current.resetAt <= now) {
      this.store.set(ip, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    current.count += 1;
    if (current.count > this.max) {
      throw new HttpException(
        { code: 'TOO_MANY_REQUESTS', message: '操作太频繁，请稍后再试' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (this.store.size > 5000) {
      for (const [key, value] of this.store.entries()) {
        if (value.resetAt <= now) this.store.delete(key);
      }
    }

    return true;
  }
}
