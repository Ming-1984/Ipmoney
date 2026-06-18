import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExcelJS = require('exceljs');

import { BulkImportService } from '../src/modules/bulk-import/bulk-import.service';

describe('BulkImportService request validation', () => {
  let prisma: any;
  let files: any;
  let audit: any;
  let service: BulkImportService;

  beforeEach(() => {
    prisma = {
      region: { findMany: vi.fn().mockResolvedValue([]) },
      userVerification: { findFirst: vi.fn() },
      user: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
      techManagerProfile: { findUnique: vi.fn(), upsert: vi.fn() },
      achievement: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
      file: { findFirst: vi.fn(), create: vi.fn() },
      idempotencyKey: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      auditLog: { findMany: vi.fn(), count: vi.fn() },
    };
    files = {
      getFileById: vi.fn(),
      getFileBuffer: vi.fn(),
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    service = new BulkImportService(prisma, files, audit);
  });

  it('requires admin', async () => {
    await expect(service.previewPeopleAchievements({}, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.executePeopleAchievements({}, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('validates import payload', async () => {
    const req: any = { auth: { isAdmin: true, userId: '11111111-1111-1111-1111-111111111111' } };

    await expect(service.previewPeopleAchievements(req, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.previewPeopleAchievements(req, {
        peopleFileId: 'not-uuid',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.previewPeopleAchievements(req, {
        peopleFileId: '11111111-1111-1111-1111-111111111111',
        ratingPolicy: 'INVALID',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.previewPeopleAchievements(req, {
        peopleFileId: '11111111-1111-1111-1111-111111111111',
        defaultRatingScore: 6,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.previewPeopleAchievements(req, {
        peopleFileId: '11111111-1111-1111-1111-111111111111',
        defaultRatingCount: -1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.previewPeopleAchievements(req, {
        peopleFileId: '11111111-1111-1111-1111-111111111111',
        defaultRatingScore: 4.8,
        defaultRatingCount: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects missing file and invalid workbook in preview pipeline', async () => {
    const req: any = { auth: { isAdmin: true, userId: '11111111-1111-1111-1111-111111111111' } };

    files.getFileById.mockResolvedValueOnce(null);
    await expect(
      service.previewPeopleAchievements(req, {
        peopleFileId: '11111111-1111-1111-1111-111111111111',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    files.getFileById.mockResolvedValueOnce({ id: '11111111-1111-1111-1111-111111111111', fileName: 'people.xlsx' });
    files.getFileBuffer.mockResolvedValueOnce(Buffer.alloc(0));
    await expect(
      service.previewPeopleAchievements(req, {
        peopleFileId: '11111111-1111-1111-1111-111111111111',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists import history with paging', async () => {
    const req: any = { auth: { isAdmin: true, userId: '11111111-1111-1111-1111-111111111111' } };
    prisma.auditLog.findMany.mockResolvedValueOnce([
      {
        id: '22222222-2222-2222-2222-222222222222',
        action: 'BULK_IMPORT_EXECUTE',
        actorUserId: '11111111-1111-1111-1111-111111111111',
        actor: { nickname: 'ipmoney', phone: '13900000000' },
        createdAt: new Date('2026-04-23T12:00:00.000Z'),
        afterJson: {
          input: { sourceBatch: 'batch-a' },
          people: { totalRows: 5, validRows: 5, invalidRows: 0, created: 3, updated: 2 },
          achievements: { totalRows: 2, validRows: 2, invalidRows: 0, created: 2, updated: 0 },
        },
      },
    ]);
    prisma.auditLog.count.mockResolvedValueOnce(1);

    const result = await service.listPeopleAchievementsHistory(req, { page: 1, pageSize: 20, action: 'EXECUTE' });
    expect(result.page.total).toBe(1);
    expect(result.items[0].action).toBe('BULK_IMPORT_EXECUTE');
    expect(result.items[0].input.sourceBatch).toBe('batch-a');
    expect(result.items[0].people.totalRows).toBe(5);
    expect(prisma.auditLog.findMany).toHaveBeenCalled();
    expect(prisma.auditLog.count).toHaveBeenCalled();
  });

  it('imports tech manager formal fields from workbook headers without auto-building intro from other columns', async () => {
    const req: any = { auth: { isAdmin: true, userId: '11111111-1111-1111-1111-111111111111' } };
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('People');
    sheet.addRow([
      '姓名',
      '职位',
      '任职单位',
      '简介',
      '服务方向',
      '服务标签',
      '工作亮点',
      '从业信息',
      '等级标签',
      '联系人',
      '联系电话',
      '照片',
    ]);
    sheet.addRow([
      '张三',
      '技术经理人',
      '示例机构',
      '正式简介',
      '成果转化, 技术交易',
      '专利运营, 尽调辅导',
      '长期服务高校成果转化',
      '10年成果转化服务经验',
      '资深顾问',
      '李四',
      '13800138000',
      '/uploads/people-a.png',
    ]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    files.getFileById.mockResolvedValueOnce({ id: '11111111-1111-1111-1111-111111111111', fileName: 'people.xlsx' });
    files.getFileBuffer.mockResolvedValueOnce(buffer);
    prisma.region.findMany.mockResolvedValueOnce([]);
    prisma.userVerification.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    prisma.userVerification.create = vi.fn().mockResolvedValue({ id: 'verification-1' });
    prisma.user.findFirst.mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValueOnce({ id: 'user-tech-1', nickname: '张三' });
    prisma.user.update.mockResolvedValueOnce(undefined);
    prisma.techManagerProfile.findUnique.mockResolvedValueOnce(null);
    prisma.techManagerProfile.upsert.mockResolvedValueOnce({ userId: 'user-tech-1' });

    const result = await service.executePeopleAchievements(req, {
      peopleFileId: '11111111-1111-1111-1111-111111111111',
      sourceBatch: 'people-batch',
      defaultRegionCode: '440000',
      ratingPolicy: 'KEEP_EXISTING',
      defaultRatingScore: 4.8,
      defaultRatingCount: 16,
    });

    expect(prisma.techManagerProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          intro: '正式简介',
          serviceDirectionsJson: ['成果转化', '技术交易'],
          serviceTagsJson: ['专利运营', '尽调辅导'],
          workHighlights: '长期服务高校成果转化',
          experienceLabel: '10年成果转化服务经验',
          levelLabel: '资深顾问',
          contactName: '李四',
          contactPhone: '13800138000',
        }),
        update: expect.objectContaining({
          intro: '正式简介',
          serviceDirectionsJson: ['成果转化', '技术交易'],
          serviceTagsJson: ['专利运营', '尽调辅导'],
          workHighlights: '长期服务高校成果转化',
          experienceLabel: '10年成果转化服务经验',
          levelLabel: '资深顾问',
          contactName: '李四',
          contactPhone: '13800138000',
        }),
      }),
    );
    expect(result.people.created).toBe(1);
    expect(result.people.failed).toBe(0);
  });

  it('keeps tech manager intro empty when workbook intro column is missing instead of filling from organization or highlights', async () => {
    const req: any = { auth: { isAdmin: true, userId: '11111111-1111-1111-1111-111111111111' } };
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('People');
    sheet.addRow([
      '姓名',
      '职位',
      '任职单位',
      '服务方向',
      '服务标签',
      '工作亮点',
      '从业信息',
      '等级标签',
      '联系人',
      '联系电话',
      '照片',
    ]);
    sheet.addRow([
      '李四',
      '技术经理人',
      '示例机构B',
      '成果转化',
      '专利运营',
      '长期服务高校成果转化',
      '8年服务经验',
      '高级顾问',
      '王五',
      '13900139000',
      '/uploads/people-b.png',
    ]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    files.getFileById.mockResolvedValueOnce({ id: '11111111-1111-1111-1111-111111111111', fileName: 'people.xlsx' });
    files.getFileBuffer.mockResolvedValueOnce(buffer);
    prisma.region.findMany.mockResolvedValueOnce([]);
    prisma.userVerification.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    prisma.userVerification.create = vi.fn().mockResolvedValue({ id: 'verification-2' });
    prisma.user.findFirst.mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValueOnce({ id: 'user-tech-2', nickname: '李四' });
    prisma.user.update.mockResolvedValueOnce(undefined);
    prisma.techManagerProfile.findUnique.mockResolvedValueOnce(null);
    prisma.techManagerProfile.upsert.mockResolvedValueOnce({ userId: 'user-tech-2' });

    const result = await service.executePeopleAchievements(req, {
      peopleFileId: '11111111-1111-1111-1111-111111111111',
      sourceBatch: 'people-batch-2',
      defaultRegionCode: '440000',
      ratingPolicy: 'KEEP_EXISTING',
      defaultRatingScore: 4.8,
      defaultRatingCount: 16,
    });

    expect(prisma.userVerification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          intro: null,
        }),
      }),
    );
    expect(prisma.techManagerProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          intro: null,
          organization: '示例机构B',
          workHighlights: '长期服务高校成果转化',
        }),
        update: expect.objectContaining({
          intro: null,
          organization: '示例机构B',
          workHighlights: '长期服务高校成果转化',
        }),
      }),
    );
    expect(result.people.created).toBe(1);
    expect(result.people.failed).toBe(0);
  });

  it('preview requires formal intro column instead of accepting organization or highlights as a substitute', async () => {
    const req: any = { auth: { isAdmin: true, userId: '11111111-1111-1111-1111-111111111111' } };
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('People');
    sheet.addRow([
      '姓名',
      '职位',
      '任职单位',
      '服务方向',
      '服务标签',
      '工作亮点',
      '从业信息',
      '等级标签',
      '联系人',
      '联系电话',
      '照片',
    ]);
    sheet.addRow([
      '王五',
      '技术经理人',
      '示例机构C',
      '成果转化',
      '专利运营',
      '长期服务企业',
      '6年服务经验',
      '顾问',
      '赵六',
      '13700137000',
      '/uploads/people-c.png',
    ]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    files.getFileById.mockResolvedValueOnce({ id: '11111111-1111-1111-1111-111111111111', fileName: 'people.xlsx' });
    files.getFileBuffer.mockResolvedValueOnce(buffer);

    const result = await service.previewPeopleAchievements(req, {
      peopleFileId: '11111111-1111-1111-1111-111111111111',
    });

    expect(result.people.totalRows).toBe(1);
    expect(result.people.validRows).toBe(0);
    expect(result.people.invalidRows).toBe(1);
    expect(result.people.sampleErrors[0]?.reason).toBe('缺少正式简介字段');
  });
});

