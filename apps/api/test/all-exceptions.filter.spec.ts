import { HttpException, HttpStatus } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

function makeHost(request: any) {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const response = { status };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as any;
  return { host, status, json };
}

describe('AllExceptionsFilter strictness suite', () => {
  let previousNodeEnv: string | undefined;

  beforeEach(() => {
    previousNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (previousNodeEnv == null) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    vi.restoreAllMocks();
  });

  it('keeps structured HTTP error payload and appends method/path details in non-production', () => {
    process.env.NODE_ENV = 'test';
    const filter = new AllExceptionsFilter();
    const { host, status, json } = makeHost({ method: 'GET', url: '/api/items?page=1' });
    const exception = new HttpException(
      {
        code: 'BAD_REQUEST',
        message: 'invalid query',
        details: { field: 'pageSize' },
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledTimes(1);
    expect(json.mock.calls[0][0]).toMatchObject({
      code: 'BAD_REQUEST',
      message: 'invalid query',
      details: { field: 'pageSize', path: '/api/items', method: 'GET' },
    });
  });

  it('joins HTTP validation message arrays into one string', () => {
    process.env.NODE_ENV = 'test';
    const filter = new AllExceptionsFilter();
    const { host, status, json } = makeHost({ method: 'POST', path: '/api/search' });
    const exception = new HttpException({ message: ['a', 'b', 'c'] }, HttpStatus.BAD_REQUEST);

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json.mock.calls[0][0]).toMatchObject({
      code: 'BAD_REQUEST',
      message: 'a; b; c',
      details: { path: '/api/search', method: 'POST' },
    });
  });

  it('returns 500 internal error and logs detailed exception metadata in non-production', () => {
    process.env.NODE_ENV = 'test';
    const filter = new AllExceptionsFilter();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { host, status, json } = makeHost({
      method: 'PUT',
      path: '/api/orders/123?full=1',
      headers: { 'x-request-id': 'req-500' },
    });

    filter.catch(new Error('unexpected failure'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json.mock.calls[0][0]).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Internal Server Error',
      details: { path: '/api/orders/123', method: 'PUT' },
    });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logPayload = JSON.parse(String(errorSpy.mock.calls[0][0]));
    expect(logPayload).toMatchObject({
      level: 'error',
      msg: 'exception',
      requestId: 'req-500',
      method: 'PUT',
      path: '/api/orders/123',
      status: 500,
      code: 'INTERNAL_ERROR',
    });
    expect(logPayload.err.name).toBe('Error');
    expect(logPayload.err.message).toBe('unexpected failure');
    expect(typeof logPayload.err.stack).toBe('string');
  });

  it('hides exception message/stack in production error logs', () => {
    process.env.NODE_ENV = 'production';
    const filter = new AllExceptionsFilter();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { host, status, json } = makeHost({
      method: 'DELETE',
      path: '/api/contracts/1',
      headers: { 'x-requestid': 'req-prod' },
    });

    filter.catch(new Error('do-not-log-message'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json.mock.calls[0][0]).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Internal Server Error',
    });
    expect(json.mock.calls[0][0].details).toBeUndefined();
    const logPayload = JSON.parse(String(errorSpy.mock.calls[0][0]));
    expect(logPayload.requestId).toBe('req-prod');
    expect(logPayload.err).toMatchObject({ name: 'Error' });
    expect(logPayload.err.message).toBeUndefined();
    expect(logPayload.err.stack).toBeUndefined();
  });
});
