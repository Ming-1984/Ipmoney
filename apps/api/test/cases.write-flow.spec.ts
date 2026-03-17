import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CasesService } from '../src/modules/cases/cases.service';

const CASE_ID = '11111111-1111-1111-1111-111111111111';
const ORDER_ID = '22222222-2222-2222-2222-222222222222';
const ASSIGNEE_ID = '33333333-3333-3333-3333-333333333333';

const REQ = {
  auth: { userId: 'admin-1', nickname: 'Admin', permissions: new Set(['case.manage']) },
};

function buildCase(overrides: Record<string, unknown> = {}) {
  return {
    id: CASE_ID,
    title: 'Case A',
    type: 'FOLLOWUP',
    status: 'OPEN',
    orderId: ORDER_ID,
    requesterName: 'Requester',
    csUserId: ASSIGNEE_ID,
    csUser: { nickname: 'CS User' },
    priority: 'MEDIUM',
    description: 'desc',
    createdAt: new Date('2026-03-13T00:00:00.000Z'),
    updatedAt: new Date('2026-03-13T01:00:00.000Z'),
    dueAt: new Date('2026-03-20T00:00:00.000Z'),
    notes: [
      {
        id: 'note-1',
        authorId: 'admin-1',
        authorName: 'Admin',
        content: 'note',
        createdAt: new Date('2026-03-13T00:00:00.000Z'),
      },
    ],
    evidences: [
      {
        id: 'evidence-1',
        fileId: '44444444-4444-4444-4444-444444444444',
        fileName: 'evidence.pdf',
        url: 'https://example.com/evidence.pdf',
        file: null,
        createdAt: new Date('2026-03-13T00:00:00.000Z'),
      },
    ],
    ...overrides,
  };
}

