import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminAiController } from '../src/modules/ai/admin-ai.controller';

const VALID_UUID = 'abababab-abab-4aba-8aba-abababababab';

describe('AdminAiController delegation suite', () => {
  let ai: any;
  let controller: AdminAiController;

  beforeEach(() => {
    ai = {
      adminListParseResults: vi.fn(),
      adminGetParseResult: vi.fn(),
      adminUpdateParseResult: vi.fn(),
    };
    controller = new AdminAiController(ai);
  });

  it('delegates list with request and fallback empty query', async () => {
    const req: any = { auth: { userId: 'admin-1' } };
    ai.adminListParseResults.mockResolvedValueOnce({ items: [] });

    await expect(controller.list(req, undefined as any)).resolves.toEqual({ items: [] });

    expect(ai.adminListParseResults).toHaveBeenCalledWith(req, {});
  });

  it('delegates getDetail with request and parseResultId', async () => {
    const req: any = { auth: { userId: 'admin-1' } };
    ai.adminGetParseResult.mockResolvedValueOnce({ id: VALID_UUID });

    await expect(controller.getDetail(req, VALID_UUID)).resolves.toEqual({ id: VALID_UUID });

    expect(ai.adminGetParseResult).toHaveBeenCalledWith(req, VALID_UUID);
  });

  it('delegates update with fallback empty body', async () => {
    const req: any = { auth: { userId: 'admin-1' } };
    ai.adminUpdateParseResult.mockResolvedValueOnce({ ok: true });

    await expect(controller.update(req, VALID_UUID, null as any)).resolves.toEqual({ ok: true });

    expect(ai.adminUpdateParseResult).toHaveBeenCalledWith(req, VALID_UUID, {});
  });
});
