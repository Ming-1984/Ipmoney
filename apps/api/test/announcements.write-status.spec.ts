import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnnouncementsService } from '../src/modules/announcements/announcements.service';

const ADMIN_REQ = { auth: { userId: 'admin-user-1' } };
const VALID_ID = '11111111-1111-1111-1111-111111111111';

describe('AnnouncementsService write and status suite', () => {
  let prisma: any;
  let audit: any;
  let service: AnnouncementsService;

  beforeEach(() => {
    prisma = {
      announcement: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    service = new AnnouncementsService(prisma, audit);
  });

  it('validates adminCreate payload strictly', async () => {
    await expect(service.adminCreate(ADMIN_REQ, { title: ' ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminCreate(ADMIN_REQ, { title: 'A', issueNo: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.adminCreate(ADMIN_REQ, { title: 'A', status: 'invalid' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('adminCreate normalizes payload, sets publishedAt, and writes audit log', async () => {
    prisma.announcement.create.mockResolvedValueOnce({
      id: VALID_ID,
      title: 'Notice A',
      summary: null,
      content: 'content',
      publisherName: 'Publisher A',
      issueNo: 'ISSUE-1',
      sourceUrl: 'https://example.com',
      tagsJson: ['AI', 'smoke-tag-temp'],
      relatedPatentsJson: [{ name: 'Patent A', patentNo: 'CN123' }],
      status: 'PUBLISHED',
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      publishedAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });

    const result = await service.adminCreate(ADMIN_REQ, {
      title: ' Notice A ',
      summary: '',
      content: ' content ',
      publisherName: ' Publisher A ',
      issueNo: ' ISSUE-1 ',
      sourceUrl: ' https://example.com ',
      tags: 'AI, smoke-tag-temp',
      relatedPatents: [{ name: ' Patent A ', patentNo: ' CN123 ' }, { name: '', patentNo: '' }],
      status: 'published',
    });

    expect(prisma.announcement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'Notice A',
        summary: null,
        content: 'content',
        publisherName: 'Publisher A',
        issueNo: 'ISSUE-1',
        sourceUrl: 'https://example.com',
        tagsJson: ['AI', 'smoke-tag-temp'],
        relatedPatentsJson: [{ name: 'Patent A', patentNo: 'CN123' }],
        status: 'PUBLISHED',
        publishedAt: expect.any(Date),
      }),
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-user-1',
        action: 'ANNOUNCEMENT_CREATE',
        targetType: 'ANNOUNCEMENT',
        targetId: VALID_ID,
      }),
    );
    expect(result).toMatchObject({
      id: VALID_ID,
      status: 'PUBLISHED',
      tags: ['AI', 'smoke-tag-temp'],
      relatedPatents: [{ name: 'Patent A', patentNo: 'CN123' }],
    });
  });

  it('validates adminUpdate id and missing target', async () => {
    await expect(service.adminUpdate(ADMIN_REQ, 'bad-id', {})).rejects.toBeInstanceOf(BadRequestException);

    prisma.announcement.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminUpdate(ADMIN_REQ, VALID_ID, {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('adminUpdate applies normalized patch and status transition audit', async () => {
    prisma.announcement.findUnique.mockResolvedValueOnce({
      id: VALID_ID,
      title: 'Old title',
      status: 'DRAFT',
      publishedAt: null,
    });
    prisma.announcement.update.mockResolvedValueOnce({
      id: VALID_ID,
      title: 'New title',
      summary: null,
      content: null,
      publisherName: null,
      issueNo: null,
      sourceUrl: null,
      tagsJson: ['AI', 'e2e-tag-temp'],
      relatedPatentsJson: [{ name: 'Patent B', patentNo: '' }],
      status: 'PUBLISHED',
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      publishedAt: new Date('2026-03-13T01:00:00.000Z'),
      updatedAt: new Date('2026-03-13T01:00:00.000Z'),
    });

    const result = await service.adminUpdate(ADMIN_REQ, VALID_ID, {
      title: ' New title ',
      summary: '',
      content: '',
      publisherName: '',
      issueNo: null,
      sourceUrl: '',
      tags: ['AI', 'e2e-tag-temp'],
      relatedPatents: [{ name: 'Patent B', patentNo: '' }, { name: '', patentNo: '' }],
      status: 'published',
    });

    expect(prisma.announcement.update).toHaveBeenCalledWith({
      where: { id: VALID_ID },
      data: expect.objectContaining({
        title: 'New title',
        summary: null,
        content: null,
        publisherName: null,
        issueNo: null,
        sourceUrl: null,
        tagsJson: ['AI', 'e2e-tag-temp'],
        relatedPatentsJson: [{ name: 'Patent B', patentNo: '' }],
        status: 'PUBLISHED',
        publishedAt: expect.any(Date),
      }),
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ANNOUNCEMENT_UPDATE',
        targetId: VALID_ID,
        beforeJson: { status: 'DRAFT', title: 'Old title' },
        afterJson: { status: 'PUBLISHED', title: 'New title' },
      }),
    );
    expect(result).toMatchObject({
      id: VALID_ID,
      title: 'New title',
      status: 'PUBLISHED',
      tags: ['AI', 'e2e-tag-temp'],
    });
  });

  it('adminPublish and adminOffShelf apply status transitions and audit', async () => {
    prisma.announcement.findUnique
      .mockResolvedValueOnce({ id: VALID_ID, status: 'DRAFT', publishedAt: null })
      .mockResolvedValueOnce({ id: VALID_ID, status: 'PUBLISHED', publishedAt: new Date('2026-03-13T01:00:00.000Z') });
    prisma.announcement.update
      .mockResolvedValueOnce({
        id: VALID_ID,
        title: 'Notice A',
        summary: null,
        content: null,
        publisherName: null,
        issueNo: null,
        sourceUrl: null,
        tagsJson: [],
        relatedPatentsJson: [],
        status: 'PUBLISHED',
        createdAt: new Date('2026-03-13T00:00:00.000Z'),
        publishedAt: new Date('2026-03-13T01:00:00.000Z'),
        updatedAt: new Date('2026-03-13T01:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: VALID_ID,
        title: 'Notice A',
        summary: null,
        content: null,
        publisherName: null,
        issueNo: null,
        sourceUrl: null,
        tagsJson: [],
        relatedPatentsJson: [],
        status: 'OFF_SHELF',
        createdAt: new Date('2026-03-13T00:00:00.000Z'),
        publishedAt: new Date('2026-03-13T01:00:00.000Z'),
        updatedAt: new Date('2026-03-13T02:00:00.000Z'),
      });

    const publishResult = await service.adminPublish(ADMIN_REQ, VALID_ID);
    const offShelfResult = await service.adminOffShelf(ADMIN_REQ, VALID_ID);

    expect(prisma.announcement.update).toHaveBeenNthCalledWith(1, {
      where: { id: VALID_ID },
      data: { status: 'PUBLISHED', publishedAt: expect.any(Date) },
    });
    expect(prisma.announcement.update).toHaveBeenNthCalledWith(2, {
      where: { id: VALID_ID },
      data: { status: 'OFF_SHELF' },
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'ANNOUNCEMENT_PUBLISH' }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'ANNOUNCEMENT_OFF_SHELF' }));
    expect(publishResult.status).toBe('PUBLISHED');
    expect(offShelfResult.status).toBe('OFF_SHELF');
  });

  it('adminDelete validates id/missing and writes delete audit', async () => {
    await expect(service.adminDelete(ADMIN_REQ, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);

    prisma.announcement.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminDelete(ADMIN_REQ, VALID_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.announcement.findUnique.mockResolvedValueOnce({ id: VALID_ID, status: 'DRAFT', title: 'Notice A' });
    prisma.announcement.delete.mockResolvedValueOnce({ id: VALID_ID });

    await expect(service.adminDelete(ADMIN_REQ, VALID_ID)).resolves.toEqual({ ok: true });

    expect(prisma.announcement.delete).toHaveBeenCalledWith({ where: { id: VALID_ID } });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ANNOUNCEMENT_DELETE',
        targetId: VALID_ID,
      }),
    );
  });

  it('getById hides non-published records and sanitizes tags', async () => {
    prisma.announcement.findUnique
      .mockResolvedValueOnce({ id: VALID_ID, status: 'DRAFT' })
      .mockResolvedValueOnce({
        id: VALID_ID,
        title: 'Notice A',
        summary: null,
        content: null,
        publisherName: null,
        issueNo: null,
        sourceUrl: null,
        tagsJson: ['AI', 'smoke-tag-temp'],
        relatedPatentsJson: [{ name: 'Patent A', patentNo: 'CN123' }],
        status: 'PUBLISHED',
        createdAt: new Date('2026-03-13T00:00:00.000Z'),
        publishedAt: new Date('2026-03-13T00:00:00.000Z'),
        updatedAt: new Date('2026-03-13T00:00:00.000Z'),
      });

    await expect(service.getById(VALID_ID)).rejects.toBeInstanceOf(NotFoundException);

    const result = await service.getById(VALID_ID);
    expect(result.tags).toEqual(['AI']);
    expect(result.relatedPatents).toEqual([{ name: 'Patent A', patentNo: 'CN123' }]);
  });
});
