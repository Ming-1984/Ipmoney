import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AiController } from '../src/modules/ai/ai.controller';

const VALID_UUID = 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0';

describe('AiController delegation suite', () => {
  let ai: any;
  let controller: AiController;

  beforeEach(() => {
    ai = {
      createAgentQuery: vi.fn(),
      createFeedback: vi.fn(),
    };
    controller = new AiController(ai);
  });

  it('delegates createAgentQuery with fallback empty body', async () => {
    ai.createAgentQuery.mockResolvedValueOnce({ id: 'query-1' });

    await expect(controller.createAgentQuery(undefined as any)).resolves.toEqual({ id: 'query-1' });

    expect(ai.createAgentQuery).toHaveBeenCalledWith({});
  });

  it('delegates createFeedback with request, route id, and fallback empty body', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    ai.createFeedback.mockResolvedValueOnce({ ok: true });

    await expect(controller.createFeedback(req, VALID_UUID, null as any)).resolves.toEqual({ ok: true });

    expect(ai.createFeedback).toHaveBeenCalledWith(req, VALID_UUID, {});
  });
});
