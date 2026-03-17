import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DemandsService } from '../src/modules/demands/demands.service';

const DEMAND_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-1';

const USER_REQ = { auth: { userId: USER_ID } };
const ADMIN_REQ = { auth: { userId: 'admin-1', isAdmin: true } };

function buildDemand(overrides: Record<string, unknown> = {}) {
  return {
    id: DEMAND_ID,
    publisherUserId: USER_ID,
    source: 'USER',
    title: 'Demand A',
    summary: 'summary',
    description: 'description',
    keywordsJson: ['AI'],
    deliveryPeriod: 'MONTH_1_3',
    cooperationModesJson: ['COOP'],
    budgetType: 'FIXED',
    budgetMinFen: 100,
    budgetMaxFen: 500,
    contactName: 'Alice',
    contactTitle: 'Manager',
    contactPhoneMasked: '138****0000',
    coverFileId: 'cover-file-1',
    regionCode: '440300',
    industryTagsJson: ['AI', 'smoke-tag-temp'],
    auditStatus: 'PENDING',
    status: 'DRAFT',
    createdAt: new Date('2026-03-13T00:00:00.000Z'),
    updatedAt: new Date('2026-03-13T01:00:00.000Z'),
    coverFile: { url: 'https://example.com/cover.png' },
    media: [
      {
        fileId: 'media-1',
        type: 'IMAGE',
        sort: 0,
        file: { url: 'https://example.com/media-1.png', mimeType: 'image/png', sizeBytes: 123, fileName: '1.png' },
      },
    ],
    stats: { viewCount: 1, favoriteCount: 2, consultCount: 3, commentCount: 4 },
    ...overrides,
  };
}

