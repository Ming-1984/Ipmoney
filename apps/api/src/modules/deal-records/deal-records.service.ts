import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import path from 'node:path';

import { AuditLogService } from '../../common/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parseExcelSerialDate, readWorkbookRowsFromBuffer } from '../../common/workbook-reader';
import { FilesService } from '../files/files.service';
import { normalizeDisplayText } from '../content-utils';

type DealRecordSource = 'ONLINE_ORDER' | 'ADMIN_IMPORT';
type DealRecordStatus = 'ACTIVE' | 'VOIDED';
type DealTradeType = 'LICENSE' | 'TRANSFER' | 'UNKNOWN';
type DealRecordImportDuplicatePolicy = 'SKIP' | 'UPSERT';
type DealRecordImportJobStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'PARTIAL_FAILED';
type DealRecordImportRowStatus = 'VALID' | 'INVALID' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';
type PrismaLike = Prisma.TransactionClient | PrismaService;

type NormalizedDealImportRow = {
  rowNo: number;
  status: 'VALID' | 'INVALID';
  rawJson: Record<string, unknown>;
  normalizedJson?: DealRecordPayload;
  errorCode?: string;
  errorMessage?: string;
  warningCode?: string;
  warningMessage?: string;
  existingDealRecordId?: string | null;
};

type DealRecordPayload = {
  patentId?: string | null;
  patentNoNorm: string;
  patentNoDisplay: string;
  patentTitle: string;
  tradeType: DealTradeType;
  sellerPartyName: string;
  buyerPartyName: string;
  dealAt: string;
  priceFen: number;
  dedupeKey: string;
  note?: string | null;
};