describe('CasesService write flow suite', () => {
  let prisma: any;
  let service: CasesService;

  beforeEach(() => {
    prisma = {
      csCase: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      order: { findUnique: vi.fn() },
      user: { findUnique: vi.fn() },
      csCaseNote: { create: vi.fn() },
      csCaseEvidence: { findFirst: vi.fn(), create: vi.fn() },
      file: { findUnique: vi.fn() },
    };
    service = new CasesService(prisma);
  });

  it('validates create payload and relation guards strictly', async () => {
    await expect(service.create(REQ, { type: 'bug' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(REQ, { status: 'pending' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(REQ, { priority: 'urgent' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(REQ, { orderId: 'bad' })).rejects.toBeInstanceOf(BadRequestException);

    prisma.order.findUnique.mockResolvedValueOnce(null);
    await expect(service.create(REQ, { orderId: ORDER_ID })).rejects.toBeInstanceOf(NotFoundException);

    prisma.order.findUnique.mockResolvedValueOnce({ id: ORDER_ID });
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.create(REQ, { orderId: ORDER_ID, assigneeId: ASSIGNEE_ID })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('create applies normalization/defaults and returns mapped case', async () => {
    prisma.order.findUnique.mockResolvedValueOnce({ id: ORDER_ID });
    prisma.user.findUnique.mockResolvedValueOnce({ id: ASSIGNEE_ID });
    prisma.csCase.create.mockResolvedValueOnce(
      buildCase({
        type: 'REFUND',
        status: 'OPEN',
        requesterName: '系统',
        title: '退款争议',
      }),
    );

    const result = await service.create(REQ, {
      type: 'refund',
      title: null,
      requesterName: null,
      orderId: ORDER_ID,
      assigneeId: ASSIGNEE_ID,
      priority: 'high',
      dueAt: '2026-03-21T00:00:00.000Z',
    });

    expect(prisma.csCase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: ORDER_ID,
          csUserId: ASSIGNEE_ID,
          type: 'REFUND',
          status: 'OPEN',
          requesterName: '系统',
          priority: 'HIGH',
          dueAt: expect.any(Date),
        }),
      }),
    );
    expect(result).toMatchObject({
      id: CASE_ID,
      status: 'OPEN',
      orderId: ORDER_ID,
      assigneeId: ASSIGNEE_ID,
      assigneeName: 'CS User',
    });
  });

  it('assign validates assignee/case/user branches and updates owner', async () => {
    await expect(service.assign(REQ, CASE_ID, { assigneeId: 'bad' })).rejects.toBeInstanceOf(BadRequestException);

    prisma.csCase.findUnique.mockResolvedValueOnce(null);
    await expect(service.assign(REQ, CASE_ID, { assigneeId: ASSIGNEE_ID })).rejects.toBeInstanceOf(NotFoundException);

    prisma.csCase.findUnique.mockResolvedValueOnce({ id: CASE_ID });
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.assign(REQ, CASE_ID, { assigneeId: ASSIGNEE_ID })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.csCase.findUnique.mockResolvedValueOnce({ id: CASE_ID });
    prisma.user.findUnique.mockResolvedValueOnce({ id: ASSIGNEE_ID });
    prisma.csCase.update.mockResolvedValueOnce(buildCase({ csUserId: ASSIGNEE_ID, csUser: { nickname: 'CS User' } }));

    const result = await service.assign(REQ, CASE_ID, { assigneeId: ASSIGNEE_ID });
    expect(prisma.csCase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CASE_ID },
        data: { csUserId: ASSIGNEE_ID },
      }),
    );
    expect(result.assigneeId).toBe(ASSIGNEE_ID);
  });

  it('updateStatus validates status and not-found branch', async () => {
    await expect(service.updateStatus(REQ, CASE_ID, { status: 'pending' })).rejects.toBeInstanceOf(BadRequestException);

    prisma.csCase.findUnique.mockResolvedValueOnce(null);
    await expect(service.updateStatus(REQ, CASE_ID, { status: 'closed' })).rejects.toBeInstanceOf(NotFoundException);

    prisma.csCase.findUnique.mockResolvedValueOnce({ id: CASE_ID });
    prisma.csCase.update.mockResolvedValueOnce(buildCase({ status: 'CLOSED' }));

    const result = await service.updateStatus(REQ, CASE_ID, { status: 'closed' });
    expect(result.status).toBe('CLOSED');
  });

  it('addNote validates note body and appends note record', async () => {
    await expect(service.addNote(REQ, CASE_ID, { note: '   ' })).rejects.toBeInstanceOf(BadRequestException);

    prisma.csCase.findUnique.mockResolvedValueOnce(null);
    await expect(service.addNote(REQ, CASE_ID, { note: 'x' })).rejects.toBeInstanceOf(NotFoundException);

    prisma.csCase.findUnique.mockResolvedValueOnce({ id: CASE_ID }).mockResolvedValueOnce(buildCase());
    prisma.csCaseNote.create.mockResolvedValueOnce({ id: 'note-2' });

    const result = await service.addNote(REQ, CASE_ID, { note: '  follow up  ' });
    expect(prisma.csCaseNote.create).toHaveBeenCalledWith({
      data: {
        caseId: CASE_ID,
        authorId: 'admin-1',
        authorName: 'Admin',
        content: 'follow up',
      },
    });
    expect(result.id).toBe(CASE_ID);
  });

  it('addEvidence validates file relation and supports create/no-op branches', async () => {
    await expect(service.addEvidence(REQ, CASE_ID, { fileId: 'bad' })).rejects.toBeInstanceOf(BadRequestException);

    prisma.csCase.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.addEvidence(REQ, CASE_ID, { fileId: '44444444-4444-4444-4444-444444444444' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.csCase.findUnique.mockResolvedValueOnce({ id: CASE_ID });
    prisma.csCaseEvidence.findFirst.mockResolvedValueOnce(null);
    prisma.file.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.addEvidence(REQ, CASE_ID, { fileId: '44444444-4444-4444-4444-444444444444' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.csCase.findUnique.mockResolvedValueOnce({ id: CASE_ID }).mockResolvedValueOnce(buildCase());
    prisma.csCaseEvidence.findFirst.mockResolvedValueOnce(null);
    prisma.file.findUnique.mockResolvedValueOnce({
      id: '44444444-4444-4444-4444-444444444444',
      fileName: 'evidence.pdf',
      url: 'https://example.com/evidence.pdf',
    });
    prisma.csCaseEvidence.create.mockResolvedValueOnce({ id: 'evidence-2' });

    const created = await service.addEvidence(REQ, CASE_ID, { fileId: '44444444-4444-4444-4444-444444444444' });
    expect(prisma.csCaseEvidence.create).toHaveBeenCalledWith({
      data: {
        caseId: CASE_ID,
        fileId: '44444444-4444-4444-4444-444444444444',
        fileName: 'evidence.pdf',
        url: 'https://example.com/evidence.pdf',
      },
    });
    expect(created.id).toBe(CASE_ID);
  });

  it('updateSla enforces dueAt strictness and updates due date', async () => {
    await expect(service.updateSla(REQ, CASE_ID, { dueAt: '' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateSla(REQ, CASE_ID, { dueAt: null })).rejects.toBeInstanceOf(BadRequestException);

    prisma.csCase.findUnique.mockResolvedValueOnce(null);
    await expect(service.updateSla(REQ, CASE_ID, { dueAt: '2026-03-22T00:00:00.000Z' })).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.csCase.findUnique.mockResolvedValueOnce({ id: CASE_ID });
    prisma.csCase.update.mockResolvedValueOnce(buildCase({ dueAt: new Date('2026-03-22T00:00:00.000Z') }));

    const result = await service.updateSla(REQ, CASE_ID, { dueAt: '2026-03-22T00:00:00.000Z' });
    expect(prisma.csCase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CASE_ID },
        data: { dueAt: expect.any(Date) },
      }),
    );
    expect(result.dueAt).toBe('2026-03-22T00:00:00.000Z');
  });
});
