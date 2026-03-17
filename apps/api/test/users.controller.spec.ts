import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UsersController } from '../src/modules/users/users.controller';

describe('UsersController delegation suite', () => {
  let users: any;
  let controller: UsersController;

  beforeEach(() => {
    users = {
      getUserIdFromReq: vi.fn(),
      getUserProfileById: vi.fn(),
      updateUserProfile: vi.fn(),
    };
    controller = new UsersController(users);
  });

  it('delegates getMe with userId resolved from request', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    users.getUserIdFromReq.mockReturnValueOnce('user-1');
    users.getUserProfileById.mockResolvedValueOnce({ userId: 'user-1' });

    await expect(controller.getMe(req)).resolves.toEqual({ userId: 'user-1' });

    expect(users.getUserIdFromReq).toHaveBeenCalledWith(req);
    expect(users.getUserProfileById).toHaveBeenCalledWith('user-1');
  });

  it('delegates updateMe with fallback empty body', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    users.getUserIdFromReq.mockReturnValueOnce('user-1');
    users.updateUserProfile.mockResolvedValueOnce({ ok: true });

    await expect(controller.updateMe(req, undefined as any)).resolves.toEqual({ ok: true });

    expect(users.updateUserProfile).toHaveBeenCalledWith('user-1', {});
  });
});