type DealRecordDto = {
  id: string;
  source: DealRecordSource;
  status: DealRecordStatus;
  sourceOrderId?: string | null;
  importJobId?: string | null;
  patentId?: string | null;
  patentNoNorm: string;
  patentNoDisplay: string;
  patentTitle: string;
  tradeType: DealTradeType;
  sellerPartyName: string;
  buyerPartyName: string;
  dealAt: string;
  priceFen: number;
  dedupeKey: string;
  note?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IMPORT_ROWS = 10000;
const SAMPLE_LIMIT = 30;
const DEAL_RECORD_STATUSES = ['ACTIVE', 'VOIDED'] as const;
const DEAL_RECORD_SOURCES = ['ONLINE_ORDER', 'ADMIN_IMPORT'] as const;
const DEAL_TRADE_TYPES = ['LICENSE', 'TRANSFER', 'UNKNOWN'] as const;
const IMPORT_DUPLICATE_POLICIES = ['SKIP', 'UPSERT'] as const;

@Injectable()
export class DealRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly audit: AuditLogService,
  ) {}

  private ensureAdmin(request: any) {
    if (!request?.auth?.isAdmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'permission denied' });
    }
  }

  private hasOwn(input: any, key: string) {
    return !!input && Object.prototype.hasOwnProperty.call(input, key);
  }

  private parseUuidStrict(value: unknown, fieldName: string): string {
    const raw = String(value ?? '').trim();
    if (!raw || !UUID_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parsePositiveIntStrict(value: unknown, fieldName: string): number {
    const raw = String(value ?? '').trim();
    if (!raw) throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private parseOptionalDate(value: unknown, fieldName: string): Date | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const date = this.parseDealDate(value);
    if (!date) throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    return date;
  }

  private parseDealRecordStatus(value: unknown): DealRecordStatus | undefined {
    const raw = String(value ?? '').trim().toUpperCase();
    if ((DEAL_RECORD_STATUSES as readonly string[]).includes(raw)) return raw as DealRecordStatus;
    return undefined;
  }

  private parseDealRecordSource(value: unknown): DealRecordSource | undefined {
    const raw = String(value ?? '').trim().toUpperCase();
    if ((DEAL_RECORD_SOURCES as readonly string[]).includes(raw)) return raw as DealRecordSource;
    return undefined;
  }

  private parseTradeType(value: unknown): DealTradeType {
    const raw = String(value ?? '').trim().toUpperCase();
    if (raw === '许可' || raw === '授予许可' || raw === 'LICENSE') return 'LICENSE';
    if (raw === '转让' || raw === '让与' || raw === 'TRANSFER' || raw === 'ASSIGNMENT') return 'TRANSFER';
    if ((DEAL_TRADE_TYPES as readonly string[]).includes(raw)) return raw as DealTradeType;
    return 'UNKNOWN';
  }

  private parseDuplicatePolicy(value: unknown): DealRecordImportDuplicatePolicy {
    const raw = String(value ?? 'SKIP').trim().toUpperCase();
    if ((IMPORT_DUPLICATE_POLICIES as readonly string[]).includes(raw)) {
      return raw as DealRecordImportDuplicatePolicy;
    }
    throw new BadRequestException({ code: 'BAD_REQUEST', message: 'duplicatePolicy is invalid' });
  }

  private normalizeCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim();
    }
    if (typeof value === 'object' && value) {
      const maybe = value as Record<string, unknown>;
      if (typeof maybe.text === 'string') return maybe.text.trim();
      if (maybe.result !== undefined) return String(maybe.result || '').trim();
    }
    return String(value).trim();
  }

  private normalizeHeaderText(value: unknown): string {
    return this.normalizeCell(value)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\s_\-:：/／\\()[\]{}【】「」『』,，.。]/g, '');
  }

  private normalizeNameForKey(value: unknown): string {
    return this.normalizeCell(value)
      .normalize('NFKC')
      .toUpperCase()
      .replace(/\s+/g, '');
  }

  private normalizePatentNo(value: unknown): string {
    return this.normalizeCell(value)
      .normalize('NFKC')
      .toUpperCase()
      .replace(/[\s._\-]/g, '');
  }

  private truncateText(value: unknown, maxLength: number): string {
    return this.normalizeCell(value).slice(0, maxLength);
  }

  private pickWorkbookValue(row: Record<string, unknown>, aliases: readonly string[]): unknown {
    const normalizedEntries = Object.entries(row).map(([key, value]) => [this.normalizeHeaderText(key), value] as const);
    const byHeader = new Map<string, unknown>(normalizedEntries);
    for (const alias of aliases) {
      const key = this.normalizeHeaderText(alias);
      if (byHeader.has(key)) return byHeader.get(key);
    }
    return undefined;
  }

  private parseDecimalScaled(raw: string, scale: bigint): number | null {
    const normalized = raw.trim();
    if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
    const [integerPart, fractionPart = ''] = normalized.split('.');
    const numerator = BigInt(`${integerPart}${fractionPart || ''}`);
    const denominator = 10n ** BigInt(fractionPart.length);
    const scaled = (numerator * scale + denominator / 2n) / denominator;
    if (scaled > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(scaled);
  }

  private parsePriceFen(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    let raw = this.normalizeCell(value).normalize('NFKC');
    if (!raw) return null;
    raw = raw.replace(/[￥¥元人民币RMB\s,，]/gi, '');
    let scale = 100n;
    if (raw.endsWith('万元') || raw.endsWith('万')) {
      raw = raw.replace(/万元?$/, '');
      scale = 10000n * 100n;
    }
    const fen = this.parseDecimalScaled(raw, scale);
    if (fen === null || !Number.isSafeInteger(fen) || fen < 0) return null;
    return fen;
  }

  private parseDealDate(value: unknown): Date | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === 'number') return parseExcelSerialDate(value);
    const raw = this.normalizeCell(value).normalize('NFKC');
    if (!raw) return null;
    if (/^\d+(\.\d+)?$/.test(raw)) {
      const serial = Number(raw);
      const date = parseExcelSerialDate(serial);
      if (date) return date;
    }
    const dateOnly = raw.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})(?:日)?$/);
    if (dateOnly) {
      const year = Number(dateOnly[1]);
      const month = Number(dateOnly[2]);
      const day = Number(dateOnly[3]);
      const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      if (!Number.isNaN(date.getTime())) return date;
    }
    const parsed = new Date(raw.replace(/\//g, '-'));
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  private formatDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private buildAdminImportDedupeKey(payload: Omit<DealRecordPayload, 'dedupeKey'>): string {
    return [
      'ADMIN_IMPORT',
      payload.patentNoNorm,
      this.normalizeNameForKey(payload.sellerPartyName),
      this.normalizeNameForKey(payload.buyerPartyName),
      this.formatDateKey(new Date(payload.dealAt)),
      String(payload.priceFen),
    ].join(':');
  }

  private detectFileName(file: { fileName?: string | null; url?: string | null }): string {
    const direct = String(file.fileName || '').trim();
    if (direct) return direct;
    const url = String(file.url || '').trim();
    if (!url) return '';
    try {
      const parsed = new URL(url);
      return path.basename(parsed.pathname);
    } catch {
      return path.basename(url.split('?')[0] || '');
    }
  }

  private async readWorkbookRows(fileId: string): Promise<Array<{ rowNo: number; rawJson: Record<string, unknown> }>> {
    const file = await this.files.getFileById(fileId);
    if (!file) throw new NotFoundException({ code: 'NOT_FOUND', message: 'import file not found' });
    const detectedName = this.detectFileName(file);
    if (!detectedName) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'import file is invalid' });
    const buffer = await this.files.getFileBuffer(detectedName);
    if (!buffer?.length) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'import file is invalid' });

    let rows: Array<Record<string, unknown>>;
    try {
      rows = await readWorkbookRowsFromBuffer(Buffer.from(buffer), { fileName: detectedName });
    } catch {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'import file is invalid' });
    }
    if (!rows.length) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'import file is empty' });
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `import rows exceed limit (${MAX_IMPORT_ROWS})` });
    }
    return rows.map((rawJson, index) => ({ rowNo: index + 2, rawJson }));
  }

  private async findPatentForPayload(client: PrismaLike, patentNoNorm: string, patentNoDisplay: string) {
    return await (client as any).patent.findFirst({
      where: {
        OR: [
          { applicationNoNorm: patentNoNorm },
          { applicationNoDisplay: patentNoDisplay },
          { patentNoDisplay },
          { publicationNoDisplay: patentNoDisplay },
          { grantPublicationNoDisplay: patentNoDisplay },
        ],
      },
      select: { id: true },
    });
  }

  private normalizeImportRow(rowNo: number, rawJson: Record<string, unknown>): NormalizedDealImportRow {
    const patentNoDisplay = this.truncateText(
      this.pickWorkbookValue(rawJson, ['专利号', '申请号', '公开号', '授权公告号', 'patentNo']),
      100,
    );
    const patentNoNorm = this.normalizePatentNo(patentNoDisplay);
    if (!patentNoDisplay || !patentNoNorm) {
      return { rowNo, status: 'INVALID', rawJson, errorCode: 'PATENT_NO_REQUIRED', errorMessage: '专利号不能为空' };
    }

    const patentTitle = this.truncateText(
      this.pickWorkbookValue(rawJson, ['专利名称', '名称', '标题', 'patentTitle']),
      300,
    );
    if (!patentTitle) {
      return { rowNo, status: 'INVALID', rawJson, errorCode: 'PATENT_TITLE_REQUIRED', errorMessage: '专利名称不能为空' };
    }

    const sellerPartyName = this.truncateText(
      this.pickWorkbookValue(rawJson, ['许可方/转让方', '许可方', '转让方', '卖方', '让与方', 'seller']),
      200,
    );
    if (!sellerPartyName) {
      return { rowNo, status: 'INVALID', rawJson, errorCode: 'SELLER_REQUIRED', errorMessage: '许可方/转让方不能为空' };
    }

    const buyerPartyName = this.truncateText(
      this.pickWorkbookValue(rawJson, ['被许可方/受让方', '被许可方', '受让方', '买方', '受让人', 'buyer']),
      200,
    );
    if (!buyerPartyName) {
      return { rowNo, status: 'INVALID', rawJson, errorCode: 'BUYER_REQUIRED', errorMessage: '被许可方/受让方不能为空' };
    }

    const dealAt = this.parseDealDate(this.pickWorkbookValue(rawJson, ['成交时间', '成交日期', '交易时间', 'dealAt']));
    if (!dealAt) {
      return { rowNo, status: 'INVALID', rawJson, errorCode: 'DEAL_AT_INVALID', errorMessage: '成交时间无效' };
    }

    const priceFen = this.parsePriceFen(this.pickWorkbookValue(rawJson, ['价格', '成交价格', '成交金额', '金额', 'price']));
    if (priceFen === null) {
      return { rowNo, status: 'INVALID', rawJson, errorCode: 'PRICE_INVALID', errorMessage: '价格无效' };
    }

    const tradeType = this.parseTradeType(this.pickWorkbookValue(rawJson, ['交易类型', '类型', 'tradeType']));
    const note = this.truncateText(this.pickWorkbookValue(rawJson, ['备注', 'note']), 500) || null;
    const basePayload = {
      patentNoNorm,
      patentNoDisplay,
      patentTitle,
      tradeType,
      sellerPartyName,
      buyerPartyName,
      dealAt: dealAt.toISOString(),
      priceFen,
      note,
    };
    const normalizedJson: DealRecordPayload = {
      ...basePayload,
      dedupeKey: this.buildAdminImportDedupeKey(basePayload),
    };

    return { rowNo, status: 'VALID', rawJson, normalizedJson };
  }

  private async normalizeImportRows(client: PrismaLike, rows: Array<{ rowNo: number; rawJson: Record<string, unknown> }>) {
    const normalized = rows.map((row) => this.normalizeImportRow(row.rowNo, row.rawJson));
    const validRows = normalized.filter((row) => row.status === 'VALID' && row.normalizedJson);
    const keys = Array.from(new Set(validRows.map((row) => row.normalizedJson?.dedupeKey).filter(Boolean))) as string[];
    const existingRows = keys.length
      ? await (client as any).dealRecord.findMany({
          where: { dedupeKey: { in: keys } },
          select: { id: true, dedupeKey: true },
        })
      : [];
    const existingByKey = new Map<string, string>(existingRows.map((row: any) => [row.dedupeKey, row.id]));
    const seenKeys = new Set<string>();

    return normalized.map((row) => {
      const dedupeKey = row.normalizedJson?.dedupeKey;
      if (!dedupeKey) return row;
      const existingDealRecordId = existingByKey.get(dedupeKey) ?? null;
      if (seenKeys.has(dedupeKey)) {
        return {
          ...row,
          existingDealRecordId,
          warningCode: 'DUPLICATE_IN_FILE',
          warningMessage: '文件内存在重复成交记录',
        };
      }
      seenKeys.add(dedupeKey);
      if (existingDealRecordId) {
        return {
          ...row,
          existingDealRecordId,
          warningCode: 'DUPLICATE_EXISTING',
          warningMessage: '系统中已存在相同成交记录',
        };
      }
      return row;
    });
  }

  private summarizeRows(rows: NormalizedDealImportRow[]) {
    const totalRows = rows.length;
    const validRows = rows.filter((row) => row.status === 'VALID').length;
    const invalidRows = rows.filter((row) => row.status === 'INVALID').length;
    const duplicateRows = rows.filter((row) => row.warningCode === 'DUPLICATE_EXISTING' || row.warningCode === 'DUPLICATE_IN_FILE').length;
    const warningRows = rows.filter((row) => row.warningCode).length;
    return { totalRows, validRows, invalidRows, duplicateRows, warningRows };
  }

  private toDealRecordDto(row: any): DealRecordDto {
    return {
      id: row.id,
      source: row.source,
      status: row.status,
      sourceOrderId: row.sourceOrderId ?? null,
      importJobId: row.importJobId ?? null,
      patentId: row.patentId ?? null,
      patentNoNorm: row.patentNoNorm,
      patentNoDisplay: row.patentNoDisplay,
      patentTitle: row.patentTitle,
      tradeType: row.tradeType,
      sellerPartyName: row.sellerPartyName,
      buyerPartyName: row.buyerPartyName,
      dealAt: row.dealAt?.toISOString?.() ?? new Date(row.dealAt).toISOString(),
      priceFen: Number(row.priceFen || 0),
      dedupeKey: row.dedupeKey,
      note: row.note ?? null,
      voidedAt: row.voidedAt ? row.voidedAt.toISOString() : null,
      voidReason: row.voidReason ?? null,
      createdAt: row.createdAt?.toISOString?.() ?? new Date(row.createdAt).toISOString(),
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    };
  }

  private toImportJobDto(row: any) {
    return {
      id: row.id,
      operatorUserId: row.operatorUserId,
      fileId: row.fileId,
      status: row.status as DealRecordImportJobStatus,
      duplicatePolicy: row.duplicatePolicy as DealRecordImportDuplicatePolicy,
      totalCount: Number(row.totalCount || 0),
      validCount: Number(row.validCount || 0),
      invalidCount: Number(row.invalidCount || 0),
      successCount: Number(row.successCount || 0),
      skippedCount: Number(row.skippedCount || 0),
      failedCount: Number(row.failedCount || 0),
      createdAt: row.createdAt?.toISOString?.() ?? new Date(row.createdAt).toISOString(),
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
      finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    };
  }

  private toImportRowDto(row: any) {
    return {
      id: row.id,
      jobId: row.jobId,
      rowNo: row.rowNo,
      status: row.status as DealRecordImportRowStatus,
      rawJson: row.rawJson,
      normalizedJson: row.normalizedJson,
      dealRecordId: row.dealRecordId ?? null,
      errorCode: row.errorCode ?? null,
      errorMessage: row.errorMessage ?? null,
      processedAt: row.processedAt ? row.processedAt.toISOString() : null,
      createdAt: row.createdAt?.toISOString?.() ?? new Date(row.createdAt).toISOString(),
    };
  }

  async previewImport(req: any, body: any) {
    this.ensureAdmin(req);
    const fileId = this.parseUuidStrict(body?.fileId, 'fileId');
    this.parseDuplicatePolicy(body?.duplicatePolicy);
    const rows = await this.readWorkbookRows(fileId);
    const normalized = await this.normalizeImportRows(this.prisma, rows);
    const invalid = normalized.filter((row) => row.status === 'INVALID').slice(0, SAMPLE_LIMIT);
    const warnings = normalized.filter((row) => row.warningCode).slice(0, SAMPLE_LIMIT);
    const samples = normalized.filter((row) => row.status === 'VALID').slice(0, 10);
    return {
      summary: this.summarizeRows(normalized),
      sampleErrors: invalid.map((row) => ({ rowNo: row.rowNo, code: row.errorCode, message: row.errorMessage })),
      sampleWarnings: warnings.map((row) => ({
        rowNo: row.rowNo,
        code: row.warningCode,
        message: row.warningMessage,
        existingDealRecordId: row.existingDealRecordId ?? null,
      })),
      sampleRows: samples.map((row) => ({ rowNo: row.rowNo, data: row.normalizedJson })),
    };
  }

  async executeImport(req: any, body: any) {
    this.ensureAdmin(req);
    const operatorUserId = this.parseUuidStrict(req?.auth?.userId, 'operatorUserId');
    const fileId = this.parseUuidStrict(body?.fileId, 'fileId');
    const duplicatePolicy = this.parseDuplicatePolicy(body?.duplicatePolicy);
    const file = await this.files.getFileById(fileId);
    if (!file) throw new NotFoundException({ code: 'NOT_FOUND', message: 'import file not found' });
    const rows = await this.readWorkbookRows(fileId);
    const normalizedRows = await this.normalizeImportRows(this.prisma, rows);
    const summary = this.summarizeRows(normalizedRows);

    const result = await this.prisma.$transaction(async (tx) => {
      const job = await tx.dealRecordImportJob.create({
        data: {
          operatorUserId,
          fileId,
          duplicatePolicy: duplicatePolicy as any,
          status: 'PENDING' as any,
          totalCount: summary.totalRows,
          validCount: summary.validRows,
          invalidCount: summary.invalidRows,
        },
      });

      let successCount = 0;
      let skippedCount = 0;
      let failedCount = summary.invalidRows;

      for (const row of normalizedRows) {
        if (row.status === 'INVALID' || !row.normalizedJson) {
          await tx.dealRecordImportJobRow.create({
            data: {
              jobId: job.id,
              rowNo: row.rowNo,
              status: 'INVALID' as any,
              rawJson: row.rawJson as any,
              normalizedJson: row.normalizedJson as any,
              errorCode: row.errorCode ?? null,
              errorMessage: row.errorMessage ?? null,
              processedAt: new Date(),
            },
          });
          continue;
        }

        try {
          const payload = row.normalizedJson;
          const patent = await this.findPatentForPayload(tx, payload.patentNoNorm, payload.patentNoDisplay);
          const data = {
            source: 'ADMIN_IMPORT' as any,
            status: 'ACTIVE' as any,
            importJobId: job.id,
            patentId: patent?.id ?? null,
            patentNoNorm: payload.patentNoNorm,
            patentNoDisplay: payload.patentNoDisplay,
            patentTitle: payload.patentTitle,
            tradeType: payload.tradeType as any,
            sellerPartyName: payload.sellerPartyName,
            buyerPartyName: payload.buyerPartyName,
            dealAt: new Date(payload.dealAt),
            priceFen: payload.priceFen,
            dedupeKey: payload.dedupeKey,
            rawJson: row.rawJson as any,
            note: payload.note ?? null,
            updatedByUserId: operatorUserId,
          };
          const existing = await tx.dealRecord.findUnique({ where: { dedupeKey: payload.dedupeKey } });

          if (existing && duplicatePolicy === 'SKIP') {
            skippedCount += 1;
            await tx.dealRecordImportJobRow.create({
              data: {
                jobId: job.id,
                rowNo: row.rowNo,
                status: 'SKIPPED' as any,
                rawJson: row.rawJson as any,
                normalizedJson: payload as any,
                dealRecordId: existing.id,
                errorCode: 'DUPLICATE_SKIPPED',
                errorMessage: '系统中已存在相同成交记录',
                processedAt: new Date(),
              },
            });
            continue;
          }

          const dealRecord = existing
            ? await tx.dealRecord.update({
                where: { id: existing.id },
                data,
              })
            : await tx.dealRecord.create({
                data: {
                  ...data,
                  createdByUserId: operatorUserId,
                },
              });

          successCount += 1;
          await tx.dealRecordImportJobRow.create({
            data: {
              jobId: job.id,
              rowNo: row.rowNo,
              status: 'SUCCEEDED' as any,
              rawJson: row.rawJson as any,
              normalizedJson: payload as any,
              dealRecordId: dealRecord.id,
              processedAt: new Date(),
            },
          });
        } catch (error: any) {
          failedCount += 1;
          await tx.dealRecordImportJobRow.create({
            data: {
              jobId: job.id,
              rowNo: row.rowNo,
              status: 'FAILED' as any,
              rawJson: row.rawJson as any,
              normalizedJson: row.normalizedJson as any,
              errorCode: error?.code || 'IMPORT_ROW_FAILED',
              errorMessage: error?.message || 'import row failed',
              processedAt: new Date(),
            },
          });
        }
      }

      const status: DealRecordImportJobStatus =
        failedCount > 0 && successCount > 0 ? 'PARTIAL_FAILED' : failedCount > 0 ? 'FAILED' : 'SUCCEEDED';
      const updatedJob = await tx.dealRecordImportJob.update({
        where: { id: job.id },
        data: {
          status: status as any,
          successCount,
          skippedCount,
          failedCount,
          finishedAt: new Date(),
        },
      });

      return {
        job: updatedJob,
        summary: {
          totalRows: summary.totalRows,
          validRows: summary.validRows,
          invalidRows: summary.invalidRows,
          successCount,
          skippedCount,
          failedCount,
        },
      };
    });

    await this.audit.log({
      actorUserId: operatorUserId,
      action: 'DEAL_RECORD_IMPORT_EXECUTE',
      targetType: 'DEAL_RECORD_IMPORT_JOB',
      targetId: result.job.id,
      afterJson: result as any,
    });

    return { job: this.toImportJobDto(result.job), summary: result.summary };
  }

  async listDealRecords(req: any, query: any) {
    this.ensureAdmin(req);
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(100, pageSizeInput);
    const q = this.truncateText(query?.q, 100);
    const source = this.hasOwn(query, 'source') ? this.parseDealRecordSource(query.source) : undefined;
    const status = this.hasOwn(query, 'status') ? this.parseDealRecordStatus(query.status) : undefined;
    const tradeType = this.hasOwn(query, 'tradeType') ? this.parseTradeType(query.tradeType) : undefined;
    const dealFrom = this.parseOptionalDate(query?.dealFrom, 'dealFrom');
    const dealTo = this.parseOptionalDate(query?.dealTo, 'dealTo');

    const where: any = {};
    if (q) {
      where.OR = [
        { patentNoDisplay: { contains: q, mode: 'insensitive' } },
        { patentNoNorm: { contains: this.normalizePatentNo(q), mode: 'insensitive' } },
        { patentTitle: { contains: q, mode: 'insensitive' } },
        { sellerPartyName: { contains: q, mode: 'insensitive' } },
        { buyerPartyName: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (source) where.source = source;
    if (status) where.status = status;
    if (tradeType && tradeType !== 'UNKNOWN') where.tradeType = tradeType;
    if (dealFrom || dealTo) {
      where.dealAt = {};
      if (dealFrom) where.dealAt.gte = dealFrom;
      if (dealTo) where.dealAt.lte = dealTo;
    }

    const [items, total] = await Promise.all([
      this.prisma.dealRecord.findMany({
        where,
        orderBy: [{ dealAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.dealRecord.count({ where }),
    ]);

    return { items: items.map((item) => this.toDealRecordDto(item)), page: { page, pageSize, total } };
  }

  async getDealRecord(req: any, dealRecordId: string) {
    this.ensureAdmin(req);
    const id = this.parseUuidStrict(dealRecordId, 'dealRecordId');
    const row = await this.prisma.dealRecord.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'deal record not found' });
    return this.toDealRecordDto(row);
  }

  async getSummary(req: any, query: any) {
    this.ensureAdmin(req);
    const dealFrom = this.parseOptionalDate(query?.dealFrom, 'dealFrom');
    const dealTo = this.parseOptionalDate(query?.dealTo, 'dealTo');
    const where: any = { status: 'ACTIVE' };
    if (dealFrom || dealTo) {
      where.dealAt = {};
      if (dealFrom) where.dealAt.gte = dealFrom;
      if (dealTo) where.dealAt.lte = dealTo;
    }
    const [activeAgg, onlineCount, importCount] = await Promise.all([
      this.prisma.dealRecord.aggregate({ where, _count: { _all: true }, _sum: { priceFen: true } }),
      this.prisma.dealRecord.count({ where: { ...where, source: 'ONLINE_ORDER' } }),
      this.prisma.dealRecord.count({ where: { ...where, source: 'ADMIN_IMPORT' } }),
    ]);
    return {
      activeTotal: activeAgg._count?._all ?? 0,
      onlineTotal: onlineCount,
      importedTotal: importCount,
      activeAmountFen: activeAgg._sum?.priceFen ?? 0,
    };
  }

  async listImportJobs(req: any, query: any) {
    this.ensureAdmin(req);
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(100, pageSizeInput);
    const [items, total] = await Promise.all([
      this.prisma.dealRecordImportJob.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.dealRecordImportJob.count(),
    ]);
    return { items: items.map((item) => this.toImportJobDto(item)), page: { page, pageSize, total } };
  }

  async voidDealRecord(req: any, dealRecordId: string, body: any) {
    this.ensureAdmin(req);
    const id = this.parseUuidStrict(dealRecordId, 'dealRecordId');
    const actorUserId = this.parseUuidStrict(req?.auth?.userId, 'actorUserId');
    const reason = this.truncateText(body?.reason, 500);
    if (!reason) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'reason is required' });
    const before = await this.prisma.dealRecord.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: 'NOT_FOUND', message: 'deal record not found' });
    if (before.status === 'VOIDED') return this.toDealRecordDto(before);
    const updated = await this.prisma.dealRecord.update({
      where: { id },
      data: {
        status: 'VOIDED',
        voidedAt: new Date(),
        voidedByUserId: actorUserId,
        voidReason: reason,
        updatedByUserId: actorUserId,
      },
    });
    await this.audit.log({
      actorUserId,
      action: 'DEAL_RECORD_VOID',
      targetType: 'DEAL_RECORD',
      targetId: id,
      beforeJson: before as any,
      afterJson: updated as any,
    });
    return this.toDealRecordDto(updated);
  }

  private buildOnlineTradeType(listing: any): DealTradeType {
    const raw = String(listing?.tradeMode || '').trim().toUpperCase();
    if (raw === 'LICENSE') return 'LICENSE';
    if (raw === 'ASSIGNMENT' || raw === 'TRANSFER') return 'TRANSFER';
    return 'UNKNOWN';
  }

  private displayUserName(user: any, fallback: string): string {
    return (
      normalizeDisplayText(user?.verifications?.[0]?.displayName) ??
      normalizeDisplayText(user?.nickname) ??
      fallback
    );
  }

  private resolvePatentNoForOnlineOrder(order: any): { display: string; norm: string } {
    const patent = order?.listing?.patent;
    const display =
      normalizeDisplayText(patent?.patentNoDisplay) ??
      normalizeDisplayText(patent?.grantPublicationNoDisplay) ??
      normalizeDisplayText(patent?.publicationNoDisplay) ??
      normalizeDisplayText(patent?.applicationNoDisplay) ??
      normalizeDisplayText(patent?.applicationNoNorm) ??
      `LISTING-${order.listingId}`;
    const norm = this.normalizePatentNo(display) || `LISTING:${order.listingId}`;
    return { display, norm };
  }

  async upsertOnlineOrderDealRecord(
    client: PrismaLike,
    orderId: string,
    opts: { actorUserId?: string | null; dealAt?: Date | null } = {},
  ) {
    const order = await (client as any).order.findUnique({
      where: { id: orderId },
      include: {
        buyer: {
          include: {
            verifications: {
              where: { verificationStatus: 'APPROVED' },
              orderBy: { reviewedAt: 'desc' },
              take: 1,
            },
          },
        },
        listing: {
          include: {
            patent: true,
            seller: {
              include: {
                verifications: {
                  where: { verificationStatus: 'APPROVED' },
                  orderBy: { reviewedAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'order not found' });
    if (order.status !== 'COMPLETED') {
      throw new ConflictException({ code: 'CONFLICT', message: 'order is not completed' });
    }
    const priceFen = Number(order.dealAmount);
    if (!Number.isSafeInteger(priceFen) || priceFen < 0) {
      throw new ConflictException({ code: 'CONFLICT', message: 'completed order deal amount is invalid' });
    }
    const patentNo = this.resolvePatentNoForOnlineOrder(order);
    const dealAt = opts.dealAt ?? order.updatedAt ?? new Date();
    const payload = {
      source: 'ONLINE_ORDER' as any,
      status: 'ACTIVE' as any,
      sourceOrderId: order.id,
      patentId: order.listing?.patentId ?? null,
      patentNoNorm: patentNo.norm,
      patentNoDisplay: patentNo.display,
      patentTitle: this.truncateText(order.listing?.title || order.listing?.patent?.title || patentNo.display, 300),
      tradeType: this.buildOnlineTradeType(order.listing) as any,
      sellerPartyName: this.displayUserName(order.listing?.seller, order.listing?.sellerUserId || '未知卖方'),
      buyerPartyName: this.displayUserName(order.buyer, order.buyerUserId || '未知买方'),
      dealAt,
      priceFen,
      dedupeKey: `ONLINE_ORDER:${order.id}`,
      rawJson: {
        orderId: order.id,
        listingId: order.listingId,
        status: order.status,
        dealAmount: order.dealAmount,
        finalAmount: order.finalAmount,
        depositAmount: order.depositAmount,
      } as any,
      updatedByUserId: opts.actorUserId ?? null,
    };
    return await (client as any).dealRecord.upsert({
      where: { dedupeKey: payload.dedupeKey },
      create: {
        ...payload,
        createdByUserId: opts.actorUserId ?? null,
      },
      update: payload,
    });
  }

  async backfillCompletedOrders(req: any, body: any) {
    this.ensureAdmin(req);
    const actorUserId = this.parseUuidStrict(req?.auth?.userId, 'actorUserId');
    const limit = Math.min(1000, this.hasOwn(body, 'limit') ? this.parsePositiveIntStrict(body.limit, 'limit') : 500);
    const orders = await this.prisma.order.findMany({
      where: { status: 'COMPLETED' },
      select: { id: true },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });
    let createdOrUpdated = 0;
    let failed = 0;
    for (const order of orders) {
      try {
        await this.upsertOnlineOrderDealRecord(this.prisma, order.id, { actorUserId });
        createdOrUpdated += 1;
      } catch {
        failed += 1;
      }
    }
    await this.audit.log({
      actorUserId,
      action: 'DEAL_RECORD_BACKFILL_COMPLETED_ORDERS',
      targetType: 'DEAL_RECORD',
      targetId: actorUserId,
      afterJson: { requested: orders.length, createdOrUpdated, failed },
    });
    return { requested: orders.length, createdOrUpdated, failed };
  }
}