describe('DemandsService write flow suite', () => {
  let prisma: any;
  let audit: any;
  let notifications: any;
  let service: DemandsService;

  beforeEach(() => {
    prisma = {
      $transaction: vi.fn(async (fn: any) => fn(prisma)),
      demand: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      demandMedia: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { id: USER_ID, nickname: 'User One', regionCode: '440300', verifications: [] },
          { id: 'owner-2', nickname: 'Owner Two', regionCode: '110000', verifications: [] },
          { id: 'owner-3', nickname: 'Owner Three', regionCode: '310000', verifications: [] },
        ]),
      },
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    notifications = { create: vi.fn().mockResolvedValue(undefined) };
    const events = { recordView: vi.fn().mockResolvedValue(undefined) };
    const config = { getRecommendation: vi.fn().mockResolvedValue({ enabled: false }) };
    service = new DemandsService(prisma, audit, notifications, events as any, config as any);
  });

  it('validates create payload strictly', async () => {
    await expect(service.create(USER_REQ, { title: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(USER_REQ, { title: 'Demand', deliveryPeriod: '' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(USER_REQ, { title: 'Demand', budgetType: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(USER_REQ, { title: 'Demand', regionCode: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(USER_REQ, { title: 'Demand', budgetMinFen: '1.2' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create normalizes payload and writes media rows', async () => {
    prisma.demand.create.mockResolvedValueOnce({ id: DEMAND_ID });
    prisma.demand.findUnique.mockResolvedValueOnce(buildDemand({ title: 'Demand Create', budgetType: 'FIXED' }));

    const result = await service.create(USER_REQ, {
      title: '  Demand Create  ',
      summary: null,
      description: '  desc  ',
      keywords: [' AI ', '', 'ml'],
      cooperationModes: ' COOP_A , COOP_B ',
      deliveryPeriod: 'month_1_3',
      budgetType: 'fixed',
      budgetMinFen: '100',
      budgetMaxFen: '500',
      contactName: ' Alice ',
      contactTitle: ' Manager ',
      contactPhoneMasked: ' 138****0000 ',
      coverFileId: ' cover-file-1 ',
      regionCode: '440300',
      industryTags: ['AI', 'smoke-tag-temp'],
      media: [
        { fileId: ' media-1 ', type: 'image', sort: 3 },
        { fileId: '', type: 'image', sort: 4 },
      ],
    });

    expect(prisma.demand.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publisherUserId: USER_ID,
          source: 'USER',
          title: 'Demand Create',
          description: 'desc',
          keywordsJson: ['AI', 'ml'],
          cooperationModesJson: ['COOP_A', 'COOP_B'],
          deliveryPeriod: 'MONTH_1_3',
          budgetType: 'FIXED',
          budgetMinFen: 100,
          budgetMaxFen: 500,
          contactName: 'Alice',
          contactTitle: 'Manager',
          contactPhoneMasked: '138****0000',
          coverFileId: 'cover-file-1',
          regionCode: '440300',
          industryTagsJson: ['AI'],
        }),
      }),
    );
    expect(prisma.demandMedia.createMany).toHaveBeenCalledWith({
      data: [{ demandId: DEMAND_ID, fileId: 'media-1', type: 'IMAGE', sort: 3 }],
    });
    expect(result).toMatchObject({
      id: DEMAND_ID,
      title: 'Demand Create',
      budgetType: 'FIXED',
      publisherUserId: USER_ID,
    });
  });

  it('update validates ownership and strict patch fields', async () => {
    prisma.demand.findUnique.mockResolvedValueOnce(null);
    await expect(service.update(USER_REQ, DEMAND_ID, {})).rejects.toBeInstanceOf(NotFoundException);

    prisma.demand.findUnique.mockResolvedValueOnce(buildDemand({ publisherUserId: 'other-user' }));
    await expect(service.update(USER_REQ, DEMAND_ID, {})).rejects.toBeInstanceOf(NotFoundException);

    prisma.demand.findUnique.mockResolvedValueOnce(buildDemand());
    await expect(service.update(USER_REQ, DEMAND_ID, { title: '   ' })).rejects.toBeInstanceOf(BadRequestException);

    prisma.demand.findUnique.mockResolvedValueOnce(buildDemand());
    await expect(service.update(USER_REQ, DEMAND_ID, { coverFileId: '' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update applies normalized patch and media replacement', async () => {
    prisma.demand.findUnique.mockResolvedValueOnce(buildDemand());
    prisma.demand.update.mockResolvedValueOnce({ id: DEMAND_ID });
    prisma.demand.findUnique.mockResolvedValueOnce(
      buildDemand({
        title: 'Demand Updated',
        summary: null,
        description: 'new desc',
        budgetType: 'NEGOTIABLE',
        budgetMinFen: 0,
        budgetMaxFen: 200,
        regionCode: null,
        status: 'ACTIVE',
      }),
    );

    const result = await service.update(USER_REQ, DEMAND_ID, {
      title: '  Demand Updated ',
      summary: null,
      description: ' new desc ',
      budgetType: 'negotiable',
      budgetMinFen: '0',
      budgetMaxFen: '200',
      regionCode: null,
      keywords: ['AI'],
      cooperationModes: 'COOP_X',
      industryTags: ['AI', 'smoke-tag-temp'],
      media: [{ fileId: ' media-2 ', type: 'image', sort: 1 }],
    });

    expect(prisma.demand.update).toHaveBeenCalledWith({
      where: { id: DEMAND_ID },
      data: expect.objectContaining({
        title: 'Demand Updated',
        summary: null,
        description: 'new desc',
        budgetType: 'NEGOTIABLE',
        budgetMinFen: 0,
        budgetMaxFen: 200,
        regionCode: null,
        keywordsJson: ['AI'],
        cooperationModesJson: ['COOP_X'],
        industryTagsJson: ['AI'],
      }),
    });
    expect(prisma.demandMedia.deleteMany).toHaveBeenCalledWith({ where: { demandId: DEMAND_ID } });
    expect(prisma.demandMedia.createMany).toHaveBeenCalledWith({
      data: [{ demandId: DEMAND_ID, fileId: 'media-2', type: 'IMAGE', sort: 1 }],
    });
    expect(result).toMatchObject({ id: DEMAND_ID, title: 'Demand Updated', budgetType: 'NEGOTIABLE' });
  });

  it('submit and offShelf enforce owner checks and apply transitions', async () => {
    prisma.demand.findUnique.mockResolvedValueOnce(null);
    await expect(service.submit(USER_REQ, DEMAND_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.demand.findUnique.mockResolvedValueOnce(buildDemand({ publisherUserId: 'other-user' }));
    await expect(service.submit(USER_REQ, DEMAND_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.demand.findUnique
      .mockResolvedValueOnce(buildDemand({ publisherUserId: USER_ID }))
      .mockResolvedValueOnce(buildDemand({ publisherUserId: USER_ID }));
    prisma.demand.update
      .mockResolvedValueOnce(buildDemand({ status: 'ACTIVE', auditStatus: 'PENDING' }))
      .mockResolvedValueOnce(buildDemand({ status: 'OFF_SHELF' }));

    const submitted = await service.submit(USER_REQ, DEMAND_ID);
    const offShelved = await service.offShelf(USER_REQ, DEMAND_ID, {});

    expect(prisma.demand.update).toHaveBeenNthCalledWith(1, {
      where: { id: DEMAND_ID },
      data: { status: 'ACTIVE', auditStatus: 'PENDING' },
    });
    expect(prisma.demand.update).toHaveBeenNthCalledWith(2, {
      where: { id: DEMAND_ID },
      data: { status: 'OFF_SHELF' },
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'DEMAND_SUBMIT', targetId: DEMAND_ID }));
    expect(submitted.status).toBe('ACTIVE');
    expect(offShelved.status).toBe('OFF_SHELF');
  });

  it('adminCreate and adminUpdate validate strict fields and normalize writes', async () => {
    await expect(service.adminCreate(ADMIN_REQ, { title: 'A', status: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminCreate(ADMIN_REQ, { title: 'A', ownerId: '' })).rejects.toBeInstanceOf(BadRequestException);

    prisma.demand.create.mockResolvedValueOnce({ id: DEMAND_ID });
    prisma.demand.findUnique.mockResolvedValueOnce(
      buildDemand({ publisherUserId: 'owner-2', source: 'PLATFORM', auditStatus: 'APPROVED', status: 'ACTIVE' }),
    );
    const created = await service.adminCreate(ADMIN_REQ, {
      title: ' Admin Demand ',
      source: 'platform',
      ownerId: ' owner-2 ',
      auditStatus: 'approved',
      status: 'active',
      media: [{ fileId: ' media-3 ', type: 'image', sort: 2 }],
    });

    expect(prisma.demand.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publisherUserId: 'owner-2',
          source: 'PLATFORM',
          title: 'Admin Demand',
          auditStatus: 'APPROVED',
          status: 'ACTIVE',
        }),
      }),
    );
    expect(created.status).toBe('ACTIVE');

    prisma.demand.findUnique.mockResolvedValueOnce(buildDemand());
    prisma.demand.update.mockResolvedValueOnce({ id: DEMAND_ID });
    prisma.demand.findUnique.mockResolvedValueOnce(
      buildDemand({
        publisherUserId: 'owner-3',
        source: 'ADMIN',
        title: 'Admin Updated',
        auditStatus: 'REJECTED',
        status: 'OFF_SHELF',
      }),
    );

    const updated = await service.adminUpdate(ADMIN_REQ, DEMAND_ID, {
      publisherUserId: ' owner-3 ',
      source: 'admin',
      title: ' Admin Updated ',
      auditStatus: 'rejected',
      status: 'off_shelf',
      media: [],
    });

    expect(prisma.demand.update).toHaveBeenCalledWith({
      where: { id: DEMAND_ID },
      data: expect.objectContaining({
        publisherUserId: 'owner-3',
        source: 'ADMIN',
        title: 'Admin Updated',
        auditStatus: 'REJECTED',
        status: 'OFF_SHELF',
      }),
    });
    expect(prisma.demandMedia.deleteMany).toHaveBeenCalledWith({ where: { demandId: DEMAND_ID } });
    expect(updated).toMatchObject({ publisherUserId: 'owner-3', status: 'OFF_SHELF' });
  });

  it('admin publish/off-shelf/approve/reject cover missing and success branches', async () => {
    prisma.demand.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminPublish(ADMIN_REQ, DEMAND_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.demand.findUnique
      .mockResolvedValueOnce(buildDemand({ status: 'DRAFT' }))
      .mockResolvedValueOnce(buildDemand({ status: 'ACTIVE' }))
      .mockResolvedValueOnce(buildDemand({ status: 'DRAFT' }))
      .mockResolvedValueOnce(buildDemand({ status: 'ACTIVE' }));
    prisma.demand.update
      .mockResolvedValueOnce(buildDemand({ status: 'ACTIVE', auditStatus: 'APPROVED' }))
      .mockResolvedValueOnce(buildDemand({ status: 'OFF_SHELF' }))
      .mockResolvedValueOnce(buildDemand({ status: 'ACTIVE', auditStatus: 'APPROVED', title: 'Demand A' }))
      .mockResolvedValueOnce(buildDemand({ status: 'ACTIVE', auditStatus: 'REJECTED', title: 'Demand A' }));

    const published = await service.adminPublish(ADMIN_REQ, DEMAND_ID);
    const offShelved = await service.adminOffShelf(ADMIN_REQ, DEMAND_ID);
    const approved = await service.adminApprove(ADMIN_REQ, DEMAND_ID);
    const rejected = await service.adminReject(ADMIN_REQ, DEMAND_ID, { reason: 'need more details' });

    expect(published.status).toBe('ACTIVE');
    expect(offShelved.status).toBe('OFF_SHELF');
    expect(approved.auditStatus).toBe('APPROVED');
    expect(rejected.auditStatus).toBe('REJECTED');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'DEMAND_APPROVE', targetId: DEMAND_ID }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'DEMAND_REJECT', targetId: DEMAND_ID }));
    expect(notifications.create).toHaveBeenCalledTimes(2);
  });
});
