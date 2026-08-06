import { describe, expect, it, vi } from 'vitest';

import { ImportBatchesService } from '../src/modules/import-batches/import-batches.service';

describe('ImportBatchesService change log backfill', () => {
  const audit = { log: vi.fn() };
  const files = { getFileById: vi.fn(), getFileBuffer: vi.fn() };

  it('backfills tech manager change logs from bulk import audit payload', async () => {
    const prisma: any = {
      achievement: { findMany: vi.fn().mockResolvedValue([]) },
      auditLog: {
        findUnique: vi.fn().mockResolvedValue({
          id: '11111111-1111-1111-1111-111111111111',
          afterJson: {
            input: { sourceBatch: 'people-batch' },
            people: {
              changes: [
                {
                  rowNo: 2,
                  entityType: 'USER_VERIFICATION',
                  entityId: '22222222-2222-2222-2222-222222222222',
                  operation: 'CREATE',
                  label: '张三',
                  afterJson: { displayName: '张三' },
                },
                {
                  rowNo: 2,
                  entityType: 'TECH_MANAGER_PROFILE',
                  entityId: '33333333-3333-3333-3333-333333333333',
                  operation: 'CREATE',
                  label: '张三',
                  afterJson: { displayName: '张三', organization: '示例机构' },
                },
              ],
            },
          },
        }),
      },
      importChangeLog: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    const service = new ImportBatchesService(prisma, audit as any, files as any);

    await (service as any).ensurePeopleAchievementsChangeLogs({
      id: '44444444-4444-4444-4444-444444444444',
      sourceBatch: 'people-batch',
      legacyJobId: '11111111-1111-1111-1111-111111111111',
    });

    expect(prisma.importChangeLog.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            rowNo: 2,
            entityType: 'USER_VERIFICATION',
            entityId: '22222222-2222-2222-2222-222222222222',
            operation: 'CREATE',
            rollbackStrategy: 'SOFT_OFF_SHELF',
          }),
          expect.objectContaining({
            rowNo: 2,
            entityType: 'TECH_MANAGER_PROFILE',
            entityId: '33333333-3333-3333-3333-333333333333',
            operation: 'CREATE',
            rollbackStrategy: 'SOFT_OFF_SHELF',
          }),
        ]),
      }),
    );
  });

  it('backfills listing change logs for patent import rows', async () => {
    const processedAt = new Date('2026-08-05T06:00:00.000Z');
    const prisma: any = {
      patentImportJob: {
        findUnique: vi.fn().mockResolvedValue({
          id: '11111111-1111-1111-1111-111111111111',
          createdAt: processedAt,
          startedAt: processedAt,
        }),
      },
      patentImportJobRow: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'row-1',
            jobId: '11111111-1111-1111-1111-111111111111',
            rowNo: 2,
            patentId: '22222222-2222-2222-2222-222222222222',
            processedAt,
          },
        ]),
      },
      listing: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: '33333333-3333-3333-3333-333333333333',
            patentId: '22222222-2222-2222-2222-222222222222',
            createdAt: processedAt,
          },
        ]),
      },
      importChangeLog: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    const service = new ImportBatchesService(prisma, audit as any, files as any);

    await (service as any).ensurePatentChangeLogs({
      id: '44444444-4444-4444-4444-444444444444',
      legacyJobId: '11111111-1111-1111-1111-111111111111',
    });

    const call = prisma.importChangeLog.createMany.mock.calls[0][0];
    expect(call.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rowNo: 2,
          entityType: 'PATENT',
          entityId: '22222222-2222-2222-2222-222222222222',
          rollbackStrategy: 'MANUAL_ONLY',
        }),
        expect.objectContaining({
          rowNo: 2,
          entityType: 'LISTING',
          entityId: '33333333-3333-3333-3333-333333333333',
          operation: 'CREATE',
          rollbackStrategy: 'SOFT_OFF_SHELF',
        }),
      ]),
    );
  });

  it('allows soft rollback for newly created tech manager verification and profile while keeping user manual', async () => {
    const referenceAt = new Date('2026-08-05T06:00:00.000Z');
    const prisma: any = {
      userVerification: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: '22222222-2222-2222-2222-222222222222',
            userId: '11111111-1111-1111-1111-111111111111',
            displayName: '张三',
            verificationStatus: 'APPROVED',
            updatedAt: referenceAt,
            user: { id: '11111111-1111-1111-1111-111111111111', nickname: '张三' },
          },
        ]),
      },
      techManagerProfile: {
        findMany: vi.fn().mockResolvedValue([
          {
            userId: '11111111-1111-1111-1111-111111111111',
            updatedAt: referenceAt,
          },
        ]),
      },
      techManagerBadge: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new ImportBatchesService(prisma, audit as any, files as any);

    const result = await (service as any).evaluateTechManagerChanges(
      { executedAt: referenceAt },
      [
        {
          id: 'change-user',
          rowNo: 2,
          entityType: 'USER',
          entityId: '11111111-1111-1111-1111-111111111111',
          operation: 'CREATE',
          rollbackStrategy: 'MANUAL_ONLY',
          afterJson: { displayName: '张三', processedAt: referenceAt.toISOString() },
        },
        {
          id: 'change-verification',
          rowNo: 2,
          entityType: 'USER_VERIFICATION',
          entityId: '22222222-2222-2222-2222-222222222222',
          operation: 'CREATE',
          rollbackStrategy: 'SOFT_OFF_SHELF',
          afterJson: { displayName: '张三', processedAt: referenceAt.toISOString() },
        },
        {
          id: 'change-profile',
          rowNo: 2,
          entityType: 'TECH_MANAGER_PROFILE',
          entityId: '11111111-1111-1111-1111-111111111111',
          operation: 'CREATE',
          rollbackStrategy: 'SOFT_OFF_SHELF',
          afterJson: { displayName: '张三', processedAt: referenceAt.toISOString() },
        },
      ],
    );

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ changeId: 'change-user', rollbackStatus: 'BLOCKED' }),
        expect.objectContaining({ changeId: 'change-verification', rollbackStatus: 'ROLLBACKABLE' }),
        expect.objectContaining({ changeId: 'change-profile', rollbackStatus: 'ROLLBACKABLE' }),
      ]),
    );
  });

  it('keeps rolled back changes terminal on later previews', async () => {
    const prisma: any = {};
    const service = new ImportBatchesService(prisma, audit as any, files as any);

    const result = await (service as any).evaluateChanges(
      { executedAt: new Date('2026-08-05T06:00:00.000Z') },
      [
        {
          id: 'change-profile',
          rowNo: 1,
          entityType: 'TECH_MANAGER_PROFILE',
          entityId: '11111111-1111-1111-1111-111111111111',
          operation: 'CREATE',
          rollbackStrategy: 'SOFT_OFF_SHELF',
          rollbackStatus: 'CONFLICTED',
          rolledBackAt: new Date('2026-08-05T06:08:00.000Z'),
          afterJson: { displayName: '测试经理人' },
        },
      ],
    );

    expect(result).toEqual([
      expect.objectContaining({
        changeId: 'change-profile',
        rollbackStatus: 'ROLLED_BACK',
        blockedReason: null,
        entityLabel: '测试经理人',
      }),
    ]);
  });
});
