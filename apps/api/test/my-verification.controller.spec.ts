import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MyVerificationController } from '../src/modules/users/my-verification.controller';

describe('MyVerificationController delegation suite', () => {
  let users: any;
  let controller: MyVerificationController;

  beforeEach(() => {
    users = {
      getUserIdFromReq: vi.fn(),
      getMyVerification: vi.fn(),
      submitMyVerification: vi.fn(),
    };
    controller = new MyVerificationController(users);
  });

  it('delegates getMyVerification with resolved userId from request', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    users.getUserIdFromReq.mockReturnValueOnce('user-1');
    users.getMyVerification.mockResolvedValueOnce({ status: 'PENDING' });

    await expect(controller.getMyVerification(req)).resolves.toEqual({ status: 'PENDING' });

    expect(users.getUserIdFromReq).toHaveBeenCalledWith(req);
    expect(users.getMyVerification).toHaveBeenCalledWith('user-1');
  });

  it('delegates submitMyVerification with resolved userId and body', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    const body = { type: 'PERSONAL', displayName: 'Alice' } as any;
    users.getUserIdFromReq.mockReturnValueOnce('user-1');
    users.submitMyVerification.mockResolvedValueOnce({ id: 'verify-1' });

    await expect(controller.submitMyVerification(req, body)).resolves.toEqual({ id: 'verify-1' });

    expect(users.getUserIdFromReq).toHaveBeenCalledWith(req);
    expect(users.submitMyVerification).toHaveBeenCalledWith('user-1', body);
  });

  it('propagates getUserIdFromReq failures without calling submit', async () => {
    const req: any = {};
    users.getUserIdFromReq.mockImplementationOnce(() => {
      throw new Error('missing auth');
    });

    await expect(controller.submitMyVerification(req, {} as any)).rejects.toThrow('missing auth');

    expect(users.submitMyVerification).not.toHaveBeenCalled();
  });
});
