import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS = require('exceljs');
import path from 'node:path';

import { AuditLogService } from '../../common/audit-log.service';
import { requirePermission } from '../../common/permissions';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FilesService } from '../files/files.service';

type ImportBatchKind = 'PEOPLE_ACHIEVEMENTS' | 'PATENT' | 'LISTING' | 'DEAL_RECORD' | 'LISTING_BATCH_ACTION';
type ImportBatchStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'PARTIALLY_SUCCEEDED'
  | 'ROLLBACK_PRECHECKED'
  | 'ROLLBACK_RUNNING'
  | 'ROLLED_BACK'
  | 'PARTIALLY_ROLLED_BACK'
  | 'ROLLBACK_FAILED';
type ImportEntityType =
  | 'USER'
  | 'USER_VERIFICATION'
  | 'TECH_MANAGER_PROFILE'
  | 'TECH_MANAGER_BADGE'
  | 'ACHIEVEMENT'
  | 'PATENT'
  | 'LISTING'
  | 'DEAL_RECORD';
type ImportChangeOperation = 'CREATE' | 'UPDATE' | 'APPEND' | 'REPLACE' | 'SOFT_DELETE' | 'VOID';
type ImportRollbackStrategy = 'DELETE' | 'RESTORE' | 'SOFT_OFF_SHELF' | 'VOID' | 'EXPIRE_BADGE' | 'MANUAL_ONLY';
type ImportRollbackStatus = 'PENDING' | 'ROLLBACKABLE' | 'BLOCKED' | 'CONFLICTED' | 'ROLLED_BACK' | 'FAILED' | 'SKIPPED';

type LegacyJobType = 'BULK_IMPORT_AUDIT_LOG' | 'PATENT_IMPORT_JOB' | 'LISTING_IMPORT_JOB' | 'DEAL_RECORD_IMPORT_JOB';
type Paged<T> = { items: T[]; page: { page: number; pageSize: number; total: number } };
type UserBrief = { id: string; nickname?: string | null; phone?: string | null };
type PeopleWorkbookRow = { rowNo: number; name: string };
type PeopleAuditChange = {
  rowNo?: number | null;
  entityType?: string | null;
  entityId?: string | null;
  operation?: string | null;
  label?: string | null;
  rollbackStrategy?: string | null;
  afterJson?: Record<string, any> | null;
};

type ImportBatchDto = {
  id: string;
  kind: ImportBatchKind;
  sourceBatch?: string | null;
  operatorUserId?: string | null;
  operatorName?: string | null;
  operatorPhone?: string | null;
  status: ImportBatchStatus;
  legacyJobType?: string | null;
  legacyJobId?: string | null;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  rollbackableCount: number;
  conflictedCount: number;
  blockedCount: number;
  rolledBackCount: number;
  fileId?: string | null;
  errorFileId?: string | null;
  executedAt?: string | null;
  rollbackAt?: string | null;
  rollbackReason?: string | null;
  lastPrecheckedAt?: string | null;
  lastRollbackError?: string | null;
  createdAt: string;
  updatedAt: string;
};

type RollbackChangePreview = {
  changeId: string;
  rowNo?: number | null;
  entityType: ImportEntityType;
  entityId?: string | null;
  entityLabel?: string | null;
  operation: ImportChangeOperation;
  rollbackStrategy: ImportRollbackStrategy;
  rollbackStatus: ImportRollbackStatus;
  blockedReason?: string | null;
  dependency?: Record<string, any> | null;
  overrideable?: boolean;
};

