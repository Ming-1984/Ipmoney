import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ListingsController } from '../src/modules/listings/listings.controller';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

describe('ListingsController delegation suite', () => {
  let listings: any;
  let contentAudit: any;
  let controller: ListingsController;

  beforeEach(() => {
    listings = {
      ensureAdmin: vi.fn(),
      adminUpdate: vi.fn(),
      approve: vi.fn(),
      createBatchJob: vi.fn(),
      listBatchJobs: vi.fn(),
      getBatchJob: vi.fn(),
      listBatchJobItems: vi.fn(),
      getBatchJobErrorFile: vi.fn(),
      createImportJob: vi.fn(),
      validateImportJob: vi.fn(),
      executeImportJob: vi.fn(),
      listImportJobs: vi.fn(),
      getImportJob: vi.fn(),
      listImportJobRows: vi.fn(),
      getImportJobErrorFile: vi.fn(),
    };
    contentAudit = {
      listMaterials: vi.fn(),
      listLogs: vi.fn(),
    };
    controller = new ListingsController(listings, contentAudit);
  });

  it('delegates getMaterials with normalized UUID when listing.read permission exists', async () => {
    const req: any = { auth: { permissions: new Set(['listing.read']) } };
    contentAudit.listMaterials.mockResolvedValueOnce({ items: [{ id: 'm-1' }] });

    await expect(controller.getMaterials(req, ` ${VALID_UUID} `)).resolves.toEqual({ items: [{ id: 'm-1' }] });

    expect(listings.ensureAdmin).toHaveBeenCalledWith(req);
    expect(contentAudit.listMaterials).toHaveBeenCalledWith('LISTING', VALID_UUID);
  });

  it('rejects getMaterials when permission is missing', async () => {
    const req: any = { auth: { permissions: new Set(['auditLog.read']) } };

    await expect(controller.getMaterials(req, VALID_UUID)).rejects.toBeInstanceOf(ForbiddenException);

    expect(listings.ensureAdmin).toHaveBeenCalledWith(req);
    expect(contentAudit.listMaterials).not.toHaveBeenCalled();
  });

  it('delegates getAuditLogs with auditLog.read permission', async () => {
    const req: any = { auth: { permissions: new Set(['auditLog.read']) } };
    contentAudit.listLogs.mockResolvedValueOnce({ items: [{ id: 'log-1' }] });

    await expect(controller.getAuditLogs(req, VALID_UUID)).resolves.toEqual({ items: [{ id: 'log-1' }] });

    expect(listings.ensureAdmin).toHaveBeenCalledWith(req);
    expect(contentAudit.listLogs).toHaveBeenCalledWith('LISTING', VALID_UUID);
  });

  it('rejects getAuditLogs when listingId is invalid', async () => {
    const req: any = { auth: { permissions: new Set(['auditLog.read']) } };

    await expect(controller.getAuditLogs(req, 'not-a-uuid')).rejects.toBeInstanceOf(BadRequestException);
    expect(contentAudit.listLogs).not.toHaveBeenCalled();
  });

  it('delegates adminUpdate with fallback empty body and normalized UUID', async () => {
    const req: any = { auth: { permissions: new Set(['listing.audit']) } };
    listings.adminUpdate.mockResolvedValueOnce({ id: VALID_UUID, title: 'updated' });

    await expect(controller.adminUpdate(req, ` ${VALID_UUID} `, null as any)).resolves.toEqual({
      id: VALID_UUID,
      title: 'updated',
    });
    expect(listings.adminUpdate).toHaveBeenCalledWith(req, VALID_UUID, {});
  });

  it('delegates approve with normalized UUID and operator identity', async () => {
    const req: any = { auth: { userId: 'admin-1', permissions: new Set(['listing.audit']) } };
    listings.approve.mockResolvedValueOnce({ ok: true });

    await expect(controller.approve(req, VALID_UUID, { reason: 'looks good' })).resolves.toEqual({ ok: true });
    expect(listings.approve).toHaveBeenCalledWith(VALID_UUID, 'admin-1', 'looks good');
  });

  it('delegates createBatchJob with listing.batchPublish permission', async () => {
    const req: any = { auth: { permissions: new Set(['listing.batchPublish']) } };
    listings.createBatchJob.mockResolvedValueOnce({ id: 'job-1' });

    await expect(
      controller.createBatchJob(req, { action: 'PUBLISH', listingIds: [VALID_UUID], reason: 'ops' }),
    ).resolves.toEqual({ id: 'job-1' });
    expect(listings.createBatchJob).toHaveBeenCalledWith(req, {
      action: 'PUBLISH',
      listingIds: [VALID_UUID],
      reason: 'ops',
    });
  });

  it('rejects createBatchJob when listing.batchPublish permission is missing', async () => {
    const req: any = { auth: { permissions: new Set(['listing.audit']) } };

    await expect(controller.createBatchJob(req, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(listings.createBatchJob).not.toHaveBeenCalled();
  });

  it('delegates batch job query endpoints with normalized jobId', async () => {
    const req: any = { auth: { permissions: new Set(['listing.batchPublish']) } };
    listings.listBatchJobs.mockResolvedValueOnce({ items: [] });
    listings.getBatchJob.mockResolvedValueOnce({ id: VALID_UUID });
    listings.listBatchJobItems.mockResolvedValueOnce({ items: [] });
    listings.getBatchJobErrorFile.mockResolvedValueOnce({ fileId: null, url: null });

    await expect(controller.listBatchJobs(req, { status: 'RUNNING' })).resolves.toEqual({ items: [] });
    await expect(controller.getBatchJob(req, ` ${VALID_UUID} `)).resolves.toEqual({ id: VALID_UUID });
    await expect(controller.listBatchJobItems(req, ` ${VALID_UUID} `, { status: 'FAILED' })).resolves.toEqual({
      items: [],
    });
    await expect(controller.getBatchJobErrorFile(req, ` ${VALID_UUID} `)).resolves.toEqual({ fileId: null, url: null });

    expect(listings.getBatchJob).toHaveBeenCalledWith(req, VALID_UUID);
    expect(listings.listBatchJobItems).toHaveBeenCalledWith(req, VALID_UUID, { status: 'FAILED' });
    expect(listings.getBatchJobErrorFile).toHaveBeenCalledWith(req, VALID_UUID);
  });

  it('rejects batch job detail when jobId is invalid UUID', async () => {
    const req: any = { auth: { permissions: new Set(['listing.batchPublish']) } };
    await expect(controller.getBatchJob(req, 'bad-job-id')).rejects.toBeInstanceOf(BadRequestException);
    expect(listings.getBatchJob).not.toHaveBeenCalled();
  });

  it('delegates import endpoints with listing.import permission', async () => {
    const req: any = { auth: { permissions: new Set(['listing.import']) } };
    listings.createImportJob.mockResolvedValueOnce({ id: 'import-job-1' });
    listings.validateImportJob.mockResolvedValueOnce({ id: VALID_UUID, status: 'PENDING' });
    listings.executeImportJob.mockResolvedValueOnce({ id: VALID_UUID, status: 'RUNNING' });
    listings.listImportJobs.mockResolvedValueOnce({ items: [] });
    listings.getImportJob.mockResolvedValueOnce({ id: VALID_UUID });
    listings.listImportJobRows.mockResolvedValueOnce({ items: [] });
    listings.getImportJobErrorFile.mockResolvedValueOnce({ fileId: null, url: null });

    await expect(controller.createImportJob(req, { fileId: VALID_UUID })).resolves.toEqual({ id: 'import-job-1' });
    await expect(controller.validateImportJob(req, ` ${VALID_UUID} `)).resolves.toEqual({
      id: VALID_UUID,
      status: 'PENDING',
    });
    await expect(controller.executeImportJob(req, ` ${VALID_UUID} `)).resolves.toEqual({
      id: VALID_UUID,
      status: 'RUNNING',
    });
    await expect(controller.listImportJobs(req, {})).resolves.toEqual({ items: [] });
    await expect(controller.getImportJob(req, ` ${VALID_UUID} `)).resolves.toEqual({ id: VALID_UUID });
    await expect(controller.listImportJobRows(req, ` ${VALID_UUID} `, { status: 'FAILED' })).resolves.toEqual({
      items: [],
    });
    await expect(controller.getImportJobErrorFile(req, ` ${VALID_UUID} `)).resolves.toEqual({ fileId: null, url: null });

    expect(listings.validateImportJob).toHaveBeenCalledWith(req, VALID_UUID);
    expect(listings.executeImportJob).toHaveBeenCalledWith(req, VALID_UUID);
    expect(listings.getImportJob).toHaveBeenCalledWith(req, VALID_UUID);
    expect(listings.listImportJobRows).toHaveBeenCalledWith(req, VALID_UUID, { status: 'FAILED' });
    expect(listings.getImportJobErrorFile).toHaveBeenCalledWith(req, VALID_UUID);
  });

  it('rejects import route when listing.import permission is missing', async () => {
    const req: any = { auth: { permissions: new Set(['listing.read']) } };
    await expect(controller.createImportJob(req, { fileId: VALID_UUID })).rejects.toBeInstanceOf(ForbiddenException);
    expect(listings.createImportJob).not.toHaveBeenCalled();
  });
});
