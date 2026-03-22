import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatentsController } from '../src/modules/patents/patents.controller';

const VALID_UUID = '15151515-1515-4151-8151-151515151515';

describe('PatentsController delegation suite', () => {
  let patents: any;
  let controller: PatentsController;

  beforeEach(() => {
    patents = {
      ensureAdmin: vi.fn(),
      adminList: vi.fn(),
      adminCreate: vi.fn(),
      adminGetById: vi.fn(),
      adminUpdate: vi.fn(),
      createImportJob: vi.fn(),
      validateImportJob: vi.fn(),
      executeImportJob: vi.fn(),
      listImportJobs: vi.fn(),
      getImportJob: vi.fn(),
      listImportJobRows: vi.fn(),
      getImportJobErrorFile: vi.fn(),
      adminGenerateListings: vi.fn(),
      createMyClaim: vi.fn(),
      listMyClaims: vi.fn(),
      adminListClaims: vi.fn(),
      approveClaim: vi.fn(),
      rejectClaim: vi.fn(),
      normalizeNumber: vi.fn(),
      getPatentById: vi.fn(),
    };
    controller = new PatentsController(patents);
  });

  it('delegates admin list/get with listing.read permission', async () => {
    const req: any = { auth: { permissions: new Set(['listing.read']) } };
    patents.adminList.mockResolvedValueOnce({ items: [] });
    patents.adminGetById.mockResolvedValueOnce({ id: VALID_UUID });

    await expect(controller.adminList(req, undefined as any)).resolves.toEqual({ items: [] });
    await expect(controller.adminGetById(req, VALID_UUID)).resolves.toEqual({ id: VALID_UUID });

    expect(patents.ensureAdmin).toHaveBeenCalledWith(req);
    expect(patents.adminList).toHaveBeenCalledWith(req, {});
    expect(patents.adminGetById).toHaveBeenCalledWith(req, VALID_UUID);
  });

  it('delegates admin create/update with listing.audit permission and body fallback', async () => {
    const req: any = { auth: { permissions: new Set(['listing.audit']) } };
    patents.adminCreate.mockResolvedValueOnce({ id: VALID_UUID });
    patents.adminUpdate.mockResolvedValueOnce({ ok: true });

    await expect(controller.adminCreate(req, undefined as any)).resolves.toEqual({ id: VALID_UUID });
    await expect(controller.adminUpdate(req, VALID_UUID, null as any)).resolves.toEqual({ ok: true });

    expect(patents.ensureAdmin).toHaveBeenCalledWith(req);
    expect(patents.adminCreate).toHaveBeenCalledWith(req, {});
    expect(patents.adminUpdate).toHaveBeenCalledWith(req, VALID_UUID, {});
  });

  it('delegates patent import and batch listing routes with patent.import permission', async () => {
    const req: any = { auth: { permissions: new Set(['patent.import']) } };
    patents.createImportJob.mockResolvedValueOnce({ id: VALID_UUID });
    patents.validateImportJob.mockResolvedValueOnce({ id: VALID_UUID, status: 'PENDING' });
    patents.executeImportJob.mockResolvedValueOnce({ id: VALID_UUID, status: 'RUNNING' });
    patents.listImportJobs.mockResolvedValueOnce({ items: [] });
    patents.getImportJob.mockResolvedValueOnce({ id: VALID_UUID });
    patents.listImportJobRows.mockResolvedValueOnce({ items: [] });
    patents.getImportJobErrorFile.mockResolvedValueOnce({ fileId: null, url: null });
    patents.adminGenerateListings.mockResolvedValueOnce({ totalCount: 1, successCount: 1, failedCount: 0, skippedCount: 0, rows: [] });

    await expect(controller.createImportJob(req, { fileId: VALID_UUID })).resolves.toEqual({ id: VALID_UUID });
    await expect(controller.validateImportJob(req, ` ${VALID_UUID} `)).resolves.toEqual({ id: VALID_UUID, status: 'PENDING' });
    await expect(controller.executeImportJob(req, ` ${VALID_UUID} `)).resolves.toEqual({ id: VALID_UUID, status: 'RUNNING' });
    await expect(controller.listImportJobs(req, {})).resolves.toEqual({ items: [] });
    await expect(controller.getImportJob(req, ` ${VALID_UUID} `)).resolves.toEqual({ id: VALID_UUID });
    await expect(controller.listImportJobRows(req, ` ${VALID_UUID} `, { status: 'FAILED' })).resolves.toEqual({ items: [] });
    await expect(controller.getImportJobErrorFile(req, ` ${VALID_UUID} `)).resolves.toEqual({ fileId: null, url: null });
    await expect(controller.adminGenerateListings(req, { patentIds: [VALID_UUID] })).resolves.toMatchObject({ totalCount: 1 });

    expect(patents.validateImportJob).toHaveBeenCalledWith(req, VALID_UUID);
    expect(patents.executeImportJob).toHaveBeenCalledWith(req, VALID_UUID);
    expect(patents.getImportJob).toHaveBeenCalledWith(req, VALID_UUID);
    expect(patents.listImportJobRows).toHaveBeenCalledWith(req, VALID_UUID, { status: 'FAILED' });
    expect(patents.getImportJobErrorFile).toHaveBeenCalledWith(req, VALID_UUID);
  });

  it('delegates claim routes and enforces patent.claim.review for admin review endpoints', async () => {
    const userReq: any = { auth: { userId: 'user-1', permissions: new Set() } };
    const adminReq: any = { auth: { isAdmin: true, permissions: new Set(['patent.claim.review']) } };
    patents.createMyClaim.mockResolvedValueOnce({ id: VALID_UUID, status: 'PENDING' });
    patents.listMyClaims.mockResolvedValueOnce({ items: [] });
    patents.adminListClaims.mockResolvedValueOnce({ items: [] });
    patents.approveClaim.mockResolvedValueOnce({ id: VALID_UUID, status: 'APPROVED' });
    patents.rejectClaim.mockResolvedValueOnce({ id: VALID_UUID, status: 'REJECTED' });

    await expect(controller.createMyClaim(userReq, { patentId: VALID_UUID, evidenceFileIds: [VALID_UUID] })).resolves.toMatchObject({
      id: VALID_UUID,
      status: 'PENDING',
    });
    await expect(controller.listMyClaims(userReq, {})).resolves.toEqual({ items: [] });
    await expect(controller.adminListClaims(adminReq, {})).resolves.toEqual({ items: [] });
    await expect(controller.approveClaim(adminReq, ` ${VALID_UUID} `, {})).resolves.toMatchObject({
      id: VALID_UUID,
      status: 'APPROVED',
    });
    await expect(controller.rejectClaim(adminReq, ` ${VALID_UUID} `, { reviewComment: 'bad evidence' })).resolves.toMatchObject({
      id: VALID_UUID,
      status: 'REJECTED',
    });

    const noPermReq: any = { auth: { isAdmin: true, permissions: new Set(['listing.read']) } };
    await expect(controller.adminListClaims(noPermReq, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.approveClaim(noPermReq, VALID_UUID, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.rejectClaim(noPermReq, VALID_UUID, { reviewComment: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects admin read/write when corresponding permission is missing', async () => {
    const reqRead: any = { auth: { permissions: new Set(['listing.audit']) } };
    const reqWrite: any = { auth: { permissions: new Set(['listing.read']) } };

    await expect(controller.adminList(reqRead, {} as any)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.adminCreate(reqWrite, {} as any)).rejects.toBeInstanceOf(ForbiddenException);

    expect(patents.adminList).not.toHaveBeenCalled();
    expect(patents.adminCreate).not.toHaveBeenCalled();
  });

  it('rejects UUID-guarded paths when id is invalid', async () => {
    const req: any = { auth: { isAdmin: true, permissions: new Set(['patent.import', 'patent.claim.review']) } };
    await expect(controller.validateImportJob(req, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.executeImportJob(req, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.getImportJob(req, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.listImportJobRows(req, 'bad-id', {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.getImportJobErrorFile(req, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.approveClaim(req, 'bad-id', {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.rejectClaim(req, 'bad-id', { reviewComment: 'x' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('delegates normalize and public getById routes', async () => {
    patents.normalizeNumber.mockResolvedValueOnce({ normalized: 'CN123' });
    patents.getPatentById.mockResolvedValueOnce({ id: VALID_UUID });

    await expect(controller.normalize({ raw: ' cn123 ' })).resolves.toEqual({ normalized: 'CN123' });
    await expect(controller.getById(VALID_UUID)).resolves.toEqual({ id: VALID_UUID });

    expect(patents.normalizeNumber).toHaveBeenCalledWith(' cn123 ');
    expect(patents.getPatentById).toHaveBeenCalledWith(VALID_UUID);
  });
});