type RollbackPreview = {
  batch: ImportBatchDto;
  canRollback: boolean;
  summary: {
    totalCount: number;
    rollbackableCount: number;
    conflictedCount: number;
    blockedCount: number;
    manualOnlyCount: number;
    rolledBackCount: number;
    skippedCount: number;
    failedCount: number;
  };
  groups: Array<{
    entityType: ImportEntityType;
    total: number;
    created: number;
    updated: number;
    rollbackable: number;
    conflicted: number;
    blocked: number;
    manualOnly: number;
    rolledBack: number;
  }>;
  warnings: string[];
  changes: RollbackChangePreview[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PAGE_SIZE = 100;
const MAX_CHANGE_PAGE_SIZE = 500;
const LEGACY_SYNC_LIMIT = 100;
const BULK_IMPORT_EXECUTE = 'BULK_IMPORT_EXECUTE';
const ROLLBACK_FINISHED_STATUSES = new Set<ImportBatchStatus>([
  'ROLLBACK_PRECHECKED',
  'ROLLBACK_RUNNING',
  'ROLLED_BACK',
  'PARTIALLY_ROLLED_BACK',
  'ROLLBACK_FAILED',
]);
const BATCH_KINDS = new Set<ImportBatchKind>([
  'PEOPLE_ACHIEVEMENTS',
  'PATENT',
  'LISTING',
  'DEAL_RECORD',
  'LISTING_BATCH_ACTION',
]);
const BATCH_STATUSES = new Set<ImportBatchStatus>([
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'PARTIALLY_SUCCEEDED',
  'ROLLBACK_PRECHECKED',
  'ROLLBACK_RUNNING',
  'ROLLED_BACK',
  'PARTIALLY_ROLLED_BACK',
  'ROLLBACK_FAILED',
]);
const CHANGE_ROLLBACK_STATUSES = new Set<ImportRollbackStatus>([
  'PENDING',
  'ROLLBACKABLE',
  'BLOCKED',
  'CONFLICTED',
  'ROLLED_BACK',
  'FAILED',
  'SKIPPED',
]);
const TECH_MANAGER_CHANGE_ENTITY_TYPES = new Set<ImportEntityType>([
  'USER',
  'USER_VERIFICATION',
  'TECH_MANAGER_PROFILE',
  'TECH_MANAGER_BADGE',
]);
const PEOPLE_NAME_ALIASES = ['name', 'displayName', 'fullName', '\u59d3\u540d', '\u540d\u79f0', '\u6280\u672f\u7ecf\u7406\u4eba'];

@Injectable()
export class ImportBatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly files: FilesService,
  ) {}

  private ensureAdmin(req: any) {
    if (!req?.auth?.isAdmin) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
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

  private truncateText(value: unknown, max = 500): string {
    return String(value ?? '').trim().slice(0, max);
  }

  private parseKind(value: unknown): ImportBatchKind | undefined {
    const raw = String(value ?? '').trim().toUpperCase();
    if (!raw) return undefined;
    if (!BATCH_KINDS.has(raw as ImportBatchKind)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'kind is invalid' });
    }
    return raw as ImportBatchKind;
  }

  private parseBatchStatus(value: unknown): ImportBatchStatus | undefined {
    const raw = String(value ?? '').trim().toUpperCase();
    if (!raw) return undefined;
    if (!BATCH_STATUSES.has(raw as ImportBatchStatus)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'status is invalid' });
    }
    return raw as ImportBatchStatus;
  }

  private parseRollbackStatus(value: unknown): ImportRollbackStatus | undefined {
    const raw = String(value ?? '').trim().toUpperCase();
    if (!raw) return undefined;
    if (!CHANGE_ROLLBACK_STATUSES.has(raw as ImportRollbackStatus)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'rollbackStatus is invalid' });
    }
    return raw as ImportRollbackStatus;
  }

  private toIso(value: any): string | null {
    if (!value) return null;
    return value?.toISOString?.() ?? new Date(value).toISOString();
  }

  private number(value: any): number {
    return Number(value || 0);
  }

  private normalizeWorkbookCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
    if (Array.isArray(value)) return value.map((item) => this.normalizeWorkbookCell(item)).join('').trim();
    if (typeof value === 'object' && value) {
      const maybe = value as Record<string, any>;
      if (maybe.result !== undefined) return this.normalizeWorkbookCell(maybe.result);
      if (typeof maybe.text === 'string') return maybe.text.trim();
      if (Array.isArray(maybe.richText)) return maybe.richText.map((item: any) => String(item?.text || '')).join('').trim();
      if (maybe.hyperlink) return String(maybe.text || maybe.hyperlink || '').trim();
    }
    return String(value).trim();
  }

  private normalizeWorkbookHeaderText(value: unknown): string {
    return this.normalizeWorkbookCell(value)
      .toLowerCase()
      .replace(/[\s_\-\uFF08\uFF09()\u3010\u3011\[\]:\uFF1A]/g, '');
  }

  private normalizePersonName(value: unknown): string {
    return String(value || '').trim().replace(/\s+/g, '');
  }

  private pickWorkbookValue(row: { byHeader: Record<string, string>; cols: string[] }, aliases: readonly string[]): string {
    for (const alias of aliases) {
      const key = this.normalizeWorkbookHeaderText(alias);
      if (Object.prototype.hasOwnProperty.call(row.byHeader, key)) return row.byHeader[key] || '';
    }
    return '';
  }

  private detectFileName(file: { fileName?: string | null; url?: string | null }): string {
    const direct = String(file.fileName || '').trim();
    if (direct) return direct;
    const url = String(file.url || '').trim();
    if (!url) return '';
    try {
      return path.basename(new URL(url).pathname);
    } catch {
      return path.basename(url.split('?')[0] || '');
    }
  }

  private async readPeopleWorkbookRows(fileId: string | null | undefined): Promise<PeopleWorkbookRow[]> {
    if (!fileId || !UUID_RE.test(fileId)) return [];
    try {
      const file = await this.files.getFileById(fileId);
      if (!file) return [];
      const fileName = this.detectFileName(file);
      if (!fileName) return [];
      const rawBuffer = await this.files.getFileBuffer(fileName);
      if (!rawBuffer?.length) return [];

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(rawBuffer) as any);
      const sheet = workbook.worksheets[0];
      if (!sheet) return [];

      const headerRow = sheet.getRow(1);
      const maxColumns = Math.max(16, headerRow.actualCellCount || 0, sheet.actualColumnCount || 0);
      const headers: string[] = [];
      for (let col = 1; col <= maxColumns; col += 1) {
        headers.push(this.normalizeWorkbookHeaderText(headerRow.getCell(col).value));
      }

      const rows: PeopleWorkbookRow[] = [];
      for (let rowNo = 2; rowNo <= sheet.rowCount; rowNo += 1) {
        const sheetRow = sheet.getRow(rowNo);
        const cols: string[] = [];
        const byHeader: Record<string, string> = {};
        let hasValue = false;
        for (let col = 1; col <= maxColumns; col += 1) {
          const value = this.normalizeWorkbookCell(sheetRow.getCell(col).value);
          cols.push(value);
          const headerKey = headers[col - 1];
          if (headerKey) byHeader[headerKey] = value;
          if (value) hasValue = true;
        }
        if (!hasValue) continue;
        const name = this.normalizePersonName(this.pickWorkbookValue({ cols, byHeader }, PEOPLE_NAME_ALIASES) || cols[0]);
        if (name) rows.push({ rowNo, name });
      }
      return rows;
    } catch {
      return [];
    }
  }

  private userName(user?: UserBrief): string | null {
    return String(user?.nickname || '').trim() || null;
  }

  private toBatchDto(row: any, user?: UserBrief): ImportBatchDto {
    return {
      id: row.id,
      kind: row.kind as ImportBatchKind,
      sourceBatch: row.sourceBatch ?? null,
      operatorUserId: row.operatorUserId ?? null,
      operatorName: this.userName(user),
      operatorPhone: String(user?.phone || '').trim() || null,
      status: row.status as ImportBatchStatus,
      legacyJobType: row.legacyJobType ?? null,
      legacyJobId: row.legacyJobId ?? null,
      createdCount: this.number(row.createdCount),
      updatedCount: this.number(row.updatedCount),
      skippedCount: this.number(row.skippedCount),
      failedCount: this.number(row.failedCount),
      rollbackableCount: this.number(row.rollbackableCount),
      conflictedCount: this.number(row.conflictedCount),
      blockedCount: this.number(row.blockedCount),
      rolledBackCount: this.number(row.rolledBackCount),
      fileId: row.fileId ?? null,
      errorFileId: row.errorFileId ?? null,
      executedAt: this.toIso(row.executedAt),
      rollbackAt: this.toIso(row.rollbackAt),
      rollbackReason: row.rollbackReason ?? null,
      lastPrecheckedAt: this.toIso(row.lastPrecheckedAt),
      lastRollbackError: row.lastRollbackError ?? null,
      createdAt: this.toIso(row.createdAt) || new Date().toISOString(),
      updatedAt: this.toIso(row.updatedAt) || new Date().toISOString(),
    };
  }

  private async buildUserMap(userIds: Array<string | null | undefined>) {
    const ids = Array.from(new Set(userIds.filter((id): id is string => !!id)));
    if (!ids.length) return new Map<string, UserBrief>();
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, nickname: true, phone: true },
    });
    return new Map(users.map((item) => [item.id, item]));
  }

  private mapListingJobStatus(status: string, successCount = 0): ImportBatchStatus {
    const raw = String(status || '').toUpperCase();
    if (raw === 'PENDING') return 'PENDING';
    if (raw === 'RUNNING' || raw === 'PAUSED') return 'RUNNING';
    if (raw === 'SUCCEEDED') return 'SUCCEEDED';
    if (raw === 'FAILED' && successCount > 0) return 'PARTIALLY_SUCCEEDED';
    return 'FAILED';
  }

  private mapPatentJobStatus(status: string, successCount = 0): ImportBatchStatus {
    return this.mapListingJobStatus(status, successCount);
  }

  private mapDealJobStatus(status: string, successCount = 0): ImportBatchStatus {
    const raw = String(status || '').toUpperCase();
    if (raw === 'PENDING') return 'PENDING';
    if (raw === 'SUCCEEDED') return 'SUCCEEDED';
    if (raw === 'PARTIAL_FAILED') return 'PARTIALLY_SUCCEEDED';
    if (raw === 'FAILED' && successCount > 0) return 'PARTIALLY_SUCCEEDED';
    return 'FAILED';
  }

  private mapBulkAuditStatus(afterJson: any): ImportBatchStatus {
    const people = afterJson?.people || {};
    const achievements = afterJson?.achievements || {};
    const success = this.number(people.created) + this.number(people.updated) + this.number(achievements.created) + this.number(achievements.updated);
    const failed = this.number(people.failed) + this.number(achievements.failed);
    if (failed > 0 && success > 0) return 'PARTIALLY_SUCCEEDED';
    if (failed > 0) return 'FAILED';
    return 'SUCCEEDED';
  }

  private async upsertLegacyBatch(params: {
    kind: ImportBatchKind;
    sourceBatch?: string | null;
    operatorUserId?: string | null;
    status: ImportBatchStatus;
    legacyJobType: LegacyJobType;
    legacyJobId: string;
    createdCount?: number;
    updatedCount?: number;
    skippedCount?: number;
    failedCount?: number;
    fileId?: string | null;
    errorFileId?: string | null;
    executedAt?: Date | null;
    createdAt?: Date | null;
  }) {
    const existing = await this.prisma.importBatch.findUnique({
      where: {
        legacyJobType_legacyJobId: {
          legacyJobType: params.legacyJobType,
          legacyJobId: params.legacyJobId,
        },
      },
    });
    const keepRollbackStatus = existing?.status && ROLLBACK_FINISHED_STATUSES.has(existing.status as ImportBatchStatus);
    const baseData = {
      kind: params.kind as any,
      sourceBatch: params.sourceBatch || null,
      operatorUserId: params.operatorUserId || null,
      legacyJobType: params.legacyJobType,
      legacyJobId: params.legacyJobId,
      createdCount: params.createdCount ?? 0,
      updatedCount: params.updatedCount ?? 0,
      skippedCount: params.skippedCount ?? 0,
      failedCount: params.failedCount ?? 0,
      fileId: params.fileId || null,
      errorFileId: params.errorFileId || null,
      executedAt: params.executedAt || null,
    };
    if (existing) {
      return await this.prisma.importBatch.update({
        where: { id: existing.id },
        data: {
          ...baseData,
          status: keepRollbackStatus ? (existing.status as any) : (params.status as any),
        },
      });
    }
    return await this.prisma.importBatch.create({
      data: {
        ...baseData,
        status: params.status as any,
        createdAt: params.createdAt || undefined,
      },
    });
  }

  private async syncRecentLegacyBatches() {
    const [dealJobs, listingJobs, patentJobs, bulkLogs] = await Promise.all([
      this.prisma.dealRecordImportJob.findMany({ orderBy: { createdAt: 'desc' }, take: LEGACY_SYNC_LIMIT }),
      this.prisma.listingImportJob.findMany({ orderBy: { createdAt: 'desc' }, take: LEGACY_SYNC_LIMIT }),
      this.prisma.patentImportJob.findMany({ orderBy: { createdAt: 'desc' }, take: LEGACY_SYNC_LIMIT }),
      this.prisma.auditLog.findMany({
        where: { targetType: 'BULK_IMPORT', action: BULK_IMPORT_EXECUTE },
        orderBy: { createdAt: 'desc' },
        take: LEGACY_SYNC_LIMIT,
      }),
    ]);

    for (const job of dealJobs) {
      await this.upsertLegacyBatch({
        kind: 'DEAL_RECORD',
        sourceBatch: `成交导入 ${String(job.id).slice(0, 8)}`,
        operatorUserId: job.operatorUserId,
        status: this.mapDealJobStatus(String(job.status), this.number(job.successCount)),
        legacyJobType: 'DEAL_RECORD_IMPORT_JOB',
        legacyJobId: job.id,
        createdCount: this.number(job.successCount),
        skippedCount: this.number(job.skippedCount),
        failedCount: this.number(job.failedCount),
        fileId: job.fileId,
        executedAt: job.finishedAt || job.createdAt,
        createdAt: job.createdAt,
      });
    }

    for (const job of listingJobs) {
      await this.upsertLegacyBatch({
        kind: 'LISTING',
        sourceBatch: `挂牌导入 ${String(job.id).slice(0, 8)}`,
        operatorUserId: job.operatorUserId,
        status: this.mapListingJobStatus(String(job.status), this.number(job.successCount)),
        legacyJobType: 'LISTING_IMPORT_JOB',
        legacyJobId: job.id,
        createdCount: this.number(job.successCount),
        skippedCount: this.number(job.skippedCount),
        failedCount: this.number(job.failedCount),
        fileId: job.fileId,
        errorFileId: job.errorFileId || null,
        executedAt: job.finishedAt || job.startedAt || job.createdAt,
        createdAt: job.createdAt,
      });
    }

    for (const job of patentJobs) {
      await this.upsertLegacyBatch({
        kind: 'PATENT',
        sourceBatch: `专利导入 ${String(job.id).slice(0, 8)}`,
        operatorUserId: job.operatorUserId,
        status: this.mapPatentJobStatus(String(job.status), this.number(job.successCount)),
        legacyJobType: 'PATENT_IMPORT_JOB',
        legacyJobId: job.id,
        createdCount: this.number(job.successCount),
        skippedCount: this.number(job.skippedCount),
        failedCount: this.number(job.failedCount),
        fileId: job.fileId,
        errorFileId: job.errorFileId || null,
        executedAt: job.finishedAt || job.startedAt || job.createdAt,
        createdAt: job.createdAt,
      });
    }

    for (const log of bulkLogs) {
      const afterJson = (log.afterJson || {}) as any;
      const input = afterJson?.input || {};
      const people = afterJson?.people || {};
      const achievements = afterJson?.achievements || {};
      await this.upsertLegacyBatch({
        kind: 'PEOPLE_ACHIEVEMENTS',
        sourceBatch: String(input?.sourceBatch || '').trim() || `成果/经理人导入 ${String(log.id).slice(0, 8)}`,
        operatorUserId: log.actorUserId,
        status: this.mapBulkAuditStatus(afterJson),
        legacyJobType: 'BULK_IMPORT_AUDIT_LOG',
        legacyJobId: log.id,
        createdCount: this.number(people.created) + this.number(achievements.created),
        updatedCount: this.number(people.updated) + this.number(achievements.updated),
        skippedCount: this.number(people.skipped) + this.number(achievements.skipped),
        failedCount: this.number(people.failed) + this.number(achievements.failed),
        fileId: input?.achievementsFileId || input?.peopleFileId || null,
        executedAt: log.createdAt,
        createdAt: log.createdAt,
      });
    }
  }

  async listImportBatches(req: any, query: any): Promise<Paged<ImportBatchDto>> {
    this.ensureAdmin(req);
    await this.syncRecentLegacyBatches();
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(MAX_PAGE_SIZE, pageSizeInput);
    const kind = this.parseKind(query?.kind);
    const status = this.parseBatchStatus(query?.status);
    const q = this.truncateText(query?.q, 100);
    const where: any = {};
    if (kind) where.kind = kind;
    if (status) where.status = status;
    if (q) {
      where.OR = [{ sourceBatch: { contains: q, mode: 'insensitive' } }];
      if (UUID_RE.test(q)) {
        where.OR.push({ id: q }, { legacyJobId: q }, { operatorUserId: q });
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.importBatch.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.importBatch.count({ where }),
    ]);
    const userMap = await this.buildUserMap(items.map((item) => item.operatorUserId));
    return {
      items: items.map((item) => this.toBatchDto(item, item.operatorUserId ? userMap.get(item.operatorUserId) : undefined)),
      page: { page, pageSize, total },
    };
  }

  private async getBatchOrThrow(batchId: string) {
    const id = this.parseUuidStrict(batchId, 'batchId');
    const batch = await this.prisma.importBatch.findUnique({ where: { id } });
    if (!batch) throw new NotFoundException({ code: 'NOT_FOUND', message: 'import batch not found' });
    return batch;
  }

  async getImportBatch(req: any, batchId: string): Promise<ImportBatchDto> {
    this.ensureAdmin(req);
    const batch = await this.getBatchOrThrow(batchId);
    const userMap = await this.buildUserMap([batch.operatorUserId]);
    return this.toBatchDto(batch, batch.operatorUserId ? userMap.get(batch.operatorUserId) : undefined);
  }

  private isCreatedNear(createdAt: any, referenceAt: any): boolean {
    if (!createdAt || !referenceAt) return false;
    const created = new Date(createdAt).getTime();
    const reference = new Date(referenceAt).getTime();
    if (!Number.isFinite(created) || !Number.isFinite(reference)) return false;
    return created >= reference - 5000;
  }

  private async ensureDealRecordChangeLogs(batch: any) {
    if (!batch.legacyJobId) return;
    const job = await this.prisma.dealRecordImportJob.findUnique({ where: { id: batch.legacyJobId } });
    if (!job) return;
    const rows = await this.prisma.dealRecordImportJobRow.findMany({
      where: { jobId: batch.legacyJobId, status: 'SUCCEEDED', dealRecordId: { not: null } },
      orderBy: [{ rowNo: 'asc' }, { id: 'asc' }],
    });
    if (!rows.length) return;
    const dealIds = rows.map((row) => row.dealRecordId).filter((id): id is string => !!id);
    const records = await this.prisma.dealRecord.findMany({ where: { id: { in: dealIds } } });
    const recordMap = new Map(records.map((item) => [item.id, item]));
    await this.prisma.importChangeLog.createMany({
      skipDuplicates: true,
      data: rows.map((row) => {
        const record = row.dealRecordId ? recordMap.get(row.dealRecordId) : null;
        const wasLikelyCreated = this.isCreatedNear(record?.createdAt, job.createdAt);
        const operation: ImportChangeOperation = wasLikelyCreated ? 'CREATE' : 'UPDATE';
        return {
          batchId: batch.id,
          rowNo: row.rowNo,
          entityType: 'DEAL_RECORD' as any,
          entityId: row.dealRecordId,
          operation: operation as any,
          afterJson: {
            jobId: row.jobId,
            rowId: row.id,
            rowNo: row.rowNo,
            processedAt: this.toIso(row.processedAt),
            detectedLegacyUpdate: !wasLikelyCreated,
          } as any,
          rollbackStrategy: 'MANUAL_ONLY' as any,
        };
      }),
    });
  }

  private async ensureListingChangeLogs(batch: any) {
    if (!batch.legacyJobId) return;
    const job = await this.prisma.listingImportJob.findUnique({ where: { id: batch.legacyJobId } });
    if (!job) return;
    const rows = await this.prisma.listingImportJobRow.findMany({
      where: { jobId: batch.legacyJobId, status: 'SUCCEEDED', listingId: { not: null } },
      orderBy: [{ rowNo: 'asc' }, { id: 'asc' }],
    });
    if (!rows.length) return;
    const listingIds = rows.map((row) => row.listingId).filter((id): id is string => !!id);
    const listings = await this.prisma.listing.findMany({ where: { id: { in: listingIds } } });
    const listingMap = new Map(listings.map((item) => [item.id, item]));
    await this.prisma.importChangeLog.createMany({
      skipDuplicates: true,
      data: rows.map((row) => {
        const listing = row.listingId ? listingMap.get(row.listingId) : null;
        const wasLikelyCreated = this.isCreatedNear(listing?.createdAt, job.startedAt || job.createdAt);
        const operation: ImportChangeOperation = wasLikelyCreated ? 'CREATE' : 'UPDATE';
        const strategy: ImportRollbackStrategy = wasLikelyCreated ? 'SOFT_OFF_SHELF' : 'MANUAL_ONLY';
        return {
          batchId: batch.id,
          rowNo: row.rowNo,
          entityType: 'LISTING' as any,
          entityId: row.listingId,
          operation: operation as any,
          afterJson: {
            jobId: row.jobId,
            rowId: row.id,
            rowNo: row.rowNo,
            processedAt: this.toIso(row.processedAt),
            detectedLegacyUpdate: !wasLikelyCreated,
          } as any,
          rollbackStrategy: strategy as any,
        };
      }),
    });
  }

  private async ensurePatentChangeLogs(batch: any) {
    if (!batch.legacyJobId) return;
    const job = await this.prisma.patentImportJob.findUnique({ where: { id: batch.legacyJobId } });
    if (!job) return;
    const rows = await this.prisma.patentImportJobRow.findMany({
      where: { jobId: batch.legacyJobId, status: 'SUCCEEDED', patentId: { not: null } },
      orderBy: [{ rowNo: 'asc' }, { id: 'asc' }],
    });
    if (!rows.length) return;
    const patentIds = Array.from(new Set(rows.map((row) => row.patentId).filter((id): id is string => !!id)));
    const listings = patentIds.length
      ? await this.prisma.listing.findMany({
          where: { patentId: { in: patentIds } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
      : [];
    const listingByPatentId = new Map<string, any>();
    for (const listing of listings) {
      if (listing.patentId && !listingByPatentId.has(listing.patentId)) listingByPatentId.set(listing.patentId, listing);
    }

    const patentLogs = rows.map((row) => ({
        batchId: batch.id,
        rowNo: row.rowNo,
        entityType: 'PATENT' as any,
        entityId: row.patentId,
        operation: 'UPDATE' as any,
        afterJson: {
          jobId: row.jobId,
          rowId: row.id,
          rowNo: row.rowNo,
          processedAt: this.toIso(row.processedAt),
        } as any,
        rollbackStrategy: 'MANUAL_ONLY' as any,
    }));
    const listingLogs = rows
      .map((row) => {
        const listing = row.patentId ? listingByPatentId.get(row.patentId) : null;
        if (!listing) return null;
        const referenceAt = row.processedAt || job.startedAt || job.createdAt;
        const wasLikelyCreated = this.isCreatedNear(listing.createdAt, referenceAt);
        const operation: ImportChangeOperation = wasLikelyCreated ? 'CREATE' : 'UPDATE';
        const strategy: ImportRollbackStrategy = wasLikelyCreated ? 'SOFT_OFF_SHELF' : 'MANUAL_ONLY';
        return {
          batchId: batch.id,
          rowNo: row.rowNo,
          entityType: 'LISTING' as any,
          entityId: listing.id,
          operation: operation as any,
          afterJson: {
            jobId: row.jobId,
            rowId: row.id,
            rowNo: row.rowNo,
            patentId: row.patentId,
            source: 'PATENT_IMPORT_LISTING_BACKFILL',
            processedAt: this.toIso(row.processedAt),
            detectedLegacyUpdate: !wasLikelyCreated,
          } as any,
          rollbackStrategy: strategy as any,
        };
      })
      .filter((item): item is NonNullable<typeof item> => !!item);
    const data = [...patentLogs, ...listingLogs];
    if (!data.length) return;
    await this.prisma.importChangeLog.createMany({ skipDuplicates: true, data });
  }

  private normalizePeopleChangeOperation(value: unknown): ImportChangeOperation {
    const raw = String(value || '').trim().toUpperCase();
    if (raw === 'CREATE' || raw === 'UPDATE' || raw === 'APPEND' || raw === 'REPLACE') return raw as ImportChangeOperation;
    return 'UPDATE';
  }

  private techManagerRollbackStrategy(entityType: ImportEntityType, operation: ImportChangeOperation): ImportRollbackStrategy {
    if (entityType === 'USER_VERIFICATION' && operation === 'CREATE') return 'SOFT_OFF_SHELF';
    if (entityType === 'TECH_MANAGER_PROFILE' && operation === 'CREATE') return 'SOFT_OFF_SHELF';
    if (entityType === 'TECH_MANAGER_BADGE' && operation === 'APPEND') return 'EXPIRE_BADGE';
    return 'MANUAL_ONLY';
  }

  private async getBulkAuditLog(batch: any) {
    if (!batch.legacyJobId) return null;
    return await this.prisma.auditLog.findUnique({ where: { id: batch.legacyJobId } });
  }

  private buildPeopleLogsFromAuditChanges(batch: any, auditLog: any): any[] {
    const afterJson = (auditLog?.afterJson || {}) as any;
    const sourceBatch = String(batch.sourceBatch || afterJson?.input?.sourceBatch || '').trim();
    const changes: PeopleAuditChange[] = Array.isArray(afterJson?.people?.changes) ? afterJson.people.changes : [];
    return changes
      .map((change) => {
        const entityType = String(change?.entityType || '').trim().toUpperCase() as ImportEntityType;
        const entityId = String(change?.entityId || '').trim();
        if (!TECH_MANAGER_CHANGE_ENTITY_TYPES.has(entityType) || !UUID_RE.test(entityId)) return null;
        const rowNoRaw = Number(change?.rowNo || 0);
        const rowNo = Number.isSafeInteger(rowNoRaw) && rowNoRaw > 0 ? rowNoRaw : null;
        const displayName = this.truncateText(change?.label || change?.afterJson?.displayName, 120);
        const operation = this.normalizePeopleChangeOperation(change?.operation);
        return {
          batchId: batch.id,
          rowNo,
          entityType: entityType as any,
          entityId,
          operation: operation as any,
          afterJson: {
            ...(change?.afterJson || {}),
            source: 'PEOPLE_IMPORT_AUDIT_PAYLOAD',
            auditLogId: auditLog.id,
            sourceBatch,
            displayName: displayName || null,
            rowNo,
          } as any,
          rollbackStrategy: this.techManagerRollbackStrategy(entityType, operation) as any,
        };
      })
      .filter((item): item is any => !!item);
  }

  private buildDateWindow(referenceAt: any, minutes = 30): { gte: Date; lte: Date } | null {
    if (!referenceAt) return null;
    const center = new Date(referenceAt);
    if (!Number.isFinite(center.getTime())) return null;
    const span = minutes * 60 * 1000;
    return { gte: new Date(center.getTime() - span), lte: new Date(center.getTime() + span) };
  }

  private async loadTechManagerBadgesForBackfill(userIds: string[], window: { gte: Date; lte: Date } | null) {
    if (!userIds.length || !window) return new Map<string, any[]>();
    const badges = await this.prisma.techManagerBadge.findMany({
      where: {
        techManagerUserId: { in: userIds },
        OR: [{ assignedAt: window }, { updatedAt: window }],
      },
      orderBy: [{ assignedAt: 'asc' }, { id: 'asc' }],
    });
    const map = new Map<string, any[]>();
    for (const badge of badges) {
      const key = String(badge.techManagerUserId || '');
      if (!key) continue;
      map.set(key, [...(map.get(key) || []), badge]);
    }
    return map;
  }

  private buildTechManagerChangeLogsFromVerifications(params: {
    batch: any;
    auditLog: any;
    rows: Array<{ rowNo: number; name: string; verification: any }>;
    badgeMap: Map<string, any[]>;
    referenceAt: any;
  }): any[] {
    const referenceAt = params.referenceAt || params.auditLog?.createdAt || params.batch.executedAt || params.batch.createdAt;
    const sourceBatch = String(params.batch.sourceBatch || params.auditLog?.afterJson?.input?.sourceBatch || '').trim();
    const out: any[] = [];
    for (const row of params.rows) {
      const verification = row.verification;
      const user = verification?.user;
      if (!verification?.id || !user?.id) continue;
      const profile = user.techManagerProfile || null;
      const displayName = row.name || String(verification.displayName || user.nickname || '').trim();
      out.push({
        batchId: params.batch.id,
        rowNo: row.rowNo,
        entityType: 'USER' as any,
        entityId: user.id,
        operation: (this.isCreatedNear(user.createdAt, referenceAt) ? 'CREATE' : 'UPDATE') as any,
        afterJson: {
          source: 'PEOPLE_IMPORT_HISTORY_BACKFILL',
          auditLogId: params.auditLog?.id || null,
          sourceBatch,
          displayName,
          importedAt: this.toIso(referenceAt),
        } as any,
        rollbackStrategy: 'MANUAL_ONLY' as any,
      });
      const verificationOperation: ImportChangeOperation = this.isCreatedNear(verification.createdAt, referenceAt)
        ? 'CREATE'
        : 'UPDATE';
      out.push({
        batchId: params.batch.id,
        rowNo: row.rowNo,
        entityType: 'USER_VERIFICATION' as any,
        entityId: verification.id,
        operation: verificationOperation as any,
        afterJson: {
          source: 'PEOPLE_IMPORT_HISTORY_BACKFILL',
          auditLogId: params.auditLog?.id || null,
          sourceBatch,
          displayName,
          verificationType: verification.verificationType,
          verificationStatus: verification.verificationStatus,
          reviewedAt: this.toIso(verification.reviewedAt),
          importedAt: this.toIso(referenceAt),
        } as any,
        rollbackStrategy: this.techManagerRollbackStrategy('USER_VERIFICATION', verificationOperation) as any,
      });
      if (profile) {
        const profileOperation: ImportChangeOperation = this.isCreatedNear(profile.createdAt, referenceAt) ? 'CREATE' : 'UPDATE';
        out.push({
          batchId: params.batch.id,
          rowNo: row.rowNo,
          entityType: 'TECH_MANAGER_PROFILE' as any,
          entityId: user.id,
          operation: profileOperation as any,
          afterJson: {
            source: 'PEOPLE_IMPORT_HISTORY_BACKFILL',
            auditLogId: params.auditLog?.id || null,
            sourceBatch,
            displayName,
            position: profile.position || null,
            organization: profile.organization || null,
            importedAt: this.toIso(referenceAt),
          } as any,
          rollbackStrategy: this.techManagerRollbackStrategy('TECH_MANAGER_PROFILE', profileOperation) as any,
        });
      }
      const badges = params.badgeMap.get(user.id) || [];
      for (const badge of badges) {
        if (!badge?.id) continue;
        const replaced = !!badge.expiresAt && this.changedAfterReference(badge.updatedAt, new Date(referenceAt));
        out.push({
          batchId: params.batch.id,
          rowNo: row.rowNo,
          entityType: 'TECH_MANAGER_BADGE' as any,
          entityId: badge.id,
          operation: (replaced ? 'REPLACE' : 'APPEND') as any,
          afterJson: {
            source: 'PEOPLE_IMPORT_HISTORY_BACKFILL',
            auditLogId: params.auditLog?.id || null,
            sourceBatch,
            displayName,
            badgeCode: badge.badgeCode,
            assignedAt: this.toIso(badge.assignedAt),
            expiresAt: this.toIso(badge.expiresAt),
          } as any,
          rollbackStrategy: this.techManagerRollbackStrategy('TECH_MANAGER_BADGE', replaced ? 'REPLACE' : 'APPEND') as any,
        });
      }
    }
    return out;
  }

  private async buildPeopleLogsFromWorkbookRows(batch: any, auditLog: any): Promise<any[]> {
    const input = ((auditLog?.afterJson || {}) as any)?.input || {};
    const workbookRows = await this.readPeopleWorkbookRows(input.peopleFileId || batch.fileId);
    if (!workbookRows.length) return [];
    const names = Array.from(new Set(workbookRows.map((row) => row.name).filter(Boolean)));
    if (!names.length) return [];
    const verifications = await this.prisma.userVerification.findMany({
      where: { verificationType: 'TECH_MANAGER' as any, displayName: { in: names } },
      include: { user: { include: { techManagerProfile: true } } },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
    const referenceAt = auditLog?.createdAt || batch.executedAt || batch.createdAt;
    const byName = new Map<string, any[]>();
    for (const verification of verifications) {
      const key = this.normalizePersonName(verification.displayName);
      if (!key) continue;
      byName.set(key, [...(byName.get(key) || []), verification]);
    }
    const referenceTime = referenceAt ? new Date(referenceAt).getTime() : Number.NaN;
    const rows = workbookRows
      .map((row) => {
        const candidates = byName.get(row.name) || [];
        const verification = Number.isFinite(referenceTime)
          ? [...candidates].sort((a, b) => {
              const aTime = new Date(a.reviewedAt || a.updatedAt || a.createdAt).getTime();
              const bTime = new Date(b.reviewedAt || b.updatedAt || b.createdAt).getTime();
              return Math.abs(aTime - referenceTime) - Math.abs(bTime - referenceTime);
            })[0]
          : candidates[0];
        return verification ? { ...row, verification } : null;
      })
      .filter((row): row is { rowNo: number; name: string; verification: any } => !!row);
    const userIds = Array.from(new Set(rows.map((row) => row.verification?.user?.id).filter((id): id is string => !!id)));
    const badgeMap = await this.loadTechManagerBadgesForBackfill(userIds, this.buildDateWindow(referenceAt));
    return this.buildTechManagerChangeLogsFromVerifications({ batch, auditLog, rows, badgeMap, referenceAt });
  }

  private async buildPeopleLogsFromTimeWindow(batch: any, auditLog: any): Promise<any[]> {
    const referenceAt = auditLog?.createdAt || batch.executedAt || batch.createdAt;
    const window = this.buildDateWindow(referenceAt);
    if (!window) return [];
    const afterJson = (auditLog?.afterJson || {}) as any;
    const expected = this.number(afterJson?.people?.created) + this.number(afterJson?.people?.updated);
    const verifications = await this.prisma.userVerification.findMany({
      where: {
        verificationType: 'TECH_MANAGER' as any,
        OR: [{ reviewedAt: window }, { updatedAt: window }, { createdAt: window }],
      },
      include: { user: { include: { techManagerProfile: true } } },
      orderBy: [{ reviewedAt: 'asc' }, { updatedAt: 'asc' }, { createdAt: 'asc' }],
      take: expected > 0 ? expected : 100,
    });
    const rows = verifications.map((verification, index) => ({
      rowNo: index + 1,
      name: this.normalizePersonName(verification.displayName || verification.user?.nickname),
      verification,
    }));
    const userIds = Array.from(new Set(rows.map((row) => row.verification?.user?.id).filter((id): id is string => !!id)));
    const badgeMap = await this.loadTechManagerBadgesForBackfill(userIds, window);
    return this.buildTechManagerChangeLogsFromVerifications({ batch, auditLog, rows, badgeMap, referenceAt });
  }

  private async ensurePeopleAchievementsChangeLogs(batch: any) {
    const sourceBatch = String(batch.sourceBatch || '').trim();
    const data: any[] = [];
    if (sourceBatch) {
      const achievements = await this.prisma.achievement.findMany({
        where: { sourceBatch },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      data.push(...achievements.map((item, index) => ({
        batchId: batch.id,
        rowNo: index + 1,
        entityType: 'ACHIEVEMENT' as any,
        entityId: item.id,
        operation: 'UPDATE' as any,
        afterJson: {
          sourceBatch,
          importedAt: this.toIso(batch.executedAt),
          status: item.status,
          auditStatus: item.auditStatus,
        } as any,
        rollbackStrategy: 'SOFT_OFF_SHELF' as any,
      })));
    }

    const auditLog = await this.getBulkAuditLog(batch);
    const auditPeopleLogs = auditLog ? this.buildPeopleLogsFromAuditChanges(batch, auditLog) : [];
    if (auditPeopleLogs.length) data.push(...auditPeopleLogs);
    else if (auditLog || batch.fileId) {
      const workbookPeopleLogs = await this.buildPeopleLogsFromWorkbookRows(batch, auditLog);
      data.push(...(workbookPeopleLogs.length ? workbookPeopleLogs : await this.buildPeopleLogsFromTimeWindow(batch, auditLog)));
    }

    if (!data.length) return;
    await this.prisma.importChangeLog.createMany({ skipDuplicates: true, data });
  }

  private async getExistingChangeEntityTypes(batchId: string): Promise<Set<ImportEntityType>> {
    const rows = await this.prisma.importChangeLog.groupBy({
      by: ['entityType'],
      where: { batchId },
      _count: { _all: true },
    });
    return new Set(rows.map((row) => row.entityType as ImportEntityType));
  }

  private async upgradeTechManagerRollbackStrategies(batchId: string) {
    await Promise.all([
      this.prisma.importChangeLog.updateMany({
        where: {
          batchId,
          entityType: 'USER_VERIFICATION' as any,
          operation: 'CREATE' as any,
          rollbackStrategy: 'MANUAL_ONLY' as any,
          rollbackStatus: { not: 'ROLLED_BACK' as any },
        },
        data: {
          rollbackStrategy: 'SOFT_OFF_SHELF' as any,
          rollbackStatus: 'PENDING' as any,
          blockedReason: null,
          rollbackError: null,
        },
      }),
      this.prisma.importChangeLog.updateMany({
        where: {
          batchId,
          entityType: 'TECH_MANAGER_PROFILE' as any,
          operation: 'CREATE' as any,
          rollbackStrategy: 'MANUAL_ONLY' as any,
          rollbackStatus: { not: 'ROLLED_BACK' as any },
        },
        data: {
          rollbackStrategy: 'SOFT_OFF_SHELF' as any,
          rollbackStatus: 'PENDING' as any,
          blockedReason: null,
          rollbackError: null,
        },
      }),
      this.prisma.importChangeLog.updateMany({
        where: {
          batchId,
          entityType: 'TECH_MANAGER_BADGE' as any,
          operation: 'APPEND' as any,
          rollbackStrategy: 'MANUAL_ONLY' as any,
          rollbackStatus: { not: 'ROLLED_BACK' as any },
        },
        data: {
          rollbackStrategy: 'EXPIRE_BADGE' as any,
          rollbackStatus: 'PENDING' as any,
          blockedReason: null,
          rollbackError: null,
        },
      }),
    ]);
  }

  private async ensureChangeLogsForBatch(batch: any) {
    if (batch.kind === 'PEOPLE_ACHIEVEMENTS') await this.upgradeTechManagerRollbackStrategies(batch.id);
    const existingTypes = await this.getExistingChangeEntityTypes(batch.id);
    if (batch.kind === 'DEAL_RECORD' && existingTypes.has('DEAL_RECORD')) return;
    if (batch.kind === 'LISTING' && existingTypes.has('LISTING')) return;
    if (batch.kind === 'PATENT' && existingTypes.has('PATENT') && existingTypes.has('LISTING')) return;
    if (batch.kind === 'PEOPLE_ACHIEVEMENTS') {
      const hasTechManagerLogs = Array.from(TECH_MANAGER_CHANGE_ENTITY_TYPES).some((entityType) => existingTypes.has(entityType));
      if (hasTechManagerLogs) return;
    }
    if (batch.kind === 'DEAL_RECORD') await this.ensureDealRecordChangeLogs(batch);
    else if (batch.kind === 'LISTING') await this.ensureListingChangeLogs(batch);
    else if (batch.kind === 'PATENT') await this.ensurePatentChangeLogs(batch);
    else if (batch.kind === 'PEOPLE_ACHIEVEMENTS') await this.ensurePeopleAchievementsChangeLogs(batch);
  }

  private extractReferenceAt(change: any, fallback?: any): Date | null {
    const after = (change.afterJson || {}) as any;
    const raw = after?.processedAt || after?.importedAt || after?.updatedAt || fallback || change.createdAt;
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  private changedAfterReference(updatedAt: any, referenceAt: Date | null): boolean {
    if (!updatedAt || !referenceAt) return false;
    const updated = new Date(updatedAt).getTime();
    const reference = referenceAt.getTime();
    if (!Number.isFinite(updated) || !Number.isFinite(reference)) return false;
    return updated > reference + 5000;
  }

  private basePreview(change: any, status: ImportRollbackStatus, reason?: string | null, extra?: Partial<RollbackChangePreview>): RollbackChangePreview {
    return {
      changeId: change.id,
      rowNo: change.rowNo ?? null,
      entityType: change.entityType as ImportEntityType,
      entityId: change.entityId ?? null,
      operation: change.operation as ImportChangeOperation,
      rollbackStrategy: change.rollbackStrategy as ImportRollbackStrategy,
      rollbackStatus: status,
      blockedReason: reason || null,
      ...extra,
    };
  }

  private changePreviewLabel(change: any): string | null {
    const after = (change.afterJson || {}) as any;
    const label = after.displayName || after.name || after.fullName || after.title || after.patentTitle || after.label || after.badgeCode;
    const normalized = String(label || '').trim();
    return normalized || null;
  }

  private async evaluateDealRecords(batch: any, changes: any[]): Promise<RollbackChangePreview[]> {
    const ids = changes.map((item) => item.entityId).filter((id): id is string => !!id);
    const records = await this.prisma.dealRecord.findMany({ where: { id: { in: ids } } });
    const map = new Map(records.map((item) => [item.id, item]));
    return changes.map((change) => {
      if (change.rollbackStrategy === 'MANUAL_ONLY') {
        return this.basePreview(change, 'BLOCKED', '成交记录是线下实际成交事实，当前只生成报告，不自动撤回');
      }
      const record = change.entityId ? map.get(change.entityId) : null;
      if (!record) return this.basePreview(change, 'BLOCKED', '成交记录不存在，无法自动撤回');
      if (record.status === 'VOIDED') {
        return this.basePreview(change, 'ROLLED_BACK', null, { entityLabel: record.patentTitle });
      }
      if (batch.legacyJobId && record.importJobId && record.importJobId !== batch.legacyJobId) {
        return this.basePreview(change, 'CONFLICTED', '成交记录已被其他导入批次更新', { entityLabel: record.patentTitle });
      }
      return this.basePreview(change, 'ROLLBACKABLE', null, { entityLabel: record.patentTitle });
    });
  }

  private async evaluateListings(batch: any, changes: any[]): Promise<RollbackChangePreview[]> {
    const ids = changes.map((item) => item.entityId).filter((id): id is string => !!id);
    const listings = await this.prisma.listing.findMany({
      where: { id: { in: ids } },
      include: { _count: { select: { orders: true, conversations: true, favorites: true, consultEvents: true } } },
    });
    const map = new Map(listings.map((item) => [item.id, item]));
    return changes.map((change) => {
      if (change.rollbackStrategy === 'MANUAL_ONLY') {
        return this.basePreview(change, 'BLOCKED', '历史覆盖更新缺少导入前快照，需要人工处理');
      }
      const listing = change.entityId ? map.get(change.entityId) : null;
      if (!listing) return this.basePreview(change, 'BLOCKED', '挂牌不存在，无法自动撤回');
      const dependency = {
        orderCount: this.number((listing as any)._count?.orders),
        conversationCount: this.number((listing as any)._count?.conversations),
        favoriteCount: this.number((listing as any)._count?.favorites),
        consultCount: this.number((listing as any)._count?.consultEvents),
      };
      if (listing.status === 'OFF_SHELF') {
        return this.basePreview(change, 'ROLLED_BACK', null, { entityLabel: listing.title, dependency });
      }
      if (listing.status === 'SOLD') {
        return this.basePreview(change, 'BLOCKED', '挂牌已成交，不自动下架', { entityLabel: listing.title, dependency });
      }
      if (this.changedAfterReference(listing.updatedAt, this.extractReferenceAt(change, batch.executedAt))) {
        return this.basePreview(change, 'CONFLICTED', '挂牌导入后已被修改，需要人工确认', {
          entityLabel: listing.title,
          dependency,
          overrideable: change.rollbackStrategy === 'SOFT_OFF_SHELF',
        });
      }
      return this.basePreview(change, 'ROLLBACKABLE', null, { entityLabel: listing.title, dependency });
    });
  }

  private async evaluateAchievements(batch: any, changes: any[]): Promise<RollbackChangePreview[]> {
    const ids = changes.map((item) => item.entityId).filter((id): id is string => !!id);
    const achievements = await this.prisma.achievement.findMany({
      where: { id: { in: ids } },
      include: { stats: true, _count: { select: { favorites: true } } },
    });
    const map = new Map(achievements.map((item) => [item.id, item]));
    return changes.map((change) => {
      const achievement = change.entityId ? map.get(change.entityId) : null;
      if (!achievement) return this.basePreview(change, 'BLOCKED', '成果不存在，无法自动撤回');
      const dependency = {
        favoriteCount: this.number((achievement as any)._count?.favorites),
        consultCount: this.number((achievement as any).stats?.consultCount),
      };
      if (achievement.status === 'OFF_SHELF') {
        return this.basePreview(change, 'ROLLED_BACK', null, { entityLabel: achievement.title, dependency });
      }
      if (this.changedAfterReference(achievement.updatedAt, this.extractReferenceAt(change, batch.executedAt))) {
        return this.basePreview(change, 'CONFLICTED', '成果导入后已被修改，需要人工确认', {
          entityLabel: achievement.title,
          dependency,
          overrideable: change.rollbackStrategy === 'SOFT_OFF_SHELF',
        });
      }
      return this.basePreview(change, 'ROLLBACKABLE', null, { entityLabel: achievement.title, dependency });
    });
  }

  private async evaluatePatents(changes: any[]): Promise<RollbackChangePreview[]> {
    const ids = changes.map((item) => item.entityId).filter((id): id is string => !!id);
    const patents = await this.prisma.patent.findMany({
      where: { id: { in: ids } },
      include: {
        _count: {
          select: { listings: true, claimRequests: true, dealRecords: true, maintenanceSchedules: true },
        },
      },
    });
    const map = new Map(patents.map((item) => [item.id, item]));
    return changes.map((change) => {
      const patent = change.entityId ? map.get(change.entityId) : null;
      if (!patent) return this.basePreview(change, 'SKIPPED', '专利不存在');
      const dependency = {
        listingCount: this.number((patent as any)._count?.listings),
        claimRequestCount: this.number((patent as any)._count?.claimRequests),
        dealRecordCount: this.number((patent as any)._count?.dealRecords),
        maintenanceScheduleCount: this.number((patent as any)._count?.maintenanceSchedules),
      };
      return this.basePreview(change, 'BLOCKED', '专利主数据撤回需要人工确认，当前版本不自动删除或覆盖', {
        entityLabel: patent.title,
        dependency,
      });
    });
  }

  private async evaluateTechManagerChanges(batch: any, changes: any[]): Promise<RollbackChangePreview[]> {
    const reasonMap: Record<string, string> = {
      USER: '经理人账号可能关联登录、订单、会话等用户行为，当前只生成处理清单，不自动删除或覆盖',
      USER_VERIFICATION: '经理人认证资料缺少导入前快照，当前只生成处理清单，不自动回退认证状态',
      TECH_MANAGER_PROFILE: '经理人主页资料缺少导入前快照，当前只生成处理清单，不自动覆盖回退',
      TECH_MANAGER_BADGE: '经理人标签可能包含人工运营调整，当前只生成处理清单，不自动过期或恢复',
    };
    const verificationIds = changes
      .filter((item) => item.entityType === 'USER_VERIFICATION')
      .map((item) => item.entityId)
      .filter((id): id is string => !!id);
    const profileUserIds = changes
      .filter((item) => item.entityType === 'TECH_MANAGER_PROFILE')
      .map((item) => item.entityId)
      .filter((id): id is string => !!id);
    const badgeIds = changes
      .filter((item) => item.entityType === 'TECH_MANAGER_BADGE')
      .map((item) => item.entityId)
      .filter((id): id is string => !!id);
    const [verifications, profiles, badges] = await Promise.all([
      verificationIds.length
        ? this.prisma.userVerification.findMany({ where: { id: { in: verificationIds } }, include: { user: true } })
        : [],
      profileUserIds.length ? this.prisma.techManagerProfile.findMany({ where: { userId: { in: profileUserIds } } }) : [],
      badgeIds.length ? this.prisma.techManagerBadge.findMany({ where: { id: { in: badgeIds } } }) : [],
    ]);
    const verificationMap = new Map(verifications.map((item) => [item.id, item]));
    const profileMap = new Map(profiles.map((item) => [item.userId, item]));
    const badgeMap = new Map(badges.map((item) => [item.id, item]));

    return changes.map((change) => {
      const after = (change.afterJson || {}) as any;
      const label = String(after.displayName || after.label || after.badgeCode || '').trim() || null;
      if (change.rollbackStrategy === 'MANUAL_ONLY') {
        return this.basePreview(change, 'BLOCKED', reasonMap[String(change.entityType)] || '该数据类型需要人工处理', {
          entityLabel: label,
        });
      }

      const referenceAt = this.extractReferenceAt(change, batch.executedAt);
      if (change.entityType === 'USER_VERIFICATION' && change.rollbackStrategy === 'SOFT_OFF_SHELF') {
        const verification = change.entityId ? verificationMap.get(change.entityId) : null;
        if (!verification) return this.basePreview(change, 'SKIPPED', '经理人认证资料不存在', { entityLabel: label });
        const displayName = label || String(verification.displayName || verification.user?.nickname || '').trim() || null;
        if (verification.verificationStatus === 'REJECTED') {
          return this.basePreview(change, 'ROLLED_BACK', null, { entityLabel: displayName });
        }
        if (change.operation !== 'CREATE') {
          return this.basePreview(change, 'BLOCKED', '更新类经理人认证缺少导入前快照，只生成处理清单', {
            entityLabel: displayName,
          });
        }
        if (this.changedAfterReference(verification.updatedAt, referenceAt)) {
          return this.basePreview(change, 'CONFLICTED', '经理人认证在导入后已被修改，需人工确认后才能取消认证', {
            entityLabel: displayName,
            overrideable: true,
          });
        }
        return this.basePreview(change, 'ROLLBACKABLE', null, { entityLabel: displayName });
      }

      if (change.entityType === 'TECH_MANAGER_PROFILE' && change.rollbackStrategy === 'SOFT_OFF_SHELF') {
        const profile = change.entityId ? profileMap.get(change.entityId) : null;
        if (!profile) return this.basePreview(change, 'SKIPPED', '经理人主页资料不存在', { entityLabel: label });
        if (change.operation !== 'CREATE') {
          return this.basePreview(change, 'BLOCKED', '更新类经理人主页缺少导入前快照，只生成处理清单', { entityLabel: label });
        }
        if (this.changedAfterReference(profile.updatedAt, referenceAt)) {
          return this.basePreview(change, 'CONFLICTED', '经理人主页在导入后已被修改，需人工确认后才能隐藏', {
            entityLabel: label,
            overrideable: true,
          });
        }
        return this.basePreview(change, 'ROLLBACKABLE', null, { entityLabel: label });
      }

      if (change.entityType === 'TECH_MANAGER_BADGE' && change.rollbackStrategy === 'EXPIRE_BADGE') {
        const badge = change.entityId ? badgeMap.get(change.entityId) : null;
        const badgeLabel = label || String(badge?.badgeCode || '').trim() || null;
        if (!badge) return this.basePreview(change, 'SKIPPED', '经理人标签不存在', { entityLabel: badgeLabel });
        if (badge.expiresAt) return this.basePreview(change, 'ROLLED_BACK', null, { entityLabel: badgeLabel });
        if (this.changedAfterReference(badge.updatedAt, referenceAt)) {
          return this.basePreview(change, 'CONFLICTED', '经理人标签在导入后已被调整，需人工确认后才能移除', {
            entityLabel: badgeLabel,
            overrideable: true,
          });
        }
        return this.basePreview(change, 'ROLLBACKABLE', null, { entityLabel: badgeLabel });
      }

      return this.basePreview(change, 'BLOCKED', reasonMap[String(change.entityType)] || '该数据类型需要人工处理', {
        entityLabel: label,
      });
    });
  }

  private async evaluateChanges(batch: any, changes: any[]): Promise<RollbackChangePreview[]> {
    const evaluatedAlreadyRolledBack = changes
      .filter((change) => change.rollbackStatus === 'ROLLED_BACK' || !!change.rolledBackAt)
      .map((change) =>
        this.basePreview(change, 'ROLLED_BACK', null, {
          entityLabel: this.changePreviewLabel(change),
        }),
      );
    const activeChanges = changes.filter((change) => change.rollbackStatus !== 'ROLLED_BACK' && !change.rolledBackAt);
    const groups = new Map<ImportEntityType, any[]>();
    for (const change of activeChanges) {
      const key = change.entityType as ImportEntityType;
      groups.set(key, [...(groups.get(key) || []), change]);
    }
    const out: RollbackChangePreview[] = [...evaluatedAlreadyRolledBack];
    for (const [entityType, items] of groups) {
      if (entityType === 'DEAL_RECORD') out.push(...(await this.evaluateDealRecords(batch, items)));
      else if (entityType === 'LISTING') out.push(...(await this.evaluateListings(batch, items)));
      else if (entityType === 'ACHIEVEMENT') out.push(...(await this.evaluateAchievements(batch, items)));
      else if (entityType === 'PATENT') out.push(...(await this.evaluatePatents(items)));
      else if (TECH_MANAGER_CHANGE_ENTITY_TYPES.has(entityType)) out.push(...(await this.evaluateTechManagerChanges(batch, items)));
      else {
        out.push(...items.map((item) => this.basePreview(item, 'BLOCKED', '该数据类型需要人工处理')));
      }
    }
    return out.sort((a, b) => {
      const left = a.rowNo ?? Number.MAX_SAFE_INTEGER;
      const right = b.rowNo ?? Number.MAX_SAFE_INTEGER;
      return left - right || String(a.changeId).localeCompare(String(b.changeId));
    });
  }

  private summarizePreview(batchDto: ImportBatchDto, changes: any[], evaluated: RollbackChangePreview[]): RollbackPreview {
    const byId = new Map(changes.map((item) => [item.id, item]));
    const summary = {
      totalCount: evaluated.length,
      rollbackableCount: 0,
      conflictedCount: 0,
      blockedCount: 0,
      manualOnlyCount: 0,
      rolledBackCount: 0,
      skippedCount: 0,
      failedCount: 0,
    };
    const groupMap = new Map<ImportEntityType, RollbackPreview['groups'][number]>();
    for (const item of evaluated) {
      if (item.rollbackStatus === 'ROLLBACKABLE') summary.rollbackableCount += 1;
      if (item.rollbackStatus === 'CONFLICTED') summary.conflictedCount += 1;
      if (item.rollbackStatus === 'BLOCKED') summary.blockedCount += 1;
      if (item.rollbackStatus === 'ROLLED_BACK') summary.rolledBackCount += 1;
      if (item.rollbackStatus === 'SKIPPED') summary.skippedCount += 1;
      if (item.rollbackStatus === 'FAILED') summary.failedCount += 1;
      if (item.rollbackStrategy === 'MANUAL_ONLY') summary.manualOnlyCount += 1;
      const source = byId.get(item.changeId);
      const group =
        groupMap.get(item.entityType) ||
        ({
          entityType: item.entityType,
          total: 0,
          created: 0,
          updated: 0,
          rollbackable: 0,
          conflicted: 0,
          blocked: 0,
          manualOnly: 0,
          rolledBack: 0,
        } satisfies RollbackPreview['groups'][number]);
      group.total += 1;
      if (source?.operation === 'CREATE') group.created += 1;
      if (source?.operation === 'UPDATE' || source?.operation === 'REPLACE' || source?.operation === 'APPEND') group.updated += 1;
      if (item.rollbackStatus === 'ROLLBACKABLE') group.rollbackable += 1;
      if (item.rollbackStatus === 'CONFLICTED') group.conflicted += 1;
      if (item.rollbackStatus === 'BLOCKED') group.blocked += 1;
      if (item.rollbackStrategy === 'MANUAL_ONLY') group.manualOnly += 1;
      if (item.rollbackStatus === 'ROLLED_BACK') group.rolledBack += 1;
      groupMap.set(item.entityType, group);
    }
    const warnings: string[] = [];
    if (summary.conflictedCount > 0) warnings.push('有数据在导入后又被改过，系统默认不会撤回这些后续修改。');
    if (summary.blockedCount > 0) warnings.push('有数据已经产生业务关联，或需要人工判断，暂不能自动撤回。');
    if (summary.manualOnlyCount > 0) warnings.push('缺少导入前快照的记录，本次只生成处理清单。');
    if (summary.rollbackableCount > 0) {
      warnings.push('自动撤回只处理支持安全回退的数据：挂牌和成果会下架，成交记录会作废；新增技术经理人认证/主页会取消认证或隐藏，账号、更新类资料和专利主数据会保留在报告中人工处理。');
    }
    return {
      batch: batchDto,
      canRollback: summary.rollbackableCount > 0,
      summary,
      groups: Array.from(groupMap.values()),
      warnings,
      changes: evaluated.slice(0, 100),
    };
  }

  private async persistPreview(batch: any, evaluated: RollbackChangePreview[], updateBatchStatus: boolean) {
    for (const item of evaluated) {
      await this.prisma.importChangeLog.update({
        where: { id: item.changeId },
        data: {
          rollbackStatus: item.rollbackStatus as any,
          blockedReason: item.blockedReason || null,
          dependencyJson: item.dependency ? (item.dependency as Prisma.InputJsonValue) : undefined,
        },
      });
    }
    const rollbackableCount = evaluated.filter((item) => item.rollbackStatus === 'ROLLBACKABLE').length;
    const conflictedCount = evaluated.filter((item) => item.rollbackStatus === 'CONFLICTED').length;
    const blockedCount = evaluated.filter((item) => item.rollbackStatus === 'BLOCKED').length;
    const rolledBackCount = evaluated.filter((item) => item.rollbackStatus === 'ROLLED_BACK').length;
    await this.prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        rollbackableCount,
        conflictedCount,
        blockedCount,
        rolledBackCount,
        lastPrecheckedAt: new Date(),
        ...(updateBatchStatus && !ROLLBACK_FINISHED_STATUSES.has(batch.status as ImportBatchStatus)
          ? { status: 'ROLLBACK_PRECHECKED' as any }
          : {}),
      },
    });
  }

  private async buildRollbackPreview(req: any, batchId: string, opts: { persist: boolean; updateBatchStatus: boolean }): Promise<RollbackPreview> {
    const batch = await this.getBatchOrThrow(batchId);
    await this.ensureChangeLogsForBatch(batch);
    const latestBatch = await this.getBatchOrThrow(batchId);
    const changes = await this.prisma.importChangeLog.findMany({
      where: { batchId: latestBatch.id },
      orderBy: [{ rowNo: 'asc' }, { id: 'asc' }],
    });
    const evaluated = await this.evaluateChanges(latestBatch, changes);
    if (opts.persist) await this.persistPreview(latestBatch, evaluated, opts.updateBatchStatus);
    const userMap = await this.buildUserMap([latestBatch.operatorUserId]);
    return this.summarizePreview(
      this.toBatchDto(latestBatch, latestBatch.operatorUserId ? userMap.get(latestBatch.operatorUserId) : undefined),
      changes,
      evaluated,
    );
  }

  async rollbackPreview(req: any, batchId: string): Promise<RollbackPreview> {
    this.ensureAdmin(req);
    const preview = await this.buildRollbackPreview(req, batchId, { persist: true, updateBatchStatus: true });
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'IMPORT_BATCH_ROLLBACK_PREVIEW',
      targetType: 'IMPORT_BATCH',
      targetId: preview.batch.id,
      afterJson: {
        summary: preview.summary,
        groups: preview.groups,
      } as any,
    });
    return preview;
  }

  async listChanges(req: any, batchId: string, query: any): Promise<Paged<any>> {
    this.ensureAdmin(req);
    const batch = await this.getBatchOrThrow(batchId);
    await this.ensureChangeLogsForBatch(batch);
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query.pageSize, 'pageSize') : 50;
    const pageSize = Math.min(MAX_CHANGE_PAGE_SIZE, pageSizeInput);
    const rollbackStatus = this.parseRollbackStatus(query?.rollbackStatus);
    const where: any = { batchId: batch.id };
    if (rollbackStatus) where.rollbackStatus = rollbackStatus;
    const [items, total] = await Promise.all([
      this.prisma.importChangeLog.findMany({
        where,
        orderBy: [{ rowNo: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.importChangeLog.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        id: item.id,
        batchId: item.batchId,
        rowNo: item.rowNo,
        entityType: item.entityType,
        entityId: item.entityId,
        operation: item.operation,
        rollbackStrategy: item.rollbackStrategy,
        rollbackStatus: item.rollbackStatus,
        blockedReason: item.blockedReason,
        dependencyJson: item.dependencyJson,
        rolledBackAt: this.toIso(item.rolledBackAt),
        rollbackError: item.rollbackError,
        createdAt: this.toIso(item.createdAt),
        updatedAt: this.toIso(item.updatedAt),
      })),
      page: { page, pageSize, total },
    };
  }

  private parseRollbackOverride(body: any): { changeIds: string[]; reason: string } {
    const rawIds = Array.isArray(body?.overrideChangeIds) ? body.overrideChangeIds : [];
    const changeIds: string[] = [];
    const seen = new Set<string>();
    for (const raw of rawIds) {
      const id = this.parseUuidStrict(raw, 'overrideChangeIds');
      if (seen.has(id)) continue;
      seen.add(id);
      changeIds.push(id);
    }
    if (changeIds.length > 100) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'overrideChangeIds exceed limit' });
    }
    const reason = this.truncateText(body?.overrideReason, 500);
    if (changeIds.length > 0 && !reason) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'overrideReason is required' });
    }
    return { changeIds, reason };
  }

  private validateOverrideableChanges(preview: RollbackPreview, overrideChangeIds: string[]) {
    const requested = new Set(overrideChangeIds);
    if (!requested.size) return [];
    const map = new Map(preview.changes.map((item) => [item.changeId, item]));
    const invalid: string[] = [];
    const allowed: RollbackChangePreview[] = [];
    for (const changeId of requested) {
      const item = map.get(changeId);
      if (!item || !item.overrideable) {
        invalid.push(changeId);
        continue;
      }
      allowed.push(item);
    }
    if (invalid.length) {
      throw new ConflictException({
        code: 'IMPORT_BATCH_ROLLBACK_OVERRIDE_NOT_ALLOWED',
        message: 'some changes cannot be manually included in rollback',
        details: { changeIds: invalid },
      });
    }
    return allowed;
  }

  private validateRollbackConfirmation(batch: any, body: any) {
    const reason = this.truncateText(body?.reason, 500);
    if (!reason) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'reason is required' });
    const confirmationText = this.truncateText(body?.confirmationText, 200);
    const expected = String(batch.sourceBatch || batch.id).trim();
    if (!confirmationText || confirmationText !== expected) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'confirmationText must match batch name or id' });
    }
    return reason;
  }

  private rollbackReason(reason: string): string {
    return this.truncateText(`[批次撤回] ${reason}`, 500);
  }

  private async markChange(changeId: string, status: ImportRollbackStatus, fields: { error?: string; reason?: string } = {}) {
    await this.prisma.importChangeLog.update({
      where: { id: changeId },
      data: {
        rollbackStatus: status as any,
        blockedReason: fields.reason || undefined,
        rollbackError: fields.error || null,
        rolledBackAt: status === 'ROLLED_BACK' ? new Date() : undefined,
      },
    });
  }

  private async rollbackDealRecord(change: any, actorUserId: string, reason: string) {
    const record = change.entityId ? await this.prisma.dealRecord.findUnique({ where: { id: change.entityId } }) : null;
    if (!record) {
      await this.markChange(change.id, 'FAILED', { error: '成交记录不存在' });
      return;
    }
    if (record.status !== 'VOIDED') {
      await this.prisma.dealRecord.update({
        where: { id: record.id },
        data: {
          status: 'VOIDED' as any,
          voidedAt: new Date(),
          voidedByUserId: actorUserId,
          voidReason: this.rollbackReason(reason),
          updatedByUserId: actorUserId,
        },
      });
    }
    await this.markChange(change.id, 'ROLLED_BACK');
  }

  private async rollbackListing(change: any) {
    const listing = change.entityId ? await this.prisma.listing.findUnique({ where: { id: change.entityId } }) : null;
    if (!listing) {
      await this.markChange(change.id, 'FAILED', { error: '挂牌不存在' });
      return;
    }
    if (listing.status !== 'OFF_SHELF') {
      await this.prisma.listing.update({
        where: { id: listing.id },
        data: { status: 'OFF_SHELF' as any },
      });
    }
    await this.markChange(change.id, 'ROLLED_BACK');
  }

  private async rollbackAchievement(change: any) {
    const achievement = change.entityId ? await this.prisma.achievement.findUnique({ where: { id: change.entityId } }) : null;
    if (!achievement) {
      await this.markChange(change.id, 'FAILED', { error: '成果不存在' });
      return;
    }
    if (achievement.status !== 'OFF_SHELF') {
      await this.prisma.achievement.update({
        where: { id: achievement.id },
        data: { status: 'OFF_SHELF' as any },
      });
    }
    await this.markChange(change.id, 'ROLLED_BACK');
  }

  private async rollbackTechManagerVerification(change: any, actorUserId: string, reason: string) {
    const verification = change.entityId ? await this.prisma.userVerification.findUnique({ where: { id: change.entityId } }) : null;
    if (!verification) {
      await this.markChange(change.id, 'FAILED', { error: '经理人认证资料不存在' });
      return;
    }
    if (verification.verificationStatus !== 'REJECTED') {
      await this.prisma.userVerification.update({
        where: { id: verification.id },
        data: {
          verificationStatus: 'REJECTED' as any,
          reviewedAt: new Date(),
          reviewedById: actorUserId,
          reviewComment: this.rollbackReason(reason),
        },
      });
    }
    await this.markChange(change.id, 'ROLLED_BACK');
  }

  private async rollbackTechManagerProfile(change: any) {
    const profile = change.entityId ? await this.prisma.techManagerProfile.findUnique({ where: { userId: change.entityId } }) : null;
    if (!profile) {
      await this.markChange(change.id, 'FAILED', { error: '经理人主页资料不存在' });
      return;
    }
    await this.prisma.techManagerProfile.update({
      where: { userId: profile.userId },
      data: {
        featuredRank: null,
        featuredUntil: null,
      },
    });
    await this.markChange(change.id, 'ROLLED_BACK');
  }

  private async rollbackTechManagerBadge(change: any) {
    const badge = change.entityId ? await this.prisma.techManagerBadge.findUnique({ where: { id: change.entityId } }) : null;
    if (!badge) {
      await this.markChange(change.id, 'FAILED', { error: '经理人标签不存在' });
      return;
    }
    if (!badge.expiresAt) {
      await this.prisma.techManagerBadge.update({
        where: { id: badge.id },
        data: { expiresAt: new Date() },
      });
    }
    await this.markChange(change.id, 'ROLLED_BACK');
  }

  async rollbackBatch(req: any, batchId: string, body: any): Promise<RollbackPreview> {
    this.ensureAdmin(req);
    const batch = await this.getBatchOrThrow(batchId);
    if (batch.status === 'ROLLBACK_RUNNING') {
      throw new ConflictException({ code: 'CONFLICT', message: 'rollback is running' });
    }
    const actorUserId = this.parseUuidStrict(req?.auth?.userId, 'actorUserId');
    const reason = this.validateRollbackConfirmation(batch, body);
    const override = this.parseRollbackOverride(body);
    if (override.changeIds.length) {
      requirePermission(req, 'importBatch.rollbackOverride');
    }
    const preview = await this.buildRollbackPreview(req, batch.id, { persist: true, updateBatchStatus: false });
    const overrideChanges = this.validateOverrideableChanges(preview, override.changeIds);
    if (!preview.summary.rollbackableCount && !overrideChanges.length) {
      throw new ConflictException({ code: 'CONFLICT', message: 'no rollbackable changes' });
    }
    const rollbackReason = overrideChanges.length
      ? this.truncateText(`${reason}\n人工确认纳入撤回：${override.reason}`, 500)
      : reason;
    await this.prisma.importBatch.update({ where: { id: batch.id }, data: { status: 'ROLLBACK_RUNNING' as any } });

    const autoWhere = { batchId: batch.id, rollbackStatus: 'ROLLBACKABLE' as any };
    const changes = await this.prisma.importChangeLog.findMany({
      where: override.changeIds.length ? { batchId: batch.id, OR: [autoWhere, { id: { in: override.changeIds } }] } : autoWhere,
      orderBy: [{ rowNo: 'asc' }, { id: 'asc' }],
    });

    for (const change of changes) {
      try {
        if (change.entityType === 'DEAL_RECORD') await this.rollbackDealRecord(change, actorUserId, rollbackReason);
        else if (change.entityType === 'LISTING') await this.rollbackListing(change);
        else if (change.entityType === 'ACHIEVEMENT') await this.rollbackAchievement(change);
        else if (change.entityType === 'USER_VERIFICATION') await this.rollbackTechManagerVerification(change, actorUserId, rollbackReason);
        else if (change.entityType === 'TECH_MANAGER_PROFILE') await this.rollbackTechManagerProfile(change);
        else if (change.entityType === 'TECH_MANAGER_BADGE') await this.rollbackTechManagerBadge(change);
        else await this.markChange(change.id, 'FAILED', { error: '该数据类型不支持自动撤回' });
      } catch (error: any) {
        await this.markChange(change.id, 'FAILED', { error: error?.message || 'rollback failed' });
      }
    }

    const statusCounts = await this.prisma.importChangeLog.groupBy({
      by: ['rollbackStatus'],
      where: { batchId: batch.id },
      _count: { _all: true },
    });
    const countMap = new Map(statusCounts.map((item) => [String(item.rollbackStatus), Number(item._count._all || 0)]));
    const rolledBackCount = countMap.get('ROLLED_BACK') || 0;
    const failedCount = countMap.get('FAILED') || 0;
    const blockedCount = countMap.get('BLOCKED') || 0;
    const conflictedCount = countMap.get('CONFLICTED') || 0;
    const rollbackableCount = countMap.get('ROLLBACKABLE') || 0;
    const nextStatus: ImportBatchStatus =
      failedCount > 0 && rolledBackCount === 0
        ? 'ROLLBACK_FAILED'
        : failedCount > 0 || blockedCount > 0 || conflictedCount > 0 || rollbackableCount > 0
        ? 'PARTIALLY_ROLLED_BACK'
        : 'ROLLED_BACK';

    const updatedBatch = await this.prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: nextStatus as any,
        rollbackableCount,
        conflictedCount,
        blockedCount,
        rolledBackCount,
        rollbackAt: new Date(),
        rollbackReason,
        lastRollbackError: failedCount > 0 ? `${failedCount} 条撤回失败` : null,
      },
    });

    await this.audit.log({
      actorUserId,
      action: 'IMPORT_BATCH_ROLLBACK_EXECUTE',
      targetType: 'IMPORT_BATCH',
      targetId: batch.id,
      beforeJson: { status: batch.status } as any,
      afterJson: {
        status: updatedBatch.status,
        reason: rollbackReason,
        manualOverride: overrideChanges.length
          ? {
              changeIds: overrideChanges.map((item) => item.changeId),
              reason: override.reason,
            }
          : undefined,
        rolledBackCount,
        failedCount,
        blockedCount,
        conflictedCount,
      } as any,
    });

    return await this.buildRollbackPreview(req, batch.id, { persist: true, updateBatchStatus: false });
  }

  async getRollbackReport(req: any, batchId: string, query: any): Promise<Paged<any>> {
    this.ensureAdmin(req);
    const normalized = {
      ...query,
      pageSize: this.hasOwn(query, 'pageSize') ? query.pageSize : 500,
    };
    return await this.listChanges(req, batchId, normalized);
  }
}
