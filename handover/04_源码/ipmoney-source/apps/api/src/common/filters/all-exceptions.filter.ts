import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

type ErrorResponse = { code: string; message: string; details?: Record<string, any> };

function nowIso() {
  return new Date().toISOString();
}

function statusToCode(status: number): string {
  if (status === HttpStatus.BAD_REQUEST) return 'BAD_REQUEST';
  if (status === HttpStatus.UNAUTHORIZED) return 'UNAUTHORIZED';
  if (status === HttpStatus.FORBIDDEN) return 'FORBIDDEN';
  if (status === HttpStatus.NOT_FOUND) return 'NOT_FOUND';
  if (status === HttpStatus.CONFLICT) return 'CONFLICT';
  return 'INTERNAL_ERROR';
}

function stripQuery(url: string): string {
  const raw = String(url || '');
  const idx = raw.indexOf('?');
  return idx >= 0 ? raw.slice(0, idx) : raw;
}

function readHeader(req: any, key: string): string {
  const raw = req?.headers?.[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value : '';
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<any>();
    const request = ctx.getRequest<any>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload: ErrorResponse = { code: statusToCode(status), message: 'Internal Server Error' };

    if (isHttp) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        payload.message = res;
      } else if (res && typeof res === 'object') {
        const obj = res as Record<string, any>;
        if (typeof obj.code === 'string' && typeof obj.message === 'string') {
          payload.code = obj.code;
          payload.message = obj.message;
          if (obj.details && typeof obj.details === 'object') payload.details = obj.details;
        } else if (typeof obj.message === 'string') {
          payload.message = obj.message;
        } else if (Array.isArray(obj.message)) {
          payload.message = obj.message.join('; ');
        }
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      const path = stripQuery(String(request?.path || request?.url || ''));
      payload.details = {
        ...(payload.details || {}),
        path,
        method: request?.method,
      };
    }

    // Minimal error logging for server-side visibility (no query/body to avoid PII leaks).
    // Request access logs are handled by requestLoggerMiddleware; this is for 5xx exceptions.
    if (status >= 500) {
      const requestId =
        String(request?.requestId || '').trim() ||
        readHeader(request, 'x-request-id') ||
        readHeader(request, 'x-requestid') ||
        undefined;
      const path = stripQuery(String(request?.path || request?.url || ''));
      const method = String(request?.method || '').toUpperCase() || undefined;
      const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();

      const errName =
        exception && typeof exception === 'object' && 'name' in exception ? String((exception as any).name || '') : '';
      const errMessage =
        exception && typeof exception === 'object' && 'message' in exception
          ? String((exception as any).message || '')
          : '';
      const errStack =
        exception && typeof exception === 'object' && 'stack' in exception ? String((exception as any).stack || '') : '';

      console.error(
        JSON.stringify({
          ts: nowIso(),
          level: 'error',
          msg: 'exception',
          requestId,
          method,
          path,
          status,
          code: payload.code,
          // Avoid logging exception details in production by default.
          err:
            nodeEnv === 'production'
              ? { name: errName || undefined }
              : { name: errName || undefined, message: errMessage || undefined, stack: errStack || undefined },
        }),
      );
    }

    response.status(status).json(payload);
  }
}
