import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CasesController } from '../src/modules/cases/cases.controller';

const VALID_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('CasesController delegation suite', () => {
  let cases: any;
  let controller: CasesController;

  beforeEach(() => {
    cases = {
      list: vi.fn(),
      getDetail: vi.fn(),
      create: vi.fn(),
      assign: vi.fn(),
      updateStatus: vi.fn(),
      addNote: vi.fn(),
      addEvidence: vi.fn(),
      updateSla: vi.fn(),
    };
    controller = new CasesController(cases);
  });

  it('delegates list with request and query', async () => {
    const req: any = { auth: { userId: 'admin-1' } };
    cases.list.mockResolvedValueOnce({ items: [] });

    await expect(controller.list(req, { status: 'OPEN' })).resolves.toEqual({ items: [] });

    expect(cases.list).toHaveBeenCalledWith(req, { status: 'OPEN' });
  });

  it('delegates getDetail with normalized UUID', async () => {
    const req: any = { auth: { userId: 'admin-1' } };
    cases.getDetail.mockResolvedValueOnce({ id: VALID_UUID });

    await expect(controller.getDetail(req, ` ${VALID_UUID} `)).resolves.toEqual({ id: VALID_UUID });

    expect(cases.getDetail).toHaveBeenCalledWith(req, VALID_UUID);
  });

  it('rejects getDetail when caseId is invalid', async () => {
    const req: any = { auth: { userId: 'admin-1' } };

    await expect(controller.getDetail(req, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);

    expect(cases.getDetail).not.toHaveBeenCalled();
  });

  it('delegates create with fallback empty body', async () => {
    const req: any = { auth: { userId: 'admin-1' } };
    cases.create.mockResolvedValueOnce({ id: VALID_UUID });

    await expect(controller.create(req, undefined as any)).resolves.toEqual({ id: VALID_UUID });

    expect(cases.create).toHaveBeenCalledWith(req, {});
  });

  it('delegates assign and status updates with normalized caseId and fallback body', async () => {
    const req: any = { auth: { userId: 'admin-1' } };
    cases.assign.mockResolvedValueOnce({ ok: true });
    cases.updateStatus.mockResolvedValueOnce({ ok: true });

    await expect(controller.assign(req, VALID_UUID, null as any)).resolves.toEqual({ ok: true });
    await expect(controller.updateStatus(req, VALID_UUID, undefined as any)).resolves.toEqual({ ok: true });

    expect(cases.assign).toHaveBeenCalledWith(req, VALID_UUID, {});
    expect(cases.updateStatus).toHaveBeenCalledWith(req, VALID_UUID, {});
  });

  it('delegates note/evidence/sla updates with normalized caseId and body fallback', async () => {
    const req: any = { auth: { userId: 'admin-1' } };
    cases.addNote.mockResolvedValueOnce({ ok: true });
    cases.addEvidence.mockResolvedValueOnce({ ok: true });
    cases.updateSla.mockResolvedValueOnce({ ok: true });

    await expect(controller.addNote(req, VALID_UUID, undefined as any)).resolves.toEqual({ ok: true });
    await expect(controller.addEvidence(req, VALID_UUID, null as any)).resolves.toEqual({ ok: true });
    await expect(controller.updateSla(req, VALID_UUID, undefined as any)).resolves.toEqual({ ok: true });

    expect(cases.addNote).toHaveBeenCalledWith(req, VALID_UUID, {});
    expect(cases.addEvidence).toHaveBeenCalledWith(req, VALID_UUID, {});
    expect(cases.updateSla).toHaveBeenCalledWith(req, VALID_UUID, {});
  });
});
