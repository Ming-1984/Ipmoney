import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

type ErrorResponse = { code: string; message: string; details?: Record<string, any> };

function statusToCode(status: number): string {
  if (status === HttpStatus.BAD_REQUEST) return 'BAD_REQUEST';
  if (status === HttpStatus.UNAUTHORIZED) return 'UNAUTHORIZED';
  if (status === HttpStatus.FORBIDDEN) return 'FORBIDDEN';
  if (status === HttpStatus.NOT_FOUND) return 'NOT_FOUND';
  if (status === HttpStatus.CONFLICT) return 'CONFLICT';
  return 'INTERNAL_ERROR';
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
      payload.details = {
        ...(payload.details || {}),
        path: request?.url,
        method: request?.method,
      };
    }

    response.status(status).json(payload);
  }
}

