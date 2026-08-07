import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DealRecordsService } from '../src/modules/deal-records/deal-records.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const FILE_ID = '22222222-2222-4222-8222-222222222222';
const JOB_ID = '33333333-3333-4333-8333-333333333333';
const DEAL_RECORD_ID = '44444444-4444-4444-8444-444444444444';

function buildCsvBuffer() {
  return Buffer.from(
    [
      '专利号,专利名称,交易类型,许可方/转让方,被许可方/受让方,成交时间,价格,备注',
      'CN202410000000.1,高效储能控制方法,转让,广东某科技有限公司,深圳某产业集团有限公司,2026-07-27,10.5万,示例',
    ].join('\n'),
    'utf8',
  );
}

function buildLargeCsvBuffer(rowCount: number) {
  const rows = ['patentNo,patentTitle,tradeType,seller,buyer,dealAt,price,note'];
  for (let index = 0; index < rowCount; index += 1) {
    const patentNo = `CN2024${String(index + 1).padStart(8, '0')}.1`;
    rows.push(`${patentNo},Patent ${index + 1},TRANSFER,Seller ${index + 1},Buyer ${index + 1},2026-07-27,100,`);
  }
  return Buffer.from(rows.join('\n'), 'utf8');
}

describe('DealRecordsService', () => {
  let prisma: any;
  let files: any;
  let audit: any;
  let service: DealRecordsService;

  beforeEach(() => {
    prisma = {
      dealRecord: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
      },
      dealRecordImportJob: {
        create: vi.fn(),
        update: vi.fn(),
      },
      dealRecordImportJobRow: {
        create: vi.fn(),
      },
      patent: {
        findFirst: vi.fn(),
      },
      order: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(async (handler: any) => handler(prisma)),
    };
    files = {
      getFileById: vi.fn().mockResolvedValue({ id: FILE_ID, fileName: 'deal-records.csv', url: '' }),
      getFileBuffer: vi.fn().mockResolvedValue(buildCsvBuffer()),
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    service = new DealRecordsService(prisma, files, audit);
  });

  it('previews deal record import rows with normalized money and dedupe warnings', async () => {
    prisma.dealRecord.findMany.mockImplementationOnce(async (args: any) => [
      { id: DEAL_RECORD_ID, dedupeKey: args.where.dedupeKey.in[0] },
    ]);

    const result = await service.previewImport(
      { auth: { isAdmin: true, userId: USER_ID } },
      { fileId: FILE_ID, duplicatePolicy: 'SKIP' },
    );

    expect(result.summary).toMatchObject({ totalRows: 1, validRows: 1, invalidRows: 0, duplicateRows: 1 });
    expect(result.sampleRows[0].data).toMatchObject({
      patentNoDisplay: 'CN202410000000.1',
      patentTitle: '高效储能控制方法',
      tradeType: 'TRANSFER',
      priceFen: 10500000,
    });
    expect(result.sampleWarnings[0]).toMatchObject({ rowNo: 2, code: 'DUPLICATE_EXISTING' });
  });

  it('executes deal record import and writes job, row, deal record, and audit log', async () => {
    prisma.dealRecord.findMany.mockResolvedValueOnce([]);
    prisma.dealRecordImportJob.create.mockResolvedValueOnce({
      id: JOB_ID,
      operatorUserId: USER_ID,
      fileId: FILE_ID,
      status: 'PENDING',
      duplicatePolicy: 'SKIP',
      totalCount: 1,
      validCount: 1,
      invalidCount: 0,
      successCount: 0,
      skippedCount: 0,
      failedCount: 0,
      createdAt: new Date('2026-07-27T00:00:00.000Z'),
      updatedAt: new Date('2026-07-27T00:00:00.000Z'),
      finishedAt: null,
    });
    prisma.patent.findFirst.mockResolvedValueOnce({ id: '55555555-5555-4555-8555-555555555555' });
    prisma.dealRecord.findUnique.mockResolvedValueOnce(null);
    prisma.dealRecord.create.mockResolvedValueOnce({ id: DEAL_RECORD_ID });
    prisma.dealRecordImportJobRow.create.mockResolvedValueOnce({});
    prisma.dealRecordImportJob.update.mockResolvedValueOnce({
      id: JOB_ID,
      operatorUserId: USER_ID,
      fileId: FILE_ID,
      status: 'SUCCEEDED',
      duplicatePolicy: 'SKIP',
      totalCount: 1,
      validCount: 1,
      invalidCount: 0,
      successCount: 1,
      skippedCount: 0,
      failedCount: 0,
      createdAt: new Date('2026-07-27T00:00:00.000Z'),
      updatedAt: new Date('2026-07-27T00:00:00.000Z'),
      finishedAt: new Date('2026-07-27T00:01:00.000Z'),
    });

    const result = await service.executeImportBatched(
      { auth: { isAdmin: true, userId: USER_ID } },
      { fileId: FILE_ID, duplicatePolicy: 'SKIP' },
    );

    expect(result.summary).toMatchObject({ totalRows: 1, successCount: 1, skippedCount: 0, failedCount: 0 });
    expect(prisma.dealRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: 'ADMIN_IMPORT',
        patentNoDisplay: 'CN202410000000.1',
        priceFen: 10500000,
        createdByUserId: USER_ID,
      }),
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'DEAL_RECORD_IMPORT_EXECUTE' }));
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 10000, timeout: 15000 });
  });

  it('processes 1256 rows in independent short transactions', async () => {
    const rowCount = 1256;
    files.getFileBuffer.mockResolvedValueOnce(buildLargeCsvBuffer(rowCount));
    prisma.dealRecord.findMany.mockResolvedValueOnce([]);
    prisma.dealRecordImportJob.create.mockResolvedValueOnce({
      id: JOB_ID,
      operatorUserId: USER_ID,
      fileId: FILE_ID,
      status: 'PENDING',
      duplicatePolicy: 'SKIP',
      totalCount: rowCount,
      validCount: rowCount,
      invalidCount: 0,
      successCount: 0,
      skippedCount: 0,
      failedCount: 0,
      createdAt: new Date('2026-07-27T00:00:00.000Z'),
      updatedAt: new Date('2026-07-27T00:00:00.000Z'),
      finishedAt: null,
    });
    prisma.dealRecord.create.mockImplementation(async (_args: any) => ({ id: `deal-${prisma.dealRecord.create.mock.calls.length}` }));
    prisma.dealRecordImportJobRow.create.mockResolvedValue({});
    prisma.dealRecordImportJob.update.mockResolvedValueOnce({
      id: JOB_ID,
      operatorUserId: USER_ID,
      fileId: FILE_ID,
      status: 'SUCCEEDED',
      duplicatePolicy: 'SKIP',
      totalCount: rowCount,
      validCount: rowCount,
      invalidCount: 0,
      successCount: rowCount,
      skippedCount: 0,
      failedCount: 0,
      createdAt: new Date('2026-07-27T00:00:00.000Z'),
      updatedAt: new Date('2026-07-27T00:00:00.000Z'),
      finishedAt: new Date('2026-07-27T00:01:00.000Z'),
    });

    const result = await service.executeImportBatched(
      { auth: { isAdmin: true, userId: USER_ID } },
      { fileId: FILE_ID, duplicatePolicy: 'SKIP' },
    );

    expect(result.summary).toMatchObject({ totalRows: rowCount, successCount: rowCount, skippedCount: 0, failedCount: 0 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(rowCount);
    expect(prisma.$transaction.mock.calls.every((call: any[]) => call[1]?.maxWait === 10000 && call[1]?.timeout === 15000)).toBe(true);
    expect(prisma.dealRecordImportJobRow.create).toHaveBeenCalledTimes(rowCount);
  });

  it('records a failed row without rolling back the rest of its batch', async () => {
    files.getFileBuffer.mockResolvedValueOnce(buildLargeCsvBuffer(2));
    prisma.dealRecord.findMany.mockResolvedValueOnce([]);
    prisma.dealRecordImportJob.create.mockResolvedValueOnce({
      id: JOB_ID,
      operatorUserId: USER_ID,
      fileId: FILE_ID,
      status: 'PENDING',
      duplicatePolicy: 'SKIP',
      totalCount: 2,
      validCount: 2,
      invalidCount: 0,
      successCount: 0,
      skippedCount: 0,
      failedCount: 0,
      createdAt: new Date('2026-07-27T00:00:00.000Z'),
      updatedAt: new Date('2026-07-27T00:00:00.000Z'),
      finishedAt: null,
    });
    prisma.patent.findFirst.mockRejectedValueOnce(Object.assign(new Error('patent lookup failed'), { code: 'TEST_LOOKUP_FAILED' }));
    prisma.patent.findFirst.mockResolvedValueOnce(null);
    prisma.dealRecord.findUnique.mockResolvedValueOnce(null);
    prisma.dealRecord.create.mockResolvedValueOnce({ id: DEAL_RECORD_ID });
    prisma.dealRecordImportJobRow.create.mockResolvedValue({});
    prisma.dealRecordImportJob.update.mockResolvedValueOnce({
      id: JOB_ID,
      operatorUserId: USER_ID,
      fileId: FILE_ID,
      status: 'PARTIAL_FAILED',
      duplicatePolicy: 'SKIP',
      totalCount: 2,
      validCount: 2,
      invalidCount: 0,
      successCount: 1,
      skippedCount: 0,
      failedCount: 1,
      createdAt: new Date('2026-07-27T00:00:00.000Z'),
      updatedAt: new Date('2026-07-27T00:00:00.000Z'),
      finishedAt: new Date('2026-07-27T00:01:00.000Z'),
    });

    const result = await service.executeImportBatched(
      { auth: { isAdmin: true, userId: USER_ID } },
      { fileId: FILE_ID, duplicatePolicy: 'SKIP' },
    );

    expect(result.job.status).toBe('PARTIAL_FAILED');
    expect(result.summary).toMatchObject({ successCount: 1, failedCount: 1 });
    expect(prisma.dealRecord.create).toHaveBeenCalledTimes(1);
    expect(prisma.dealRecordImportJobRow.create).toHaveBeenCalledTimes(2);
    expect(prisma.dealRecordImportJobRow.create.mock.calls[0][0].data).toMatchObject({
      rowNo: 2,
      status: 'FAILED',
      errorCode: 'TEST_LOOKUP_FAILED',
    });
  });

  it('upserts an online order deal record with a stable order dedupe key', async () => {
    prisma.order.findUnique.mockResolvedValueOnce({
      id: '66666666-6666-4666-8666-666666666666',
      status: 'COMPLETED',
      listingId: '77777777-7777-4777-8777-777777777777',
      buyerUserId: '88888888-8888-4888-8888-888888888888',
      dealAmount: 260000,
      finalAmount: 250000,
      depositAmount: 10000,
      updatedAt: new Date('2026-07-27T03:00:00.000Z'),
      buyer: { nickname: '买方用户', verifications: [] },
      listing: {
        title: '高效储能控制方法',
        tradeMode: 'LICENSE',
        patentId: '55555555-5555-4555-8555-555555555555',
        sellerUserId: '99999999-9999-4999-8999-999999999999',
        seller: { nickname: '卖方用户', verifications: [] },
        patent: {
          patentNoDisplay: 'CN202410000000.1',
          grantPublicationNoDisplay: null,
          publicationNoDisplay: null,
          applicationNoDisplay: null,
          applicationNoNorm: 'CN2024100000001',
        },
      },
    });
    prisma.dealRecord.upsert.mockResolvedValueOnce({ id: DEAL_RECORD_ID });

    await service.upsertOnlineOrderDealRecord(prisma, '66666666-6666-4666-8666-666666666666', {
      actorUserId: USER_ID,
      dealAt: new Date('2026-07-27T04:00:00.000Z'),
    });

    expect(prisma.dealRecord.upsert).toHaveBeenCalledWith({
      where: { dedupeKey: 'ONLINE_ORDER:66666666-6666-4666-8666-666666666666' },
      create: expect.objectContaining({
        source: 'ONLINE_ORDER',
        sourceOrderId: '66666666-6666-4666-8666-666666666666',
        patentNoNorm: 'CN2024100000001',
        tradeType: 'LICENSE',
        priceFen: 260000,
        createdByUserId: USER_ID,
      }),
      update: expect.objectContaining({
        source: 'ONLINE_ORDER',
        priceFen: 260000,
        updatedByUserId: USER_ID,
      }),
    });
  });
});
