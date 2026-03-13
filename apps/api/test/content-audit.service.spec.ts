import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContentAuditService } from '../src/common/content-audit.service';

describe('ContentAuditService strictness suite', () => {
  let prisma: any;
  let service: ContentAuditService;

  beforeEach(() => {
    prisma = {
      listing: { findUnique: vi.fn().mockResolvedValue(null) },
      file: { findMany: vi.fn().mockResolvedValue([]) },
      listingMedia: { findMany: vi.fn().mockResolvedValue([]) },
      demandMedia: { findMany: vi.fn().mockResolvedValue([]) },
      achievementMedia: { findMany: vi.fn().mockResolvedValue([]) },
      artworkMedia: { findMany: vi.fn().mockResolvedValue([]) },
      userVerification: { findUnique: vi.fn().mockResolvedValue(null) },
      auditLog: { findMany: vi.fn().mockResolvedValue([]) },
    };
    service = new ContentAuditService(prisma);
  });

  it('returns empty materials when targetId is missing', async () => {
    await expect(service.listMaterials('LISTING', '')).resolves.toEqual({ items: [] });

    expect(prisma.listing.findUnique).not.toHaveBeenCalled();
    expect(prisma.file.findMany).not.toHaveBeenCalled();
  });

  it('uses listing proofFileIds with deterministic order and deduplication', async () => {
    prisma.listing.findUnique.mockResolvedValueOnce({
      proofFileIdsJson: ['file-2', ' file-1 ', 'file-2', '', '   '],
    });
    prisma.file.findMany.mockResolvedValueOnce([
      { id: 'file-1', fileName: 'A.pdf', url: '/f/a.pdf', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'file-2', fileName: 'B.pdf', url: '/f/b.pdf', createdAt: '2026-01-02T00:00:00.000Z' },
    ]);

    const result = await service.listMaterials('LISTING', 'listing-1');

    expect(prisma.file.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['file-2', 'file-1', 'file-2'] } },
    });
    expect(result.items.map((item) => item.id)).toEqual(['file-2', 'file-1']);
    expect(result.items[0]).toMatchObject({
      name: 'B.pdf',
      kind: 'OWNERSHIP',
      url: '/f/b.pdf',
    });
  });

  it('falls back to listing media when proof file ids are absent', async () => {
    prisma.listing.findUnique.mockResolvedValueOnce({ proofFileIdsJson: null });
    prisma.listingMedia.findMany.mockResolvedValueOnce([
      {
        type: 'FILE',
        file: { id: 'm-1', fileName: '', url: '/f/m-1', createdAt: '2026-01-03T00:00:00.000Z' },
      },
      {
        type: 'FILE',
        file: { id: 'm-1', fileName: 'duplicate.pdf', url: '/f/m-1', createdAt: '2026-01-03T00:00:00.000Z' },
      },
    ]);

    const result = await service.listMaterials('LISTING', 'listing-2');

    expect(prisma.listingMedia.findMany).toHaveBeenCalledWith({
      where: { listingId: 'listing-2', type: 'FILE' },
      include: { file: true },
      orderBy: { sort: 'asc' },
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'm-1',
      name: 'Attachment',
      kind: 'FILE',
    });
  });

  it('supports verification evidence ids provided as a string', async () => {
    prisma.userVerification.findUnique.mockResolvedValueOnce({ evidenceFileIdsJson: 'evidence-1' });
    prisma.file.findMany.mockResolvedValueOnce([
      {
        id: 'evidence-1',
        fileName: 'verification.pdf',
        url: '/f/v-1',
        createdAt: '2026-01-04T00:00:00.000Z',
      },
    ]);

    const result = await service.listMaterials('VERIFICATION', 'verification-1');

    expect(prisma.file.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['evidence-1'] } },
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'evidence-1',
      kind: 'OWNERSHIP',
      name: 'verification.pdf',
    });
  });

  it('maps verification logs with normalized actions and reason fallback', async () => {
    prisma.auditLog.findMany.mockResolvedValueOnce([
      {
        id: 'log-1',
        action: 'VERIFICATION_REJECT',
        afterJson: { reason: 'missing document' },
        beforeJson: null,
        actorUserId: 'u-1',
        actor: { nickname: null, phone: '13800000000' },
        createdAt: new Date('2026-01-05T00:00:00.000Z'),
      },
      {
        id: 'log-2',
        action: 'VERIFICATION_APPROVE',
        afterJson: {},
        beforeJson: { note: 'legacy note' },
        actorUserId: null,
        actor: null,
        createdAt: new Date('2026-01-06T00:00:00.000Z'),
      },
    ]);

    const result = await service.listLogs('VERIFICATION', 'verification-2');

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { targetType: 'USER_VERIFICATION', targetId: 'verification-2' },
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
    });
    expect(result.items).toEqual([
      {
        id: 'log-1',
        action: 'REJECT',
        reason: 'missing document',
        operatorId: 'u-1',
        operatorName: '13800000000',
        createdAt: '2026-01-05T00:00:00.000Z',
      },
      {
        id: 'log-2',
        action: 'APPROVE',
        reason: 'legacy note',
        operatorId: undefined,
        operatorName: null,
        createdAt: '2026-01-06T00:00:00.000Z',
      },
    ]);
  });
});
